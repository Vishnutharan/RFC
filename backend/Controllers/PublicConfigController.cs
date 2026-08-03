using Microsoft.AspNetCore.Mvc;

namespace RFC.Api.Controllers;

[ApiController]
[Route("api/config")]
public sealed class PublicConfigController : ControllerBase
{
    private readonly IConfiguration _configuration;

    public PublicConfigController(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    [HttpGet("public")]
    public IActionResult GetPublicConfig()
    {
        var stripePublishableKey = _configuration["Stripe:PublishableKey"];
        if (string.IsNullOrWhiteSpace(stripePublishableKey) ||
            !(stripePublishableKey.StartsWith("pk_test_", StringComparison.Ordinal) ||
              stripePublishableKey.StartsWith("pk_live_", StringComparison.Ordinal)) ||
            stripePublishableKey.Contains("replace", StringComparison.OrdinalIgnoreCase))
        {
            return StatusCode(
                StatusCodes.Status503ServiceUnavailable,
                new { message = "Card payment configuration is temporarily unavailable." });
        }

        Response.Headers.CacheControl = "public, max-age=300";
        return Ok(new { stripePublishableKey });
    }
}
