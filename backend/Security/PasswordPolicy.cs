namespace RFC.Api.Security;

public static class PasswordPolicy
{
    public static bool IsValid(string? password)
    {
        if (string.IsNullOrWhiteSpace(password) || password.Length is < 12 or > 128) return false;

        return password.Any(char.IsUpper) &&
               password.Any(char.IsLower) &&
               password.Any(char.IsDigit);
    }

    public const string Message = "Password must be 12-128 characters and include uppercase, lowercase, and a digit.";
}
