using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using RFC.Api.Controllers;
using RFC.Api.Data;
using RFC.Api.Models;
using RFC.Api.Services;
using Xunit;

namespace RFC.Api.Tests;

public class OrdersControllerTests
{
    [Fact]
    public async Task CreateOrder_RejectsEmptyBasket()
    {
        var fixture = CreateFixture();
        var order = CreateOrder(items: []);

        var result = await fixture.Controller.CreateOrder(order);

        Assert.IsType<BadRequestObjectResult>(result);
        Assert.False(await fixture.Db.Orders.AnyAsync());
        Assert.Equal(0, fixture.Payments.VerifyCalls);
    }

    [Fact]
    public async Task CreateOrder_DecrementsStockAndReturnsGuestAccessToken_WhenCashOrderIsValid()
    {
        var fixture = CreateFixture();
        SeedMenuItem(fixture.Db, stockCount: 5);

        var result = await fixture.Controller.CreateOrder(CreateOrder(quantity: 2, paymentMethod: "cash"));

        var ok = Assert.IsType<OkObjectResult>(result);
        var savedOrder = Assert.IsType<Order>(ok.Value);
        var dbOrder = await fixture.Db.Orders.SingleAsync();
        var item = await fixture.Db.MenuItems.SingleAsync(item => item.Id == "item-1");
        Assert.Equal(3, item.StockCount);
        Assert.False(string.IsNullOrWhiteSpace(savedOrder.AccessToken));
        Assert.Equal(OrderAccessService.HashAccessToken(savedOrder.AccessToken!), dbOrder.OrderAccessTokenHash);
        Assert.True(dbOrder.OrderAccessTokenExpiresAt > DateTime.UtcNow);
    }

    [Fact]
    public async Task CreateOrder_DoesNotPersistOrderOrStockChanges_WhenStockValidationFails()
    {
        var fixture = CreateFixture();
        SeedMenuItem(fixture.Db, stockCount: 1);

        var result = await fixture.Controller.CreateOrder(CreateOrder(quantity: 2, paymentMethod: "cash"));

        Assert.IsType<BadRequestObjectResult>(result);
        Assert.False(await fixture.Db.Orders.AnyAsync());
        var item = await fixture.Db.MenuItems.SingleAsync(item => item.Id == "item-1");
        Assert.Equal(1, item.StockCount);
    }

    [Fact]
    public async Task CreateOrder_CallsStripeVerificationAndRejectsFailedCardPayment()
    {
        var fixture = CreateFixture(verifyResult: new PaymentGatewayResult(false, false, "Card payment was not confirmed."));
        SeedMenuItem(fixture.Db, stockCount: 5);

        var result = await fixture.Controller.CreateOrder(CreateOrder(quantity: 1, paymentMethod: "card"));

        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Contains("Card payment", badRequest.Value?.ToString() ?? string.Empty, StringComparison.OrdinalIgnoreCase);
        Assert.Equal(1, fixture.Payments.VerifyCalls);
        Assert.False(await fixture.Db.Orders.AnyAsync());
    }

    [Fact]
    public async Task CreateOrder_AcceptsSuccessfulStripeVerification()
    {
        var fixture = CreateFixture(verifyResult: new PaymentGatewayResult(true, false, string.Empty));
        SeedMenuItem(fixture.Db, stockCount: 5);

        var result = await fixture.Controller.CreateOrder(CreateOrder(quantity: 1, paymentMethod: "card"));

        var ok = Assert.IsType<OkObjectResult>(result);
        var savedOrder = Assert.IsType<Order>(ok.Value);
        Assert.Equal("Paid", savedOrder.PaymentStatus);
        Assert.Equal(1, fixture.Payments.VerifyCalls);
        Assert.True(await fixture.Db.Orders.AnyAsync());
    }

    private static ControllerFixture CreateFixture(PaymentGatewayResult? verifyResult = null)
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddHttpContextAccessor();
        services.AddDbContext<RfcDbContext>(options =>
            options.UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
                .ConfigureWarnings(warnings => warnings.Ignore(InMemoryEventId.TransactionIgnoredWarning)));
        services.AddScoped<AuditService>();
        services.AddScoped<OrderAccessService>();

        var provider = services.BuildServiceProvider();
        var db = provider.GetRequiredService<RfcDbContext>();
        var configuration = new ConfigurationBuilder().Build();
        var payments = new TestPaymentGateway(verifyResult ?? new PaymentGatewayResult(true, false, string.Empty));
        var pricing = new OrderPricingService(provider, new DeliveryRadiusService(), NullLogger<OrderPricingService>.Instance);
        var maps = new GoogleMapsService(new HttpClient(), configuration, NullLogger<GoogleMapsService>.Instance);
        var notifications = new NotificationService(configuration, NullLogger<NotificationService>.Instance);
        var controller = new OrdersController(
            provider,
            pricing,
            maps,
            notifications,
            provider.GetRequiredService<OrderAccessService>(),
            payments,
            NullLogger<OrdersController>.Instance)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { RequestServices = provider }
            }
        };

        return new ControllerFixture(provider, db, controller, payments);
    }

    private static void SeedMenuItem(RfcDbContext db, int stockCount)
    {
        db.MenuItems.Add(new MenuItem
        {
            Id = "item-1",
            CategoryId = "meals",
            Name = "Chicken Meal",
            Description = "Test item",
            Price = 4.00m,
            IsAvailable = true,
            StockCount = stockCount
        });
        db.SaveChanges();
    }

    private static Order CreateOrder(int quantity = 1, string paymentMethod = "cash", List<OrderItem>? items = null)
    {
        var orderItems = items ?? [new OrderItem { Id = "item-1", Quantity = quantity }];
        var subtotal = orderItems.Sum(item => item.Quantity * 4.00m);
        return new Order
        {
            OrderType = "collection",
            CustomerName = "Test Customer",
            CustomerPhone = "07123456789",
            CustomerEmail = "customer@example.com",
            Items = orderItems,
            Subtotal = subtotal,
            DiscountAmount = 0,
            DeliveryFee = 0,
            Total = subtotal,
            PaymentMethod = paymentMethod,
            StripePaymentIntentId = paymentMethod == "card" ? "pi_test_123" : null
        };
    }

    private sealed record ControllerFixture(
        ServiceProvider Provider,
        RfcDbContext Db,
        OrdersController Controller,
        TestPaymentGateway Payments);

    private sealed class TestPaymentGateway : IPaymentGateway
    {
        private readonly PaymentGatewayResult _verifyResult;

        public TestPaymentGateway(PaymentGatewayResult verifyResult)
        {
            _verifyResult = verifyResult;
        }

        public int VerifyCalls { get; private set; }

        public Task<PaymentGatewayResult> VerifyPaymentIntentAsync(string? paymentIntentId, decimal expectedTotal, CancellationToken cancellationToken)
        {
            VerifyCalls++;
            return Task.FromResult(_verifyResult);
        }

        public Task<PaymentGatewayResult> RefundPaymentIntentAsync(string? paymentIntentId, CancellationToken cancellationToken)
        {
            return Task.FromResult(new PaymentGatewayResult(true, false, string.Empty));
        }
    }
}
