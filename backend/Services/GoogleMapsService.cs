using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;

namespace RFC.Api.Services;

public sealed class GoogleMapsService
{
    private const decimal StoreLat = 51.682366m;
    private const decimal StoreLng = -0.41867m;

    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;
    private readonly IMemoryCache _cache;
    private readonly ILogger<GoogleMapsService> _logger;

    public GoogleMapsService(HttpClient httpClient, IConfiguration configuration, IMemoryCache cache, ILogger<GoogleMapsService> logger)
    {
        _httpClient = httpClient;
        _configuration = configuration;
        _cache = cache;
        _logger = logger;
    }

    public async Task<GeoPoint?> GeocodePostcodeAsync(string? postcode, CancellationToken cancellationToken = default)
    {
        var apiKey = _configuration["GoogleMaps:ApiKey"];
        if (string.IsNullOrWhiteSpace(apiKey) || string.IsNullOrWhiteSpace(postcode))
        {
            return null;
        }

        try
        {
            var url = $"https://maps.googleapis.com/maps/api/geocode/json?address={Uri.EscapeDataString(postcode)}&components=country:GB&key={Uri.EscapeDataString(apiKey)}";
            using var response = await _httpClient.GetAsync(url, cancellationToken);
            if (!response.IsSuccessStatusCode) return null;

            await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
            using var json = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);
            var results = json.RootElement.GetProperty("results");
            if (results.GetArrayLength() == 0) return null;

            var location = results[0].GetProperty("geometry").GetProperty("location");
            return new GeoPoint(location.GetProperty("lat").GetDecimal(), location.GetProperty("lng").GetDecimal());
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Google postcode geocoding failed for {Postcode}", postcode);
            return null;
        }
    }

    public async Task<int?> GetEtaMinutesAsync(decimal destinationLat, decimal destinationLng, CancellationToken cancellationToken = default)
    {
        var apiKey = _configuration["GoogleMaps:ApiKey"];
        if (string.IsNullOrWhiteSpace(apiKey)) return null;

        var cacheKey = $"eta_{Math.Round(destinationLat, 4)}_{Math.Round(destinationLng, 4)}";
        if (_cache.TryGetValue<int>(cacheKey, out var cachedEta))
        {
            return cachedEta;
        }

        try
        {
            var url = "https://maps.googleapis.com/maps/api/distancematrix/json" +
                      $"?origins={StoreLat},{StoreLng}" +
                      $"&destinations={destinationLat},{destinationLng}" +
                      "&mode=driving" +
                      $"&key={Uri.EscapeDataString(apiKey)}";

            using var response = await _httpClient.GetAsync(url, cancellationToken);
            if (!response.IsSuccessStatusCode) return null;

            await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
            using var json = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);
            var element = json.RootElement.GetProperty("rows")[0].GetProperty("elements")[0];
            if (element.GetProperty("status").GetString() != "OK") return null;

            var seconds = element.GetProperty("duration").GetProperty("value").GetInt32();
            var etaMinutes = Math.Max(1, (int)Math.Ceiling(seconds / 60m));

            _cache.Set(cacheKey, etaMinutes, TimeSpan.FromMinutes(3));
            return etaMinutes;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Google ETA lookup failed.");
            return null;
        }
    }
}

public sealed record GeoPoint(decimal Lat, decimal Lng);

