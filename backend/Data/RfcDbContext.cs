using Microsoft.EntityFrameworkCore;
using RFC.Api.Models;

namespace RFC.Api.Data;

public class RfcDbContext : DbContext
{
    public RfcDbContext(DbContextOptions<RfcDbContext> options) : base(options) { }

    public DbSet<MenuItem> MenuItems => Set<MenuItem>();
    public DbSet<DbOrder> Orders => Set<DbOrder>();
    public DbSet<DbReview> Reviews => Set<DbReview>();
    public DbSet<DbCustomer> Customers => Set<DbCustomer>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<MenuItem>(entity =>
        {
            entity.ToTable("menu_items");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.Id).HasColumnName("id");
            entity.Property(item => item.CategoryId).HasColumnName("category_id");
            entity.Property(item => item.Name).HasColumnName("name");
            entity.Property(item => item.Description).HasColumnName("description");
            entity.Property(item => item.Price).HasColumnName("price");
            entity.Property(item => item.CalorieInfo).HasColumnName("calorie_info");
            entity.Property(item => item.IsSpicy).HasColumnName("is_spicy");
            entity.Property(item => item.IsBestseller).HasColumnName("is_bestseller");
            entity.Property(item => item.ImageUrl).HasColumnName("image_url");
            entity.Property(item => item.HasOptions).HasColumnName("has_options");
            entity.Property(item => item.IsAvailable).HasColumnName("is_available");
        });

        modelBuilder.Entity<DbOrder>(entity =>
        {
            entity.ToTable("orders");
            entity.HasKey(order => order.Id);
            entity.Property(order => order.Id).HasColumnName("id");
            entity.Property(order => order.OrderNumber).HasColumnName("order_number");
            entity.Property(order => order.OrderType).HasColumnName("order_type");
            entity.Property(order => order.CustomerName).HasColumnName("customer_name");
            entity.Property(order => order.CustomerPhone).HasColumnName("customer_phone");
            entity.Property(order => order.CustomerEmail).HasColumnName("customer_email");
            entity.Property(order => order.DeliveryAddress).HasColumnName("delivery_address");
            entity.Property(order => order.DeliveryPostcode).HasColumnName("delivery_postcode");
            entity.Property(order => order.DeliveryNotes).HasColumnName("delivery_notes");
            entity.Property(order => order.ItemsJson).HasColumnName("items_json").HasColumnType("jsonb");
            entity.Property(order => order.Subtotal).HasColumnName("subtotal");
            entity.Property(order => order.DiscountAmount).HasColumnName("discount_amount");
            entity.Property(order => order.DeliveryFee).HasColumnName("delivery_fee");
            entity.Property(order => order.Total).HasColumnName("total");
            entity.Property(order => order.VoucherCode).HasColumnName("voucher_code");
            entity.Property(order => order.PaymentMethod).HasColumnName("payment_method");
            entity.Property(order => order.PaymentStatus).HasColumnName("payment_status");
            entity.Property(order => order.OrderStatus).HasColumnName("order_status");
            entity.Property(order => order.OrderTime).HasColumnName("order_time");
            entity.Property(order => order.CancellationReason).HasColumnName("cancellation_reason");
            entity.Property(order => order.CreatedAt).HasColumnName("created_at");
        });

        modelBuilder.Entity<DbReview>(entity =>
        {
            entity.ToTable("reviews");
            entity.HasKey(review => review.Id);
            entity.Property(review => review.Id).HasColumnName("id");
            entity.Property(review => review.CustomerName).HasColumnName("customer_name");
            entity.Property(review => review.Rating).HasColumnName("rating");
            entity.Property(review => review.Type).HasColumnName("type");
            entity.Property(review => review.Category).HasColumnName("category");
            entity.Property(review => review.Comment).HasColumnName("comment");
            entity.Property(review => review.OrderNumber).HasColumnName("order_number");
            entity.Property(review => review.Status).HasColumnName("status");
            entity.Property(review => review.Response).HasColumnName("response");
            entity.Property(review => review.Date).HasColumnName("date");
        });

        modelBuilder.Entity<DbCustomer>(entity =>
        {
            entity.ToTable("customers");
            entity.HasKey(customer => customer.Id);
            entity.Property(customer => customer.Id).HasColumnName("id");
            entity.Property(customer => customer.Name).HasColumnName("name");
            entity.Property(customer => customer.Email).HasColumnName("email");
            entity.Property(customer => customer.Phone).HasColumnName("phone");
            entity.Property(customer => customer.Address).HasColumnName("address");
            entity.Property(customer => customer.Postcode).HasColumnName("postcode");
            entity.Property(customer => customer.PasswordHash).HasColumnName("password_hash");
            entity.Property(customer => customer.CreatedAt).HasColumnName("created_at");
            entity.Property(customer => customer.UpdatedAt).HasColumnName("updated_at");
            entity.HasIndex(customer => customer.Email).IsUnique();
        });
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
    public string PaymentStatus { get; set; } = "Pending";
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
