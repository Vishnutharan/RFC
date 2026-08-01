using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RFC.Api.Data;
using Stripe;

namespace RFC.Api.Controllers;

[ApiController]
[RequestSizeLimit(1_048_576)]
[Route("api/[controller]")]
public class PaymentsController : ControllerBase
{
    private const string ServiceUnavailableMessage = "Service temporarily unavailable. Please try again shortly.";

    private readonly RfcDbContext? _db;
    private readonly IConfiguration _configuration;
    private readonly ILogger<PaymentsController> _logger;

    public PaymentsController(IServiceProvider provider, IConfiguration configuration, ILogger<PaymentsController> logger)
    {
        _db = provider.GetService<RfcDbContext>();
        _configuration = configuration;
        _logger = logger;
    }

    [HttpPost("create-intent")]
    public async Task<IActionResult> CreateIntent([FromBody] CreatePaymentIntentRequest request)
    {
        var secretKey = _configuration["Stripe:SecretKey"];
        if (string.IsNullOrWhiteSpace(secretKey)) return ServiceUnavailable();

        if (request.Amount <= 0)
        {
            return BadRequest(new { message = "Payment amount is invalid." });
        }

        try
        {
            StripeConfiguration.ApiKey = secretKey;
            var service = new PaymentIntentService();
            var amountInPence = (long)Math.Round(request.Amount * 100m, MidpointRounding.AwayFromZero);
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
                    ["customer_email"] = request.CustomerEmail ?? string.Empty
                }
            });

            return Ok(new
            {
                clientSecret = intent.ClientSecret,
                paymentIntentId = intent.Id
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create Stripe PaymentIntent.");
            return ServiceUnavailable();
        }
    }

    [HttpPost("confirm-webhook")]
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
                var order = await _db.Orders.FirstOrDefaultAsync(item => item.StripePaymentIntentId == intent.Id);
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

                    await _db.SaveChangesAsync();
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
}

public sealed class CreatePaymentIntentRequest
{
    public decimal Amount { get; set; }
    public string? CustomerEmail { get; set; }
}
