using System.Net;
using System.Net.Mail;
using System.Security.Cryptography;
using BCrypt.Net;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

[ApiController]
[Route("api/password")]
public class PasswordController(
    AppDbContext db,
    IMemoryCache cache,
    IConfiguration config,
    IWebHostEnvironment environment,
    ILogger<PasswordController> logger) : ControllerBase
{
    [HttpPost("forgot")]
    public async Task<IActionResult> Forgot(ForgotPasswordRequest request)
    {
        var host = config["Email:SmtpHost"];
        var from = config["Email:From"];
        var username = config["Email:SmtpUsername"];
        var password = config["Email:SmtpPassword"];
        var portSetting = config["Email:SmtpPort"];
        var sslSetting = config["Email:EnableSsl"];

        var emailConfigured = !string.IsNullOrWhiteSpace(host) && !string.IsNullOrWhiteSpace(from) &&
            (string.IsNullOrWhiteSpace(username) == string.IsNullOrWhiteSpace(password)) &&
            (string.IsNullOrWhiteSpace(portSetting) || int.TryParse(portSetting, out _)) &&
            (string.IsNullOrWhiteSpace(sslSetting) || bool.TryParse(sslSetting, out _));
        var smtpSettingsMissing = string.IsNullOrWhiteSpace(host) && string.IsNullOrWhiteSpace(from) &&
            string.IsNullOrWhiteSpace(username) && string.IsNullOrWhiteSpace(password);
        var useDevelopmentOtp = environment.IsDevelopment() && smtpSettingsMissing;

        if (!emailConfigured && !useDevelopmentOtp)
            return StatusCode(StatusCodes.Status503ServiceUnavailable,
                new { message = "Password-reset email is not configured. Configure SMTP settings and try again." });

        var user = await db.Users.SingleOrDefaultAsync(x => x.UserId == request.UserId);
        // Do not disclose whether an account exists.
        if (user is null) return Ok(new { message = "If the account exists, a verification code has been generated." });

        var otp = RandomNumberGenerator.GetInt32(100000, 1000000).ToString();
        cache.Set($"resetotp:{user.Id}", otp, TimeSpan.FromMinutes(5));

        if (useDevelopmentOtp)
        {
            return Ok(new
            {
                message = "SMTP is not configured. Use this development-only verification code within 5 minutes.",
                developmentOtp = otp
            });
        }

        try
        {
            using var mail = new MailMessage
            {
                From = new MailAddress(from!),
                Subject = "Your password reset code",
                Body = $"Your password reset code is {otp}. It expires in 5 minutes. If you did not request this, you can ignore this email."
            };
            mail.To.Add(new MailAddress(user.Email));

            var port = string.IsNullOrWhiteSpace(portSetting) ? 587 : int.Parse(portSetting);
            var enableSsl = string.IsNullOrWhiteSpace(sslSetting) || bool.Parse(sslSetting);
            using var smtp = new SmtpClient(host!, port) { EnableSsl = enableSsl };
            if (!string.IsNullOrWhiteSpace(username))
                smtp.Credentials = new NetworkCredential(username, password);

            await smtp.SendMailAsync(mail);
        }
        catch (Exception ex) when (ex is SmtpException or FormatException)
        {
            cache.Remove($"resetotp:{user.Id}");
            logger.LogError(ex, "Unable to send password reset email.");
            return StatusCode(StatusCodes.Status503ServiceUnavailable,
                new { message = "Unable to send the reset code email. Check SMTP settings and try again." });
        }

        return Ok(new { message = "A password-reset verification code has been sent to your email address." });
    }

    [HttpPost("reset")]
    public async Task<IActionResult> Reset(ResetPasswordRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.NewPassword) || request.NewPassword.Length < 8)
            return BadRequest(new { message = "Password must contain at least 8 characters." });

        var user = await db.Users.SingleOrDefaultAsync(x => x.UserId == request.UserId);
        if (user is null || !cache.TryGetValue($"resetotp:{user.Id}", out string? otp) ||
            !string.Equals(otp, request.Otp, StringComparison.Ordinal))
            return BadRequest(new { message = "Verification code is invalid or expired." });

        cache.Remove($"resetotp:{user.Id}");
        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
        var sessions = await db.UserSessions.Where(x => x.UserId == user.Id && !x.IsRevoked).ToListAsync();
        foreach (var session in sessions) session.IsRevoked = true;
        await db.SaveChangesAsync();
        return Ok(new { message = "Password reset successfully. Please log in again." });
    }
}

public record ForgotPasswordRequest(string UserId);
public record ResetPasswordRequest(string UserId, string Otp, string NewPassword);
