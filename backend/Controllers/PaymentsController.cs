using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
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
        if (string.IsNullOrWhiteSpace(secretKey) || secretKey.Contains("replace", StringComparison.OrdinalIgnoreCase))
            return ServiceUnavailable();

        if (request.Order == null)
        {
            return BadRequest(new { message = "Order draft is required before card payment." });
        }

        var customerId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(customerId)) return Unauthorized();
        if (!Guid.TryParse(request.CheckoutId, out var checkoutGuid))
        {
            return BadRequest(new { message = "A valid checkout id is required." });
        }

        var checkoutId = checkoutGuid.ToString("N");

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

            var service = new PaymentIntentService(new StripeClient(secretKey));
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
                    ["purpose"] = "rfc_order",
                    ["customer_id"] = customerId,
                    ["checkout_id"] = checkoutId
                }
            }, new RequestOptions
            {
                IdempotencyKey = $"rfc-payment-intent:{customerId}:{checkoutId}"
            }, HttpContext.RequestAborted);

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
            var json = await reader.ReadToEndAsync(HttpContext.RequestAborted);
            var signature = Request.Headers["Stripe-Signature"];
            var stripeEvent = EventUtility.ConstructEvent(json, signature, webhookSecret);

            if (await _db.PaymentWebhookEvents.AsNoTracking().AnyAsync(
                    item => item.Id == stripeEvent.Id,
                    HttpContext.RequestAborted))
            {
                return Ok(new { received = true, duplicate = true });
            }

            var webhookEvent = new PaymentWebhookEvent
            {
                Id = stripeEvent.Id,
                Type = stripeEvent.Type,
                ReceivedAt = DateTime.UtcNow
            };
            _db.PaymentWebhookEvents.Add(webhookEvent);

            if (stripeEvent.Data.Object is PaymentIntent intent)
            {
                webhookEvent.PaymentIntentId = intent.Id;
                var order = await _db.Orders.FirstOrDefaultAsync(
                    item => item.StripePaymentIntentId == intent.Id,
                    HttpContext.RequestAborted);
                if (order != null)
                {
                    if (stripeEvent.Type == "payment_intent.succeeded")
                    {
                        if (order.PaymentStatus is not "Refunded") order.PaymentStatus = "Paid";
                    }
                    else if (stripeEvent.Type is "payment_intent.payment_failed" or "payment_intent.canceled")
                    {
                        if (order.PaymentStatus is "Pending" or "Authorized") order.PaymentStatus = "Failed";
                    }
                }
            }

            webhookEvent.ProcessedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(HttpContext.RequestAborted);

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
    [Required]
    [MaxLength(80)]
    public string CheckoutId { get; set; } = string.Empty;

    [Required]
    public Order? Order { get; set; }
}
