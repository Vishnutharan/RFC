using System.Security.Claims;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Npgsql;
using Polly;
using Polly.Extensions.Http;
using RFC.Api.Data;
using RFC.Api.Hubs;
using RFC.Api.Infrastructure;
using RFC.Api.Services;
using StackExchange.Redis;

EnvFile.LoadFromCommonLocations();

var builder = WebApplication.CreateBuilder(args);
builder.WebHost.UseUrls(builder.Configuration["ASPNETCORE_URLS"] ?? "http://localhost:5242");

var isDevelopment = builder.Environment.IsDevelopment() ||
                    string.Equals(builder.Configuration["ASPNETCORE_ENVIRONMENT"], "Development", StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(builder.Configuration["DOTNET_ENVIRONMENT"], "Development", StringComparison.OrdinalIgnoreCase);
var isTesting = builder.Environment.IsEnvironment("Testing");
ValidateProductionConfiguration(builder, isDevelopment || isTesting);

var connectionString = ProgramConnectionStringNormalizer.NormalizePostgresConnectionString(
    builder.Configuration.GetConnectionString("RfcDatabase"));
if (!string.IsNullOrWhiteSpace(connectionString))
{
    builder.Services.AddDbContext<RfcDbContext>(options =>
        options.UseNpgsql(connectionString, npgsql =>
            npgsql.CommandTimeout(15)));
    builder.Services.AddScoped<AuditService>();
}

builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.ForwardLimit = 2;
    if (builder.Configuration.GetValue<bool>("ForwardedHeaders:TrustAll"))
    {
        // Only enable this when the API is isolated behind a trusted ingress/service network.
        options.KnownNetworks.Clear();
        options.KnownProxies.Clear();
    }
});

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

var dataProtection = builder.Services
    .AddDataProtection()
    .SetApplicationName("rfc-watford-api");

var redisConnectionString = builder.Configuration["Redis:ConnectionString"];
IConnectionMultiplexer? redis = null;
if (!string.IsNullOrWhiteSpace(redisConnectionString))
{
    redis = ConnectionMultiplexer.Connect(redisConnectionString);
    builder.Services.AddSingleton(redis);
    dataProtection.PersistKeysToStackExchangeRedis(redis, "rfc:data-protection-keys");
}

builder.Services
    .AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.Cookie.Name = isDevelopment ? "rfc_session" : "__Host-rfc_session";
        options.Cookie.HttpOnly = true;
        options.Cookie.IsEssential = true;
        options.Cookie.Path = "/";
        options.Cookie.SameSite = SameSiteMode.Lax;
        options.Cookie.SecurePolicy = isDevelopment
            ? CookieSecurePolicy.SameAsRequest
            : CookieSecurePolicy.Always;
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
        options.Events.OnValidatePrincipal = ValidateSessionAsync;
    });

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("StaffOnly", policy => policy.RequireRole("staff", "manager"));
    options.AddPolicy("ManagerOnly", policy => policy.RequireRole("manager"));
    options.AddPolicy("CustomerOnly", policy => policy.RequireRole("customer"));
});

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
        RateLimitPartition.GetFixedWindowLimiter(
            $"global:{GetClientKey(context)}",
            _ => FixedWindow(240, TimeSpan.FromMinutes(1))));

    options.AddPolicy("auth", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            $"auth:{GetClientKey(context)}:{context.Request.Path.Value?.ToLowerInvariant()}",
            _ => FixedWindow(8, TimeSpan.FromMinutes(1))));
    options.AddPolicy("order-write", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            $"order:{GetClientKey(context)}",
            _ => FixedWindow(20, TimeSpan.FromMinutes(1))));
    options.AddPolicy("order-read", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            $"order-read:{GetClientKey(context)}",
            _ => FixedWindow(60, TimeSpan.FromMinutes(1))));
    options.AddPolicy("feedback-write", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            $"feedback:{GetClientKey(context)}",
            _ => FixedWindow(6, TimeSpan.FromMinutes(1))));
    options.AddPolicy("webhook", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            $"webhook:{GetClientKey(context)}",
            _ => FixedWindow(120, TimeSpan.FromMinutes(1))));

    options.OnRejected = async (context, cancellationToken) =>
    {
        context.HttpContext.Response.Headers.RetryAfter = "60";
        await context.HttpContext.Response.WriteAsJsonAsync(
            new { message = "Too many requests. Please try again shortly." },
            cancellationToken);
    };
});

builder.Services.AddHttpContextAccessor();
builder.Services.AddMemoryCache();
builder.Services.AddScoped<OrderAccessService>();
builder.Services.AddScoped<OrderPricingService>();
builder.Services.AddScoped<IPaymentGateway, StripePaymentGateway>();
builder.Services.AddHttpClient<DeliveryRadiusService>(client => client.Timeout = TimeSpan.FromSeconds(4))
    .AddPolicyHandler(GetExternalApiRetryPolicy());
