using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using RFC.Api.Data;

#nullable disable

namespace RFC.Api.Migrations;

[DbContext(typeof(RfcDbContext))]
[Migration("20260802023000_AddOrderAccessControl")]
public partial class AddOrderAccessControl : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_id varchar(80) NULL;
            ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_access_token_hash varchar(128) NULL;
            ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_access_token_expires_at timestamptz NULL;
            CREATE INDEX IF NOT EXISTS ix_orders_customer_id ON orders (customer_id);
            CREATE INDEX IF NOT EXISTS ix_orders_order_access_token_hash ON orders (order_access_token_hash);
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        // Intentionally empty to avoid destructive production rollback of order access data.
    }
}
