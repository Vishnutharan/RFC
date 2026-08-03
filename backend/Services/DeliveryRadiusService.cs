namespace RFC.Api.Services;

using System.Text.Json;

public sealed class DeliveryRadiusService
{
    private const decimal MaxRadiusKm = 5.0m;
    private const double StoreLat = 51.682366d;
    private const double StoreLng = -0.41867d;

    private readonly HttpClient? _httpClient;
    private readonly ILogger<DeliveryRadiusService>? _logger;

    private static readonly IReadOnlyDictionary<string, decimal> PostcodeDistances =
        new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase)
        {
            ["WD17"] = 0.2m,
            ["WD24"] = 2.2m,
            ["WD18"] = 3.4m,
            ["WD25"] = 4.8m,
            ["WD19"] = 5.0m,
            ["WD3"] = 6.8m,
            ["WD4"] = 7.4m,
            ["WD5"] = 6.1m,
            ["WD6"] = 10.5m,
            ["WD7"] = 9.8m,
            ["HA5"] = 7.5m,
            ["HA6"] = 8.2m,
            ["AL2"] = 11.0m
        };

    public DeliveryRadiusService()
    {
    }

    public DeliveryRadiusService(HttpClient httpClient, ILogger<DeliveryRadiusService> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
    }

    public async Task<DeliveryCheck> CheckAsync(string? postcode, CancellationToken cancellationToken = default)
    {
        var validation = ValidatePostcode(postcode);
        if (validation != null) return validation;

        var clean = NormalizePostcode(postcode);
        if (_httpClient == null) return EstimateByOutwardCode(clean);

        try
        {
            using var response = await _httpClient.GetAsync(
                $"https://api.postcodes.io/postcodes/{Uri.EscapeDataString(clean)}",
                cancellationToken);

            if (response.StatusCode == System.Net.HttpStatusCode.NotFound)
            {
                return new DeliveryCheck(false, 0, MaxRadiusKm, "Please enter a valid UK postcode.");
            }

            if (!response.IsSuccessStatusCode)
            {
                return EstimateByOutwardCode(clean);
            }

            await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
            using var json = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);
            var result = json.RootElement.GetProperty("result");
            var lat = result.GetProperty("latitude").GetDouble();
            var lng = result.GetProperty("longitude").GetDouble();
            var distanceKm = Math.Round(CalculateDistanceKm(StoreLat, StoreLng, lat, lng), 1);

            return BuildResult((decimal)distanceKm, liveChecked: true);
        }
        catch (Exception ex)
        {
            _logger?.LogWarning(ex, "Live postcode radius check failed for {Postcode}. Falling back to outward-code estimate.", clean);
            return EstimateByOutwardCode(clean);
        }
    }

    public DeliveryCheck Check(string? postcode)
    {
        var validation = ValidatePostcode(postcode);
        return validation ?? EstimateByOutwardCode(NormalizePostcode(postcode));
    }

    private static DeliveryCheck? ValidatePostcode(string? postcode)
    {
        if (string.IsNullOrWhiteSpace(postcode))
        {
            return new DeliveryCheck(false, 0, MaxRadiusKm, "Please enter a valid UK postcode.");
        }

        var clean = NormalizePostcode(postcode);
        if (clean.Length < 3)
        {
            return new DeliveryCheck(false, 0, MaxRadiusKm, "Please enter a complete postcode.");
        }

        return null;
    }

    private static DeliveryCheck EstimateByOutwardCode(string clean)
    {
        var outward = clean.Length <= 4 ? clean : clean[..^3];
        var distanceKm = PostcodeDistances.TryGetValue(outward, out var known)
            ? known
            : clean.StartsWith("WD", StringComparison.OrdinalIgnoreCase) ? 5.8m : 12.5m;

        return BuildResult(distanceKm, liveChecked: false);
    }

    private static DeliveryCheck BuildResult(decimal distanceKm, bool liveChecked)
    {
        var suffix = liveChecked ? "" : " Estimated from postcode area.";
        return distanceKm <= MaxRadiusKm
            ? new DeliveryCheck(true, distanceKm, MaxRadiusKm, $"{distanceKm:0.0} km from 119 Courtlands Dr - inside our 5 km delivery radius.{suffix}")
            : new DeliveryCheck(false, distanceKm, MaxRadiusKm, $"Your address is about {distanceKm:0.0} km from 119 Courtlands Dr, outside our 5 km delivery radius. Please select Store Collection.{suffix}");
    }

    private static string NormalizePostcode(string? postcode)
    {
        return new string((postcode ?? string.Empty).Trim().ToUpperInvariant().Where(c => !char.IsWhiteSpace(c)).ToArray());
    }

    private static double CalculateDistanceKm(double lat1, double lng1, double lat2, double lng2)
    {
        const double earthRadiusKm = 6371d;
        var dLat = ToRadians(lat2 - lat1);
        var dLng = ToRadians(lng2 - lng1);
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                Math.Cos(ToRadians(lat1)) * Math.Cos(ToRadians(lat2)) *
                Math.Sin(dLng / 2) * Math.Sin(dLng / 2);
        var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
        return earthRadiusKm * c;
    }

    private static double ToRadians(double degrees) => degrees * Math.PI / 180d;
}

public sealed record DeliveryCheck(bool IsEligible, decimal DistanceKm, decimal MaxRadiusKm, string Reason);
