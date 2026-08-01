namespace RFC.Api.Models;

using System.ComponentModel.DataAnnotations;

public class Voucher
{
    [Required]
    [MaxLength(50)]
    public string Code { get; set; } = string.Empty;

    [Range(0, 100)]
    public decimal DiscountPercent { get; set; }

    [Range(0, 1000)]
    public decimal MinSpend { get; set; }

    [MaxLength(255)]
    public string Description { get; set; } = string.Empty;

    public bool IsActive { get; set; } = true;
}
