using System.Security.Claims;
using System.Text.Json;
using RFC.Api.Data;

namespace RFC.Api.Services;

public sealed class AuditService
{
    private readonly RfcDbContext _db;
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly ILogger<AuditService> _logger;

    public AuditService(RfcDbContext db, IHttpContextAccessor httpContextAccessor, ILogger<AuditService> logger)
    {
        _db = db;
        _httpContextAccessor = httpContextAccessor;
        _logger = logger;
    }

    public async Task LogAsync(string action, string entityType, string? entityId = null, object? oldValue = null, object? newValue = null)
    {
        try
        {
            var httpContext = _httpContextAccessor.HttpContext;
            _db.AuditLogs.Add(new AuditLog
            {
                Id = Guid.NewGuid().ToString("N"),
                UserId = httpContext?.User.FindFirstValue(ClaimTypes.NameIdentifier),
                Action = action,
                EntityType = entityType,
                EntityId = entityId,
                OldValue = oldValue == null ? null : JsonSerializer.Serialize(oldValue),
                NewValue = newValue == null ? null : JsonSerializer.Serialize(newValue),
                Timestamp = DateTime.UtcNow,
                IpAddress = httpContext?.Connection.RemoteIpAddress?.ToString()
            });
            await _db.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Audit log failed for {Action} on {EntityType}/{EntityId}", action, entityType, entityId);
        }
    }
}
