using System.Security.Cryptography;
using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using RFC.Api.Data;
using RFC.Api.Models;
using RFC.Api.Security;
using RFC.Api.Services;

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
    private readonly AuditService? _audit;
    private readonly OrderPricingService _pricing;
    private readonly GoogleMapsService _maps;
    private readonly NotificationService _notifications;
    private readonly OrderAccessService _orderAccess;
    private readonly IPaymentGateway _payments;
    private readonly ILogger<OrdersController> _logger;

    public OrdersController(
        IServiceProvider provider,
        OrderPricingService pricing,
        GoogleMapsService maps,
        NotificationService notifications,
        OrderAccessService orderAccess,
        IPaymentGateway payments,
        ILogger<OrdersController> logger)
    {
        _db = provider.GetService<RfcDbContext>();
        _audit = provider.GetService<AuditService>();
        _pricing = pricing;
        _maps = maps;
        _notifications = notifications;
        _orderAccess = orderAccess;
        _payments = payments;
        _logger = logger;
    }

    [HttpPost]
    [EnableRateLimiting("order-write")]
    public async Task<IActionResult> CreateOrder([FromBody] Order order)
    {
        if (_db == null) return ServiceUnavailable();
        var cancellationToken = HttpContext.RequestAborted;
        Order? paidOrderPendingPersistence = null;
        var orderPersisted = false;

        try
        {
            order = SanitizeOrder(order);
            string? authenticatedCustomerId = null;
            if (order.PaymentMethod == "card")
            {
                authenticatedCustomerId = GetAuthenticatedCustomerId();
                if (string.IsNullOrWhiteSpace(authenticatedCustomerId))
                {
                    return Unauthorized(new { message = "Sign in before paying by card." });
                }

                if (!Guid.TryParse(order.CheckoutId, out var checkoutGuid))
                {
                    return BadRequest(new { message = "A valid checkout id is required for card payment." });
                }
                if (string.IsNullOrWhiteSpace(order.StripePaymentIntentId))
                {
                    return BadRequest(new { message = "A confirmed card payment is required." });
                }

                order.CheckoutId = checkoutGuid.ToString("N");
                var existingPaymentOrder = await _db.Orders.AsNoTracking().FirstOrDefaultAsync(
                    existing => existing.StripePaymentIntentId == order.StripePaymentIntentId ||
                                existing.CheckoutId == order.CheckoutId,
                    cancellationToken);
                if (existingPaymentOrder != null)
                {
                    if (existingPaymentOrder.CustomerId == authenticatedCustomerId)
                    {
                        return Ok(MapToOrderDto(existingPaymentOrder));
                    }

                    return Conflict(new { message = "This card payment has already been used for an order." });
                }
            }

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
                var paymentCheck = await _payments.VerifyPaymentIntentAsync(
                    pricedOrder.StripePaymentIntentId,
                    pricedOrder.Total,
                    authenticatedCustomerId!,
                    pricedOrder.CheckoutId!,
                    cancellationToken);
                if (!paymentCheck.IsValid)
                {
                    if (paymentCheck.ShouldCompensate)
                    {
                        var compensation = await CompensateUnpersistedPaymentAsync(
                            pricedOrder,
                            "checkout-verification-mismatch",
                            cancellationToken);
                        if (!compensation.IsValid) return ServiceUnavailable();

                        return Conflict(new
                        {
                            message = "The completed card payment no longer matched this checkout and has been refunded. Please refresh your basket and try again."
                        });
                    }

                    return paymentCheck.IsServiceUnavailable
                        ? ServiceUnavailable()
                        : BadRequest(new { message = paymentCheck.Message });
                }

                pricedOrder.PaymentStatus = "Paid";
                paidOrderPendingPersistence = pricedOrder;
            }

            var now = DateTime.UtcNow;
            pricedOrder.Id = Guid.NewGuid().ToString("N");
            pricedOrder.OrderNumber = await GenerateUniqueOrderNumberAsync();
            pricedOrder.CreatedAt = now;
            pricedOrder.OrderStatus = "Placed";
            pricedOrder.OrderTime = now.ToString("dd MMM yyyy, HH:mm:ss");
            pricedOrder.AccessToken = OrderAccessService.CreateAccessToken();

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
            if (pricedOrder.PaymentMethod == "card")
            {
                if (_db.Database.IsRelational())
                {
                    // Serialise finalisation for a checkout before relying on the
                    // unique indexes. Without this lock, a concurrent loser could
                    // refund a payment already committed by the winning request.
                    await _db.Database.ExecuteSqlInterpolatedAsync(
                        $"SELECT pg_advisory_xact_lock(hashtextextended({pricedOrder.CheckoutId!}, 0));",
                        cancellationToken);
                }

                var concurrentlyPersistedOrder = await _db.Orders.AsNoTracking().FirstOrDefaultAsync(
                    existing => existing.StripePaymentIntentId == pricedOrder.StripePaymentIntentId ||
                                existing.CheckoutId == pricedOrder.CheckoutId,
                    cancellationToken);
                if (concurrentlyPersistedOrder != null)
                {
                    if (concurrentlyPersistedOrder.CustomerId == authenticatedCustomerId)
                    {
                        return Ok(MapToOrderDto(concurrentlyPersistedOrder));
                    }

                    return Conflict(new { message = "This card payment has already been used for an order." });
                }
            }

            var stockCheck = await DecrementStockAsync(pricedOrder);
            if (!stockCheck.IsValid)
            {
                await transaction.RollbackAsync(cancellationToken);
                if (paidOrderPendingPersistence != null)
                {
                    var refund = await CompensateUnpersistedPaymentAsync(
                        paidOrderPendingPersistence,
                        "stock-unavailable",
                        cancellationToken);
                    if (!refund.IsValid) return ServiceUnavailable();

                    return Conflict(new
                    {
                        message = "Stock changed during checkout. The card payment has been refunded; no order was placed."
                    });
                }

                return BadRequest(new { message = stockCheck.Message });
            }

            var dbOrder = ToDbOrder(pricedOrder);
            dbOrder.CustomerId = GetAuthenticatedCustomerId();
            dbOrder.OrderAccessTokenHash = OrderAccessService.HashAccessToken(pricedOrder.AccessToken);
            dbOrder.OrderAccessTokenExpiresAt = now.Add(OrderAccessService.GuestAccessTokenLifetime);
            _db.Orders.Add(dbOrder);
            if (string.Equals(pricedOrder.VoucherCode, "FIRST10", StringComparison.OrdinalIgnoreCase) &&
                !string.IsNullOrWhiteSpace(dbOrder.CustomerId))
            {
                _db.VoucherRedemptions.Add(new VoucherRedemption
                {
                    Id = Guid.NewGuid().ToString("N"),
                    Code = "FIRST10",
                    CustomerId = dbOrder.CustomerId,
                    OrderId = dbOrder.Id,
                    RedeemedAt = now
                });
            }

            await _db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            orderPersisted = true;

            await _notifications.SendOrderPlacedAsync(pricedOrder);
            pricedOrder.StripePaymentIntentId = null;
            pricedOrder.CheckoutId = null;
            return Ok(pricedOrder);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create order.");
            if (paidOrderPendingPersistence != null && !orderPersisted)
            {
                var refund = await CompensateUnpersistedPaymentAsync(
                    paidOrderPendingPersistence,
                    "order-persistence-failed",
                    CancellationToken.None);
                if (!refund.IsValid)
                {
                    _logger.LogCritical(
                        "Manual reconciliation required for payment {PaymentIntentId}; order persistence and automatic refund both failed.",
                        paidOrderPendingPersistence.StripePaymentIntentId);
                }
            }

            return ServiceUnavailable();
        }
    }

    [HttpGet("{idOrNumber}")]
    [EnableRateLimiting("order-read")]
    public async Task<IActionResult> GetOrder(string idOrNumber)
    {
        if (_db == null) return ServiceUnavailable();

        try
        {
            var clean = InputSanitizer.Clean(idOrNumber, 80);
            var dbOrder = await _db.Orders.AsNoTracking().FirstOrDefaultAsync(
                o => o.Id == clean || o.OrderNumber == clean,
                HttpContext.RequestAborted);
            if (dbOrder == null) return NotFound(new { message = "Order not found" });

            var accessToken = OrderAccessService.GetAccessToken(Request);
            if (!_orderAccess.HasAccess(dbOrder, User, accessToken))
            {
                await _orderAccess.AuditDeniedAsync("OrderReadDenied", dbOrder, accessToken, "ownership proof failed");
                return NotFound(new { message = "Order not found." });
            }

            return Ok(MapToOrderDto(dbOrder));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to load order {OrderIdOrNumber}", idOrNumber);
            return ServiceUnavailable();
        }
    }

    [HttpGet("{idOrNumber}/eta")]
    [EnableRateLimiting("order-read")]
    public async Task<IActionResult> RefreshEta(string idOrNumber)
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

            var accessToken = OrderAccessService.GetAccessToken(Request);
            if (!_orderAccess.HasAccess(dbOrder, User, accessToken))
            {
                await _orderAccess.AuditDeniedAsync("OrderEtaRefreshDenied", dbOrder, accessToken, "ownership proof failed");
                return NotFound(new { message = "Order not found." });
            }

            if (dbOrder.OrderType == "delivery" &&
                dbOrder.OrderStatus == "Out for Delivery" &&
                dbOrder.DeliveryLat != null &&
                dbOrder.DeliveryLng != null)
            {
                var eta = await _maps.GetEtaMinutesAsync(dbOrder.DeliveryLat.Value, dbOrder.DeliveryLng.Value, cancellationToken);
                if (eta != null)
                {
                    dbOrder.EtaMinutes = eta;
                    await _db.SaveChangesAsync(cancellationToken);
                }
            }

            return Ok(new
            {
                etaMinutes = dbOrder.EtaMinutes,
                estimatedAt = DateTime.UtcNow,
                isLiveDriverTracking = false
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to refresh ETA for order {OrderIdOrNumber}", idOrNumber);
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

            var accessToken = OrderAccessService.GetAccessToken(Request);
            if (!_orderAccess.HasAccess(dbOrder, User, accessToken))
            {
                await _orderAccess.AuditDeniedAsync("OrderCancelDenied", dbOrder, accessToken, "ownership proof failed");
                return NotFound(new { message = "Order not found." });
            }

            if (!CustomerCancellableStatuses.Contains(dbOrder.OrderStatus))
            {
                return Conflict(new { message = "This order can no longer be cancelled online." });
            }

            var oldStatus = dbOrder.OrderStatus;
            var oldPaymentStatus = dbOrder.PaymentStatus;
            if (!await TryReserveCancellationAsync(dbOrder, oldStatus, cancellationToken))
            {
                return Conflict(new { message = "This order changed while the cancellation was being processed. Refresh and try again." });
            }

            if (dbOrder.PaymentMethod == "card" && dbOrder.PaymentStatus == "Paid")
            {
                var refundCheck = await RefundStripePaymentAsync(dbOrder, cancellationToken);
                if (!refundCheck.IsValid)
                {
                    await RestoreCancellationReservationAsync(dbOrder, oldStatus, oldPaymentStatus, cancellationToken);
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

            if (_audit != null)
            {
                await _audit.LogAsync(
                    "CustomerCancelOrder",
                    "Order",
                    dbOrder.Id,
                    new { orderStatus = oldStatus, paymentStatus = oldPaymentStatus },
                    new { orderStatus = dbOrder.OrderStatus, paymentStatus = dbOrder.PaymentStatus, reason = dbOrder.CancellationReason });
            }

            await _notifications.SendCancellationEmailAsync(dbOrder, dbOrder.CancellationReason);
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
            StripePaymentIntentId = null,
            CheckoutId = null,
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
            CheckoutId = order.CheckoutId,
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

            var requested = group.Sum(item => item.Quantity);
            if (_db.Database.IsRelational())
            {
                var updated = await _db.MenuItems
                    .Where(item => item.Id == group.Key && item.IsAvailable && item.StockCount >= requested)
                    .ExecuteUpdateAsync(setters => setters
                        .SetProperty(item => item.StockCount, item => item.StockCount - requested),
                        HttpContext.RequestAborted);
                if (updated != 1)
                {
                    return new StockCheck(false, $"{group.First().Name} is currently out of stock.");
                }

                continue;
            }

            var menuItem = await _db.MenuItems.FirstOrDefaultAsync(item => item.Id == group.Key, HttpContext.RequestAborted);
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
            var quantity = group.Sum(item => item.Quantity);
            if (_db.Database.IsRelational())
            {
                await _db.MenuItems
                    .Where(item => item.Id == group.Key)
                    .ExecuteUpdateAsync(setters => setters
                        .SetProperty(item => item.StockCount, item => item.StockCount + quantity),
                        HttpContext.RequestAborted);
                continue;
            }

            var menuItem = await _db.MenuItems.FirstOrDefaultAsync(item => item.Id == group.Key, HttpContext.RequestAborted);
            if (menuItem != null) menuItem.StockCount += quantity;
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

    private async Task<PaymentGatewayResult> RefundStripePaymentAsync(DbOrder order, CancellationToken cancellationToken)
    {
        var result = await _payments.RefundPaymentIntentAsync(
            order.StripePaymentIntentId,
            $"rfc-order-refund:{order.Id}",
            cancellationToken);
        if (result.IsValid)
        {
            order.PaymentStatus = "Refunded";
            return result;
        }

        if (_audit != null)
        {
            await _audit.LogAsync(
                "StripeRefundFailed",
                "Order",
                order.Id,
                null,
                new
                {
                    order.OrderNumber,
                    order.StripePaymentIntentId,
                    result.Message,
                    result.IsServiceUnavailable
                });
        }

        return result;
    }

    private async Task<PaymentGatewayResult> CompensateUnpersistedPaymentAsync(
        Order order,
        string reason,
        CancellationToken cancellationToken)
    {
        var checkoutId = order.CheckoutId ?? order.StripePaymentIntentId ?? Guid.NewGuid().ToString("N");
        var result = await _payments.RefundPaymentIntentAsync(
            order.StripePaymentIntentId,
            $"rfc-checkout-refund:{checkoutId}",
            cancellationToken);

        if (!result.IsValid && _audit != null)
        {
            await _audit.LogAsync(
                "CheckoutCompensationFailed",
                "PaymentIntent",
                order.StripePaymentIntentId,
                null,
                new { reason, result.Message, result.IsServiceUnavailable });
        }

        return result;
    }

    private async Task<bool> TryReserveCancellationAsync(
        DbOrder order,
        string expectedStatus,
        CancellationToken cancellationToken)
    {
        const string pendingStatus = "Cancellation Pending";
        if (_db == null) return false;

        if (_db.Database.IsRelational())
        {
            var updated = await _db.Orders
                .Where(item => item.Id == order.Id && item.OrderStatus == expectedStatus)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(item => item.OrderStatus, pendingStatus),
                    cancellationToken);
            if (updated != 1) return false;
            order.OrderStatus = pendingStatus;
            return true;
        }

        order.OrderStatus = pendingStatus;
        await _db.SaveChangesAsync(cancellationToken);
        return true;
    }

    private async Task RestoreCancellationReservationAsync(
        DbOrder order,
        string originalStatus,
        string originalPaymentStatus,
        CancellationToken cancellationToken)
    {
        if (_db == null) return;

        if (_db.Database.IsRelational())
        {
            await _db.Orders
                .Where(item => item.Id == order.Id && item.OrderStatus == "Cancellation Pending")
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(item => item.OrderStatus, originalStatus)
                    .SetProperty(item => item.PaymentStatus, originalPaymentStatus),
                    cancellationToken);
        }
        else
        {
            order.OrderStatus = originalStatus;
            order.PaymentStatus = originalPaymentStatus;
            await _db.SaveChangesAsync(cancellationToken);
        }

        order.OrderStatus = originalStatus;
        order.PaymentStatus = originalPaymentStatus;
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
        order.StripePaymentIntentId = order.PaymentMethod == "card"
            ? InputSanitizer.CleanNullable(order.StripePaymentIntentId, 200)
            : null;
        order.CheckoutId = order.PaymentMethod == "card"
            ? InputSanitizer.CleanNullable(order.CheckoutId, 80)
            : null;
        return order;
    }

    private string? GetAuthenticatedCustomerId()
    {
        return User.Identity?.IsAuthenticated == true && User.IsInRole("customer")
            ? User.FindFirstValue(ClaimTypes.NameIdentifier)
            : null;
    }

    private ObjectResult ServiceUnavailable()
    {
        return StatusCode(StatusCodes.Status503ServiceUnavailable, new { message = ServiceUnavailableMessage });
    }
}

internal sealed record StockCheck(bool IsValid, string Message);
internal sealed record OpeningHoursResult(bool IsOpen, string HoursSummary);
