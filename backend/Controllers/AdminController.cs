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
            dbOrder.OrderStatus = status;

            if (status == "Out for Delivery" && dbOrder.DeliveryLat != null && dbOrder.DeliveryLng != null)
            {
                dbOrder.EtaMinutes ??= await _maps.GetEtaMinutesAsync(dbOrder.DeliveryLat.Value, dbOrder.DeliveryLng.Value, HttpContext.RequestAborted);
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
}
