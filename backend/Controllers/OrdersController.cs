using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RFC.Api.Data;
using RFC.Api.Models;

namespace RFC.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class OrdersController : ControllerBase
{
    private readonly RfcDbContext? _db;
    public static readonly List<Order> SharedOrders = new();

    public OrdersController(IServiceProvider provider)
    {
        try { _db = provider.GetService<RfcDbContext>(); } catch { }
    }

    [HttpPost]
    public async Task<IActionResult> CreateOrder([FromBody] Order order)
    {
        if (order == null || order.Items == null || order.Items.Count == 0)
        {
            return BadRequest("Order items cannot be empty");
        }

        var now = DateTime.UtcNow;
        order.Id = Guid.NewGuid().ToString();
        order.OrderNumber = $"RFC-{Random.Shared.Next(100000, 999999)}";
        order.CreatedAt = now;
        order.OrderStatus = "Placed";
        if (string.IsNullOrEmpty(order.OrderTime))
        {
            order.OrderTime = now.ToString("dd MMM yyyy, HH:mm:ss");
        }

        if (_db != null)
        {
            try
            {
                var dbOrder = new DbOrder
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

                _db.Orders.Add(dbOrder);
                await _db.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[OrdersController] Save Order DB info: {ex.Message}");
            }
        }

        SharedOrders.Insert(0, order);
        return Ok(order);
    }

    [HttpGet("{idOrNumber}")]
    public async Task<IActionResult> GetOrder(string idOrNumber)
    {
        if (_db != null)
        {
            try
            {
                var dbOrder = await _db.Orders.AsNoTracking().FirstOrDefaultAsync(o => o.Id == idOrNumber || o.OrderNumber == idOrNumber);
                if (dbOrder != null)
                {
                    return Ok(MapToOrderDto(dbOrder));
                }
            }
            catch { }
        }

        var mem = SharedOrders.FirstOrDefault(o => o.Id == idOrNumber || o.OrderNumber == idOrNumber);
        if (mem != null) return Ok(mem);
        return NotFound("Order not found");
    }

    public static Order MapToOrderDto(DbOrder dbOrder)
    {
        List<OrderItem> items = new();
        try
        {
            items = JsonSerializer.Deserialize<List<OrderItem>>(dbOrder.ItemsJson) ?? new();
        }
        catch { }

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
}

[ApiController]
[Route("api/[controller]")]
public class AdminController : ControllerBase
{
    private readonly RfcDbContext? _db;

    public AdminController(IServiceProvider provider)
    {
        try { _db = provider.GetService<RfcDbContext>(); } catch { }
    }

    [HttpGet("orders")]
    public async Task<IActionResult> GetAllOrders()
    {
        if (_db != null)
        {
            try
            {
                var dbOrders = await _db.Orders.AsNoTracking().OrderByDescending(o => o.CreatedAt).ToListAsync();
                if (dbOrders != null && dbOrders.Count > 0)
                {
                    var dtos = dbOrders.Select(OrdersController.MapToOrderDto).ToList();
                    return Ok(dtos);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[AdminController] Get Orders DB info: {ex.Message}");
            }
        }

        return Ok(OrdersController.SharedOrders);
    }

    [HttpPut("orders/{id}/status")]
    public async Task<IActionResult> UpdateStatus(string id, [FromBody] UpdateOrderStatusDto dto)
    {
        if (_db != null)
        {
            try
            {
                var dbOrder = await _db.Orders.FirstOrDefaultAsync(o => o.Id == id || o.OrderNumber == id);
                if (dbOrder != null)
                {
                    dbOrder.OrderStatus = dto.Status;
                    await _db.SaveChangesAsync();
                }
            }
            catch { }
        }

        var mem = OrdersController.SharedOrders.FirstOrDefault(o => o.Id == id || o.OrderNumber == id);
        if (mem != null) mem.OrderStatus = dto.Status;

        return Ok(new { success = true, orderId = id, orderStatus = dto.Status });
    }
}
