using Stripe;

namespace RFC.Api.Services;

public interface IPaymentGateway
{
    Task<PaymentGatewayResult> VerifyPaymentIntentAsync(
        string? paymentIntentId,
        decimal expectedTotal,
        string expectedCustomerId,
        string expectedCheckoutId,
        CancellationToken cancellationToken);

    Task<PaymentGatewayResult> RefundPaymentIntentAsync(
        string? paymentIntentId,
        string idempotencyKey,
        CancellationToken cancellationToken);
}

public sealed class StripePaymentGateway : IPaymentGateway
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<StripePaymentGateway> _logger;

    public StripePaymentGateway(IConfiguration configuration, ILogger<StripePaymentGateway> logger)
    {
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<PaymentGatewayResult> VerifyPaymentIntentAsync(
        string? paymentIntentId,
        decimal expectedTotal,
        string expectedCustomerId,
        string expectedCheckoutId,
        CancellationToken cancellationToken)
    {
        var secretKey = _configuration["Stripe:SecretKey"];
        if (string.IsNullOrWhiteSpace(secretKey) || secretKey.Contains("replace", StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogError("Stripe payment verification is unavailable because the secret key is not configured.");
            return new PaymentGatewayResult(false, true, "Card payment is temporarily unavailable.");
        }

        if (string.IsNullOrWhiteSpace(paymentIntentId))
        {
            return new PaymentGatewayResult(false, false, "A confirmed card payment is required.");
        }

        try
        {
            var stripeClient = new StripeClient(secretKey);
            var service = new PaymentIntentService(stripeClient);
            var intent = await service.GetAsync(
                paymentIntentId,
                requestOptions: null,
                cancellationToken: cancellationToken);
            var expectedAmount = (long)Math.Round(expectedTotal * 100m, MidpointRounding.AwayFromZero);

            Charge? charge = null;
            if (!string.IsNullOrWhiteSpace(intent.LatestChargeId))
            {
                charge = await new ChargeService(stripeClient).GetAsync(
                    intent.LatestChargeId,
                    requestOptions: null,
                    cancellationToken: cancellationToken);
            }

            var hasExpectedMetadata =
                intent.Metadata.TryGetValue("purpose", out var purpose) && purpose == "rfc_order" &&
                intent.Metadata.TryGetValue("customer_id", out var customerId) && customerId == expectedCustomerId &&
                intent.Metadata.TryGetValue("checkout_id", out var checkoutId) && checkoutId == expectedCheckoutId;
            var hasUnrefundedCharge = charge is
            {
                Paid: true,
                Refunded: false,
                AmountRefunded: 0
            };
            var isCapturedForCheckout =
                intent.Status == "succeeded" &&
                hasExpectedMetadata &&
                hasUnrefundedCharge;

            if (intent.Status != "succeeded" ||
                !string.Equals(intent.Currency, "gbp", StringComparison.OrdinalIgnoreCase) ||
                intent.Amount != expectedAmount ||
                intent.AmountReceived != expectedAmount ||
                charge == null ||
                !charge.Paid ||
                charge.Refunded ||
                charge.AmountRefunded != 0 ||
                charge.Amount != expectedAmount ||
                !string.Equals(charge.Currency, "gbp", StringComparison.OrdinalIgnoreCase) ||
                !hasExpectedMetadata)
            {
                return new PaymentGatewayResult(
                    false,
                    false,
                    "Card payment could not be matched to this checkout.",
                    ShouldCompensate: isCapturedForCheckout);
            }

            return new PaymentGatewayResult(true, false, string.Empty);
        }
        catch (StripeException ex)
        {
            _logger.LogWarning(ex, "Stripe payment verification failed for {PaymentIntentId}", paymentIntentId);
            return new PaymentGatewayResult(false, true, "Card payment is temporarily unavailable.");
        }
    }

    public async Task<PaymentGatewayResult> RefundPaymentIntentAsync(
        string? paymentIntentId,
        string idempotencyKey,
        CancellationToken cancellationToken)
    {
        var secretKey = _configuration["Stripe:SecretKey"];
        if (string.IsNullOrWhiteSpace(secretKey) || secretKey.Contains("replace", StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogError("Stripe refund is unavailable because the secret key is not configured.");
            return new PaymentGatewayResult(false, true, "Card refund is temporarily unavailable.");
        }

        if (string.IsNullOrWhiteSpace(paymentIntentId))
        {
            return new PaymentGatewayResult(false, false, "The original card payment could not be identified.");
        }

        try
        {
            var service = new RefundService(new StripeClient(secretKey));
            var refund = await service.CreateAsync(
                new RefundCreateOptions
                {
                    PaymentIntent = paymentIntentId,
                    Reason = "requested_by_customer"
                },
                new RequestOptions { IdempotencyKey = idempotencyKey },
                cancellationToken);

            return refund.Status is "succeeded" or "pending"
                ? new PaymentGatewayResult(true, false, string.Empty)
                : new PaymentGatewayResult(false, false, "Card refund could not be confirmed.");
        }
        catch (StripeException ex)
        {
            _logger.LogWarning(ex, "Stripe refund failed for {PaymentIntentId}", paymentIntentId);
            return new PaymentGatewayResult(false, true, "Card refund is temporarily unavailable.");
        }
    }
}

public sealed record PaymentGatewayResult(
    bool IsValid,
    bool IsServiceUnavailable,
    string Message,
    bool ShouldCompensate = false);
