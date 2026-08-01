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
    private readonly ILogger<MenuController> _logger;

    public MenuController(IServiceProvider provider, ILogger<MenuController> logger)
    {
        _db = provider.GetService<RfcDbContext>();
        _logger = logger;
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
                _logger.LogError(ex, "Failed to load menu from database.");
            }
        }
        return Ok(SeedData.DefaultMenuItems);
    }
}
