using Microsoft.EntityFrameworkCore;
using RFC.Api.Security;

namespace RFC.Api.Data;

public static class DatabaseInitializer
{
    private const string DefaultOpeningHours = """
    {
      "Monday": {"open": "11:00", "close": "23:00"},
      "Tuesday": {"open": "11:00", "close": "23:00"},
      "Wednesday": {"open": "11:00", "close": "23:00"},
      "Thursday": {"open": "11:00", "close": "23:00"},
      "Friday": {"open": "11:00", "close": "23:30"},
      "Saturday": {"open": "11:00", "close": "23:30"},
      "Sunday": {"open": "12:00", "close": "22:30"}
    }
    """;

    public static async Task InitializeAsync(WebApplication app, bool forceMigrations = false)
    {
        using var scope = app.Services.CreateScope();
        var logger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("DatabaseInitializer");
        var db = scope.ServiceProvider.GetService<RfcDbContext>();

        if (db == null)
        {
            var message = "ConnectionStrings:RfcDatabase is not configured.";
            logger.LogCritical(message);
            if (!app.Environment.IsDevelopment()) throw new InvalidOperationException(message);
            return;
        }

        try
        {
            var shouldMigrate = forceMigrations ||
                                app.Environment.IsDevelopment() ||
                                app.Configuration.GetValue<bool>("Database:RunMigrationsOnStartup");
            if (!shouldMigrate)
            {
                if (!await db.Database.CanConnectAsync())
                    throw new InvalidOperationException("The production database is not reachable.");

                var pendingMigrations = await db.Database.GetPendingMigrationsAsync();
                if (pendingMigrations.Any())
                    throw new InvalidOperationException(
                        "The database schema is behind the application. Run the release migration job before starting the API.");
                await EnsureActiveManagerAsync(db);
                return;
            }

            await db.Database.MigrateAsync();
            await SeedMenuAsync(db, logger);
            await SeedOpeningHoursAsync(db);
            await SeedStaffUserAsync(db, app.Configuration, logger);
            await EnsureActiveManagerAsync(db);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Database initialization failed. Check the configured database connection and migrations.");
            if (!app.Environment.IsDevelopment()) throw;
        }
    }

    private static async Task SeedMenuAsync(RfcDbContext db, ILogger logger)
    {
        if (await db.MenuItems.AnyAsync()) return;

        foreach (var item in SeedData.DefaultMenuItems)
        {
            item.StockCount = item.StockCount <= 0 ? 999 : item.StockCount;
        }

        db.MenuItems.AddRange(SeedData.DefaultMenuItems);
        await db.SaveChangesAsync();
        logger.LogInformation("Seeded default menu items.");
    }

    private static async Task SeedOpeningHoursAsync(RfcDbContext db)
    {
        if (await db.StoreSettings.AnyAsync(setting => setting.Key == "OpeningHours")) return;

        db.StoreSettings.Add(new StoreSetting
        {
            Key = "OpeningHours",
            Value = DefaultOpeningHours
        });
        await db.SaveChangesAsync();
    }

    private static async Task SeedStaffUserAsync(RfcDbContext db, IConfiguration configuration, ILogger logger)
    {
        if (await db.StaffUsers.AnyAsync()) return;

        var email = configuration["SeedAdmin:Email"];
        var name = configuration["SeedAdmin:Name"] ?? "RFC Manager";
        var role = (configuration["SeedAdmin:Role"] ?? "manager").Trim().ToLowerInvariant();
        var passwordHash = configuration["SeedAdmin:PasswordHash"];
        var password = configuration["SeedAdmin:Password"];

        if (string.IsNullOrWhiteSpace(email))
        {
            logger.LogCritical("No staff users exist and no seed staff email is configured. Set SeedAdmin__Email and SeedAdmin__Password before going live.");
            return;
        }

        if (string.IsNullOrWhiteSpace(passwordHash))
        {
            if (!PasswordPolicy.IsValid(password))
            {
                logger.LogCritical("No staff users exist and SeedAdmin__Password is missing or does not meet complexity rules. Staff user was not created.");
                return;
            }

            passwordHash = PasswordHasher.Hash(password!);
        }

        db.StaffUsers.Add(new StaffUser
        {
            Id = Guid.NewGuid().ToString("N"),
            Name = InputSanitizer.Clean(name, 100),
            Email = email.Trim().ToLowerInvariant(),
            PasswordHash = passwordHash,
            Role = role is "manager" or "staff" ? role : "staff",
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();
        logger.LogInformation("Seeded first staff user {Email}.", email);
    }

    private static async Task EnsureActiveManagerAsync(RfcDbContext db)
    {
        if (await db.StaffUsers.AsNoTracking().AnyAsync(user => user.IsActive && user.Role == "manager"))
        {
            return;
        }

        throw new InvalidOperationException(
            "No active manager account exists. Provision one through the approved bootstrap process before serving traffic.");
    }
}
