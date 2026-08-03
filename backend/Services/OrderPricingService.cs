using Microsoft.EntityFrameworkCore;
using RFC.Api.Data;
using RFC.Api.Models;

namespace RFC.Api.Services;

public sealed class OrderPricingService
{
    public const string ServiceUnavailableMessage = "Service temporarily unavailable. Please try again shortly.";

    private const decimal DeliveryFeeThreshold = 25.00m;
    private const decimal DeliveryFee = 2.50m;
    private const decimal DeliveryMinimumSpend = 15.00m;

    private static readonly IReadOnlyDictionary<string, decimal> OptionPriceMap =
        new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase)
        {
            ["Wedges"] = 0.80m,
            ["Wedges (+GBP0.80)"] = 0.80m,
            ["Pepsi 1.5L Bottle"] = 2.00m,
            ["Pepsi 1.5L (+GBP2.00)"] = 2.00m
        };

    private readonly RfcDbContext? _db;
    private readonly DeliveryRadiusService _deliveryRadius;
    private readonly ILogger<OrderPricingService> _logger;

    public OrderPricingService(IServiceProvider provider, DeliveryRadiusService deliveryRadius, ILogger<OrderPricingService> logger)
    {
        _db = provider.GetService<RfcDbContext>();
        _deliveryRadius = deliveryRadius;
        _logger = logger;
    }

    public async Task<OrderPricingResult> PriceAsync(Order order)
    {
        if (order.Items.Count == 0)
        {
            return OrderPricingResult.Fail("Order items cannot be empty.");
        }

        var menuItems = await GetMenuItemsAsync();
        if (menuItems == null)
        {
            return OrderPricingResult.Fail(ServiceUnavailableMessage);
        }

        var menuById = menuItems
            .Where(item => item.IsAvailable)
            .ToDictionary(item => item.Id, item => item, StringComparer.OrdinalIgnoreCase);

        var normalizedItems = new List<OrderItem>();
        var requestedStock = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        foreach (var requestedItem in order.Items)
        {
            if (requestedItem.Quantity is < 1 or > 20)
            {
                return OrderPricingResult.Fail("Item quantities must be between 1 and 20.");
            }

            var menuItemId = ResolveMenuItemId(requestedItem);
            if (string.IsNullOrWhiteSpace(menuItemId) || !menuById.TryGetValue(menuItemId, out var menuItem))
            {
                return OrderPricingResult.Fail("One or more menu items are unavailable. Please refresh the menu.");
            }

            requestedStock[menuItem.Id] = requestedStock.GetValueOrDefault(menuItem.Id) + requestedItem.Quantity;
            if (requestedStock[menuItem.Id] > menuItem.StockCount)
            {
                return OrderPricingResult.Fail($"{menuItem.Name} is currently out of stock.");
            }

            var unitPrice = RoundMoney(menuItem.Price + CalculateOptionTotal(requestedItem));
            normalizedItems.Add(new OrderItem
            {
                Id = menuItem.Id,
                Name = menuItem.Name,
                Item = menuItem,
                Quantity = requestedItem.Quantity,
                SelectedSide = CleanOption(requestedItem.SelectedSide),
                SelectedDrink = CleanOption(requestedItem.SelectedDrink),
                Notes = CleanOption(requestedItem.Notes),
                Options = requestedItem.Options.Select(CleanOption).OfType<string>().Where(option => !string.IsNullOrWhiteSpace(option)).ToList(),
                Price = unitPrice,
                UnitPrice = unitPrice
            });
        }

        var subtotal = RoundMoney(normalizedItems.Sum(item => item.UnitPrice * item.Quantity));
        if (order.OrderType == "delivery")
        {
            if (subtotal < DeliveryMinimumSpend)
            {
                return OrderPricingResult.Fail($"Delivery requires a minimum spend of GBP {DeliveryMinimumSpend:0.00}.");
            }

            var deliveryCheck = await _deliveryRadius.CheckAsync(order.DeliveryPostcode);
            if (!deliveryCheck.IsEligible)
            {
                return OrderPricingResult.Fail(deliveryCheck.Reason);
            }
        }

        var voucher = ValidateVoucher(order.VoucherCode, subtotal);
        if (!voucher.IsValid)
        {
            return OrderPricingResult.Fail(voucher.Message);
        }

        var discount = RoundMoney(voucher.DiscountPercent > 0 ? subtotal * voucher.DiscountPercent / 100m : 0m);
        var deliveryFee = order.OrderType == "delivery" && subtotal < DeliveryFeeThreshold ? DeliveryFee : 0m;
        var total = RoundMoney(subtotal - discount + deliveryFee);

        if (!MoneyMatches(order.Subtotal, subtotal) ||
            !MoneyMatches(order.DiscountAmount, discount) ||
            !MoneyMatches(order.DeliveryFee, deliveryFee) ||
            !MoneyMatches(order.Total, total))
        {
            _logger.LogWarning(
                "Rejected order with mismatched totals. Client subtotal {ClientSubtotal}, server subtotal {ServerSubtotal}, client total {ClientTotal}, server total {ServerTotal}",
                order.Subtotal,
                subtotal,
                order.Total,
                total);
            return OrderPricingResult.Fail("Order totals are invalid. Please refresh your basket and try again.");
        }

        order.Items = normalizedItems;
        order.Subtotal = subtotal;
        order.DiscountAmount = discount;
        order.DeliveryFee = deliveryFee;
        order.Total = total;
        order.VoucherCode = voucher.Code;
        order.PaymentStatus = order.PaymentMethod == "cash" ? "PayOnCollectionOrDelivery" : "Pending";

        return OrderPricingResult.Success(order);
    }

    private async Task<List<MenuItem>?> GetMenuItemsAsync()
    {
        if (_db == null) return null;

        try
        {
            var dbItems = await _db.MenuItems.AsNoTracking().ToListAsync();
            return dbItems.Count > 0 ? dbItems : null;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Menu lookup failed while pricing an order.");
            return null;
        }
    }

    private static string? ResolveMenuItemId(OrderItem item)
    {
        if (!string.IsNullOrWhiteSpace(item.Item?.Id)) return item.Item.Id;
        if (string.IsNullOrWhiteSpace(item.Id)) return null;

        var parts = item.Id.Split('-', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length >= 3 && long.TryParse(parts[^1], out _))
        {
            return string.Join('-', parts.Take(parts.Length - 1));
        }

        return item.Id;
    }

    private static decimal CalculateOptionTotal(OrderItem item)
    {
        var labels = new List<string>();
        if (!string.IsNullOrWhiteSpace(item.SelectedSide)) labels.Add(item.SelectedSide);
        if (!string.IsNullOrWhiteSpace(item.SelectedDrink)) labels.Add(item.SelectedDrink);
        labels.AddRange(item.Options.Where(option => !string.IsNullOrWhiteSpace(option)));

        return labels
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Sum(label => OptionPriceMap.TryGetValue(NormalizeOptionLabel(label), out var price) ? price : 0m);
    }

    private static string NormalizeOptionLabel(string value)
    {
        return value.Replace("GBP", "GBP", StringComparison.OrdinalIgnoreCase)
                    .Replace("£", "GBP", StringComparison.OrdinalIgnoreCase)
                    .Trim();
    }

    private static string? CleanOption(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        return RFC.Api.Security.InputSanitizer.Clean(value, 500);
    }

    private static VoucherValidation ValidateVoucher(string? code, decimal subtotal)
    {
        if (string.IsNullOrWhiteSpace(code)) return new(true, null, 0m, string.Empty);

        var clean = code.Trim().ToUpperInvariant();
        var voucher = SeedData.DefaultVouchers.FirstOrDefault(v => v.Code == clean && v.IsActive);
        if (voucher == null)
        {
            return new(false, clean, 0m, "Invalid voucher code.");
        }

        if (subtotal < voucher.MinSpend)
        {
            return new(false, clean, 0m, $"Code {clean} requires minimum spend of GBP {voucher.MinSpend:0.00}.");
        }

        return new(true, clean, voucher.DiscountPercent, string.Empty);
    }

    private static decimal RoundMoney(decimal value) => Math.Round(value, 2, MidpointRounding.AwayFromZero);

    private static bool MoneyMatches(decimal client, decimal server) => Math.Abs(RoundMoney(client) - server) <= 0.01m;
}

public sealed record OrderPricingResult(bool IsValid, string? Error, Order? Order)
{
    public static OrderPricingResult Success(Order order) => new(true, null, order);
    public static OrderPricingResult Fail(string error) => new(false, error, null);
}

public sealed record VoucherValidation(bool IsValid, string? Code, decimal DiscountPercent, string Message);