builder.Services.AddSingleton<NotificationService>();
builder.Services.AddHttpClient<GoogleMapsService>(client => client.Timeout = TimeSpan.FromSeconds(5))
    .AddPolicyHandler(GetExternalApiRetryPolicy());

var signalR = builder.Services.AddSignalR(options =>
{
    options.EnableDetailedErrors = isDevelopment;
    options.MaximumReceiveMessageSize = 32 * 1024;
});
if (!string.IsNullOrWhiteSpace(redisConnectionString))
{
    signalR.AddStackExchangeRedis(redisConnectionString);
}

builder.Services.AddHealthChecks()
    .AddCheck("self", () => HealthCheckResult.Healthy(), tags: ["live"])
    .AddCheck<PostgresHealthCheck>("postgres", tags: ["ready"]);
builder.Services.AddControllers(options => options.SuppressAsyncSuffixInActionNames = false);
builder.Services.AddEndpointsApiExplorer();

var app = builder.Build();
if (redis != null)
{
    app.Lifetime.ApplicationStopping.Register(redis.Dispose);
}

var migrateOnly = args.Any(argument => string.Equals(argument, "--migrate-only", StringComparison.OrdinalIgnoreCase));
await DatabaseInitializer.InitializeAsync(app, forceMigrations: migrateOnly);
if (migrateOnly) return;

app.UseForwardedHeaders();
if (!isDevelopment)
{
    app.UseHsts();
    app.UseHttpsRedirection();
}

app.Use(async (context, next) =>
{
    context.Response.Headers.ContentSecurityPolicy =
        "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";
    context.Response.Headers.XContentTypeOptions = "nosniff";
    context.Response.Headers.XFrameOptions = "DENY";
    context.Response.Headers["Referrer-Policy"] = "no-referrer";
    context.Response.Headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()";

    if (context.Request.Path.StartsWithSegments("/api/auth") ||
        context.Request.Path.StartsWithSegments("/api/admin") ||
        context.Request.Path.StartsWithSegments("/api/orders") ||
        context.Request.Path.StartsWithSegments("/api/payments"))
    {
        context.Response.Headers.CacheControl = "no-store";
        context.Response.Headers.Pragma = "no-cache";
    }

    await next();
});

app.UseCors("ConfiguredOrigins");
app.UseMiddleware<CsrfMiddleware>();
app.UseAuthentication();
app.UseRateLimiter();
app.UseAuthorization();
app.MapControllers();
app.MapHub<OrderHub>("/hubs/order").RequireCors("ConfiguredOrigins");
app.MapHealthChecks("/health");
app.MapHealthChecks("/health/live", new HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("live")
});
app.MapHealthChecks("/health/ready", new HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("ready")
});

app.Run();

static FixedWindowRateLimiterOptions FixedWindow(int permitLimit, TimeSpan window)
{
    return new FixedWindowRateLimiterOptions
    {
        PermitLimit = permitLimit,
        Window = window,
        QueueLimit = 0,
        AutoReplenishment = true
    };
}

static string GetClientKey(HttpContext context)
{
    var userId = context.User.FindFirstValue(ClaimTypes.NameIdentifier);
    if (!string.IsNullOrWhiteSpace(userId)) return $"user:{userId}";
    return $"ip:{context.Connection.RemoteIpAddress?.ToString() ?? "unknown"}";
}

static async Task ValidateSessionAsync(CookieValidatePrincipalContext context)
{
    var db = context.HttpContext.RequestServices.GetService<RfcDbContext>();
    var userId = context.Principal?.FindFirstValue(ClaimTypes.NameIdentifier);
    var role = context.Principal?.FindFirstValue(ClaimTypes.Role);
    var securityStamp = context.Principal?.FindFirstValue("security_stamp");
    var isValid = false;

    if (db != null && !string.IsNullOrWhiteSpace(userId) && !string.IsNullOrWhiteSpace(securityStamp))
    {
        if (role is "staff" or "manager")
        {
            isValid = await db.StaffUsers.AsNoTracking().AnyAsync(
                user => user.Id == userId &&
                        user.IsActive &&
                        user.Role == role &&
                        user.SecurityStamp == securityStamp,
                context.HttpContext.RequestAborted);
        }
        else if (role == "customer")
        {
            isValid = await db.Customers.AsNoTracking().AnyAsync(
                user => user.Id == userId && user.SecurityStamp == securityStamp,
                context.HttpContext.RequestAborted);
        }
    }

    if (isValid) return;

    context.RejectPrincipal();
    await context.HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
}

