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
    public async Task<IActionResult> Get([FromQuery] int limit = 30)
    {
        if (_db == null) return ServiceUnavailable();

        try
        {
            var reviews = await _db.Reviews.AsNoTracking()
                .Where(review => review.Type == "Review" && review.Status == "Published")
                .OrderByDescending(r => r.Date)
                .Take(Math.Clamp(limit, 1, 100))
                .Select(review => new PublicReviewDto(
                    review.Id,
                    review.CustomerName,
                    review.Rating,
                    review.Category,
                    review.Comment,
                    review.Response,
                    review.Date))
                .ToListAsync(HttpContext.RequestAborted);
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
                Status = "Pending",
                Date = DateTime.UtcNow
            };

            _db.Reviews.Add(review);
            await _db.SaveChangesAsync(HttpContext.RequestAborted);
            return Accepted(new { review.Id, review.Status });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to persist feedback.");
            return ServiceUnavailable();
        }
    }

    [Authorize(Policy = "StaffOnly")]
    [HttpGet("moderation")]
    public async Task<IActionResult> GetForModeration([FromQuery] int page = 1, [FromQuery] int pageSize = 50)
    {
        if (_db == null) return ServiceUnavailable();

        try
        {
            var safePage = Math.Max(1, page);
            var safePageSize = Math.Clamp(pageSize, 1, 100);
            var feedback = await _db.Reviews.AsNoTracking()
                .OrderByDescending(review => review.Date)
                .Skip((safePage - 1) * safePageSize)
                .Take(safePageSize)
                .ToListAsync(HttpContext.RequestAborted);
            return Ok(feedback);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to load feedback moderation queue.");
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
            var review = await _db.Reviews.FirstOrDefaultAsync(r => r.Id == cleanId, HttpContext.RequestAborted);
            if (review == null) return NotFound(new { message = "Feedback item not found." });

            var oldValue = new { review.Status, review.Response };
            review.Status = InputSanitizer.Clean(request.Status, 30);
            review.Response = InputSanitizer.CleanNullable(request.Response, 1000);
            await _db.SaveChangesAsync(HttpContext.RequestAborted);

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

public sealed record PublicReviewDto(
    string Id,
    string CustomerName,
    int Rating,
    string Category,
    string Comment,
    string? Response,
    DateTime Date);
