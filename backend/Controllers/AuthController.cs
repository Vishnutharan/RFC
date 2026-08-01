using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using RFC.Api.Data;
using RFC.Api.Models;
using RFC.Api.Security;

namespace RFC.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private static readonly List<DbCustomer> InMemoryCustomers = new();

    private readonly RfcDbContext? _db;
    private readonly IConfiguration _configuration;
    private readonly ILogger<AuthController> _logger;

    public AuthController(IServiceProvider provider, IConfiguration configuration, ILogger<AuthController> logger)
    {
        _db = provider.GetService<RfcDbContext>();
        _configuration = configuration;
        _logger = logger;
    }

    [HttpPost("admin/login")]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> AdminLogin([FromBody] LoginRequest request)
    {
        var configuredEmail = _configuration["Admin:Email"];
        var configuredHash = _configuration["Admin:PasswordHash"];
        var configuredRole = _configuration["Admin:Role"] ?? "staff";

        if (string.IsNullOrWhiteSpace(configuredEmail) || string.IsNullOrWhiteSpace(configuredHash))
        {
            _logger.LogError("Admin login attempted but Admin:Email or Admin:PasswordHash is not configured.");
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new { message = "Admin login is not configured." });
        }

        var emailMatches = string.Equals(configuredEmail.Trim(), request.Email.Trim(), StringComparison.OrdinalIgnoreCase);
        var passwordMatches = emailMatches && PasswordHasher.Verify(request.Password, configuredHash);
        if (!passwordMatches)
        {
            _logger.LogWarning("Failed admin login for {Email}", request.Email);
            return Unauthorized(new { message = "Invalid email or password." });
        }

        var user = new AuthUserDto("staff-admin", "RFC Staff", configuredEmail, configuredRole);
        await SignInAsync(user, isPersistent: false);
        return Ok(user);
    }

    [HttpPost("customers/register")]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> RegisterCustomer([FromBody] CustomerRegisterRequest request)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        var exists = _db != null
            ? await _db.Customers.AnyAsync(c => c.Email.ToLower() == email)
            : InMemoryCustomers.Any(c => string.Equals(c.Email, email, StringComparison.OrdinalIgnoreCase));

        if (exists)
        {
            return Conflict(new { message = "An account already exists for this email." });
        }

        var customer = new DbCustomer
        {
            Id = Guid.NewGuid().ToString(),
            Name = request.Name.Trim(),
            Email = email,
            Phone = request.Phone.Trim(),
            Address = request.Address.Trim(),
            Postcode = request.Postcode.Trim().ToUpperInvariant(),
            PasswordHash = PasswordHasher.Hash(request.Password),
            CreatedAt = DateTime.UtcNow
        };

        if (_db != null)
        {
            try
            {
                _db.Customers.Add(customer);
                await _db.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to create customer account for {Email}", email);
                return StatusCode(StatusCodes.Status503ServiceUnavailable, new { message = "Account could not be created." });
            }
        }
        else
        {
            InMemoryCustomers.Add(customer);
        }

        var user = ToCustomerDto(customer);
        await SignInAsync(user, isPersistent: true);
        return Ok(user);
    }

    [HttpPost("customers/login")]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> LoginCustomer([FromBody] LoginRequest request)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        var customer = _db != null
            ? await _db.Customers.FirstOrDefaultAsync(c => c.Email.ToLower() == email)
            : InMemoryCustomers.FirstOrDefault(c => string.Equals(c.Email, email, StringComparison.OrdinalIgnoreCase));

        if (customer == null || !PasswordHasher.Verify(request.Password, customer.PasswordHash))
        {
            return Unauthorized(new { message = "Invalid email or password." });
        }

        var user = ToCustomerDto(customer);
        await SignInAsync(user, isPersistent: true);
        return Ok(user);
    }

    [HttpGet("me")]
    public async Task<IActionResult> Me()
    {
        if (User.Identity?.IsAuthenticated != true)
        {
            return Ok(null);
        }

        var role = User.FindFirstValue(ClaimTypes.Role) ?? string.Empty;
        if (role == "customer" && _db != null)
        {
            var id = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var customer = await _db.Customers.AsNoTracking().FirstOrDefaultAsync(c => c.Id == id);
            if (customer != null) return Ok(ToCustomerDto(customer));
        }

        if (role == "customer")
        {
            var id = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var customer = InMemoryCustomers.FirstOrDefault(c => c.Id == id);
            if (customer != null) return Ok(ToCustomerDto(customer));
        }

        return Ok(new AuthUserDto(
            User.FindFirstValue(ClaimTypes.NameIdentifier) ?? string.Empty,
            User.FindFirstValue(ClaimTypes.Name) ?? string.Empty,
            User.FindFirstValue(ClaimTypes.Email) ?? string.Empty,
            role));
    }

    [Authorize(Policy = "CustomerOnly")]
    [HttpPut("customers/me")]
    public async Task<IActionResult> UpdateCustomer([FromBody] CustomerUpdateRequest request)
    {
        var id = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var customer = _db != null
            ? await _db.Customers.FirstOrDefaultAsync(c => c.Id == id)
            : InMemoryCustomers.FirstOrDefault(c => c.Id == id);

        if (customer == null) return NotFound(new { message = "Customer account not found." });

        customer.Name = request.Name.Trim();
        customer.Phone = request.Phone.Trim();
        customer.Address = request.Address.Trim();
        customer.Postcode = request.Postcode.Trim().ToUpperInvariant();
        customer.UpdatedAt = DateTime.UtcNow;
        if (_db != null)
        {
            await _db.SaveChangesAsync();
        }

        var user = ToCustomerDto(customer);
        await SignInAsync(user, isPersistent: true);
        return Ok(user);
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        return Ok(new { success = true });
    }

    private async Task SignInAsync(AuthUserDto user, bool isPersistent)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id),
            new(ClaimTypes.Name, user.Name),
            new(ClaimTypes.Email, user.Email),
            new(ClaimTypes.Role, user.Role)
        };

        if (!string.IsNullOrWhiteSpace(user.Phone)) claims.Add(new("phone", user.Phone));
        if (!string.IsNullOrWhiteSpace(user.Address)) claims.Add(new("address", user.Address));
        if (!string.IsNullOrWhiteSpace(user.Postcode)) claims.Add(new("postcode", user.Postcode));

        var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
        var principal = new ClaimsPrincipal(identity);
        await HttpContext.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, principal, new AuthenticationProperties
        {
            IsPersistent = isPersistent,
            AllowRefresh = true,
            ExpiresUtc = DateTimeOffset.UtcNow.AddHours(isPersistent ? 24 : 8)
        });
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
}
