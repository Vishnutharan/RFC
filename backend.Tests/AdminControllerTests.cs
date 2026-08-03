using System.Reflection;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using RFC.Api.Controllers;
using RFC.Api.Data;
using RFC.Api.Hubs;
using RFC.Api.Models;
using RFC.Api.Services;
using Xunit;

namespace RFC.Api.Tests;

public class AdminControllerTests
{
    [Fact]
    public void AdminController_IsStaffOnly()
    {
        var authorize = typeof(AdminController).GetCustomAttribute<AuthorizeAttribute>();

        Assert.NotNull(authorize);
        Assert.Equal("StaffOnly", authorize!.Policy);
    }

    [Theory]
    [InlineData("Placed", "Preparing")]
    [InlineData("Placed", "Cancelled")]
    [InlineData("Preparing", "Out for Delivery")]
    [InlineData("Preparing", "Ready for Collection")]
    [InlineData("Preparing", "Cancelled")]
    [InlineData("Out for Delivery", "Completed")]
    [InlineData("Ready for Collection", "Completed")]
    public void OrderStatusTransitions_AllowsExpectedTransitions(string current, string next)
    {
        Assert.True(OrderStatusTransitions.CanTransition(current, next));
    }

    [Theory]
    [InlineData("Placed", "Completed")]
    [InlineData("Cancelled", "Preparing")]
    [InlineData("Completed", "Preparing")]
    [InlineData("Out for Delivery", "Cancelled")]
    public void OrderStatusTransitions_RejectsInvalidTransitions(string current, string next)
    {
        Assert.False(OrderStatusTransitions.CanTransition(current, next));
    }

    [Fact]
    public async Task UpdateStatus_ReturnsConflictForInvalidJump()
    {
        var fixture = CreateFixture("Placed");

        var result = await fixture.Controller.UpdateStatus("order-1", new UpdateOrderStatusDto { Status = "Completed" });

        Assert.IsType<ConflictObjectResult>(result);
        var order = await fixture.Db.Orders.SingleAsync();
        Assert.Equal("Placed", order.OrderStatus);
    }

    [Fact]
    public async Task UpdateStatus_RejectsTerminalOrderChanges()
    {
        var fixture = CreateFixture("Cancelled");

        var result = await fixture.Controller.UpdateStatus("order-1", new UpdateOrderStatusDto { Status = "Preparing" });

        Assert.IsType<ConflictObjectResult>(result);
        var order = await fixture.Db.Orders.SingleAsync();
        Assert.Equal("Cancelled", order.OrderStatus);
    }

    [Fact]
    public async Task UpdateStatus_RejectsGenericCancellationWorkflow()
    {
        var fixture = CreateFixture("Placed");

        var result = await fixture.Controller.UpdateStatus("order-1", new UpdateOrderStatusDto { Status = "Cancelled" });

        Assert.IsType<ConflictObjectResult>(result);
        var order = await fixture.Db.Orders.SingleAsync();
        Assert.Equal("Placed", order.OrderStatus);
    }

    [Fact]
    public async Task UpdateStoreSetting_RejectsIncompleteOpeningHours()
    {
        var fixture = CreateFixture("Placed");

        var result = await fixture.Controller.UpdateStoreSetting(
            "OpeningHours",
            new AdminStoreSettingRequest { Value = "{}" });

        Assert.IsType<BadRequestObjectResult>(result);
        Assert.False(await fixture.Db.StoreSettings.AnyAsync());
    }

    [Fact]
    public async Task UpdateStoreSetting_AcceptsCompleteOpeningHours()
    {
        var fixture = CreateFixture("Placed");
        const string openingHours = """
            {
              "Monday":{"open":"11:00","close":"23:00"},
              "Tuesday":{"open":"11:00","close":"23:00"},
              "Wednesday":{"open":"11:00","close":"23:00"},
              "Thursday":{"open":"11:00","close":"23:00"},
              "Friday":{"open":"11:00","close":"23:30"},
              "Saturday":{"open":"11:00","close":"23:30"},
              "Sunday":{"open":"12:00","close":"22:30"}
            }
            """;

        var result = await fixture.Controller.UpdateStoreSetting(
            "OpeningHours",
            new AdminStoreSettingRequest { Value = openingHours });

        Assert.IsType<OkObjectResult>(result);
        Assert.Equal(openingHours, (await fixture.Db.StoreSettings.SingleAsync()).Value);
    }

    private static AdminFixture CreateFixture(string currentStatus)
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddHttpContextAccessor();
        services.AddDbContext<RfcDbContext>(options =>
            options.UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
                .ConfigureWarnings(warnings => warnings.Ignore(InMemoryEventId.TransactionIgnoredWarning)));
        services.AddScoped<AuditService>();

        var provider = services.BuildServiceProvider();
        var db = provider.GetRequiredService<RfcDbContext>();
        db.Orders.Add(new DbOrder
        {
            Id = "order-1",
            OrderNumber = "RFC-TEST123",
            OrderStatus = currentStatus,
            CustomerName = "Test Customer",
            CustomerPhone = "07123456789",
            CustomerEmail = "customer@example.com",
            ItemsJson = "[]"
        });
        db.SaveChanges();

        var configuration = new ConfigurationBuilder().Build();
        var controller = new AdminController(
            provider,
            new NoopHubContext(),
            new GoogleMapsService(new HttpClient(), configuration, NullLogger<GoogleMapsService>.Instance),
            new NotificationService(configuration, NullLogger<NotificationService>.Instance),
            NullLogger<AdminController>.Instance)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { RequestServices = provider }
            }
        };

        return new AdminFixture(db, controller);
    }

    private sealed record AdminFixture(RfcDbContext Db, AdminController Controller);

    private sealed class NoopHubContext : IHubContext<OrderHub>
    {
        public IHubClients Clients { get; } = new NoopHubClients();
        public IGroupManager Groups { get; } = new NoopGroupManager();
    }

    private sealed class NoopHubClients : IHubClients
    {
        private static readonly IClientProxy Proxy = new NoopClientProxy();

        public IClientProxy All => Proxy;
        public IClientProxy AllExcept(IReadOnlyList<string> excludedConnectionIds) => Proxy;
        public IClientProxy Client(string connectionId) => Proxy;
        public IClientProxy Clients(IReadOnlyList<string> connectionIds) => Proxy;
        public IClientProxy Group(string groupName) => Proxy;
        public IClientProxy GroupExcept(string groupName, IReadOnlyList<string> excludedConnectionIds) => Proxy;
        public IClientProxy Groups(IReadOnlyList<string> groupNames) => Proxy;
        public IClientProxy User(string userId) => Proxy;
        public IClientProxy Users(IReadOnlyList<string> userIds) => Proxy;
    }

    private sealed class NoopClientProxy : IClientProxy
    {
        public Task SendCoreAsync(string method, object?[] args, CancellationToken cancellationToken = default)
        {
            return Task.CompletedTask;
        }
    }

    private sealed class NoopGroupManager : IGroupManager
    {
        public Task AddToGroupAsync(string connectionId, string groupName, CancellationToken cancellationToken = default)
        {
            return Task.CompletedTask;
        }

        public Task RemoveFromGroupAsync(string connectionId, string groupName, CancellationToken cancellationToken = default)
        {
            return Task.CompletedTask;
        }
    }
}
