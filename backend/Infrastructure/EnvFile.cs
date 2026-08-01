namespace RFC.Api.Infrastructure;

public static class EnvFile
{
    public static void LoadFromCommonLocations()
    {
        var current = Directory.GetCurrentDirectory();
        var currentParent = Directory.GetParent(current)?.FullName;
        var baseDir = AppContext.BaseDirectory;
        var baseParent = Directory.GetParent(baseDir)?.FullName;

        var candidates = new[]
        {
            Path.Combine(current, ".env"),
            Path.Combine(current, ".env.local"),
            currentParent == null ? null : Path.Combine(currentParent, ".env"),
            currentParent == null ? null : Path.Combine(currentParent, ".env.local"),
            Path.Combine(current, "backend", ".env"),
            Path.Combine(current, "backend", ".env.local"),
            Path.Combine(baseDir, ".env"),
            Path.Combine(baseDir, ".env.local"),
            baseParent == null ? null : Path.Combine(baseParent, ".env"),
            baseParent == null ? null : Path.Combine(baseParent, ".env.local")
        };

        foreach (var path in candidates.Where(path => path != null).Distinct(StringComparer.OrdinalIgnoreCase))
        {
            Load(path!, overrideExisting: path!.EndsWith(".env.local", StringComparison.OrdinalIgnoreCase));
        }
    }

    public static void Load(string path, bool overrideExisting = false)
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

            if (overrideExisting || string.IsNullOrEmpty(Environment.GetEnvironmentVariable(key)))
            {
                Environment.SetEnvironmentVariable(key, value);
            }
        }
    }
}
