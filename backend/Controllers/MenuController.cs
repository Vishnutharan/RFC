using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RFC.Api.Data;

namespace RFC.Api.Controllers;

[ApiController]
[RequestSizeLimit(1_048_576)]
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
        if (_db == null)
        {
            _logger.LogWarning("Database is not configured. Serving bundled menu fallback.");
            return Ok(SeedData.DefaultMenuItems.Where(item => item.IsAvailable).ToList());
        }

        try
        {
            var items = await _db.MenuItems.AsNoTracking()
                .Where(item => item.IsAvailable)
                .ToListAsync(HttpContext.RequestAborted);

            if (items.Count == 0)
            {
                _logger.LogWarning("Menu table is empty. Serving bundled menu fallback.");
                return Ok(SeedData.DefaultMenuItems.Where(item => item.IsAvailable).ToList());
            }

            return Ok(items);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to load menu from database. Serving bundled menu fallback.");
            return Ok(SeedData.DefaultMenuItems.Where(item => item.IsAvailable).ToList());
        }
    }
}
