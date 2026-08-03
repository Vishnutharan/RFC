using System.Security.Claims;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using RFC.Api.Data;
using RFC.Api.Services;
using Xunit;

namespace RFC.Api.Tests;

public class OrderAccessServiceTests
{
    [Fact]
    public void HasAccess_AllowsAuthenticatedCustomerById()
    {
        var service = CreateService();
        var order = new DbOrder
        {
            CustomerId = "customer-1",
            CustomerEmail = "owner@example.com"
        };

        var user = CustomerPrincipal("customer-1", "other@example.com");

        Assert.True(service.HasAccess(order, user, null));
    }

    [Fact]
    public void HasAccess_RejectsUnverifiedEmailMatchForLegacyOrders()
    {
        var service = CreateService();
        var order = new DbOrder
        {
            CustomerEmail = "owner@example.com"
        };

        var user = CustomerPrincipal("customer-2", "OWNER@example.com");

        Assert.False(service.HasAccess(order, user, null));
    }

    [Fact]
    public void HasAccess_AllowsGuestWithUnexpiredToken()
    {
        var service = CreateService();
        var token = OrderAccessService.CreateAccessToken();
        var order = new DbOrder
        {
            CustomerEmail = "guest@example.com",
            OrderAccessTokenHash = OrderAccessService.HashAccessToken(token),
            OrderAccessTokenExpiresAt = DateTime.UtcNow.AddMinutes(30)
        };

        Assert.True(service.HasAccess(order, AnonymousPrincipal(), token));
    }

    [Fact]
    public void HasAccess_RejectsWrongGuestToken()
    {
        var service = CreateService();
        var order = new DbOrder
        {
            CustomerEmail = "guest@example.com",
            OrderAccessTokenHash = OrderAccessService.HashAccessToken(OrderAccessService.CreateAccessToken()),
            OrderAccessTokenExpiresAt = DateTime.UtcNow.AddMinutes(30)
        };

        Assert.False(service.HasAccess(order, AnonymousPrincipal(), OrderAccessService.CreateAccessToken()));
    }

    [Fact]
    public void HasAccess_RejectsExpiredGuestToken()
    {
        var service = CreateService();
        var token = OrderAccessService.CreateAccessToken();
        var order = new DbOrder
        {
            CustomerEmail = "guest@example.com",
            OrderAccessTokenHash = OrderAccessService.HashAccessToken(token),
            OrderAccessTokenExpiresAt = DateTime.UtcNow.AddMinutes(-1)
        };

        Assert.False(service.HasAccess(order, AnonymousPrincipal(), token));
    }

    private static OrderAccessService CreateService()
    {
        var provider = new ServiceCollection().BuildServiceProvider();
        return new OrderAccessService(provider, NullLogger<OrderAccessService>.Instance);
    }

    private static ClaimsPrincipal CustomerPrincipal(string id, string email)
    {
        var identity = new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, id),
            new Claim(ClaimTypes.Email, email),
            new Claim(ClaimTypes.Role, "customer")
        }, "TestAuth");

        return new ClaimsPrincipal(identity);
    }

    private static ClaimsPrincipal AnonymousPrincipal()
    {
        return new ClaimsPrincipal(new ClaimsIdentity());
    }
}
