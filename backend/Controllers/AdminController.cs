using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using RFC.Api.Data;
using RFC.Api.Hubs;
using RFC.Api.Models;
using RFC.Api.Security;
using RFC.Api.Services;

namespace RFC.Api.Controllers;

[ApiController]
[Authorize(Policy = "StaffOnly")]
[RequestSizeLimit(1_048_576)]
[Route("api/[controller]")]
public class AdminController : ControllerBase
{
    private const string ServiceUnavailableMessage = "Service temporarily unavailable. Please try again shortly.";

    private static readonly HashSet<string> ValidStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        "Placed",
        "Preparing",
        "Out for Delivery",
        "Ready for Collection",
        "Completed",
        "Cancelled"
    };

    private readonly RfcDbContext? _db;
    private readonly AuditService? _audit;
    private readonly IHubContext<OrderHub> _hubContext;
    private readonly GoogleMapsService _maps;
    private readonly NotificationService _notifications;
    private readonly ILogger<AdminController> _logger;

    public AdminController(
        IServiceProvider provider,
        IHubContext<OrderHub> hubContext,
        GoogleMapsService maps,
        NotificationService notifications,
        ILogger<AdminController> logger)
    {
        _db = provider.GetService<RfcDbContext>();
        _audit = provider.GetService<AuditService>();
        _hubContext = hubContext;
        _maps = maps;
        _notifications = notifications;
        _logger = logger;
    }

    [HttpGet("orders")]
    public async Task<IActionResult> GetAllOrders()
    {
        if (_db == null) return ServiceUnavailable();

        try
        {
            var dbOrders = await _db.Orders.AsNoTracking()
                .OrderByDescending(o => o.CreatedAt)
                .ToListAsync(HttpContext.RequestAborted);
            return Ok(dbOrders.Select(OrdersController.MapToOrderDto).ToList());
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to load admin order list.");
            return ServiceUnavailable();
        }
    }

    [HttpGet("menu")]
    public async Task<IActionResult> GetMenu()
    {
        if (_db == null) return ServiceUnavailable();

        try
        {
            var items = await _db.MenuItems.AsNoTracking()
                .OrderBy(item => item.CategoryId)
                .ThenBy(item => item.Name)
                .ToListAsync(HttpContext.RequestAborted);
            return Ok(items);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to load admin menu.");
            return ServiceUnavailable();
        }
    }

    [HttpPost("menu")]
    [EnableRateLimiting("order-write")]
    public async Task<IActionResult> CreateMenuItem([FromBody] AdminMenuItemRequest request)
    {
        if (_db == null) return ServiceUnavailable();

        var name = InputSanitizer.Clean(request.Name, 180);
        var categoryId = InputSanitizer.Clean(request.CategoryId, 80);
        if (string.IsNullOrWhiteSpace(name) || string.IsNullOrWhiteSpace(categoryId))
        {
            return BadRequest(new { message = "Menu item name and category are required." });
        }

        try
        {
            var id = string.IsNullOrWhiteSpace(request.Id)
                ? $"item-{Guid.NewGuid():N}"
                : InputSanitizer.Clean(request.Id, 80);
            if (await _db.MenuItems.AnyAsync(item => item.Id == id, HttpContext.RequestAborted))
            {
                return Conflict(new { message = "A menu item already exists with that id." });
            }

            var item = new MenuItem
            {
                Id = id,
                CategoryId = categoryId,
                Name = name,
                Description = InputSanitizer.Clean(request.Description, 1000),
                Price = request.Price,
                CalorieInfo = InputSanitizer.Clean(request.CalorieInfo, 80),
                ImageUrl = InputSanitizer.Clean(request.ImageUrl, 1000),
                HasOptions = request.HasOptions,
                IsSpicy = request.IsSpicy,
                IsBestseller = request.IsBestseller,
                IsAvailable = request.IsAvailable,
                StockCount = Math.Clamp(request.StockCount, 0, 9999)
            };

            _db.MenuItems.Add(item);
            await _db.SaveChangesAsync(HttpContext.RequestAborted);
            if (_audit != null) await _audit.LogAsync("CreateMenuItem", "MenuItem", item.Id, null, item);
            return Ok(item);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create menu item {MenuItemName}.", name);
            return ServiceUnavailable();
        }
    }

    [HttpPut("menu/{id}")]
    [EnableRateLimiting("order-write")]
    public async Task<IActionResult> UpdateMenuItem(string id, [FromBody] AdminMenuItemRequest request)
    {
        if (_db == null) return ServiceUnavailable();

        try
        {
            var cleanId = InputSanitizer.Clean(id, 80);
            var item = await _db.MenuItems.FirstOrDefaultAsync(menuItem => menuItem.Id == cleanId, HttpContext.RequestAborted);
            if (item == null) return NotFound(new { message = "Menu item not found." });

            var oldValue = new
            {
                item.CategoryId,
                item.Name,
                item.Description,
                item.Price,
                item.CalorieInfo,
                item.ImageUrl,
                item.HasOptions,
                item.IsSpicy,
                item.IsBestseller,
                item.IsAvailable,
                item.StockCount
            };

            item.CategoryId = InputSanitizer.Clean(request.CategoryId, 80);
            item.Name = InputSanitizer.Clean(request.Name, 180);
            item.Description = InputSanitizer.Clean(request.Description, 1000);
            item.Price = request.Price;
            item.CalorieInfo = InputSanitizer.Clean(request.CalorieInfo, 80);
            item.ImageUrl = InputSanitizer.Clean(request.ImageUrl, 1000);
            item.HasOptions = request.HasOptions;
            item.IsSpicy = request.IsSpicy;
            item.IsBestseller = request.IsBestseller;
            item.IsAvailable = request.IsAvailable;
            item.StockCount = Math.Clamp(request.StockCount, 0, 9999);

            if (string.IsNullOrWhiteSpace(item.CategoryId) || string.IsNullOrWhiteSpace(item.Name))
            {
                return BadRequest(new { message = "Menu item name and category are required." });
            }

            await _db.SaveChangesAsync(HttpContext.RequestAborted);
            if (_audit != null) await _audit.LogAsync("UpdateMenuItem", "MenuItem", item.Id, oldValue, item);
            return Ok(item);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to update menu item {MenuItemId}.", id);
            return ServiceUnavailable();
        }
    }

    [HttpDelete("menu/{id}")]
    [EnableRateLimiting("order-write")]
    public async Task<IActionResult> ArchiveMenuItem(string id)
    {
        if (_db == null) return ServiceUnavailable();

        try
        {
            var cleanId = InputSanitizer.Clean(id, 80);
            var item = await _db.MenuItems.FirstOrDefaultAsync(menuItem => menuItem.Id == cleanId, HttpContext.RequestAborted);
            if (item == null) return NotFound(new { message = "Menu item not found." });

            var oldValue = new { item.IsAvailable };
            item.IsAvailable = false;
            await _db.SaveChangesAsync(HttpContext.RequestAborted);
            if (_audit != null) await _audit.LogAsync("ArchiveMenuItem", "MenuItem", item.Id, oldValue, new { item.IsAvailable });
            return Ok(item);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to archive menu item {MenuItemId}.", id);
            return ServiceUnavailable();
        }
    }

    [HttpGet("customers")]
    public async Task<IActionResult> GetCustomers()
    {
        if (_db == null) return ServiceUnavailable();

        try
        {
            var customers = await _db.Customers.AsNoTracking()
                .Select(customer => new
                {
                    customer.Id,
                    customer.Name,
                    customer.Email,
                    customer.Phone,
                    customer.Address,
                    customer.Postcode,
                    customer.CreatedAt,
                    customer.UpdatedAt,
                    OrderCount = _db.Orders.Count(order => order.CustomerId == customer.Id || order.CustomerEmail == customer.Email),
                    LifetimeSpend = _db.Orders
                        .Where(order => order.CustomerId == customer.Id || order.CustomerEmail == customer.Email)
                        .Sum(order => (decimal?)order.Total) ?? 0m,
                    LastOrderAt = _db.Orders
                        .Where(order => order.CustomerId == customer.Id || order.CustomerEmail == customer.Email)
                        .Max(order => (DateTime?)order.CreatedAt)
                })
                .OrderByDescending(customer => customer.LastOrderAt ?? customer.CreatedAt)
                .ToListAsync(HttpContext.RequestAborted);

            return Ok(customers);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to load customer list.");
            return ServiceUnavailable();
        }
    }

    [HttpGet("staff")]
    public async Task<IActionResult> GetStaffUsers()
    {
        if (_db == null) return ServiceUnavailable();

        try
        {
            var staff = await _db.StaffUsers.AsNoTracking()
                .OrderByDescending(user => user.CreatedAt)
                .Select(user => new
                {
                    user.Id,
                    user.Name,
                    user.Email,
                    user.Role,
                    user.IsActive,
                    user.CreatedAt
                })
                .ToListAsync(HttpContext.RequestAborted);
            return Ok(staff);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to load staff users.");
            return ServiceUnavailable();
        }
    }

    [HttpPost("staff")]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> CreateStaffUser([FromBody] AdminStaffRequest request)
    {
        if (_db == null) return ServiceUnavailable();
        if (!User.IsInRole("manager")) return Forbid();

        var email = InputSanitizer.Clean(request.Email, 120).Trim().ToLowerInvariant();
        if (!PasswordPolicy.IsValid(request.Password))
        {
            return BadRequest(new { message = PasswordPolicy.Message });
        }

        try
        {
            if (await _db.StaffUsers.AnyAsync(user => user.Email == email, HttpContext.RequestAborted))
            {
                return Conflict(new { message = "A staff user already exists with this email." });
            }

            var staff = new StaffUser
            {
                Id = Guid.NewGuid().ToString("N"),
                Name = InputSanitizer.Clean(request.Name, 100),
                Email = email,
                PasswordHash = PasswordHasher.Hash(request.Password),
                Role = NormalizeStaffRole(request.Role),
                IsActive = request.IsActive,
                CreatedAt = DateTime.UtcNow
            };

            _db.StaffUsers.Add(staff);
            await _db.SaveChangesAsync(HttpContext.RequestAborted);
            if (_audit != null) await _audit.LogAsync("CreateStaffUser", "StaffUser", staff.Id, null, new { staff.Name, staff.Email, staff.Role, staff.IsActive });
            return Ok(new { staff.Id, staff.Name, staff.Email, staff.Role, staff.IsActive, staff.CreatedAt });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create staff user {Email}.", email);
            return ServiceUnavailable();
        }
    }

    [HttpPut("staff/{id}")]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> UpdateStaffUser(string id, [FromBody] AdminStaffUpdateRequest request)
    {
        if (_db == null) return ServiceUnavailable();
        if (!User.IsInRole("manager")) return Forbid();

        try
        {
            var cleanId = InputSanitizer.Clean(id, 80);
            var staff = await _db.StaffUsers.FirstOrDefaultAsync(user => user.Id == cleanId, HttpContext.RequestAborted);
            if (staff == null) return NotFound(new { message = "Staff user not found." });

            var oldValue = new { staff.Name, staff.Role, staff.IsActive };
            staff.Name = InputSanitizer.Clean(request.Name, 100);
            staff.Role = NormalizeStaffRole(request.Role);
            staff.IsActive = request.IsActive;

            if (!string.IsNullOrWhiteSpace(request.Password))
            {
                if (!PasswordPolicy.IsValid(request.Password))
                {
                    return BadRequest(new { message = PasswordPolicy.Message });
                }

                staff.PasswordHash = PasswordHasher.Hash(request.Password);
            }

            await _db.SaveChangesAsync(HttpContext.RequestAborted);
            if (_audit != null) await _audit.LogAsync("UpdateStaffUser", "StaffUser", staff.Id, oldValue, new { staff.Name, staff.Role, staff.IsActive, PasswordChanged = !string.IsNullOrWhiteSpace(request.Password) });
            return Ok(new { staff.Id, staff.Name, staff.Email, staff.Role, staff.IsActive, staff.CreatedAt });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to update staff user {StaffUserId}.", id);
            return ServiceUnavailable();
        }
    }

    [HttpGet("audit")]
    public async Task<IActionResult> GetAuditLogs([FromQuery] int limit = 80)
    {
        if (_db == null) return ServiceUnavailable();

        try
        {
            var take = Math.Clamp(limit, 20, 200);
            var logs = await _db.AuditLogs.AsNoTracking()
                .OrderByDescending(log => log.Timestamp)
                .Take(take)
                .ToListAsync(HttpContext.RequestAborted);
            return Ok(logs);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to load audit logs.");
            return ServiceUnavailable();
        }
    }

    [HttpGet("settings")]
    public async Task<IActionResult> GetStoreSettings()
    {
        if (_db == null) return ServiceUnavailable();

        try
        {
            var settings = await _db.StoreSettings.AsNoTracking()
                .OrderBy(setting => setting.Key)
                .ToListAsync(HttpContext.RequestAborted);
            return Ok(settings);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to load store settings.");
            return ServiceUnavailable();
        }
    }

    [HttpPut("settings/{key}")]
    [EnableRateLimiting("order-write")]
    public async Task<IActionResult> UpdateStoreSetting(string key, [FromBody] AdminStoreSettingRequest request)
    {
        if (_db == null) return ServiceUnavailable();

        var cleanKey = InputSanitizer.Clean(key, 120);
        if (string.IsNullOrWhiteSpace(cleanKey)) return BadRequest(new { message = "Setting key is required." });

        try
        {
            using var _ = JsonDocument.Parse(request.Value);
            var setting = await _db.StoreSettings.FirstOrDefaultAsync(item => item.Key == cleanKey, HttpContext.RequestAborted);
            var oldValue = setting?.Value;

            if (setting == null)
            {
                setting = new StoreSetting { Key = cleanKey, Value = request.Value };
                _db.StoreSettings.Add(setting);
            }
            else
            {
                setting.Value = request.Value;
            }

            await _db.SaveChangesAsync(HttpContext.RequestAborted);
            if (_audit != null) await _audit.LogAsync("UpdateStoreSetting", "StoreSetting", setting.Key, oldValue, setting.Value);
            return Ok(setting);
        }
        catch (JsonException)
        {
            return BadRequest(new { message = "Setting value must be valid JSON." });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to update store setting {StoreSettingKey}.", key);
            return ServiceUnavailable();
        }
    }

    [HttpPut("orders/{id}/status")]
    [EnableRateLimiting("order-write")]
    public async Task<IActionResult> UpdateStatus(string id, [FromBody] UpdateOrderStatusDto dto)
    {
        if (_db == null) return ServiceUnavailable();

        var status = InputSanitizer.Clean(dto.Status, 30);
        if (!ValidStatuses.Contains(status))
        {
            return BadRequest(new { message = "Unsupported order status." });
        }

        try
        {
            var cleanId = InputSanitizer.Clean(id, 80);
            var dbOrder = await _db.Orders.FirstOrDefaultAsync(
                o => o.Id == cleanId || o.OrderNumber == cleanId,
                HttpContext.RequestAborted);
            if (dbOrder == null) return NotFound(new { message = "Order not found" });

            var oldStatus = dbOrder.OrderStatus;
            if (!OrderStatusTransitions.CanTransition(oldStatus, status))
            {
                return Conflict(new { message = $"Cannot move order from {oldStatus} to {status}." });
            }

            dbOrder.OrderStatus = status;

            if (status == "Out for Delivery" && dbOrder.DeliveryLat != null && dbOrder.DeliveryLng != null)
            {
                dbOrder.EtaMinutes = await _maps.GetEtaMinutesAsync(dbOrder.DeliveryLat.Value, dbOrder.DeliveryLng.Value, HttpContext.RequestAborted)
                    ?? dbOrder.EtaMinutes;
            }

            await _db.SaveChangesAsync(HttpContext.RequestAborted);

            if (_audit != null)
            {
                await _audit.LogAsync("UpdateOrderStatus", "Order", dbOrder.Id, new { orderStatus = oldStatus }, new { orderStatus = status });
            }

            if (status == "Out for Delivery")
            {
                _notifications.SendOutForDeliveryInBackground(dbOrder);
            }

            await _hubContext.Clients
                .Group(OrderHub.Normalize(dbOrder.OrderNumber))
                .SendAsync("OrderStatusUpdated", new
                {
                    orderNumber = dbOrder.OrderNumber,
                    status = dbOrder.OrderStatus,
                    timestamp = DateTime.UtcNow,
                    etaMinutes = dbOrder.EtaMinutes
                });

            return Ok(new { success = true, orderId = id, orderStatus = status, etaMinutes = dbOrder.EtaMinutes });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to update order {OrderId} to {Status}", id, status);
            return ServiceUnavailable();
        }
    }

    private ObjectResult ServiceUnavailable()
    {
        return StatusCode(StatusCodes.Status503ServiceUnavailable, new { message = ServiceUnavailableMessage });
    }

    private static string NormalizeStaffRole(string? role)
    {
        var clean = (role ?? "staff").Trim().ToLowerInvariant();
        return clean is "manager" or "staff" ? clean : "staff";
    }
}

