using System.Reflection;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using RFC.Api.Controllers;
using RFC.Api.Security;
using RFC.Api.Services;
using Xunit;

namespace RFC.Api.Tests;

public sealed class SecurityHardeningTests
{
    [Fact]
    public void PasswordHasher_RoundTripsCurrentHash()
    {
        var hash = PasswordHasher.Hash("Correct-Horse-Battery-7");

        Assert.True(PasswordHasher.Verify("Correct-Horse-Battery-7", hash));
        Assert.False(PasswordHasher.Verify("wrong-password", hash));
        Assert.False(PasswordHasher.NeedsRehash(hash));
    }

    [Theory]
    [InlineData("")]
    [InlineData("not-a-hash")]
    [InlineData("pbkdf2-sha256$99999$AA==$AA==")]
    [InlineData("pbkdf2-sha256$999999999$AA==$AA==")]
    [InlineData("pbkdf2-sha256$600000$not-base64$not-base64")]
    public void PasswordHasher_RejectsMalformedOrUnsafeHashes(string hash)
    {
        Assert.False(PasswordHasher.Verify("anything", hash));
    }

    [Fact]
    public async Task StripeGateway_FailsClosedWhenSecretIsMissing()
    {
        var configuration = new ConfigurationBuilder().Build();
        var gateway = new StripePaymentGateway(
            configuration,
            NullLogger<StripePaymentGateway>.Instance);

        var verification = await gateway.VerifyPaymentIntentAsync(
            "pi_example",
            10m,
            "customer-1",
            "checkout-1",
            CancellationToken.None);
        var refund = await gateway.RefundPaymentIntentAsync(
            "pi_example",
            "refund-order-1",
            CancellationToken.None);

        Assert.False(verification.IsValid);
        Assert.True(verification.IsServiceUnavailable);
        Assert.False(refund.IsValid);
        Assert.True(refund.IsServiceUnavailable);
    }

    [Fact]
    public void PublicConfig_FailsClosedWithoutPublishableKey()
    {
        var controller = CreatePublicConfigController(new ConfigurationBuilder().Build());

        var result = Assert.IsType<ObjectResult>(controller.GetPublicConfig());

        Assert.Equal(StatusCodes.Status503ServiceUnavailable, result.StatusCode);
    }

    [Fact]
    public void PublicConfig_ReturnsOnlyPublishableStripeKey()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Stripe:PublishableKey"] = "pk_test_public_example"
            })
            .Build();
        var controller = CreatePublicConfigController(configuration);

        var result = Assert.IsType<OkObjectResult>(controller.GetPublicConfig());

        Assert.Contains("pk_test_public_example", result.Value?.ToString());
        Assert.Equal("public, max-age=300", controller.Response.Headers.CacheControl);
    }

    [Theory]
    [InlineData(nameof(AdminController.CreateMenuItem))]
    [InlineData(nameof(AdminController.UpdateMenuItem))]
    [InlineData(nameof(AdminController.ArchiveMenuItem))]
    [InlineData(nameof(AdminController.GetCustomers))]
    [InlineData(nameof(AdminController.GetStaffUsers))]
    [InlineData(nameof(AdminController.CreateStaffUser))]
    [InlineData(nameof(AdminController.UpdateStaffUser))]
    [InlineData(nameof(AdminController.GetAuditLogs))]
    [InlineData(nameof(AdminController.GetStoreSettings))]
    [InlineData(nameof(AdminController.UpdateStoreSetting))]
    public void SensitiveAdminEndpoints_AreManagerOnly(string methodName)
    {
        var method = typeof(AdminController).GetMethods(BindingFlags.Instance | BindingFlags.Public)
            .Single(candidate => candidate.Name == methodName);
        var authorize = method.GetCustomAttribute<AuthorizeAttribute>();

        Assert.NotNull(authorize);
        Assert.Equal("ManagerOnly", authorize!.Policy);
    }

    private static PublicConfigController CreatePublicConfigController(IConfiguration configuration)
    {
        return new PublicConfigController(configuration)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext()
            }
        };
    }
}
