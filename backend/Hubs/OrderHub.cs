using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using RFC.Api.Data;
using RFC.Api.Security;
using RFC.Api.Services;

namespace RFC.Api.Hubs;

public sealed class OrderHub : Hub
{
    private readonly RfcDbContext? _db;
    private readonly OrderAccessService _orderAccess;
    private readonly ILogger<OrderHub> _logger;

    public OrderHub(IServiceProvider provider, OrderAccessService orderAccess, ILogger<OrderHub> logger)
    {
        _db = provider.GetService<RfcDbContext>();
        _orderAccess = orderAccess;
        _logger = logger;
    }

    public async Task JoinOrderGroup(string orderNumber, string? accessToken = null)
    {
        if (string.IsNullOrWhiteSpace(orderNumber) || _db == null) return;

        var clean = InputSanitizer.Clean(orderNumber, 80);
        var order = await _db.Orders.AsNoTracking().FirstOrDefaultAsync(
            item => item.Id == clean || item.OrderNumber == clean,
            Context.ConnectionAborted);

        if (order == null)
        {
            await _orderAccess.AuditDeniedAsync("OrderTrackingJoinDenied", null, accessToken, "order not found");
            _logger.LogWarning("Rejected SignalR order-group join for unknown order {OrderNumber}.", clean);
            return;
        }

        if (!_orderAccess.HasAccess(order, Context.User, accessToken))
        {
            await _orderAccess.AuditDeniedAsync("OrderTrackingJoinDenied", order, accessToken, "ownership proof failed");
            _logger.LogWarning("Rejected SignalR order-group join for order {OrderNumber}.", order.OrderNumber);
            return;
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, Normalize(order.OrderNumber), Context.ConnectionAborted);
    }

    public Task LeaveOrderGroup(string orderNumber)
    {
        if (string.IsNullOrWhiteSpace(orderNumber)) return Task.CompletedTask;
        return Groups.RemoveFromGroupAsync(Context.ConnectionId, Normalize(orderNumber));
    }

    public static string Normalize(string orderNumber) => orderNumber.Trim().ToUpperInvariant();
}
