using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using RFC.Api.Data;
using RFC.Api.Models;
using RFC.Api.Services;

namespace RFC.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class OrdersController : ControllerBase
{
    private static readonly List<Order> SharedOrders = new();
    private static readonly HashSet<string> CustomerCancellableStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        "Placed",
        "Preparing"
    };

    private readonly RfcDbContext? _db;
    private readonly OrderPricingService _pricing;
    private readonly ILogger<OrdersController> _logger;

    public OrdersController(IServiceProvider provider, OrderPricingService pricing, ILogger<OrdersController> logger)
    {
        _db = provider.GetService<RfcDbContext>();
        _pricing = pricing;
        _logger = logger;
    }

    [HttpPost]
    [EnableRateLimiting("order-write")]
    public async Task<IActionResult> CreateOrder([FromBody] Order order)
    {
        var pricingResult = await _pricing.PriceAsync(order);
        if (!pricingResult.IsValid || pricingResult.Order == null)
        {
            return BadRequest(new { message = pricingResult.Error });
        }

        var pricedOrder = pricingResult.Order;
        var now = DateTime.UtcNow;
        pricedOrder.Id = Guid.NewGuid().ToString();
        pricedOrder.OrderNumber = $"RFC-{Random.Shared.Next(100000, 999999)}";
        pricedOrder.CreatedAt = now;
        pricedOrder.OrderStatus = "Placed";
        pricedOrder.OrderTime = string.IsNullOrWhiteSpace(pricedOrder.OrderTime)
            ? now.ToString("dd MMM yyyy, HH:mm:ss")
            : pricedOrder.OrderTime;

        if (_db != null)
        {
            try
            {
                _db.Orders.Add(ToDbOrder(pricedOrder));
                await _db.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to persist order {OrderNumber}", pricedOrder.OrderNumber);
                return StatusCode(StatusCodes.Status503ServiceUnavailable, new { message = "Order could not be saved. Please try again." });
            }
        }
        else
        {
            SharedOrders.Insert(0, pricedOrder);
        }

        return Ok(pricedOrder);
    }

    [HttpGet("{idOrNumber}")]
    public async Task<IActionResult> GetOrder(string idOrNumber)
    {
        if (_db != null)
        {
            try
            {
                var dbOrder = await _db.Orders.AsNoTracking().FirstOrDefaultAsync(o => o.Id == idOrNumber || o.OrderNumber == idOrNumber);
                if (dbOrder != null) return Ok(MapToOrderDto(dbOrder));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to load order {OrderIdOrNumber}", idOrNumber);
            }
        }

        var mem = SharedOrders.FirstOrDefault(o => o.Id == idOrNumber || o.OrderNumber == idOrNumber);
        return mem != null ? Ok(mem) : NotFound(new { message = "Order not found" });
    }

    [HttpPut("{idOrNumber}/cancel")]
    [EnableRateLimiting("order-write")]
    public async Task<IActionResult> CancelOrder(string idOrNumber, [FromBody] CancelOrderRequest request)
    {
        if (_db != null)
        {
            try
            {
                var dbOrder = await _db.Orders.FirstOrDefaultAsync(o => o.Id == idOrNumber || o.OrderNumber == idOrNumber);
                if (dbOrder == null) return NotFound(new { message = "Order not found" });
                if (!CustomerCancellableStatuses.Contains(dbOrder.OrderStatus))
                {
                    return Conflict(new { message = "This order can no longer be cancelled online." });
                }

                dbOrder.OrderStatus = "Cancelled";
                dbOrder.CancellationReason = request.Reason;
                await _db.SaveChangesAsync();
                return Ok(MapToOrderDto(dbOrder));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to cancel order {OrderIdOrNumber}", idOrNumber);
                return StatusCode(StatusCodes.Status503ServiceUnavailable, new { message = "Order could not be cancelled. Please call the store." });
            }
        }

        var mem = SharedOrders.FirstOrDefault(o => o.Id == idOrNumber || o.OrderNumber == idOrNumber);
        if (mem == null) return NotFound(new { message = "Order not found" });
        if (!CustomerCancellableStatuses.Contains(mem.OrderStatus))
        {
            return Conflict(new { message = "This order can no longer be cancelled online." });
        }

        mem.OrderStatus = "Cancelled";
        mem.CancellationReason = request.Reason;
        return Ok(mem);
    }

    public static Order MapToOrderDto(DbOrder dbOrder)
    {
        List<OrderItem> items = new();
        try
        {
            items = JsonSerializer.Deserialize<List<OrderItem>>(dbOrder.ItemsJson, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            }) ?? new();
        }
        catch
        {
            items = new();
        }

        return new Order
        {
            Id = dbOrder.Id,
            OrderNumber = dbOrder.OrderNumber,
            OrderType = dbOrder.OrderType,
            CustomerName = dbOrder.CustomerName,
            CustomerPhone = dbOrder.CustomerPhone,
            CustomerEmail = dbOrder.CustomerEmail,
            DeliveryAddress = dbOrder.DeliveryAddress,
            DeliveryPostcode = dbOrder.DeliveryPostcode,
            DeliveryNotes = dbOrder.DeliveryNotes,
            Items = items,
            Subtotal = dbOrder.Subtotal,
            DiscountAmount = dbOrder.DiscountAmount,
            DeliveryFee = dbOrder.DeliveryFee,
            Total = dbOrder.Total,
            VoucherCode = dbOrder.VoucherCode,
            PaymentMethod = dbOrder.PaymentMethod,
            PaymentStatus = dbOrder.PaymentStatus,
            OrderStatus = dbOrder.OrderStatus,
            OrderTime = dbOrder.OrderTime,
            CancellationReason = dbOrder.CancellationReason,
            CreatedAt = dbOrder.CreatedAt
        };
    }

    internal static DbOrder ToDbOrder(Order order)
    {
        return new DbOrder
        {
            Id = order.Id,
            OrderNumber = order.OrderNumber,
            OrderType = order.OrderType,
            CustomerName = order.CustomerName,
            CustomerPhone = order.CustomerPhone,
            CustomerEmail = order.CustomerEmail,
            DeliveryAddress = order.DeliveryAddress,
            DeliveryPostcode = order.DeliveryPostcode,
            DeliveryNotes = order.DeliveryNotes,
            ItemsJson = JsonSerializer.Serialize(order.Items),
            Subtotal = order.Subtotal,
            DiscountAmount = order.DiscountAmount,
            DeliveryFee = order.DeliveryFee,
            Total = order.Total,
            VoucherCode = order.VoucherCode,
            PaymentMethod = order.PaymentMethod,
            PaymentStatus = order.PaymentStatus,
            OrderStatus = order.OrderStatus,
            OrderTime = order.OrderTime,
            CancellationReason = order.CancellationReason,
            CreatedAt = order.CreatedAt
        };
    }
}

