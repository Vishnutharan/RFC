using System.ComponentModel.DataAnnotations;

namespace RFC.Api.Models;

public class LoginRequest
{
    [Required]
    [EmailAddress]
    [MaxLength(120)]
    public string Email { get; set; } = string.Empty;

    [Required]
    [MinLength(8)]
    [MaxLength(200)]
    public string Password { get; set; } = string.Empty;
}

public class CustomerRegisterRequest : LoginRequest
{
    [Required]
    [MinLength(2)]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [Phone]
    [MaxLength(30)]
    public string Phone { get; set; } = string.Empty;

    [MaxLength(400)]
    public string Address { get; set; } = string.Empty;

    [MaxLength(20)]
    public string Postcode { get; set; } = string.Empty;
}

public class CustomerUpdateRequest
{
    [Required]
    [MinLength(2)]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [Phone]
    [MaxLength(30)]
    public string Phone { get; set; } = string.Empty;

    [MaxLength(400)]
    public string Address { get; set; } = string.Empty;

    [MaxLength(20)]
    public string Postcode { get; set; } = string.Empty;
}

public sealed record AuthUserDto(string Id, string Name, string Email, string Role, string? Phone = null, string? Address = null, string? Postcode = null);
