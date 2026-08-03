using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using RFC.Api.Data;
using RFC.Api.Security;

namespace RFC.Api.Services;

public sealed class OrderAccessService
{
    public const string AccessTokenHeader = "X-Order-Access-Token";
    public static readonly TimeSpan GuestAccessTokenLifetime = TimeSpan.FromHours(24);

    private readonly AuditService? _audit;
    private readonly ILogger<OrderAccessService> _logger;

    public OrderAccessService(IServiceProvider provider, ILogger<OrderAccessService> logger)
    {
        _audit = provider.GetService<AuditService>();
        _logger = logger;
    }

    public static string CreateAccessToken()
    {
        return Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
    }

    public static string HashAccessToken(string token)
    {
        var clean = InputSanitizer.Clean(token, 256);
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(clean));
        return Convert.ToHexString(hash).ToLowerInvariant();
    }

    public static string? GetAccessToken(HttpRequest request)
    {
        var token = InputSanitizer.CleanNullable(
            request.Headers[AccessTokenHeader].FirstOrDefault(),
            256);

        return string.IsNullOrWhiteSpace(token) ? null : token;
    }

    public bool HasAccess(DbOrder order, ClaimsPrincipal? user, string? presentedAccessToken)
    {
        if (IsOwnedByAuthenticatedCustomer(order, user))
        {
            return true;
        }

        if (string.IsNullOrWhiteSpace(presentedAccessToken) ||
            string.IsNullOrWhiteSpace(order.OrderAccessTokenHash) ||
            order.OrderAccessTokenExpiresAt == null ||
            order.OrderAccessTokenExpiresAt <= DateTime.UtcNow)
        {
            return false;
        }

        var presentedHash = HashAccessToken(presentedAccessToken);
        var storedHashBytes = Encoding.UTF8.GetBytes(order.OrderAccessTokenHash);
        var presentedHashBytes = Encoding.UTF8.GetBytes(presentedHash);
        return storedHashBytes.Length == presentedHashBytes.Length &&
               CryptographicOperations.FixedTimeEquals(storedHashBytes, presentedHashBytes);
    }

    public async Task AuditDeniedAsync(
        string action,
        DbOrder? order,
        string? presentedAccessToken,
        string reason)
    {
        try
        {
            if (_audit == null) return;

            await _audit.LogAsync(
                action,
                "Order",
                order?.Id,
                null,
                new
                {
                    orderNumber = order?.OrderNumber,
                    reason,
                    hasAccessToken = !string.IsNullOrWhiteSpace(presentedAccessToken)
                });
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to audit denied order access for {Action}.", action);
        }
    }

    private static bool IsOwnedByAuthenticatedCustomer(DbOrder order, ClaimsPrincipal? user)
    {
        if (user?.Identity?.IsAuthenticated != true || !user.IsInRole("customer"))
        {
            return false;
        }

        var customerId = user.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!string.IsNullOrWhiteSpace(order.CustomerId) &&
            string.Equals(order.CustomerId, customerId, StringComparison.Ordinal))
        {
            return true;
        }

        return false;
    }
}