[ApiController]
[Authorize(Policy = "StaffOnly")]
[Route("api/[controller]")]
public class AdminController : ControllerBase
{
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
    private readonly ILogger<AdminController> _logger;

    public AdminController(IServiceProvider provider, ILogger<AdminController> logger)
    {
        _db = provider.GetService<RfcDbContext>();
        _logger = logger;
    }

    [HttpGet("orders")]
    public async Task<IActionResult> GetAllOrders()
    {
        if (_db != null)
        {
            try
            {
                var dbOrders = await _db.Orders.AsNoTracking().OrderByDescending(o => o.CreatedAt).ToListAsync();
                return Ok(dbOrders.Select(OrdersController.MapToOrderDto).ToList());
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to load admin order list.");
                return StatusCode(StatusCodes.Status503ServiceUnavailable, new { message = "Orders could not be loaded." });
            }
        }

        return Ok(Array.Empty<Order>());
    }

    [HttpPut("orders/{id}/status")]
    [EnableRateLimiting("order-write")]
    public async Task<IActionResult> UpdateStatus(string id, [FromBody] UpdateOrderStatusDto dto)
    {
        if (!ValidStatuses.Contains(dto.Status))
        {
            return BadRequest(new { message = "Unsupported order status." });
        }

        if (_db != null)
        {
            try
            {
                var dbOrder = await _db.Orders.FirstOrDefaultAsync(o => o.Id == id || o.OrderNumber == id);
                if (dbOrder == null) return NotFound(new { message = "Order not found" });

                dbOrder.OrderStatus = dto.Status;
                await _db.SaveChangesAsync();
                return Ok(new { success = true, orderId = id, orderStatus = dto.Status });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to update order {OrderId} to {Status}", id, dto.Status);
                return StatusCode(StatusCodes.Status503ServiceUnavailable, new { message = "Order status could not be updated." });
            }
        }

        return NotFound(new { message = "Order not found" });
    }
}
