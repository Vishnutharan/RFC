namespace RFC.Api.Models;

public class Voucher
{
    public string Code { get; set; } = string.Empty;
    public decimal DiscountPercent { get; set; }
    public decimal MinSpend { get; set; }
    public string Description { get; set; } = string.Empty;
}