static void ValidateProductionConfiguration(WebApplicationBuilder builder, bool skipValidation)
{
    if (skipValidation) return;

    var errors = new List<string>();
    var databaseConnection = builder.Configuration.GetConnectionString("RfcDatabase");
    if (string.IsNullOrWhiteSpace(databaseConnection))
        errors.Add("ConnectionStrings:RfcDatabase is required.");
    else
    {
        try
        {
            var normalized = ProgramConnectionStringNormalizer.NormalizePostgresConnectionString(databaseConnection);
            var postgres = new NpgsqlConnectionStringBuilder(normalized);
            if (postgres.SslMode != SslMode.VerifyFull)
                errors.Add("ConnectionStrings:RfcDatabase must use SSL Mode=VerifyFull.");
        }
        catch (Exception)
        {
            errors.Add("ConnectionStrings:RfcDatabase is not a valid PostgreSQL connection string.");
        }
    }

    var redisConnection = builder.Configuration["Redis:ConnectionString"];
    if (string.IsNullOrWhiteSpace(redisConnection))
        errors.Add("Redis:ConnectionString is required for shared sessions and SignalR.");
    else
    {
        try
        {
            if (!ConfigurationOptions.Parse(redisConnection).Ssl)
                errors.Add("Redis:ConnectionString must enable TLS with ssl=true.");
        }
        catch (Exception)
        {
            errors.Add("Redis:ConnectionString is not valid.");
        }
    }

    var stripeSecretKey = builder.Configuration["Stripe:SecretKey"];
    if (IsPlaceholder(stripeSecretKey) ||
        !(stripeSecretKey!.StartsWith("sk_", StringComparison.Ordinal) ||
          stripeSecretKey.StartsWith("rk_", StringComparison.Ordinal)))
        errors.Add("Stripe:SecretKey is required and must be an sk_ or restricted rk_ key.");
    var stripePublishableKey = builder.Configuration["Stripe:PublishableKey"];
    if (IsPlaceholder(stripePublishableKey) ||
        !(stripePublishableKey!.StartsWith("pk_test_", StringComparison.Ordinal) ||
          stripePublishableKey.StartsWith("pk_live_", StringComparison.Ordinal)))
        errors.Add("Stripe:PublishableKey is required and must be a pk_test_ or pk_live_ key.");
    var stripeWebhookSecret = builder.Configuration["Stripe:WebhookSecret"];
    if (IsPlaceholder(stripeWebhookSecret) ||
        !stripeWebhookSecret!.StartsWith("whsec_", StringComparison.Ordinal))
        errors.Add("Stripe:WebhookSecret is required and must be a whsec_ signing secret.");

    var publicAppUrl = builder.Configuration["PublicAppUrl"];
    if (!Uri.TryCreate(publicAppUrl, UriKind.Absolute, out var publicUri) || publicUri.Scheme != Uri.UriSchemeHttps)
        errors.Add("PublicAppUrl must be an absolute HTTPS URL.");

    var cors = builder.Configuration["Cors:AllowedOrigins"] ?? string.Empty;
    var productionOrigins = cors.Split(
        [',', ';'],
        StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
    if (productionOrigins.Length == 0 || productionOrigins.Any(origin =>
            !Uri.TryCreate(origin, UriKind.Absolute, out var uri) ||
            uri.Scheme != Uri.UriSchemeHttps ||
            uri.AbsolutePath != "/" ||
            !string.IsNullOrEmpty(uri.Query) ||
            !string.IsNullOrEmpty(uri.Fragment) ||
            uri.Host is "localhost" or "127.0.0.1"))
    {
        errors.Add("Every production CORS origin must be an origin-only HTTPS URL and cannot be localhost.");
    }

    var allowedHosts = builder.Configuration["AllowedHosts"];
    if (string.IsNullOrWhiteSpace(allowedHosts) || allowedHosts.Contains('*'))
        errors.Add("AllowedHosts must explicitly list the production host names.");

    if (errors.Count > 0)
        throw new InvalidOperationException("Production configuration is invalid: " + string.Join(" ", errors));
}

static bool IsPlaceholder(string? value)
{
    return string.IsNullOrWhiteSpace(value) ||
           value.Contains("replace", StringComparison.OrdinalIgnoreCase);
}

static IAsyncPolicy<HttpResponseMessage> GetExternalApiRetryPolicy()
{
    return HttpPolicyExtensions
        .HandleTransientHttpError()
        .OrResult(response => (int)response.StatusCode == StatusCodes.Status429TooManyRequests)
        .WaitAndRetryAsync(3, retry => TimeSpan.FromMilliseconds(200 * Math.Pow(2, retry)));
}
