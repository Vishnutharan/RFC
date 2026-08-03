using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RFC.Api.Data;

#nullable disable

namespace RFC.Api.Migrations;

[DbContext(typeof(RfcDbContext))]
[Migration("20260803150000_HardenEnterpriseSecurity")]
public partial class HardenEnterpriseSecurity : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            ALTER TABLE customers ADD COLUMN IF NOT EXISTS security_stamp varchar(64);
            UPDATE customers
            SET security_stamp = md5(random()::text || clock_timestamp()::text || id)
            WHERE security_stamp IS NULL OR security_stamp = '';
            ALTER TABLE customers ALTER COLUMN security_stamp SET NOT NULL;

            ALTER TABLE staff_users ADD COLUMN IF NOT EXISTS security_stamp varchar(64);
            UPDATE staff_users
            SET security_stamp = md5(random()::text || clock_timestamp()::text || id)
            WHERE security_stamp IS NULL OR security_stamp = '';
            ALTER TABLE staff_users ALTER COLUMN security_stamp SET NOT NULL;

            DROP INDEX IF EXISTS ix_orders_stripe_payment_intent_id;
            CREATE UNIQUE INDEX ix_orders_stripe_payment_intent_id
                ON orders (stripe_payment_intent_id)
                WHERE stripe_payment_intent_id IS NOT NULL;
            ALTER TABLE orders ADD COLUMN IF NOT EXISTS checkout_id varchar(80) NULL;
            CREATE UNIQUE INDEX ix_orders_checkout_id
                ON orders (checkout_id)
                WHERE checkout_id IS NOT NULL;

            CREATE INDEX IF NOT EXISTS ix_orders_created_at ON orders (created_at);
            CREATE INDEX IF NOT EXISTS ix_orders_order_status_created_at ON orders (order_status, created_at);
            CREATE INDEX IF NOT EXISTS ix_orders_customer_email ON orders (customer_email);
            CREATE INDEX IF NOT EXISTS ix_reviews_status_date ON reviews (status, date);
            CREATE INDEX IF NOT EXISTS ix_audit_logs_timestamp ON audit_logs (timestamp);

            CREATE TABLE IF NOT EXISTS payment_webhook_events (
                id varchar(120) PRIMARY KEY,
                type varchar(120) NOT NULL,
                payment_intent_id varchar(200) NULL,
                received_at timestamptz NOT NULL,
                processed_at timestamptz NULL
            );
            CREATE INDEX IF NOT EXISTS ix_payment_webhook_events_received_at
                ON payment_webhook_events (received_at);

            CREATE TABLE IF NOT EXISTS voucher_redemptions (
                id varchar(80) PRIMARY KEY,
                code varchar(50) NOT NULL,
                customer_id varchar(80) NOT NULL,
                order_id varchar(80) NOT NULL,
                redeemed_at timestamptz NOT NULL
            );
            CREATE UNIQUE INDEX IF NOT EXISTS ix_voucher_redemptions_code_customer_id
                ON voucher_redemptions (code, customer_id);
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            DROP TABLE IF EXISTS payment_webhook_events;
            DROP TABLE IF EXISTS voucher_redemptions;
            DROP INDEX IF EXISTS ix_audit_logs_timestamp;
            DROP INDEX IF EXISTS ix_reviews_status_date;
            DROP INDEX IF EXISTS ix_orders_customer_email;
            DROP INDEX IF EXISTS ix_orders_order_status_created_at;
            DROP INDEX IF EXISTS ix_orders_created_at;
            DROP INDEX IF EXISTS ix_orders_checkout_id;
            ALTER TABLE orders DROP COLUMN IF EXISTS checkout_id;
            DROP INDEX IF EXISTS ix_orders_stripe_payment_intent_id;
            CREATE INDEX ix_orders_stripe_payment_intent_id ON orders (stripe_payment_intent_id);
            ALTER TABLE staff_users DROP COLUMN IF EXISTS security_stamp;
            ALTER TABLE customers DROP COLUMN IF EXISTS security_stamp;
            """);
    }
}
