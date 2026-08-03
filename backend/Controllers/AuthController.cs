using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using RFC.Api.Data;
using RFC.Api.Models;
using RFC.Api.Security;
using RFC.Api.Services;

namespace RFC.Api.Controllers;

[ApiController]
[RequestSizeLimit(1_048_576)]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private const string ServiceUnavailableMessage = "Service temporarily unavailable. Please try again shortly.";
    private static readonly TimeSpan FailedAttemptWindow = TimeSpan.FromMinutes(15);
    private static readonly TimeSpan LockoutDuration = TimeSpan.FromMinutes(30);

    private readonly RfcDbContext? _db;
    private readonly AuditService? _audit;
    private readonly IConfiguration _configuration;
    private readonly IHostEnvironment _environment;
    private readonly ILogger<AuthController> _logger;

    public AuthController(
        IServiceProvider provider,
        IConfiguration configuration,
        IHostEnvironment environment,
        ILogger<AuthController> logger)
    {
        _db = provider.GetService<RfcDbContext>();
        _audit = provider.GetService<AuditService>();
        _configuration = configuration;
        _environment = environment;
        _logger = logger;
    }

    [HttpPost("admin/login")]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> AdminLogin([FromBody] LoginRequest request)
    {
        if (_db == null) return ServiceUnavailable();

        var email = NormalizeEmail(request.Email);
        try
        {
            if (await IsLockedOutAsync(email, "staff"))
            {
                _logger.LogWarning("Locked staff login attempt for {Email}", email);
                return Unauthorized(new { message = "Invalid email or password." });
            }

            var staff = await _db.StaffUsers.FirstOrDefaultAsync(
                user => user.Email == email && user.IsActive,
                HttpContext.RequestAborted);
            if (staff == null || !PasswordHasher.Verify(request.Password, staff.PasswordHash))
            {
                await RecordFailedLoginAsync(email, "staff");
                return Unauthorized(new { message = "Invalid email or password." });
            }

            if (PasswordHasher.NeedsRehash(staff.PasswordHash))
            {
                staff.PasswordHash = PasswordHasher.Hash(request.Password);
                staff.SecurityStamp = Guid.NewGuid().ToString("N");
                await _db.SaveChangesAsync(HttpContext.RequestAborted);
            }

            await ClearFailedLoginAsync(email, "staff");
            var user = new AuthUserDto(staff.Id, staff.Name, staff.Email, staff.Role);
            await SignInAsync(user, staff.SecurityStamp, isPersistent: false);
            if (_audit != null) await _audit.LogAsync("Login", "StaffUser", staff.Id, null, new { staff.Email, staff.Role });
            return Ok(user);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Staff login failed for {Email}", email);
            return ServiceUnavailable();
        }
    }

    [HttpPost("customers/register")]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> RegisterCustomer([FromBody] CustomerRegisterRequest request)
    {
        if (_db == null) return ServiceUnavailable();
        if (!PasswordPolicy.IsValid(request.Password))
        {
            return BadRequest(new { message = PasswordPolicy.Message });
        }

        if (!request.ConsentAccepted)
        {
            return BadRequest(new { message = "Privacy policy consent is required." });
        }

        var email = NormalizeEmail(request.Email);
        try
        {
            var exists = await _db.Customers.AnyAsync(c => c.Email == email, HttpContext.RequestAborted);
            if (exists)
            {
                return Conflict(new { message = "An account already exists for this email." });
            }

            var customer = new DbCustomer
            {
                Id = Guid.NewGuid().ToString("N"),
                Name = InputSanitizer.Clean(request.Name, 100),
                Email = email,
                Phone = InputSanitizer.Clean(request.Phone, 30),
                Address = InputSanitizer.Clean(request.Address, 400),
                Postcode = InputSanitizer.Clean(request.Postcode, 20).ToUpperInvariant(),
                PasswordHash = PasswordHasher.Hash(request.Password),
                CreatedAt = DateTime.UtcNow
            };

            _db.Customers.Add(customer);
            await _db.SaveChangesAsync(HttpContext.RequestAborted);

            var user = ToCustomerDto(customer);
            await SignInAsync(user, customer.SecurityStamp, isPersistent: true);
            return Ok(user);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create customer account for {Email}", email);
            return ServiceUnavailable();
        }
    }

    [HttpPost("customers/login")]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> LoginCustomer([FromBody] LoginRequest request)
    {
        if (_db == null) return ServiceUnavailable();

        var email = NormalizeEmail(request.Email);
        try
        {
            if (await IsLockedOutAsync(email, "customer"))
            {
                return Unauthorized(new { message = "Invalid email or password." });
            }

            var customer = await _db.Customers.FirstOrDefaultAsync(c => c.Email == email, HttpContext.RequestAborted);
            if (customer == null || !PasswordHasher.Verify(request.Password, customer.PasswordHash))
            {
                await RecordFailedLoginAsync(email, "customer");
                return Unauthorized(new { message = "Invalid email or password." });
            }

            if (PasswordHasher.NeedsRehash(customer.PasswordHash))
            {
                customer.PasswordHash = PasswordHasher.Hash(request.Password);
                customer.SecurityStamp = Guid.NewGuid().ToString("N");
                customer.UpdatedAt = DateTime.UtcNow;
                await _db.SaveChangesAsync(HttpContext.RequestAborted);
            }

            await ClearFailedLoginAsync(email, "customer");
            var user = ToCustomerDto(customer);
            await SignInAsync(user, customer.SecurityStamp, isPersistent: true);
            return Ok(user);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Customer login failed for {Email}", email);
            return ServiceUnavailable();
        }
    }

    [HttpGet("me")]
    public async Task<IActionResult> Me()
    {
        if (User.Identity?.IsAuthenticated != true)
        {
            return Ok(null);
        }

        if (_db == null) return ServiceUnavailable();

        var id = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var role = User.FindFirstValue(ClaimTypes.Role) ?? string.Empty;

        try
        {
            if (role == "customer")
            {
                var customer = await _db.Customers.AsNoTracking().FirstOrDefaultAsync(c => c.Id == id, HttpContext.RequestAborted);
                return customer == null ? Unauthorized() : Ok(ToCustomerDto(customer));
            }

            var staff = await _db.StaffUsers.AsNoTracking().FirstOrDefaultAsync(
                s => s.Id == id && s.IsActive,
                HttpContext.RequestAborted);
            return staff == null
                ? Unauthorized()
                : Ok(new AuthUserDto(staff.Id, staff.Name, staff.Email, staff.Role));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to load current session.");
            return ServiceUnavailable();
        }
    }

    [Authorize(Policy = "CustomerOnly")]
    [HttpPut("customers/me")]
    public async Task<IActionResult> UpdateCustomer([FromBody] CustomerUpdateRequest request)
    {
        if (_db == null) return ServiceUnavailable();

        var id = User.FindFirstValue(ClaimTypes.NameIdentifier);
        try
        {
            var customer = await _db.Customers.FirstOrDefaultAsync(c => c.Id == id, HttpContext.RequestAborted);
            if (customer == null) return NotFound(new { message = "Customer account not found." });

            customer.Name = InputSanitizer.Clean(request.Name, 100);
            customer.Phone = InputSanitizer.Clean(request.Phone, 30);
            customer.Address = InputSanitizer.Clean(request.Address, 400);
            customer.Postcode = InputSanitizer.Clean(request.Postcode, 20).ToUpperInvariant();
            customer.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(HttpContext.RequestAborted);

            var user = ToCustomerDto(customer);
            await SignInAsync(user, customer.SecurityStamp, isPersistent: true);
            return Ok(user);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to update customer {CustomerId}", id);
            return ServiceUnavailable();
        }
    }

    [Authorize(Policy = "CustomerOnly")]
    [HttpGet("customers/me/orders")]
    public async Task<IActionResult> GetCustomerOrders([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        if (_db == null) return ServiceUnavailable();

        var customerId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var safePage = Math.Max(1, page);
        var safePageSize = Math.Clamp(pageSize, 1, 50);
        try
        {
            var orders = await _db.Orders.AsNoTracking()
                .Where(order => order.CustomerId == customerId)
                .OrderByDescending(order => order.CreatedAt)
                .Skip((safePage - 1) * safePageSize)
                .Take(safePageSize)
                .ToListAsync(HttpContext.RequestAborted);

            return Ok(orders.Select(OrdersController.MapToOrderDto));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to load orders for customer {CustomerId}", customerId);
            return ServiceUnavailable();
        }
    }

    [Authorize(Policy = "CustomerOnly")]
    [HttpDelete("customers/me")]
    public async Task<IActionResult> DeleteCustomer()
    {
        if (_db == null) return ServiceUnavailable();

        var id = User.FindFirstValue(ClaimTypes.NameIdentifier);
        try
        {
            var customer = await _db.Customers.FirstOrDefaultAsync(c => c.Id == id, HttpContext.RequestAborted);
            if (customer == null) return NotFound(new { message = "Customer account not found." });

            await using var transaction = await _db.Database.BeginTransactionAsync(HttpContext.RequestAborted);
            var anonymousEmail = $"deleted-{customer.Id}@deleted.local";
            var orders = await _db.Orders
                .Where(order => order.CustomerId == customer.Id)
                .ToListAsync(HttpContext.RequestAborted);
            var orderNumbers = orders.Select(order => order.OrderNumber).ToList();
            foreach (var order in orders)
            {
                order.CustomerName = "Deleted Customer";
                order.CustomerEmail = anonymousEmail;
                order.CustomerId = null;
                order.CustomerPhone = string.Empty;
                order.DeliveryAddress = "Anonymised";
                order.DeliveryPostcode = string.Empty;
                order.DeliveryNotes = string.Empty;
                order.OrderAccessTokenHash = null;
                order.OrderAccessTokenExpiresAt = null;
            }

            var feedback = await _db.Reviews
                .Where(review => review.OrderNumber != null && orderNumbers.Contains(review.OrderNumber))
                .ToListAsync(HttpContext.RequestAborted);
            foreach (var item in feedback)
            {
                item.CustomerName = "Deleted Customer";
                item.OrderNumber = null;
                item.Comment = "Removed at the account holder's request.";
            }

            var auditRows = await _db.AuditLogs
                .Where(log => log.UserId == customer.Id ||
                              (log.EntityType == "Customer" && log.EntityId == customer.Id))
                .ToListAsync(HttpContext.RequestAborted);
            foreach (var log in auditRows)
            {
                log.UserId = null;
                log.EntityId = null;
                log.OldValue = null;
                log.NewValue = null;
                log.IpAddress = null;
            }

            var voucherRedemptions = await _db.VoucherRedemptions
                .Where(item => item.CustomerId == customer.Id)
                .ToListAsync(HttpContext.RequestAborted);
            _db.VoucherRedemptions.RemoveRange(voucherRedemptions);

            customer.Name = "Deleted Customer";
            customer.Email = anonymousEmail;
            customer.Phone = string.Empty;
            customer.Address = "Anonymised";
            customer.Postcode = string.Empty;
            customer.PasswordHash = PasswordHasher.Hash(Guid.NewGuid().ToString("N") + "Aa1");
            customer.SecurityStamp = Guid.NewGuid().ToString("N");
            customer.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(HttpContext.RequestAborted);
            await transaction.CommitAsync(HttpContext.RequestAborted);

            await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            return Ok(new { success = true });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to delete customer {CustomerId}", id);
            return ServiceUnavailable();
        }
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var role = User.FindFirstValue(ClaimTypes.Role);
        if (_audit != null && !string.IsNullOrWhiteSpace(userId))
        {
            await _audit.LogAsync("Logout", role == "customer" ? "Customer" : "StaffUser", userId);
        }

        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        return Ok(new { success = true });
    }

    private async Task<bool> IsLockedOutAsync(string email, string realm)
    {
        if (_db == null) return false;

        var key = BuildLoginAttemptKey(email, realm);
        var attempt = await _db.LoginAttempts.FirstOrDefaultAsync(item => item.Email == key, HttpContext.RequestAborted);
        return attempt?.LockedUntil != null && attempt.LockedUntil > DateTime.UtcNow;
    }

    private async Task RecordFailedLoginAsync(string email, string realm)
    {
        if (_db == null) return;

        var now = DateTime.UtcNow;
        var key = BuildLoginAttemptKey(email, realm);
        var attempt = await _db.LoginAttempts.FirstOrDefaultAsync(item => item.Email == key, HttpContext.RequestAborted);
        if (attempt == null)
        {
            attempt = new LoginAttempt
            {
                Id = Guid.NewGuid().ToString("N"),
                Email = key,
                AttemptCount = 1,
                LastAttemptAt = now
            };
            _db.LoginAttempts.Add(attempt);
        }
        else
        {
            attempt.AttemptCount = attempt.LastAttemptAt < now.Subtract(FailedAttemptWindow)
                ? 1
                : attempt.AttemptCount + 1;
            attempt.LastAttemptAt = now;
        }

        if (attempt.AttemptCount >= 5)
        {
            attempt.LockedUntil = now.Add(LockoutDuration);
        }

        await _db.SaveChangesAsync(HttpContext.RequestAborted);
    }

    private async Task ClearFailedLoginAsync(string email, string realm)
    {
        if (_db == null) return;

        var key = BuildLoginAttemptKey(email, realm);
        var attempt = await _db.LoginAttempts.FirstOrDefaultAsync(item => item.Email == key, HttpContext.RequestAborted);
        if (attempt == null) return;

        _db.LoginAttempts.Remove(attempt);
        await _db.SaveChangesAsync(HttpContext.RequestAborted);
    }

    private async Task SignInAsync(AuthUserDto user, string securityStamp, bool isPersistent)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id),
            new(ClaimTypes.Role, user.Role),
            new("security_stamp", securityStamp)
        };

        var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
        var principal = new ClaimsPrincipal(identity);
        await HttpContext.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, principal, new AuthenticationProperties
        {
            IsPersistent = isPersistent,
            AllowRefresh = true,
            ExpiresUtc = DateTimeOffset.UtcNow.AddHours(isPersistent ? 8 : 4)
        });
    }

    private string BuildLoginAttemptKey(string email, string realm)
    {
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        var value = $"{realm}|{email}|{ipAddress}";
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value))).ToLowerInvariant();
    }

    private static AuthUserDto ToCustomerDto(DbCustomer customer)
    {
        return new AuthUserDto(
            customer.Id,
            customer.Name,
            customer.Email,
            "customer",
            customer.Phone,
            customer.Address,
            customer.Postcode);
    }

    private static string NormalizeEmail(string email) => InputSanitizer.Clean(email, 120).ToLowerInvariant();

    private ObjectResult ServiceUnavailable()
    {
        if (_environment.IsDevelopment())
        {
            var connectionString = _configuration.GetConnectionString("RfcDatabase") ?? string.Empty;
            var message = connectionString.Contains("YOUR_PASSWORD", StringComparison.OrdinalIgnoreCase) ||
                          connectionString.Contains("replace-me", StringComparison.OrdinalIgnoreCase)
                ? "Supabase database password is missing. Replace YOUR_PASSWORD in .env.local with the real database password, then restart the backend."
                : "Supabase database connection failed. Check the database password, pooler host, and network access.";

            return StatusCode(StatusCodes.Status503ServiceUnavailable, new { message });
        }

        return StatusCode(StatusCodes.Status503ServiceUnavailable, new { message = ServiceUnavailableMessage });
    }
}
