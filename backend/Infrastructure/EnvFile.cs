namespace RFC.Api.Infrastructure;

public static class EnvFile
{
    public static void LoadFromCommonLocations()
    {
        // Production configuration must come from the process environment or the
        // platform secret provider. Dotenv files are a local-development aid only.
        if (!ShouldLoadDotEnv())
        {
            return;
        }

        var current = Directory.GetCurrentDirectory();
        var baseDir = AppContext.BaseDirectory;

        var roots = new[]
        {
            Path.Combine(current, "backend", ".env"),
            Path.Combine(current, ".env"),
            Path.Combine(baseDir, ".env")
        };

        foreach (var envPath in roots.Distinct(StringComparer.OrdinalIgnoreCase))
        {
            // Load the more-specific local file first. Load() never overwrites a
            // value already supplied by the host, container, or secret provider.
            Load($"{envPath}.local");
            Load(envPath);
        }
    }

    public static void Load(string path)
    {
        if (!File.Exists(path)) return;

        foreach (var rawLine in File.ReadAllLines(path))
        {
            var line = rawLine.Trim();
            if (line.Length == 0 || line.StartsWith('#')) continue;

            var separatorIndex = line.IndexOf('=');
            if (separatorIndex <= 0) continue;

            var key = line[..separatorIndex].Trim();
            var value = line[(separatorIndex + 1)..].Trim().Trim('"');

            if (Environment.GetEnvironmentVariable(key) is null)
            {
                Environment.SetEnvironmentVariable(key, value);
            }
            var normalizedKey = key.Replace("__", ":");
            if (normalizedKey != key && Environment.GetEnvironmentVariable(normalizedKey) is null)
            {
                Environment.SetEnvironmentVariable(normalizedKey, value);
            }
        }
    }

    private static bool ShouldLoadDotEnv()
    {
        var environmentName = Environment.GetEnvironmentVariable("DOTNET_ENVIRONMENT")
            ?? Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT");

        return string.IsNullOrEmpty(environmentName)
            || string.Equals(environmentName, "Development", StringComparison.OrdinalIgnoreCase)
            || string.Equals(environmentName, "Test", StringComparison.OrdinalIgnoreCase)
            || string.Equals(
                Environment.GetEnvironmentVariable("RFC_LOAD_DOTENV"),
                "true",
                StringComparison.OrdinalIgnoreCase);
    }
}
