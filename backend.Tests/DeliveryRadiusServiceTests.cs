using System.Net;
using Microsoft.Extensions.Logging.Abstractions;
using RFC.Api.Services;
using Xunit;

namespace RFC.Api.Tests;

public sealed class DeliveryRadiusServiceTests
{
    [Theory]
    [InlineData("")]
    [InlineData("WD")]
    [InlineData("not-a-postcode")]
    public async Task CheckAsync_RejectsInvalidPostcodes(string postcode)
    {
        var service = CreateService(HttpStatusCode.OK);

        var result = await service.CheckAsync(postcode);

        Assert.False(result.IsEligible);
        Assert.False(result.IsServiceUnavailable);
    }

    [Fact]
    public async Task CheckAsync_FailsClosedWhenPostcodeProviderIsUnavailable()
    {
        var service = CreateService(HttpStatusCode.ServiceUnavailable);

        var result = await service.CheckAsync("WD17 1AA");

        Assert.False(result.IsEligible);
        Assert.True(result.IsServiceUnavailable);
    }

    private static DeliveryRadiusService CreateService(HttpStatusCode statusCode)
    {
        var client = new HttpClient(new StubHandler(statusCode));
        return new DeliveryRadiusService(client, NullLogger<DeliveryRadiusService>.Instance);
    }

    private sealed class StubHandler(HttpStatusCode statusCode) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            return Task.FromResult(new HttpResponseMessage(statusCode));
        }
    }
}
