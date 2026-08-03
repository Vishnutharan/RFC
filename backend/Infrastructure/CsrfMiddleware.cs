using System.Security.Cryptography;

namespace RFC.Api.Infrastructure;

public sealed class CsrfMiddleware
{
    public const string CookieName = "rfc_csrf";
    public const string HeaderName = "X-CSRF-Token";

    private static readonly HashSet<string> UnsafeMethods = new(StringComparer.OrdinalIgnoreCase)
    {
        HttpMethods.Post,
        HttpMethods.Put,
        HttpMethods.Delete,
        HttpMethods.Patch
    };

    private readonly RequestDelegate _next;
    private readonly IHostEnvironment _environment;
    private readonly HashSet<string> _allowedOrigins;

    public CsrfMiddleware(RequestDelegate next, IHostEnvironment environment, IConfiguration configuration)
    {
        _next = next;
        _environment = environment;
        var rawOrigins = configuration["Cors:AllowedOrigins"] ??
                         configuration["Cors__AllowedOrigins"] ??
                         "http://localhost:3000,http://127.0.0.1:3000";
        _allowedOrigins = rawOrigins
            .Split([',', ';'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(origin => origin.TrimEnd('/'))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
    }

    public async Task InvokeAsync(HttpContext context)
    {
        if (ShouldIssueToken(context))
        {
            EnsureTokenCookie(context);
        }

        if (UnsafeMethods.Contains(context.Request.Method) && ShouldValidate(context))
        {
            if (!HasAllowedOrigin(context))
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                await context.Response.WriteAsJsonAsync(new { message = "Request origin is not allowed." });
                return;
            }

            var cookieToken = context.Request.Cookies[CookieName];
            var headerToken = context.Request.Headers[HeaderName].FirstOrDefault();

            if (string.IsNullOrWhiteSpace(cookieToken) ||
                string.IsNullOrWhiteSpace(headerToken) ||
                !FixedTimeEquals(cookieToken, headerToken))
            {
                context.Response.StatusCode = StatusCodes.Status400BadRequest;
                await context.Response.WriteAsJsonAsync(new { message = "Invalid CSRF token." });
                return;
            }
        }

        await _next(context);
    }

    private static bool ShouldIssueToken(HttpContext context)
    {
        return HttpMethods.IsGet(context.Request.Method) &&
               context.Request.Path.Equals("/api/auth/me", StringComparison.OrdinalIgnoreCase);
    }

    private static bool ShouldValidate(HttpContext context)
    {
        var path = context.Request.Path;
        return !path.StartsWithSegments("/api/payments/confirm-webhook") &&
               !path.StartsWithSegments("/hubs");
    }

    private void EnsureTokenCookie(HttpContext context)
    {
        if (!string.IsNullOrWhiteSpace(context.Request.Cookies[CookieName])) return;

        context.Response.Cookies.Append(CookieName, CreateToken(), new CookieOptions
        {
            HttpOnly = false,
            SameSite = SameSiteMode.Lax,
            Secure = !_environment.IsDevelopment() || context.Request.IsHttps,
            Path = "/",
            MaxAge = TimeSpan.FromHours(8),
            IsEssential = true
        });
    }

    private bool HasAllowedOrigin(HttpContext context)
    {
        var origin = context.Request.Headers.Origin.FirstOrDefault();
        if (string.IsNullOrWhiteSpace(origin)) return true;
        if (string.Equals(origin, "null", StringComparison.OrdinalIgnoreCase)) return false;

        var requestOrigin = $"{context.Request.Scheme}://{context.Request.Host}".TrimEnd('/');
        return string.Equals(origin.TrimEnd('/'), requestOrigin, StringComparison.OrdinalIgnoreCase) ||
               _allowedOrigins.Contains(origin.TrimEnd('/'));
    }

    private static string CreateToken() => Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));

    private static bool FixedTimeEquals(string left, string right)
    {
        var leftBytes = System.Text.Encoding.UTF8.GetBytes(left);
        var rightBytes = System.Text.Encoding.UTF8.GetBytes(right);
        return leftBytes.Length == rightBytes.Length &&
               CryptographicOperations.FixedTimeEquals(leftBytes, rightBytes);
    }
}
