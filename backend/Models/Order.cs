namespace RFC.Api.Models;

public class OrderItem
{
    public MenuItem Item { get; set; } = new();
    public int Quantity { get; set; }
    public string? SelectedSide { get; set; }
    public string? SelectedDrink { get; set; }
    public decimal UnitPrice { get; set; }
}

public class Order
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string OrderNumber { get; set; } = string.Empty;
    public string OrderType { get; set; } = "delivery";
    public string CustomerName { get; set; } = string.Empty;
    public string CustomerPhone { get; set; } = string.Empty;
    public string CustomerEmail { get; set; } = string.Empty;
    public string DeliveryAddress { get; set; } = string.Empty;
    public string DeliveryPostcode { get; set; } = string.Empty;
    public string DeliveryNotes { get; set; } = string.Empty;
    public string ScheduledTime { get; set; } = "ASAP";
    public List<OrderItem> Items { get; set; } = new();
    public decimal Subtotal { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal DeliveryFee { get; set; }
    public decimal Total { get; set; }
    public string? VoucherCode { get; set; }
    public string PaymentMethod { get; set; } = "card";
    public string PaymentStatus { get; set; } = "Paid";
    public string OrderStatus { get; set; } = "Placed";
    public string OrderTime { get; set; } = string.Empty;
    public string? CancellationReason { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class UpdateOrderStatusDto
{
    public string Status { get; set; } = string.Empty;
}
