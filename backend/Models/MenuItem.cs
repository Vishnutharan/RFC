namespace RFC.Api.Models;

using System.ComponentModel.DataAnnotations;

public class MenuItem
{
    [MaxLength(80)]
    public string Id { get; set; } = string.Empty;

    [MaxLength(80)]
    public string CategoryId { get; set; } = string.Empty;

    [MaxLength(180)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(1000)]
    public string Description { get; set; } = string.Empty;

    [Range(0, 500)]
    public decimal Price { get; set; }

    [MaxLength(80)]
    public string CalorieInfo { get; set; } = string.Empty;

    public bool IsSpicy { get; set; }
    public bool IsBestseller { get; set; }

    [MaxLength(1000)]
    public string ImageUrl { get; set; } = string.Empty;

    public bool HasOptions { get; set; }
    public bool IsAvailable { get; set; } = true;
    public int StockCount { get; set; } = 999;
}
