namespace RFC.Api.Services;

public static class OrderStatusTransitions
{
    private static readonly HashSet<string> TerminalStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        "Completed",
        "Cancelled"
    };

    private static readonly IReadOnlyDictionary<string, HashSet<string>> AllowedTransitions =
        new Dictionary<string, HashSet<string>>(StringComparer.OrdinalIgnoreCase)
        {
            ["Placed"] = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "Preparing", "Cancelled" },
            ["Preparing"] = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "Out for Delivery", "Ready for Collection", "Cancelled" },
            ["Out for Delivery"] = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "Completed" },
            ["Ready for Collection"] = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "Completed" }
        };

    public static bool IsTerminal(string? status)
    {
        return !string.IsNullOrWhiteSpace(status) && TerminalStatuses.Contains(status);
    }

    public static bool CanTransition(string? currentStatus, string nextStatus)
    {
        if (string.IsNullOrWhiteSpace(currentStatus) || string.IsNullOrWhiteSpace(nextStatus))
        {
            return false;
        }

        if (IsTerminal(currentStatus))
        {
            return false;
        }

        if (string.Equals(currentStatus, nextStatus, StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        return AllowedTransitions.TryGetValue(currentStatus, out var allowed) && allowed.Contains(nextStatus);
    }
}
