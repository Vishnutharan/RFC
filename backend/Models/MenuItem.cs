namespace RFC.Api.Models;

public class MenuItem
{
    public string Id { get; set; } = string.Empty;
    public string CategoryId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public string CalorieInfo { get; set; } = string.Empty;
    public bool IsSpicy { get; set; }
    public bool IsBestseller { get; set; }
    public string ImageUrl { get; set; } = string.Empty;
    public bool HasOptions { get; set; }
}
