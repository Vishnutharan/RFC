namespace RFC.Api.Models;

using System.ComponentModel.DataAnnotations;

public class OrderItem
{
    public string? Id { get; set; }

    [MaxLength(180)]
    public string Name { get; set; } = string.Empty;

    public MenuItem? Item { get; set; }

    [Range(1, 20)]
    public int Quantity { get; set; }

    [MaxLength(80)]
    public string? SelectedSide { get; set; }

    [MaxLength(80)]
    public string? SelectedDrink { get; set; }

    [MaxLength(500)]
    public string? Notes { get; set; }

    public List<string> Options { get; set; } = new();

    [Range(0, 500)]
    public decimal Price { get; set; }

    [Range(0, 500)]
    public decimal UnitPrice { get; set; }
}

public class Order
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string OrderNumber { get; set; } = string.Empty;

    [Required]
    [RegularExpression("delivery|collection")]
    public string OrderType { get; set; } = "delivery";

    [Required]
    [MinLength(2)]
    [MaxLength(100)]
    public string CustomerName { get; set; } = string.Empty;

    [Required]
    [Phone]
    [MaxLength(30)]
    public string CustomerPhone { get; set; } = string.Empty;

    [Required]
    [EmailAddress]
    [MaxLength(120)]
    public string CustomerEmail { get; set; } = string.Empty;

    [MaxLength(400)]
    public string DeliveryAddress { get; set; } = string.Empty;

    [MaxLength(20)]
    public string DeliveryPostcode { get; set; } = string.Empty;

    [MaxLength(500)]
    public string DeliveryNotes { get; set; } = string.Empty;

    [MaxLength(50)]
    public string ScheduledTime { get; set; } = "ASAP";

    [Required]
    [MinLength(1)]
    [MaxLength(80)]
    public List<OrderItem> Items { get; set; } = new();

    [Range(0, 10000)]
    public decimal Subtotal { get; set; }

    [Range(0, 10000)]
    public decimal DiscountAmount { get; set; }

    [Range(0, 10000)]
    public decimal DeliveryFee { get; set; }

    [Range(0, 10000)]
    public decimal Total { get; set; }

    [MaxLength(50)]
    public string? VoucherCode { get; set; }

    [Required]
    [RegularExpression("card|apple_pay|cash")]
    public string PaymentMethod { get; set; } = "card";

    [MaxLength(30)]
    public string PaymentStatus { get; set; } = "Paid";

    [MaxLength(30)]
    public string OrderStatus { get; set; } = "Placed";

    [MaxLength(80)]
    public string OrderTime { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? CancellationReason { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class UpdateOrderStatusDto
{
    [Required]
    [MaxLength(30)]
    public string Status { get; set; } = string.Empty;
}

public class CancelOrderRequest
{
    [Required]
    [MinLength(3)]
    [MaxLength(500)]
    public string Reason { get; set; } = string.Empty;
}
