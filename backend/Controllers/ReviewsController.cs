using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using RFC.Api.Data;
using RFC.Api.Models;

namespace RFC.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ReviewsController : ControllerBase
{
    private static readonly List<DbReview> InMemoryReviews =
    [
        new()
        {
            Id = "rev-1",
            CustomerName = "Sarah M.",
            Rating = 5,
            Type = "Review",
            Category = "Food Quality",
            Comment = "The 10-piece bucket was super crispy and piping hot. Delivered in 25 mins.",
            Date = new DateTime(2026, 7, 29, 18, 30, 0, DateTimeKind.Utc),
            Status = "Published",
            Response = "Thank you Sarah. Glad you loved the extra crispy recipe."
        },
        new()
        {
            Id = "rev-2",
            CustomerName = "David K.",
            Rating = 5,
            Type = "Review",
            Category = "Delivery Speed",
            Comment = "Always fast delivery to Berry Avenue. Free delivery code worked perfectly.",
            Date = new DateTime(2026, 7, 28, 19, 15, 0, DateTimeKind.Utc),
            Status = "Published"
        }
    ];

    private readonly RfcDbContext? _db;
    private readonly ILogger<ReviewsController> _logger;

    public ReviewsController(IServiceProvider provider, ILogger<ReviewsController> logger)
    {
        _db = provider.GetService<RfcDbContext>();
        _logger = logger;
    }

    [HttpGet]
    public async Task<IActionResult> Get()
    {
        if (_db != null)
        {
            try
            {
                var reviews = await _db.Reviews.AsNoTracking().OrderByDescending(r => r.Date).ToListAsync();
                return Ok(reviews.Count > 0 ? reviews : InMemoryReviews);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to load reviews.");
                return StatusCode(StatusCodes.Status503ServiceUnavailable, new { message = "Reviews could not be loaded." });
            }
        }

        return Ok(InMemoryReviews);
    }

    [HttpPost]
    [EnableRateLimiting("feedback-write")]
    public async Task<IActionResult> Create([FromBody] FeedbackCreateRequest request)
    {
        var review = new DbReview
        {
            Id = $"rev-{Guid.NewGuid():N}",
            CustomerName = string.IsNullOrWhiteSpace(request.CustomerName) ? "Anonymous Customer" : request.CustomerName.Trim(),
            Rating = request.Rating,
            Type = request.Type,
            Category = request.Category.Trim(),
            Comment = request.Comment.Trim(),
            OrderNumber = string.IsNullOrWhiteSpace(request.OrderNumber) ? null : request.OrderNumber.Trim(),
            Status = request.Type == "Complaint" ? "Pending" : "Published",
            Date = DateTime.UtcNow
        };

        if (_db != null)
        {
            try
            {
                _db.Reviews.Add(review);
                await _db.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to persist feedback.");
                return StatusCode(StatusCodes.Status503ServiceUnavailable, new { message = "Feedback could not be saved." });
            }
        }
        else
        {
            InMemoryReviews.Insert(0, review);
        }

        return Ok(review);
    }

    [Authorize(Policy = "StaffOnly")]
    [HttpPut("{id}")]
    [EnableRateLimiting("feedback-write")]
    public async Task<IActionResult> Update(string id, [FromBody] FeedbackUpdateRequest request)
    {
        if (_db != null)
        {
            try
            {
                var review = await _db.Reviews.FirstOrDefaultAsync(r => r.Id == id);
                if (review == null) return NotFound(new { message = "Feedback item not found." });

                review.Status = request.Status;
                review.Response = request.Response;
                await _db.SaveChangesAsync();
                return Ok(review);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to update feedback {FeedbackId}", id);
                return StatusCode(StatusCodes.Status503ServiceUnavailable, new { message = "Feedback could not be updated." });
            }
        }

        var inMemory = InMemoryReviews.FirstOrDefault(r => r.Id == id);
        if (inMemory == null) return NotFound(new { message = "Feedback item not found." });

        inMemory.Status = request.Status;
        inMemory.Response = request.Response;
        return Ok(inMemory);
    }
}
