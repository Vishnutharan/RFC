using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using RFC.Api.Data;
using RFC.Api.Hubs;
using RFC.Api.Infrastructure;
using RFC.Api.Services;

EnvFile.LoadFromCommonLocations();

var builder = WebApplication.CreateBuilder(args);
builder.WebHost.UseUrls(builder.Configuration["ASPNETCORE_URLS"] ?? "http://localhost:5242");

var connectionString = ProgramConnectionStringNormalizer.NormalizePostgresConnectionString(
    builder.Configuration.GetConnectionString("RfcDatabase"));
if (!string.IsNullOrWhiteSpace(connectionString))
{
    builder.Services.AddDbContext<RfcDbContext>(options =>
        options.UseNpgsql(connectionString));
    builder.Services.AddScoped<AuditService>();
}

var allowedOrigins = (builder.Configuration["Cors:AllowedOrigins"] ??
                      "http://localhost:3000,http://127.0.0.1:3000")
    .Split([',', ';'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

builder.Services.AddCors(options =>
{
    options.AddPolicy("ConfiguredOrigins", policy =>
    {
        policy.WithOrigins(allowedOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

builder.Services
    .AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.Cookie.Name = "rfc_session";
        options.Cookie.HttpOnly = true;
        options.Cookie.SameSite = SameSiteMode.Lax;
        options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
        options.SlidingExpiration = true;
        options.ExpireTimeSpan = TimeSpan.FromHours(8);
        options.Events.OnRedirectToLogin = context =>
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            return Task.CompletedTask;
        };
        options.Events.OnRedirectToAccessDenied = context =>
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            return Task.CompletedTask;
        };
    });

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("StaffOnly", policy => policy.RequireRole("staff", "manager"));
    options.AddPolicy("CustomerOnly", policy => policy.RequireRole("customer"));
});

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddFixedWindowLimiter("auth", limiter =>
    {
        limiter.PermitLimit = 8;
        limiter.Window = TimeSpan.FromMinutes(1);
        limiter.QueueLimit = 0;
    });
    options.AddFixedWindowLimiter("order-write", limiter =>
    {
        limiter.PermitLimit = 20;
        limiter.Window = TimeSpan.FromMinutes(1);
        limiter.QueueLimit = 0;
    });
    options.AddFixedWindowLimiter("feedback-write", limiter =>
    {
        limiter.PermitLimit = 12;
        limiter.Window = TimeSpan.FromMinutes(1);
        limiter.QueueLimit = 0;
    });
});

builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<OrderPricingService>();
builder.Services.AddSingleton<DeliveryRadiusService>();
builder.Services.AddSingleton<NotificationService>();
builder.Services.AddHttpClient<GoogleMapsService>();
builder.Services.AddSignalR();
builder.Services.AddHealthChecks().AddCheck<PostgresHealthCheck>("postgres");
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();

var app = builder.Build();

await DatabaseInitializer.InitializeAsync(app);

app.UseHsts();
app.UseHttpsRedirection();
app.Use(async (context, next) =>
{
    var supabaseSource = BuildSupabaseCspSource(app.Configuration.GetConnectionString("RfcDatabase"));
    context.Response.Headers["Content-Security-Policy"] =
        $"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://api.stripe.com {supabaseSource}; frame-ancestors 'none'; base-uri 'self';";
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers["X-Frame-Options"] = "DENY";
    context.Response.Headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
    await next();
});

app.UseCors("ConfiguredOrigins");
app.UseMiddleware<CsrfMiddleware>();
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapHub<OrderHub>("/hubs/order").RequireCors("ConfiguredOrigins");
app.MapHealthChecks("/health");

app.Run();

static string BuildSupabaseCspSource(string? value)
{
    if (string.IsNullOrWhiteSpace(value)) return "https://*.supabase.co";
    if (!value.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase) &&
        !value.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase))
    {
        var hostPart = value.Split(';', StringSplitOptions.RemoveEmptyEntries)
            .FirstOrDefault(part => part.TrimStart().StartsWith("Host=", StringComparison.OrdinalIgnoreCase));
        var host = hostPart?.Split('=', 2).ElementAtOrDefault(1);
        return string.IsNullOrWhiteSpace(host) ? "https://*.supabase.co" : $"https://{host.Trim()}";
    }

    return $"https://{new Uri(value).Host}";
}
