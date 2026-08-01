using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using RFC.Api.Data;
using RFC.Api.Models;
using RFC.Api.Security;
using RFC.Api.Services;
using Stripe;

namespace RFC.Api.Controllers;

[ApiController]
[RequestSizeLimit(1_048_576)]
[Route("api/[controller]")]
public class OrdersController : ControllerBase
{
    private const string ServiceUnavailableMessage = "Service temporarily unavailable. Please try again shortly.";
    private const string OrderNumberAlphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

    private static readonly HashSet<string> CustomerCancellableStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        "Placed",
        "Preparing"
    };

    private readonly RfcDbContext? _db;
    private readonly OrderPricingService _pricing;
    private readonly GoogleMapsService _maps;
    private readonly NotificationService _notifications;
    private readonly IConfiguration _configuration;
    private readonly ILogger<OrdersController> _logger;

    public OrdersController(
        IServiceProvider provider,
        OrderPricingService pricing,
        GoogleMapsService maps,
        NotificationService notifications,
        IConfiguration configuration,
        ILogger<OrdersController> logger)
    {
        _db = provider.GetService<RfcDbContext>();
        _pricing = pricing;
        _maps = maps;
        _notifications = notifications;
        _configuration = configuration;
        _logger = logger;
    }

    [HttpPost]
    [EnableRateLimiting("order-write")]
    public async Task<IActionResult> CreateOrder([FromBody] Order order)
    {
        if (_db == null) return ServiceUnavailable();
        var cancellationToken = HttpContext.RequestAborted;

        try
        {
            order = SanitizeOrder(order);

            var openingHours = await ValidateOpeningHoursAsync();
            if (!openingHours.IsOpen)
            {
                return BadRequest(new { message = $"We are currently closed. Opening hours: {openingHours.HoursSummary}" });
            }

            var pricingResult = await _pricing.PriceAsync(order);
            if (!pricingResult.IsValid || pricingResult.Order == null)
            {
                if (pricingResult.Error == OrderPricingService.ServiceUnavailableMessage) return ServiceUnavailable();
                return BadRequest(new { message = pricingResult.Error });
            }

            var pricedOrder = pricingResult.Order;
            if (pricedOrder.PaymentMethod == "card")
            {
                var paymentCheck = await VerifyStripePaymentAsync(pricedOrder, cancellationToken);
                if (!paymentCheck.IsValid)
                {
                    return paymentCheck.IsServiceUnavailable
                        ? ServiceUnavailable()
                        : BadRequest(new { message = paymentCheck.Message });
                }

                pricedOrder.PaymentStatus = "Paid";
            }

            var now = DateTime.UtcNow;
            pricedOrder.Id = Guid.NewGuid().ToString("N");
            pricedOrder.OrderNumber = await GenerateUniqueOrderNumberAsync();
            pricedOrder.CreatedAt = now;
            pricedOrder.OrderStatus = "Placed";
            pricedOrder.OrderTime = string.IsNullOrWhiteSpace(pricedOrder.OrderTime)
                ? now.ToString("dd MMM yyyy, HH:mm:ss")
                : pricedOrder.OrderTime;

            if (pricedOrder.OrderType == "delivery")
            {
                var location = await _maps.GeocodePostcodeAsync(pricedOrder.DeliveryPostcode, HttpContext.RequestAborted);
                if (location != null)
                {
                    pricedOrder.DeliveryLat = location.Lat;
                    pricedOrder.DeliveryLng = location.Lng;
                    pricedOrder.EtaMinutes = await _maps.GetEtaMinutesAsync(location.Lat, location.Lng, HttpContext.RequestAborted);
                }
            }

            await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
            var stockCheck = await DecrementStockAsync(pricedOrder);
            if (!stockCheck.IsValid)
            {
                await transaction.RollbackAsync(cancellationToken);
                return BadRequest(new { message = stockCheck.Message });
            }

            _db.Orders.Add(ToDbOrder(pricedOrder));
            await _db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            _notifications.SendOrderPlacedInBackground(pricedOrder);
            return Ok(pricedOrder);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create order.");
            return ServiceUnavailable();
        }
    }

    [HttpGet("{idOrNumber}")]
    public async Task<IActionResult> GetOrder(string idOrNumber)
    {
        if (_db == null) return ServiceUnavailable();

        try
        {
            var clean = InputSanitizer.Clean(idOrNumber, 80);
            var dbOrder = await _db.Orders.AsNoTracking().FirstOrDefaultAsync(
                o => o.Id == clean || o.OrderNumber == clean,
                HttpContext.RequestAborted);
            return dbOrder != null ? Ok(MapToOrderDto(dbOrder)) : NotFound(new { message = "Order not found" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to load order {OrderIdOrNumber}", idOrNumber);
            return ServiceUnavailable();
        }
    }

    [HttpPut("{idOrNumber}/cancel")]
    [EnableRateLimiting("order-write")]
    public async Task<IActionResult> CancelOrder(string idOrNumber, [FromBody] CancelOrderRequest request)
    {
        if (_db == null) return ServiceUnavailable();
        var cancellationToken = HttpContext.RequestAborted;

        try
        {
            var cleanId = InputSanitizer.Clean(idOrNumber, 80);
            var dbOrder = await _db.Orders.FirstOrDefaultAsync(
                o => o.Id == cleanId || o.OrderNumber == cleanId,
                cancellationToken);
            if (dbOrder == null) return NotFound(new { message = "Order not found" });
            if (!CustomerCancellableStatuses.Contains(dbOrder.OrderStatus))
            {
                return Conflict(new { message = "This order can no longer be cancelled online." });
            }

            if (dbOrder.PaymentMethod == "card" && dbOrder.PaymentStatus == "Paid")
            {
                var refundCheck = await RefundStripePaymentAsync(dbOrder, cancellationToken);
                if (!refundCheck.IsValid)
                {
                    return refundCheck.IsServiceUnavailable
                        ? ServiceUnavailable()
                        : BadRequest(new { message = refundCheck.Message });
                }
            }

            await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
            dbOrder.OrderStatus = "Cancelled";
            dbOrder.CancellationReason = InputSanitizer.Clean(request.Reason, 500);
            await RestoreStockAsync(dbOrder);
            await _db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            _notifications.SendCancellationEmailInBackground(dbOrder, dbOrder.CancellationReason);
            return Ok(MapToOrderDto(dbOrder));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to cancel order {OrderIdOrNumber}", idOrNumber);
            return ServiceUnavailable();
        }
    }

    public static Order MapToOrderDto(DbOrder dbOrder)
    {
        List<OrderItem> items = new();
        try
        {
            items = JsonSerializer.Deserialize<List<OrderItem>>(dbOrder.ItemsJson, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            }) ?? new();
        }
        catch
        {
            items = new();
        }

        return new Order
        {
            Id = dbOrder.Id,
            OrderNumber = dbOrder.OrderNumber,
            OrderType = dbOrder.OrderType,
            CustomerName = dbOrder.CustomerName,
            CustomerPhone = dbOrder.CustomerPhone,
            CustomerEmail = dbOrder.CustomerEmail,
            DeliveryAddress = dbOrder.DeliveryAddress,
            DeliveryPostcode = dbOrder.DeliveryPostcode,
            DeliveryNotes = dbOrder.DeliveryNotes,
            Items = items,
            Subtotal = dbOrder.Subtotal,
            DiscountAmount = dbOrder.DiscountAmount,
            DeliveryFee = dbOrder.DeliveryFee,
            Total = dbOrder.Total,
            VoucherCode = dbOrder.VoucherCode,
            PaymentMethod = dbOrder.PaymentMethod,
            PaymentStatus = dbOrder.PaymentStatus,
            OrderStatus = dbOrder.OrderStatus,
            OrderTime = dbOrder.OrderTime,
            CancellationReason = dbOrder.CancellationReason,
            StripePaymentIntentId = dbOrder.StripePaymentIntentId,
            DeliveryLat = dbOrder.DeliveryLat,
            DeliveryLng = dbOrder.DeliveryLng,
            EtaMinutes = dbOrder.EtaMinutes,
            DriverId = dbOrder.DriverId,
            CreatedAt = dbOrder.CreatedAt
        };
    }

    internal static DbOrder ToDbOrder(Order order)
    {
        return new DbOrder
        {
            Id = order.Id,
            OrderNumber = order.OrderNumber,
            OrderType = order.OrderType,
            CustomerName = order.CustomerName,
            CustomerPhone = order.CustomerPhone,
            CustomerEmail = order.CustomerEmail,
            DeliveryAddress = order.DeliveryAddress,
            DeliveryPostcode = order.DeliveryPostcode,
            DeliveryNotes = order.DeliveryNotes,
            ItemsJson = JsonSerializer.Serialize(order.Items),
            Subtotal = order.Subtotal,
            DiscountAmount = order.DiscountAmount,
            DeliveryFee = order.DeliveryFee,
            Total = order.Total,
            VoucherCode = order.VoucherCode,
            PaymentMethod = order.PaymentMethod,
            PaymentStatus = order.PaymentStatus,
            OrderStatus = order.OrderStatus,
            OrderTime = order.OrderTime,
            CancellationReason = order.CancellationReason,
            StripePaymentIntentId = order.StripePaymentIntentId,
            DeliveryLat = order.DeliveryLat,
            DeliveryLng = order.DeliveryLng,
            EtaMinutes = order.EtaMinutes,
            DriverId = order.DriverId,
            CreatedAt = order.CreatedAt
        };
    }

    private async Task<string> GenerateUniqueOrderNumberAsync()
    {
        if (_db == null) throw new InvalidOperationException("Database is unavailable.");

        for (var attempt = 0; attempt < 12; attempt++)
        {
            var orderNumber = $"RFC-{CreateOrderCode()}";
            if (!await _db.Orders.AnyAsync(order => order.OrderNumber == orderNumber, HttpContext.RequestAborted))
            {
                return orderNumber;
            }
        }

        throw new InvalidOperationException("Could not generate a unique order number.");
    }

    private static string CreateOrderCode()
    {
        Span<byte> bytes = stackalloc byte[8];
        RandomNumberGenerator.Fill(bytes);
        var chars = new char[8];
        for (var i = 0; i < chars.Length; i++)
        {
            chars[i] = OrderNumberAlphabet[bytes[i] % OrderNumberAlphabet.Length];
        }

        return new string(chars);
    }

    private async Task<StockCheck> DecrementStockAsync(Order order)
    {
        if (_db == null) return new StockCheck(false, ServiceUnavailableMessage);

        foreach (var group in order.Items.GroupBy(item => item.Id, StringComparer.OrdinalIgnoreCase))
        {
            if (string.IsNullOrWhiteSpace(group.Key)) return new StockCheck(false, "One or more menu items are unavailable.");

            var menuItem = await _db.MenuItems.FirstOrDefaultAsync(item => item.Id == group.Key, HttpContext.RequestAborted);
            var requested = group.Sum(item => item.Quantity);
            if (menuItem == null || menuItem.StockCount < requested)
            {
                return new StockCheck(false, $"{group.First().Name} is currently out of stock.");
            }

            menuItem.StockCount -= requested;
        }

        return new StockCheck(true, string.Empty);
    }

    private async Task RestoreStockAsync(DbOrder order)
    {
        if (_db == null) return;

        var items = MapToOrderDto(order).Items;
        foreach (var group in items.GroupBy(item => item.Id, StringComparer.OrdinalIgnoreCase))
        {
            if (string.IsNullOrWhiteSpace(group.Key)) continue;
            var menuItem = await _db.MenuItems.FirstOrDefaultAsync(item => item.Id == group.Key, HttpContext.RequestAborted);
            if (menuItem != null) menuItem.StockCount += group.Sum(item => item.Quantity);
        }
    }

    private async Task<OpeningHoursResult> ValidateOpeningHoursAsync()
    {
        if (_db == null) return new OpeningHoursResult(false, "Unavailable");

        var setting = await _db.StoreSettings.AsNoTracking().FirstOrDefaultAsync(
            item => item.Key == "OpeningHours",
            HttpContext.RequestAborted);
        if (setting == null || string.IsNullOrWhiteSpace(setting.Value))
        {
            return new OpeningHoursResult(true, "Opening hours unavailable");
        }

        var londonNow = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, GetLondonTimeZone());
        using var doc = JsonDocument.Parse(setting.Value);
        var dayName = londonNow.DayOfWeek.ToString();
        if (!doc.RootElement.TryGetProperty(dayName, out var day))
        {
            return new OpeningHoursResult(false, BuildHoursSummary(doc.RootElement));
        }

        var open = TimeOnly.Parse(day.GetProperty("open").GetString() ?? "00:00");
        var close = TimeOnly.Parse(day.GetProperty("close").GetString() ?? "00:00");
        var current = TimeOnly.FromDateTime(londonNow);
        var isOpen = close > open
            ? current >= open && current <= close
            : current >= open || current <= close;

        return new OpeningHoursResult(isOpen, BuildHoursSummary(doc.RootElement));
    }

    private static string BuildHoursSummary(JsonElement root)
    {
        return string.Join(", ", root.EnumerateObject().Select(day =>
        {
            var open = day.Value.GetProperty("open").GetString();
            var close = day.Value.GetProperty("close").GetString();
            return $"{day.Name[..3]} {open}-{close}";
        }));
    }

    private static TimeZoneInfo GetLondonTimeZone()
    {
        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById("Europe/London");
        }
        catch (TimeZoneNotFoundException)
        {
            return TimeZoneInfo.FindSystemTimeZoneById("GMT Standard Time");
        }
    }

    private async Task<PaymentCheck> VerifyStripePaymentAsync(Order order, CancellationToken cancellationToken)
    {
        var secretKey = _configuration["Stripe:SecretKey"];
        if (string.IsNullOrWhiteSpace(secretKey) || string.IsNullOrWhiteSpace(order.StripePaymentIntentId))
        {
            return new PaymentCheck(false, true, "Card payment is temporarily unavailable.");
        }

        try
        {
            StripeConfiguration.ApiKey = secretKey;
            var service = new PaymentIntentService();
            var intent = await service.GetAsync(order.StripePaymentIntentId, requestOptions: null, cancellationToken: cancellationToken);
            var expectedAmount = (long)Math.Round(order.Total * 100m, MidpointRounding.AwayFromZero);
            if (intent.Status != "succeeded" ||
                intent.Currency != "gbp" ||
                intent.AmountReceived < expectedAmount)
            {
                return new PaymentCheck(false, false, "Card payment was not confirmed.");
            }

            return new PaymentCheck(true, false, string.Empty);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Stripe payment verification failed for {PaymentIntentId}", order.StripePaymentIntentId);
            return new PaymentCheck(false, true, "Card payment is temporarily unavailable.");
        }
    }

    private async Task<PaymentCheck> RefundStripePaymentAsync(DbOrder order, CancellationToken cancellationToken)
    {
        var secretKey = _configuration["Stripe:SecretKey"];
        if (string.IsNullOrWhiteSpace(secretKey) || string.IsNullOrWhiteSpace(order.StripePaymentIntentId))
        {
            return new PaymentCheck(false, true, "Card refund is temporarily unavailable.");
        }

        try
        {
            StripeConfiguration.ApiKey = secretKey;
            var service = new RefundService();
            var refund = await service.CreateAsync(new RefundCreateOptions
            {
                PaymentIntent = order.StripePaymentIntentId,
                Reason = "requested_by_customer"
            }, requestOptions: null, cancellationToken: cancellationToken);

            if (refund.Status is "succeeded" or "pending")
            {
                order.PaymentStatus = "Refunded";
                return new PaymentCheck(true, false, string.Empty);
            }

            return new PaymentCheck(false, false, "Card refund could not be confirmed.");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Stripe refund failed for {PaymentIntentId}", order.StripePaymentIntentId);
            return new PaymentCheck(false, true, "Card refund is temporarily unavailable.");
        }
    }

    private static Order SanitizeOrder(Order order)
    {
        order.CustomerName = InputSanitizer.Clean(order.CustomerName, 100);
        order.CustomerPhone = InputSanitizer.Clean(order.CustomerPhone, 30);
        order.CustomerEmail = InputSanitizer.Clean(order.CustomerEmail, 120).ToLowerInvariant();
        order.DeliveryAddress = InputSanitizer.Clean(order.DeliveryAddress, 400);
        order.DeliveryPostcode = InputSanitizer.Clean(order.DeliveryPostcode, 20).ToUpperInvariant();
        order.DeliveryNotes = InputSanitizer.Clean(order.DeliveryNotes, 500);
        order.VoucherCode = InputSanitizer.CleanNullable(order.VoucherCode, 50);
        order.PaymentMethod = order.PaymentMethod == "cash" ? "cash" : "card";
        order.StripePaymentIntentId = InputSanitizer.CleanNullable(order.StripePaymentIntentId, 200);
        return order;
    }

    private ObjectResult ServiceUnavailable()
    {
        return StatusCode(StatusCodes.Status503ServiceUnavailable, new { message = ServiceUnavailableMessage });
    }
}

internal sealed record StockCheck(bool IsValid, string Message);
internal sealed record OpeningHoursResult(bool IsOpen, string HoursSummary);
internal sealed record PaymentCheck(bool IsValid, bool IsServiceUnavailable, string Message);
