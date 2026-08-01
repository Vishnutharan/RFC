using Microsoft.AspNetCore.SignalR;

namespace RFC.Api.Hubs;

public sealed class OrderHub : Hub
{
    public Task JoinOrderGroup(string orderNumber)
    {
        if (string.IsNullOrWhiteSpace(orderNumber)) return Task.CompletedTask;
        return Groups.AddToGroupAsync(Context.ConnectionId, Normalize(orderNumber));
    }

    public Task LeaveOrderGroup(string orderNumber)
    {
        if (string.IsNullOrWhiteSpace(orderNumber)) return Task.CompletedTask;
        return Groups.RemoveFromGroupAsync(Context.ConnectionId, Normalize(orderNumber));
    }

    public static string Normalize(string orderNumber) => orderNumber.Trim().ToUpperInvariant();
}
