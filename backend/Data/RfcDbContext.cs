using Microsoft.EntityFrameworkCore;
using RFC.Api.Models;

namespace RFC.Api.Data;

public class RfcDbContext : DbContext
{
    public RfcDbContext(DbContextOptions<RfcDbContext> options) : base(options) { }

    public DbSet<MenuItem> MenuItems => Set<MenuItem>();
    public DbSet<DbOrder> Orders => Set<DbOrder>();
    public DbSet<DbReview> Reviews => Set<DbReview>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<MenuItem>().ToTable("menu_items");
        modelBuilder.Entity<DbOrder>().ToTable("orders");
        modelBuilder.Entity<DbReview>().ToTable("reviews");
    }
}

public class DbOrder
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
    public string ItemsJson { get; set; } = "[]";
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

public class DbReview
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string CustomerName { get; set; } = string.Empty;
    public int Rating { get; set; } = 5;
    public string Type { get; set; } = "Review";
    public string Category { get; set; } = "General";
    public string Comment { get; set; } = string.Empty;
    public string? OrderNumber { get; set; }
    public string Status { get; set; } = "Published";
    public string? Response { get; set; }
    public DateTime Date { get; set; } = DateTime.UtcNow;
}
