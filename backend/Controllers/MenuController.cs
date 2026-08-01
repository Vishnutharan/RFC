using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RFC.Api.Data;

namespace RFC.Api.Controllers;

[ApiController]
[RequestSizeLimit(1_048_576)]
[Route("api/[controller]")]
public class MenuController : ControllerBase
{
    private const string ServiceUnavailableMessage = "Service temporarily unavailable. Please try again shortly.";

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
        if (_db == null) return ServiceUnavailable();

        try
        {
            var items = await _db.MenuItems.AsNoTracking().Where(item => item.IsAvailable).ToListAsync();
            return Ok(items);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to load menu from database.");
            return ServiceUnavailable();
        }
    }

    private ObjectResult ServiceUnavailable()
    {
        return StatusCode(StatusCodes.Status503ServiceUnavailable, new { message = ServiceUnavailableMessage });
    }
}
