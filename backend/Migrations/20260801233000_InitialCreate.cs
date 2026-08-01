using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RFC.Api.Data;

#nullable disable

namespace RFC.Api.Migrations;

[DbContext(typeof(RfcDbContext))]
[Migration("20260801233000_InitialCreate")]
public partial class InitialCreate : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            CREATE TABLE IF NOT EXISTS menu_items (
                id varchar(80) PRIMARY KEY,
                category_id varchar(80) NOT NULL DEFAULT '',
                name varchar(180) NOT NULL,
                description varchar(1000) NOT NULL DEFAULT '',
                price numeric(10, 2) NOT NULL DEFAULT 0,
                calorie_info varchar(80) NOT NULL DEFAULT '',
                is_spicy boolean NOT NULL DEFAULT false,
                is_bestseller boolean NOT NULL DEFAULT false,
                image_url varchar(1000) NOT NULL DEFAULT '',
                has_options boolean NOT NULL DEFAULT false,
                is_available boolean NOT NULL DEFAULT true,
                stock_count integer NOT NULL DEFAULT 999
            );

            ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS stock_count integer NOT NULL DEFAULT 999;
            ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS has_options boolean NOT NULL DEFAULT false;
            ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS is_available boolean NOT NULL DEFAULT true;

            CREATE TABLE IF NOT EXISTS customers (
                id varchar(80) PRIMARY KEY,
                name varchar(100) NOT NULL,
                email varchar(120) NOT NULL,
                phone varchar(30) NOT NULL DEFAULT '',
                address varchar(400) NOT NULL DEFAULT '',
                postcode varchar(20) NOT NULL DEFAULT '',
                password_hash varchar(300) NOT NULL,
                created_at timestamptz NOT NULL DEFAULT now(),
                updated_at timestamptz NULL
            );
            CREATE UNIQUE INDEX IF NOT EXISTS ix_customers_email ON customers (email);

            CREATE TABLE IF NOT EXISTS orders (
                id varchar(80) PRIMARY KEY,
                order_number varchar(20) UNIQUE NOT NULL,
                order_type varchar(20) NOT NULL DEFAULT 'delivery',
                customer_name varchar(100) NOT NULL,
                customer_phone varchar(50) NOT NULL,
                customer_email varchar(120) NOT NULL,
                delivery_address varchar(500) NOT NULL DEFAULT '',
                delivery_postcode varchar(20) NOT NULL DEFAULT '',
                delivery_notes varchar(500) NOT NULL DEFAULT '',
                items_json jsonb NOT NULL DEFAULT '[]'::jsonb,
                subtotal numeric(10, 2) NOT NULL DEFAULT 0,
                discount_amount numeric(10, 2) NOT NULL DEFAULT 0,
                delivery_fee numeric(10, 2) NOT NULL DEFAULT 0,
                total numeric(10, 2) NOT NULL DEFAULT 0,
                voucher_code varchar(50) NULL,
                payment_method varchar(50) NOT NULL DEFAULT 'card',
                payment_status varchar(50) NOT NULL DEFAULT 'Pending',
                order_status varchar(50) NOT NULL DEFAULT 'Placed',
                order_time varchar(100) NOT NULL DEFAULT '',
                cancellation_reason varchar(500) NULL,
                stripe_payment_intent_id varchar(200) NULL,
                delivery_lat numeric(9, 6) NULL,
                delivery_lng numeric(9, 6) NULL,
                eta_minutes integer NULL,
                driver_id varchar(80) NULL,
                created_at timestamptz NOT NULL DEFAULT now()
            );
            ALTER TABLE orders ADD COLUMN IF NOT EXISTS stripe_payment_intent_id varchar(200) NULL;
            ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_lat numeric(9, 6) NULL;
            ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_lng numeric(9, 6) NULL;
            ALTER TABLE orders ADD COLUMN IF NOT EXISTS eta_minutes integer NULL;
            ALTER TABLE orders ADD COLUMN IF NOT EXISTS driver_id varchar(80) NULL;
            CREATE UNIQUE INDEX IF NOT EXISTS ix_orders_order_number ON orders (order_number);
            CREATE INDEX IF NOT EXISTS ix_orders_stripe_payment_intent_id ON orders (stripe_payment_intent_id);

            CREATE TABLE IF NOT EXISTS reviews (
                id varchar(80) PRIMARY KEY,
                customer_name varchar(100) NOT NULL DEFAULT '',
                rating integer NOT NULL DEFAULT 5,
                type varchar(30) NOT NULL DEFAULT 'Review',
                category varchar(80) NOT NULL DEFAULT 'General',
                comment varchar(2000) NOT NULL DEFAULT '',
                order_number varchar(30) NULL,
                status varchar(30) NOT NULL DEFAULT 'Published',
                response varchar(1000) NULL,
                date timestamptz NOT NULL DEFAULT now()
            );

            CREATE TABLE IF NOT EXISTS staff_users (
                id varchar(80) PRIMARY KEY,
                name varchar(100) NOT NULL,
                email varchar(120) NOT NULL,
                password_hash varchar(300) NOT NULL,
                role varchar(30) NOT NULL DEFAULT 'staff',
                is_active boolean NOT NULL DEFAULT true,
                created_at timestamptz NOT NULL DEFAULT now()
            );
            CREATE UNIQUE INDEX IF NOT EXISTS ix_staff_users_email ON staff_users (email);

            CREATE TABLE IF NOT EXISTS login_attempts (
                id varchar(80) PRIMARY KEY,
                email varchar(120) NOT NULL,
                attempt_count integer NOT NULL DEFAULT 0,
                last_attempt_at timestamptz NOT NULL DEFAULT now(),
                locked_until timestamptz NULL
            );
            CREATE UNIQUE INDEX IF NOT EXISTS ix_login_attempts_email ON login_attempts (email);

            CREATE TABLE IF NOT EXISTS audit_logs (
                id varchar(80) PRIMARY KEY,
                user_id varchar(80) NULL,
                action varchar(120) NOT NULL,
                entity_type varchar(80) NOT NULL,
                entity_id varchar(120) NULL,
                old_value jsonb NULL,
                new_value jsonb NULL,
                timestamp timestamptz NOT NULL DEFAULT now(),
                ip_address varchar(80) NULL
            );

            CREATE TABLE IF NOT EXISTS store_settings (
                key varchar(120) PRIMARY KEY,
                value jsonb NOT NULL DEFAULT '{}'::jsonb
            );
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        // Intentionally left empty. Rolling back this migration would destroy
        // production order, customer, audit, and payment-reference data.
    }
}
