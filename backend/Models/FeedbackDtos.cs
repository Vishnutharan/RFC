using System.ComponentModel.DataAnnotations;

namespace RFC.Api.Models;

public class FeedbackCreateRequest
{
    [MaxLength(100)]
    public string CustomerName { get; set; } = "Anonymous Customer";

    [Range(1, 5)]
    public int Rating { get; set; } = 5;

    [Required]
    [RegularExpression("Review|Complaint")]
    public string Type { get; set; } = "Review";

    [Required]
    [MaxLength(80)]
    public string Category { get; set; } = "General";

    [Required]
    [MinLength(3)]
    [MaxLength(2000)]
    public string Comment { get; set; } = string.Empty;

    [MaxLength(30)]
    public string? OrderNumber { get; set; }
}

public class FeedbackUpdateRequest
{
    [Required]
    [RegularExpression("Published|Pending|Resolved|Hidden")]
    public string Status { get; set; } = "Resolved";

    [MaxLength(1000)]
    public string? Response { get; set; }
}
