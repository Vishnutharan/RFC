using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using RFC.Api.Data;
using RFC.Api.Models;
using RFC.Api.Security;
using RFC.Api.Services;
using Stripe;

namespace RFC.Api.Controllers;

[ApiController]
[RequestSizeLimit(1_048_576)]
[Route("api/[controller]")]
public class PaymentsController : ControllerBase
{
    private const string ServiceUnavailableMessage = "Service temporarily unavailable. Please try again shortly.";

    private readonly RfcDbContext? _db;
    private readonly OrderPricingService _pricing;
    private readonly IConfiguration _configuration;
    private readonly ILogger<PaymentsController> _logger;

    public PaymentsController(
        IServiceProvider provider,
        OrderPricingService pricing,
        IConfiguration configuration,
        ILogger<PaymentsController> logger)
    {
        _db = provider.GetService<RfcDbContext>();
        _pricing = pricing;
        _configuration = configuration;
        _logger = logger;
    }

    [HttpPost("create-intent")]
    [Authorize(Policy = "CustomerOnly")]
    [EnableRateLimiting("order-write")]
    public async Task<IActionResult> CreateIntent([FromBody] CreatePaymentIntentRequest request)
    {
        var secretKey = _configuration["Stripe:SecretKey"];
        if (string.IsNullOrWhiteSpace(secretKey)) return ServiceUnavailable();

        if (request.Order == null)
        {
            return BadRequest(new { message = "Order draft is required before card payment." });
        }

        try
        {
            var order = SanitizeOrderDraft(request.Order);
            order.PaymentMethod = "card";

            var pricingResult = await _pricing.PriceAsync(order);
            if (!pricingResult.IsValid || pricingResult.Order == null)
            {
                if (pricingResult.Error == OrderPricingService.ServiceUnavailableMessage) return ServiceUnavailable();
                return BadRequest(new { message = pricingResult.Error });
            }

            StripeConfiguration.ApiKey = secretKey;
            var service = new PaymentIntentService();
            var pricedOrder = pricingResult.Order;
            var amountInPence = (long)Math.Round(pricedOrder.Total * 100m, MidpointRounding.AwayFromZero);
            var intent = await service.CreateAsync(new PaymentIntentCreateOptions
            {
                Amount = amountInPence,
                Currency = "gbp",
                AutomaticPaymentMethods = new PaymentIntentAutomaticPaymentMethodsOptions
                {
                    Enabled = true
                },
                Metadata = new Dictionary<string, string>
                {
                    ["source"] = "rfc-watford-web",
                    ["customer_email"] = pricedOrder.CustomerEmail,
                    ["server_total"] = pricedOrder.Total.ToString("0.00")
                }
            }, requestOptions: null, cancellationToken: HttpContext.RequestAborted);

            return Ok(new
            {
                clientSecret = intent.ClientSecret,
                paymentIntentId = intent.Id,
                amount = pricedOrder.Total
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create Stripe PaymentIntent.");
            return ServiceUnavailable();
        }
    }

    [HttpPost("confirm-webhook")]
    [EnableRateLimiting("webhook")]
    public async Task<IActionResult> ConfirmWebhook()
    {
        if (_db == null) return ServiceUnavailable();

        var webhookSecret = _configuration["Stripe:WebhookSecret"];
        if (string.IsNullOrWhiteSpace(webhookSecret)) return ServiceUnavailable();

        try
        {
            using var reader = new StreamReader(HttpContext.Request.Body);
            var json = await reader.ReadToEndAsync();
            var signature = Request.Headers["Stripe-Signature"];
            var stripeEvent = EventUtility.ConstructEvent(json, signature, webhookSecret);

            if (stripeEvent.Data.Object is PaymentIntent intent)
            {
                var order = await _db.Orders.FirstOrDefaultAsync(
                    item => item.StripePaymentIntentId == intent.Id,
                    HttpContext.RequestAborted);
                if (order != null)
                {
                    if (stripeEvent.Type == "payment_intent.succeeded")
                    {
                        order.PaymentStatus = "Paid";
                    }
                    else if (stripeEvent.Type == "payment_intent.payment_failed")
                    {
                        order.PaymentStatus = "Failed";
                    }

                    await _db.SaveChangesAsync(HttpContext.RequestAborted);
                }
            }

            return Ok(new { received = true });
        }
        catch (StripeException ex)
        {
            _logger.LogWarning(ex, "Invalid Stripe webhook.");
            return BadRequest(new { message = "Invalid webhook signature." });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Stripe webhook processing failed.");
            return ServiceUnavailable();
        }
    }

    private ObjectResult ServiceUnavailable()
    {
        return StatusCode(StatusCodes.Status503ServiceUnavailable, new { message = ServiceUnavailableMessage });
    }

    private static Order SanitizeOrderDraft(Order order)
    {
        order.CustomerName = InputSanitizer.Clean(order.CustomerName, 100);
        order.CustomerPhone = InputSanitizer.Clean(order.CustomerPhone, 30);
        order.CustomerEmail = InputSanitizer.Clean(order.CustomerEmail, 120).ToLowerInvariant();
        order.DeliveryAddress = InputSanitizer.Clean(order.DeliveryAddress, 400);
        order.DeliveryPostcode = InputSanitizer.Clean(order.DeliveryPostcode, 20).ToUpperInvariant();
        order.DeliveryNotes = InputSanitizer.Clean(order.DeliveryNotes, 500);
        order.VoucherCode = InputSanitizer.CleanNullable(order.VoucherCode, 50);
        order.StripePaymentIntentId = null;
        return order;
    }
}

public sealed class CreatePaymentIntentRequest
{
    public Order? Order { get; set; }
}
