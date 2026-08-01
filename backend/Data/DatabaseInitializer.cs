using Microsoft.EntityFrameworkCore;

namespace RFC.Api.Data;

public static class DatabaseInitializer
{
    public static async Task InitializeAsync(WebApplication app)
    {
        using var scope = app.Services.CreateScope();
        var logger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("DatabaseInitializer");
        var db = scope.ServiceProvider.GetService<RfcDbContext>();

        if (db == null)
        {
            logger.LogWarning("ConnectionStrings:RfcDatabase is not configured. API is running with in-memory fallbacks where available.");
            return;
        }

        try
        {
            await db.Database.EnsureCreatedAsync();
            await EnsureOperationalTablesAsync(db);

            if (!await db.MenuItems.AnyAsync())
            {
                db.MenuItems.AddRange(SeedData.DefaultMenuItems);
                await db.SaveChangesAsync();
                logger.LogInformation("Seeded default menu items.");
            }
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Database initialization failed. Check the configured database connection and schema.");
        }
    }

    private static async Task EnsureOperationalTablesAsync(RfcDbContext db)
    {
        await db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS menu_items (
                id varchar(50) PRIMARY KEY,
                category_id varchar(50) NOT NULL DEFAULT '',
                name varchar(200) NOT NULL,
                description text NULL,
                price numeric(10, 2) NOT NULL DEFAULT 0,
                calorie_info varchar(100) NULL,
                is_spicy boolean NOT NULL DEFAULT false,
                is_bestseller boolean NOT NULL DEFAULT false,
                image_url text NULL,
                has_options boolean NOT NULL DEFAULT false,
                is_available boolean NOT NULL DEFAULT true
            );
            """);

        await db.Database.ExecuteSqlRawAsync("""
            ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS has_options boolean NOT NULL DEFAULT false;
            ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS is_available boolean NOT NULL DEFAULT true;
            """);

        await db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS orders (
                id varchar(50) PRIMARY KEY,
                order_number varchar(20) UNIQUE NOT NULL,
                order_type varchar(20) NOT NULL DEFAULT 'delivery',
                customer_name varchar(100) NOT NULL,
                customer_phone varchar(50) NOT NULL,
                customer_email varchar(120) NOT NULL,
                delivery_address text NOT NULL,
                delivery_postcode varchar(20) NOT NULL,
                delivery_notes text NULL,
                items_json jsonb NOT NULL,
                subtotal numeric(10, 2) NOT NULL,
                discount_amount numeric(10, 2) NOT NULL DEFAULT 0,
                delivery_fee numeric(10, 2) NOT NULL DEFAULT 0,
                total numeric(10, 2) NOT NULL,
                voucher_code varchar(50) NULL,
                payment_method varchar(50) NOT NULL DEFAULT 'card',
                payment_status varchar(50) NOT NULL DEFAULT 'Pending',
                order_status varchar(50) NOT NULL DEFAULT 'Placed',
                order_time varchar(100) NULL,
                cancellation_reason text NULL,
                created_at timestamptz NOT NULL DEFAULT now()
            );
            """);

        await db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS customers (
                id text PRIMARY KEY,
                name text NOT NULL,
                email text NOT NULL,
                phone text NOT NULL DEFAULT '',
                address text NOT NULL DEFAULT '',
                postcode text NOT NULL DEFAULT '',
                password_hash text NOT NULL,
                created_at timestamp with time zone NOT NULL DEFAULT now(),
                updated_at timestamp with time zone NULL
            );
            """);

        await db.Database.ExecuteSqlRawAsync("""
            CREATE UNIQUE INDEX IF NOT EXISTS ix_customers_email_lower
            ON customers (LOWER(email));
            """);

        await db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS reviews (
                id text PRIMARY KEY,
                customer_name text NOT NULL DEFAULT '',
                rating integer NOT NULL DEFAULT 5,
                type text NOT NULL DEFAULT 'Review',
                category text NOT NULL DEFAULT 'General',
                comment text NOT NULL DEFAULT '',
                order_number text NULL,
                status text NOT NULL DEFAULT 'Published',
                response text NULL,
                date timestamp with time zone NOT NULL DEFAULT now()
            );
            """);
    }
}
