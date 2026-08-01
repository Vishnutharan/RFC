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

    public CsrfMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        if (ShouldIssueToken(context))
        {
            EnsureTokenCookie(context);
        }

        if (UnsafeMethods.Contains(context.Request.Method) && ShouldValidate(context))
        {
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

    private static void EnsureTokenCookie(HttpContext context)
    {
        if (!string.IsNullOrWhiteSpace(context.Request.Cookies[CookieName])) return;

        context.Response.Cookies.Append(CookieName, CreateToken(), new CookieOptions
        {
            HttpOnly = false,
            SameSite = SameSiteMode.Lax,
            Secure = context.Request.IsHttps,
            Path = "/"
        });
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