public sealed class AdminMenuItemRequest
{
    [MaxLength(80)]
    public string? Id { get; set; }

    [Required]
    [MaxLength(80)]
    public string CategoryId { get; set; } = string.Empty;

    [Required]
    [MaxLength(180)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(1000)]
    public string Description { get; set; } = string.Empty;

    [Range(0, 500)]
    public decimal Price { get; set; }

    [MaxLength(80)]
    public string CalorieInfo { get; set; } = string.Empty;

    [MaxLength(1000)]
    public string ImageUrl { get; set; } = string.Empty;

    public bool HasOptions { get; set; }
    public bool IsSpicy { get; set; }
    public bool IsBestseller { get; set; }
    public bool IsAvailable { get; set; } = true;
    public int StockCount { get; set; } = 999;
}

public sealed class AdminStaffRequest
{
    [Required]
    [MinLength(2)]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [Required]
    [EmailAddress]
    [MaxLength(120)]
    public string Email { get; set; } = string.Empty;

    [Required]
    [MinLength(8)]
    [MaxLength(200)]
    public string Password { get; set; } = string.Empty;

    [MaxLength(30)]
    public string Role { get; set; } = "staff";

    public bool IsActive { get; set; } = true;
}

public sealed class AdminStaffUpdateRequest
{
    [Required]
    [MinLength(2)]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(200)]
    public string? Password { get; set; }

    [MaxLength(30)]
    public string Role { get; set; } = "staff";

    public bool IsActive { get; set; } = true;
}

public sealed class AdminStoreSettingRequest
{
    [Required]
    public string Value { get; set; } = "{}";
}
