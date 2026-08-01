using System.Text;
using RFC.Api.Data;
using RFC.Api.Models;
using SendGrid;
using SendGrid.Helpers.Mail;
using Twilio;
using Twilio.Rest.Api.V2010.Account;
using Twilio.Types;

namespace RFC.Api.Services;

public sealed class NotificationService
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<NotificationService> _logger;

    public NotificationService(IConfiguration configuration, ILogger<NotificationService> logger)
    {
        _configuration = configuration;
        _logger = logger;
    }

    public async Task SendOrderPlacedAsync(Order order)
    {
        var trackingUrl = BuildTrackingUrl(order.OrderNumber);
        await SendSmsAsync(
            order.CustomerPhone,
            $"Hi {order.CustomerName}, your RFC order #{order.OrderNumber} for GBP {order.Total:0.00} is confirmed. Track: {trackingUrl}");

        await SendEmailAsync(
            order.CustomerEmail,
            $"RFC order #{order.OrderNumber} confirmed",
            BuildReceiptHtml(order, trackingUrl));
    }

    public async Task SendOutForDeliveryAsync(DbOrder order)
    {
        await SendSmsAsync(
            order.CustomerPhone,
            $"Your RFC order #{order.OrderNumber} is on the way! Estimated arrival: {order.EtaMinutes ?? 25} minutes.");
    }

    public async Task SendCancellationEmailAsync(DbOrder order, string? reason)
    {
        await SendEmailAsync(
            order.CustomerEmail,
            $"RFC order #{order.OrderNumber} cancelled",
            $"""
            <h1>Order cancelled</h1>
            <p>Your RFC order <strong>#{System.Net.WebUtility.HtmlEncode(order.OrderNumber)}</strong> has been cancelled.</p>
            <p><strong>Reason:</strong> {System.Net.WebUtility.HtmlEncode(reason ?? "No reason provided")}</p>
            """);
    }

    private async Task SendSmsAsync(string? to, string body)
    {
        var accountSid = _configuration["Twilio:AccountSid"];
        var authToken = _configuration["Twilio:AuthToken"];
        var from = _configuration["Twilio:FromPhone"];

        if (string.IsNullOrWhiteSpace(accountSid) ||
            string.IsNullOrWhiteSpace(authToken) ||
            string.IsNullOrWhiteSpace(from) ||
            string.IsNullOrWhiteSpace(to))
        {
            _logger.LogInformation("SMS skipped because Twilio configuration or recipient is missing.");
            return;
        }

        try
        {
            TwilioClient.Init(accountSid, authToken);
            await MessageResource.CreateAsync(
                from: new PhoneNumber(from),
                to: new PhoneNumber(to),
                body: body);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "SMS notification failed for {Recipient}", to);
        }
    }

    private async Task SendEmailAsync(string? to, string subject, string html)
    {
        var apiKey = _configuration["SendGrid:ApiKey"];
        var fromEmail = _configuration["SendGrid:FromEmail"];
        var fromName = _configuration["SendGrid:FromName"] ?? "RFC Watford";

        if (string.IsNullOrWhiteSpace(apiKey) ||
            string.IsNullOrWhiteSpace(fromEmail) ||
            string.IsNullOrWhiteSpace(to))
        {
            _logger.LogInformation("Email skipped because SendGrid configuration or recipient is missing.");
            return;
        }

        try
        {
            var client = new SendGridClient(apiKey);
            var message = MailHelper.CreateSingleEmail(
                new EmailAddress(fromEmail, fromName),
                new EmailAddress(to),
                subject,
                System.Text.RegularExpressions.Regex.Replace(html, "<[^>]+>", string.Empty),
                html);
            await client.SendEmailAsync(message);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Email notification failed for {Recipient}", to);
        }
    }

    private string BuildTrackingUrl(string orderNumber)
    {
        var baseUrl = _configuration["PublicAppUrl"]?.TrimEnd('/') ?? "https://www.rfcchickenwatford.com";
        return $"{baseUrl}/track/{Uri.EscapeDataString(orderNumber)}";
    }

    private static string BuildReceiptHtml(Order order, string trackingUrl)
    {
        var rows = new StringBuilder();
        foreach (var item in order.Items)
        {
            rows.Append($"""
                <tr>
                  <td>{System.Net.WebUtility.HtmlEncode(item.Quantity.ToString())}x {System.Net.WebUtility.HtmlEncode(item.Name)}</td>
                  <td style="text-align:right">GBP {(item.UnitPrice * item.Quantity):0.00}</td>
                </tr>
                """);
        }

        return $"""
        <h1>RFC Watford receipt</h1>
        <p>Thanks {System.Net.WebUtility.HtmlEncode(order.CustomerName)}, your order <strong>#{System.Net.WebUtility.HtmlEncode(order.OrderNumber)}</strong> is confirmed.</p>
        <table width="100%" cellpadding="6" cellspacing="0">{rows}</table>
        <p><strong>Total:</strong> GBP {order.Total:0.00}</p>
        <p><a href="{System.Net.WebUtility.HtmlEncode(trackingUrl)}">Track your order</a></p>
        """;
    }
}
