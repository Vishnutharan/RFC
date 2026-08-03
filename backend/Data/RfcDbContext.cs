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
    public DbSet<StaffUser> StaffUsers => Set<StaffUser>();
    public DbSet<LoginAttempt> LoginAttempts => Set<LoginAttempt>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<StoreSetting> StoreSettings => Set<StoreSetting>();
    public DbSet<PaymentWebhookEvent> PaymentWebhookEvents => Set<PaymentWebhookEvent>();
    public DbSet<VoucherRedemption> VoucherRedemptions => Set<VoucherRedemption>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<MenuItem>(entity =>
        {
            entity.ToTable("menu_items");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.Id).HasColumnName("id").HasMaxLength(80);
            entity.Property(item => item.CategoryId).HasColumnName("category_id").HasMaxLength(80).IsRequired();
            entity.Property(item => item.Name).HasColumnName("name").HasMaxLength(180).IsRequired();
            entity.Property(item => item.Description).HasColumnName("description").HasMaxLength(1000);
            entity.Property(item => item.Price).HasColumnName("price").HasPrecision(10, 2);
            entity.Property(item => item.CalorieInfo).HasColumnName("calorie_info").HasMaxLength(80);
            entity.Property(item => item.IsSpicy).HasColumnName("is_spicy");
            entity.Property(item => item.IsBestseller).HasColumnName("is_bestseller");
            entity.Property(item => item.ImageUrl).HasColumnName("image_url").HasMaxLength(1000);
            entity.Property(item => item.HasOptions).HasColumnName("has_options");
            entity.Property(item => item.IsAvailable).HasColumnName("is_available");
            entity.Property(item => item.StockCount).HasColumnName("stock_count").HasDefaultValue(999);
        });

        modelBuilder.Entity<DbOrder>(entity =>
        {
            entity.ToTable("orders");
            entity.HasKey(order => order.Id);
            entity.Property(order => order.Id).HasColumnName("id").HasMaxLength(80);
            entity.Property(order => order.OrderNumber).HasColumnName("order_number").HasMaxLength(20).IsRequired();
            entity.HasIndex(order => order.OrderNumber).IsUnique();
            entity.Property(order => order.OrderType).HasColumnName("order_type").HasMaxLength(20).IsRequired();
            entity.Property(order => order.CustomerName).HasColumnName("customer_name").HasMaxLength(100).IsRequired();
            entity.Property(order => order.CustomerPhone).HasColumnName("customer_phone").HasMaxLength(50).IsRequired();
            entity.Property(order => order.CustomerEmail).HasColumnName("customer_email").HasMaxLength(120).IsRequired();
            entity.Property(order => order.CustomerId).HasColumnName("customer_id").HasMaxLength(80);
            entity.HasIndex(order => order.CustomerId);
            entity.Property(order => order.OrderAccessTokenHash).HasColumnName("order_access_token_hash").HasMaxLength(128);
            entity.HasIndex(order => order.OrderAccessTokenHash);
            entity.Property(order => order.OrderAccessTokenExpiresAt).HasColumnName("order_access_token_expires_at");
            entity.Property(order => order.DeliveryAddress).HasColumnName("delivery_address").HasMaxLength(500);
            entity.Property(order => order.DeliveryPostcode).HasColumnName("delivery_postcode").HasMaxLength(20);
            entity.Property(order => order.DeliveryNotes).HasColumnName("delivery_notes").HasMaxLength(500);
            entity.Property(order => order.ItemsJson).HasColumnName("items_json").HasColumnType("jsonb");
            entity.Property(order => order.Subtotal).HasColumnName("subtotal").HasPrecision(10, 2);
            entity.Property(order => order.DiscountAmount).HasColumnName("discount_amount").HasPrecision(10, 2);
            entity.Property(order => order.DeliveryFee).HasColumnName("delivery_fee").HasPrecision(10, 2);
            entity.Property(order => order.Total).HasColumnName("total").HasPrecision(10, 2);
            entity.Property(order => order.VoucherCode).HasColumnName("voucher_code").HasMaxLength(50);
            entity.Property(order => order.PaymentMethod).HasColumnName("payment_method").HasMaxLength(50);
            entity.Property(order => order.PaymentStatus).HasColumnName("payment_status").HasMaxLength(50);
            entity.Property(order => order.OrderStatus).HasColumnName("order_status").HasMaxLength(50);
            entity.Property(order => order.OrderTime).HasColumnName("order_time").HasMaxLength(100);
            entity.Property(order => order.CancellationReason).HasColumnName("cancellation_reason").HasMaxLength(500);
            entity.Property(order => order.StripePaymentIntentId).HasColumnName("stripe_payment_intent_id").HasMaxLength(200);
            entity.HasIndex(order => order.StripePaymentIntentId)
                .IsUnique()
                .HasFilter("stripe_payment_intent_id IS NOT NULL");
            entity.Property(order => order.CheckoutId).HasColumnName("checkout_id").HasMaxLength(80);
            entity.HasIndex(order => order.CheckoutId)
                .IsUnique()
                .HasFilter("checkout_id IS NOT NULL");
            entity.HasIndex(order => order.CreatedAt);
            entity.HasIndex(order => new { order.OrderStatus, order.CreatedAt });
            entity.HasIndex(order => order.CustomerEmail);
            entity.Property(order => order.DeliveryLat).HasColumnName("delivery_lat").HasPrecision(9, 6);
            entity.Property(order => order.DeliveryLng).HasColumnName("delivery_lng").HasPrecision(9, 6);
            entity.Property(order => order.EtaMinutes).HasColumnName("eta_minutes");
            entity.Property(order => order.DriverId).HasColumnName("driver_id").HasMaxLength(80);
            entity.Property(order => order.CreatedAt).HasColumnName("created_at");
        });

        modelBuilder.Entity<DbReview>(entity =>
        {
            entity.ToTable("reviews");
            entity.HasKey(review => review.Id);
            entity.Property(review => review.Id).HasColumnName("id").HasMaxLength(80);
            entity.Property(review => review.CustomerName).HasColumnName("customer_name").HasMaxLength(100);
            entity.Property(review => review.Rating).HasColumnName("rating");
            entity.Property(review => review.Type).HasColumnName("type").HasMaxLength(30);
            entity.Property(review => review.Category).HasColumnName("category").HasMaxLength(80);
            entity.Property(review => review.Comment).HasColumnName("comment").HasMaxLength(2000);
            entity.Property(review => review.OrderNumber).HasColumnName("order_number").HasMaxLength(30);
            entity.Property(review => review.Status).HasColumnName("status").HasMaxLength(30);
            entity.Property(review => review.Response).HasColumnName("response").HasMaxLength(1000);
            entity.Property(review => review.Date).HasColumnName("date");
            entity.HasIndex(review => new { review.Status, review.Date });
        });

        modelBuilder.Entity<DbCustomer>(entity =>
        {
            entity.ToTable("customers");
            entity.HasKey(customer => customer.Id);
            entity.Property(customer => customer.Id).HasColumnName("id").HasMaxLength(80);
            entity.Property(customer => customer.Name).HasColumnName("name").HasMaxLength(100).IsRequired();
            entity.Property(customer => customer.Email).HasColumnName("email").HasMaxLength(120).IsRequired();
            entity.Property(customer => customer.Phone).HasColumnName("phone").HasMaxLength(30);
            entity.Property(customer => customer.Address).HasColumnName("address").HasMaxLength(400);
            entity.Property(customer => customer.Postcode).HasColumnName("postcode").HasMaxLength(20);
            entity.Property(customer => customer.PasswordHash).HasColumnName("password_hash").HasMaxLength(300).IsRequired();
            entity.Property(customer => customer.SecurityStamp).HasColumnName("security_stamp").HasMaxLength(64).IsRequired();
            entity.Property(customer => customer.CreatedAt).HasColumnName("created_at");
            entity.Property(customer => customer.UpdatedAt).HasColumnName("updated_at");
            entity.HasIndex(customer => customer.Email).IsUnique();
        });

        modelBuilder.Entity<StaffUser>(entity =>
        {
            entity.ToTable("staff_users");
            entity.HasKey(staff => staff.Id);
            entity.Property(staff => staff.Id).HasColumnName("id").HasMaxLength(80);
            entity.Property(staff => staff.Name).HasColumnName("name").HasMaxLength(100).IsRequired();
            entity.Property(staff => staff.Email).HasColumnName("email").HasMaxLength(120).IsRequired();
            entity.Property(staff => staff.PasswordHash).HasColumnName("password_hash").HasMaxLength(300).IsRequired();
            entity.Property(staff => staff.SecurityStamp).HasColumnName("security_stamp").HasMaxLength(64).IsRequired();
            entity.Property(staff => staff.Role).HasColumnName("role").HasMaxLength(30).IsRequired();
            entity.Property(staff => staff.IsActive).HasColumnName("is_active");
            entity.Property(staff => staff.CreatedAt).HasColumnName("created_at");
            entity.HasIndex(staff => staff.Email).IsUnique();
        });

        modelBuilder.Entity<LoginAttempt>(entity =>
        {
            entity.ToTable("login_attempts");
            entity.HasKey(attempt => attempt.Id);
            entity.Property(attempt => attempt.Id).HasColumnName("id").HasMaxLength(80);
            entity.Property(attempt => attempt.Email).HasColumnName("email").HasMaxLength(120).IsRequired();
            entity.Property(attempt => attempt.AttemptCount).HasColumnName("attempt_count");
            entity.Property(attempt => attempt.LastAttemptAt).HasColumnName("last_attempt_at");
            entity.Property(attempt => attempt.LockedUntil).HasColumnName("locked_until");
            entity.HasIndex(attempt => attempt.Email).IsUnique();
        });

        modelBuilder.Entity<AuditLog>(entity =>
        {
            entity.ToTable("audit_logs");
            entity.HasKey(log => log.Id);
            entity.Property(log => log.Id).HasColumnName("id").HasMaxLength(80);
            entity.Property(log => log.UserId).HasColumnName("user_id").HasMaxLength(80);
            entity.Property(log => log.Action).HasColumnName("action").HasMaxLength(120).IsRequired();
            entity.Property(log => log.EntityType).HasColumnName("entity_type").HasMaxLength(80).IsRequired();
            entity.Property(log => log.EntityId).HasColumnName("entity_id").HasMaxLength(120);
            entity.Property(log => log.OldValue).HasColumnName("old_value").HasColumnType("jsonb");
            entity.Property(log => log.NewValue).HasColumnName("new_value").HasColumnType("jsonb");
            entity.Property(log => log.Timestamp).HasColumnName("timestamp");
            entity.Property(log => log.IpAddress).HasColumnName("ip_address").HasMaxLength(80);
            entity.HasIndex(log => log.Timestamp);
        });

        modelBuilder.Entity<StoreSetting>(entity =>
        {
            entity.ToTable("store_settings");
            entity.HasKey(setting => setting.Key);
            entity.Property(setting => setting.Key).HasColumnName("key").HasMaxLength(120);
            entity.Property(setting => setting.Value).HasColumnName("value").HasColumnType("jsonb");
        });

        modelBuilder.Entity<PaymentWebhookEvent>(entity =>
        {
            entity.ToTable("payment_webhook_events");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.Id).HasColumnName("id").HasMaxLength(120);
            entity.Property(item => item.Type).HasColumnName("type").HasMaxLength(120).IsRequired();
            entity.Property(item => item.PaymentIntentId).HasColumnName("payment_intent_id").HasMaxLength(200);
            entity.Property(item => item.ReceivedAt).HasColumnName("received_at");
            entity.Property(item => item.ProcessedAt).HasColumnName("processed_at");
            entity.HasIndex(item => item.ReceivedAt);
        });

        modelBuilder.Entity<VoucherRedemption>(entity =>
        {
            entity.ToTable("voucher_redemptions");
            entity.HasKey(item => item.Id);
            entity.Property(item => item.Id).HasColumnName("id").HasMaxLength(80);
            entity.Property(item => item.Code).HasColumnName("code").HasMaxLength(50).IsRequired();
            entity.Property(item => item.CustomerId).HasColumnName("customer_id").HasMaxLength(80).IsRequired();
            entity.Property(item => item.OrderId).HasColumnName("order_id").HasMaxLength(80).IsRequired();
            entity.Property(item => item.RedeemedAt).HasColumnName("redeemed_at");
            entity.HasIndex(item => new { item.Code, item.CustomerId }).IsUnique();
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
    public string? CustomerId { get; set; }
    public string? OrderAccessTokenHash { get; set; }
    public DateTime? OrderAccessTokenExpiresAt { get; set; }
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
    public string? StripePaymentIntentId { get; set; }
    public string? CheckoutId { get; set; }
    public decimal? DeliveryLat { get; set; }
    public decimal? DeliveryLng { get; set; }
    public int? EtaMinutes { get; set; }
    public string? DriverId { get; set; }
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

public class StaffUser
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string SecurityStamp { get; set; } = Guid.NewGuid().ToString("N");
    public string Role { get; set; } = "staff";
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class LoginAttempt
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Email { get; set; } = string.Empty;
    public int AttemptCount { get; set; }
    public DateTime LastAttemptAt { get; set; } = DateTime.UtcNow;
    public DateTime? LockedUntil { get; set; }
}

public class AuditLog
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string? UserId { get; set; }
    public string Action { get; set; } = string.Empty;
    public string EntityType { get; set; } = string.Empty;
    public string? EntityId { get; set; }
    public string? OldValue { get; set; }
    public string? NewValue { get; set; }
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    public string? IpAddress { get; set; }
}

public class StoreSetting
{
    public string Key { get; set; } = string.Empty;
    public string Value { get; set; } = "{}";
}

public class PaymentWebhookEvent
{
    public string Id { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string? PaymentIntentId { get; set; }
    public DateTime ReceivedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ProcessedAt { get; set; }
}

public class VoucherRedemption
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string Code { get; set; } = string.Empty;
    public string CustomerId { get; set; } = string.Empty;
    public string OrderId { get; set; } = string.Empty;
    public DateTime RedeemedAt { get; set; } = DateTime.UtcNow;
}
