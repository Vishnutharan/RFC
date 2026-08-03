namespace RFC.Api.Services;

using System.Text.Json;
using System.Text.RegularExpressions;

public sealed partial class DeliveryRadiusService
{
    private const decimal MaxRadiusKm = 5.0m;
    private const double StoreLat = 51.682366d;
    private const double StoreLng = -0.41867d;

    private readonly HttpClient? _httpClient;
    private readonly ILogger<DeliveryRadiusService>? _logger;

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
        if (_httpClient == null) return Unavailable();

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
                return Unavailable();
            }

            await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
            using var json = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);
            var result = json.RootElement.GetProperty("result");
            var lat = result.GetProperty("latitude").GetDouble();
            var lng = result.GetProperty("longitude").GetDouble();
            var distanceKm = Math.Round(CalculateDistanceKm(StoreLat, StoreLng, lat, lng), 1);

            return BuildResult((decimal)distanceKm);
        }
        catch (Exception ex)
        {
            _logger?.LogWarning(ex, "Live postcode radius check failed for {Postcode}; delivery validation is failing closed.", clean);
            return Unavailable();
        }
    }

    private static DeliveryCheck? ValidatePostcode(string? postcode)
    {
        if (string.IsNullOrWhiteSpace(postcode))
        {
            return new DeliveryCheck(false, 0, MaxRadiusKm, "Please enter a valid UK postcode.");
        }

        var clean = NormalizePostcode(postcode);
        if (!UkPostcodeRegex().IsMatch(clean))
        {
            return new DeliveryCheck(false, 0, MaxRadiusKm, "Please enter a valid UK postcode.");
        }

        return null;
    }

    private static DeliveryCheck BuildResult(decimal distanceKm)
    {
        return distanceKm <= MaxRadiusKm
            ? new DeliveryCheck(true, distanceKm, MaxRadiusKm, $"{distanceKm:0.0} km from 119 Courtlands Dr - inside our 5 km delivery radius.")
            : new DeliveryCheck(false, distanceKm, MaxRadiusKm, $"Your address is about {distanceKm:0.0} km from 119 Courtlands Dr, outside our 5 km delivery radius. Please select Store Collection.");
    }

    private static DeliveryCheck Unavailable()
    {
        return new DeliveryCheck(
            false,
            0,
            MaxRadiusKm,
            "Delivery postcode validation is temporarily unavailable. Please try again shortly or select Store Collection.",
            IsServiceUnavailable: true);
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

    [GeneratedRegex("^(?:GIR0AA|[A-Z]{1,2}[0-9][A-Z0-9]?[0-9][A-Z]{2})$", RegexOptions.IgnoreCase)]
    private static partial Regex UkPostcodeRegex();
}

public sealed record DeliveryCheck(
    bool IsEligible,
    decimal DistanceKm,
    decimal MaxRadiusKm,
    string Reason,
    bool IsServiceUnavailable = false);
