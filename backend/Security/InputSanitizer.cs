using System.Text.RegularExpressions;

namespace RFC.Api.Security;

public static partial class InputSanitizer
{
    public static string Clean(string? value, int maxLength = 2000)
    {
        if (string.IsNullOrWhiteSpace(value)) return string.Empty;

        var withoutTags = HtmlTagRegex().Replace(value, string.Empty);
        var normalized = System.Net.WebUtility.HtmlDecode(withoutTags).Trim();
        return normalized.Length <= maxLength ? normalized : normalized[..maxLength];
    }

    public static string? CleanNullable(string? value, int maxLength = 2000)
    {
        var clean = Clean(value, maxLength);
        return string.IsNullOrWhiteSpace(clean) ? null : clean;
    }

    [GeneratedRegex("<[^>]*>", RegexOptions.Compiled)]
    private static partial Regex HtmlTagRegex();
}
