using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using RFC.Api.Data;
using RFC.Api.Models;
using RFC.Api.Security;
using RFC.Api.Services;

namespace RFC.Api.Controllers;

[ApiController]
[RequestSizeLimit(1_048_576)]
[Route("api/[controller]")]
public class ReviewsController : ControllerBase
{
    private const string ServiceUnavailableMessage = "Service temporarily unavailable. Please try again shortly.";

    private readonly RfcDbContext? _db;
    private readonly AuditService? _audit;
    private readonly ILogger<ReviewsController> _logger;

    public ReviewsController(IServiceProvider provider, ILogger<ReviewsController> logger)
    {
        _db = provider.GetService<RfcDbContext>();
        _audit = provider.GetService<AuditService>();
        _logger = logger;
    }

    [HttpGet]
    public async Task<IActionResult> Get()
    {
        if (_db == null) return ServiceUnavailable();

        try
        {
            var reviews = await _db.Reviews.AsNoTracking().OrderByDescending(r => r.Date).ToListAsync();
            return Ok(reviews);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to load reviews.");
            return ServiceUnavailable();
        }
    }

    [HttpPost]
    [EnableRateLimiting("feedback-write")]
    public async Task<IActionResult> Create([FromBody] FeedbackCreateRequest request)
    {
        if (_db == null) return ServiceUnavailable();

        try
        {
            var review = new DbReview
            {
                Id = $"rev-{Guid.NewGuid():N}",
                CustomerName = string.IsNullOrWhiteSpace(request.CustomerName)
                    ? "Anonymous Customer"
                    : InputSanitizer.Clean(request.CustomerName, 100),
                Rating = request.Rating,
                Type = InputSanitizer.Clean(request.Type, 30),
                Category = InputSanitizer.Clean(request.Category, 80),
                Comment = InputSanitizer.Clean(request.Comment, 2000),
                OrderNumber = InputSanitizer.CleanNullable(request.OrderNumber, 30),
                Status = request.Type == "Complaint" ? "Pending" : "Published",
                Date = DateTime.UtcNow
            };

            _db.Reviews.Add(review);
            await _db.SaveChangesAsync();
            return Ok(review);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to persist feedback.");
            return ServiceUnavailable();
        }
    }

    [Authorize(Policy = "StaffOnly")]
    [HttpPut("{id}")]
    [EnableRateLimiting("feedback-write")]
    public async Task<IActionResult> Update(string id, [FromBody] FeedbackUpdateRequest request)
    {
        if (_db == null) return ServiceUnavailable();

        try
        {
            var cleanId = InputSanitizer.Clean(id, 80);
            var review = await _db.Reviews.FirstOrDefaultAsync(r => r.Id == cleanId);
            if (review == null) return NotFound(new { message = "Feedback item not found." });

            var oldValue = new { review.Status, review.Response };
            review.Status = InputSanitizer.Clean(request.Status, 30);
            review.Response = InputSanitizer.CleanNullable(request.Response, 1000);
            await _db.SaveChangesAsync();

            if (_audit != null)
            {
                await _audit.LogAsync("UpdateFeedback", "Review", review.Id, oldValue, new { review.Status, review.Response });
            }

            return Ok(review);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to update feedback {FeedbackId}", id);
            return ServiceUnavailable();
        }
    }

    private ObjectResult ServiceUnavailable()
    {
        return StatusCode(StatusCodes.Status503ServiceUnavailable, new { message = ServiceUnavailableMessage });
    }
}
