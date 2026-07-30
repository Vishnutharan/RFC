using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RFC.Api.Data;
using RFC.Api.Models;

namespace RFC.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class MenuController : ControllerBase
{
    private readonly RfcDbContext? _db;

    private static readonly List<MenuItem> DefaultMenuItems = new()
    {
        new MenuItem { Id = "bm-1", CategoryId = "box-meals", Name = "Boneless Banquet Meal", Description = "3 Chicken Strips, Small Popcorn Chicken, 1 Side, Regular Fries & Drink.", Price = 8.99m, CalorieInfo = "980 kcal", IsBestseller = true, IsSpicy = false, ImageUrl = "https://images.unsplash.com/photo-1562967914-608f82629710?w=600&auto=format&fit=crop&q=80", HasOptions = true },
        new MenuItem { Id = "bm-2", CategoryId = "box-meals", Name = "Club Max Box Meal", Description = "Club Max Burger with 3 Spicy Wings, 1 Side, Regular Fries & Choice of Drink.", Price = 8.99m, CalorieInfo = "1120 kcal", IsBestseller = true, IsSpicy = true, ImageUrl = "https://images.unsplash.com/photo-1610614819513-58e34989848b?w=600&auto=format&fit=crop&q=80", HasOptions = true },
        new MenuItem { Id = "bg-1", CategoryId = "burgers-meals", Name = "Club Max Burger", Description = "2 Crispy 100% Chicken Strips coated in spicy marinade, cheese, hash brown, lettuce & mayo.", Price = 6.99m, CalorieInfo = "780 kcal", IsBestseller = true, IsSpicy = true, ImageUrl = "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&auto=format&fit=crop&q=80", HasOptions = false },
        new MenuItem { Id = "bk-1", CategoryId = "family-buckets", Name = "Family Feast Meal", Description = "8 or 12 Chicken, 4 Regular Fries, 2 Large Sides & 1.5L Drink.", Price = 21.99m, CalorieInfo = "2800 kcal", IsBestseller = true, IsSpicy = false, ImageUrl = "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=600&auto=format&fit=crop&q=80", HasOptions = true },
        new MenuItem { Id = "fc-1", CategoryId = "fried-chicken", Name = "Spicy Wings Meal (6 Wings)", Description = "6 Crispy Spicy Wings, Fries & Drink.", Price = 7.49m, CalorieInfo = "850 kcal", IsBestseller = true, IsSpicy = true, ImageUrl = "https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=600&auto=format&fit=crop&q=80", HasOptions = true },
        new MenuItem { Id = "sd-1", CategoryId = "sides", Name = "Regular Fries", Description = "Golden crispy potato french fries.", Price = 2.79m, CalorieInfo = "320 kcal", IsBestseller = true, IsSpicy = false, ImageUrl = "https://images.unsplash.com/photo-1576107232684-1279f3908594?w=600&auto=format&fit=crop&q=80", HasOptions = false },
    };

    public MenuController(IServiceProvider provider)
    {
        try { _db = provider.GetService<RfcDbContext>(); } catch { }
    }

    [HttpGet]
    public async Task<IActionResult> GetMenu()
    {
        if (_db != null)
        {
            try
            {
                var items = await _db.MenuItems.AsNoTracking().ToListAsync();
                if (items != null && items.Count > 0)
                {
                    return Ok(items);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[MenuController] DB query info: {ex.Message}");
            }
        }
        return Ok(DefaultMenuItems);
    }
}
