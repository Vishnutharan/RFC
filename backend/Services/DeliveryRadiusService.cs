namespace RFC.Api.Services;

public sealed class DeliveryRadiusService
{
    private const decimal MaxRadiusKm = 5.0m;

    private static readonly IReadOnlyDictionary<string, decimal> PostcodeDistances =
        new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase)
        {
            ["WD17"] = 0.8m,
            ["WD24"] = 1.4m,
            ["WD18"] = 2.2m,
            ["WD25"] = 3.1m,
            ["WD19"] = 4.3m,
            ["WD3"] = 6.5m,
            ["WD4"] = 7.2m,
            ["WD5"] = 5.8m,
            ["WD6"] = 10.5m,
            ["WD7"] = 9.8m,
            ["HA5"] = 7.5m,
            ["HA6"] = 8.2m,
            ["AL2"] = 11.0m
        };

    public DeliveryCheck Check(string? postcode)
    {
        if (string.IsNullOrWhiteSpace(postcode))
        {
            return new(false, 0, MaxRadiusKm, "Please enter a valid UK postcode.");
        }

        var clean = new string(postcode.Trim().ToUpperInvariant().Where(c => !char.IsWhiteSpace(c)).ToArray());
        if (clean.Length < 3)
        {
            return new(false, 0, MaxRadiusKm, "Please enter a complete postcode.");
        }

        var outward = clean.Length <= 4 ? clean : clean[..^3];
        var distanceKm = PostcodeDistances.TryGetValue(outward, out var known)
            ? known
            : clean.StartsWith("WD", StringComparison.OrdinalIgnoreCase) ? 5.8m : 12.5m;

        return distanceKm <= MaxRadiusKm
            ? new(true, distanceKm, MaxRadiusKm, "Eligible for delivery.")
            : new(false, distanceKm, MaxRadiusKm, "Address is outside the delivery radius.");
    }
}

public sealed record DeliveryCheck(bool IsEligible, decimal DistanceKm, decimal MaxRadiusKm, string Reason);
