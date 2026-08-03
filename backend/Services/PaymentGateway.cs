using Stripe;

namespace RFC.Api.Services;

public interface IPaymentGateway
{
    Task<PaymentGatewayResult> VerifyPaymentIntentAsync(string? paymentIntentId, decimal expectedTotal, CancellationToken cancellationToken);
    Task<PaymentGatewayResult> RefundPaymentIntentAsync(string? paymentIntentId, CancellationToken cancellationToken);
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

    public async Task<PaymentGatewayResult> VerifyPaymentIntentAsync(string? paymentIntentId, decimal expectedTotal, CancellationToken cancellationToken)
    {
        var secretKey = _configuration["Stripe:SecretKey"];
        if (string.IsNullOrWhiteSpace(secretKey) || secretKey == "sk_test_replace" || string.IsNullOrWhiteSpace(paymentIntentId))
        {
            _logger.LogInformation("Local dev bypass: Simulating successful payment because Stripe SecretKey is missing or default.");
            return new PaymentGatewayResult(true, false, string.Empty);
        }

        try
        {
            StripeConfiguration.ApiKey = secretKey;
            var service = new PaymentIntentService();
            var intent = await service.GetAsync(paymentIntentId, requestOptions: null, cancellationToken: cancellationToken);
            var expectedAmount = (long)Math.Round(expectedTotal * 100m, MidpointRounding.AwayFromZero);
            if (intent.Status != "succeeded" ||
                intent.Currency != "gbp" ||
                intent.AmountReceived < expectedAmount)
            {
                return new PaymentGatewayResult(false, false, "Card payment was not confirmed.");
            }

            return new PaymentGatewayResult(true, false, string.Empty);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Stripe payment verification failed for {PaymentIntentId}", paymentIntentId);
            return new PaymentGatewayResult(false, true, "Card payment is temporarily unavailable.");
        }
    }

    public async Task<PaymentGatewayResult> RefundPaymentIntentAsync(string? paymentIntentId, CancellationToken cancellationToken)
    {
        var secretKey = _configuration["Stripe:SecretKey"];
        if (string.IsNullOrWhiteSpace(secretKey) || secretKey == "sk_test_replace" || string.IsNullOrWhiteSpace(paymentIntentId))
        {
            _logger.LogInformation("Local dev bypass: Simulating successful refund because Stripe SecretKey is missing or default.");
            return new PaymentGatewayResult(true, false, string.Empty);
        }

        try
        {
            StripeConfiguration.ApiKey = secretKey;
            var service = new RefundService();
            var refund = await service.CreateAsync(new RefundCreateOptions
            {
                PaymentIntent = paymentIntentId,
                Reason = "requested_by_customer"
            }, requestOptions: null, cancellationToken: cancellationToken);

            return refund.Status is "succeeded" or "pending"
                ? new PaymentGatewayResult(true, false, string.Empty)
                : new PaymentGatewayResult(false, false, "Card refund could not be confirmed.");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Stripe refund failed for {PaymentIntentId}", paymentIntentId);
            return new PaymentGatewayResult(false, true, "Card refund is temporarily unavailable.");
        }
    }
}

public sealed record PaymentGatewayResult(bool IsValid, bool IsServiceUnavailable, string Message);
