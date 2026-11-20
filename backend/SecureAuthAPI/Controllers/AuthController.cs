using System.Security.Claims;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Cryptography;
using System.Text;
using System.Net.Mail;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.IdentityModel.Tokens;
using MySqlConnector;

[ApiController]
[Route("api/[controller]")]
public class AuthController(
    AppDbContext db,
    IMemoryCache cache,
    IConfiguration config,
    IWebHostEnvironment environment) : ControllerBase
{
    private const string RefreshCookie = "secureauth_refresh";

    [HttpPost("register")]
    public async Task<IActionResult> Register(RegisterRequest request)
    {
        var userId = request.UserId?.Trim();
        var email = request.Email?.Trim();
        var mobileNumber = request.MobileNumber?.Trim();
        var password = request.Password ?? "";

        if (string.IsNullOrEmpty(userId) || userId.Length > 20 || !userId.All(char.IsDigit))
            return BadRequest(new { message = "User ID must contain 1 to 20 numbers." });
        if (password.Length < 8 || Encoding.UTF8.GetByteCount(password) > 72)
            return BadRequest(new { message = "Password must be at least 8 characters and no more than 72 bytes." });
        if (string.IsNullOrWhiteSpace(email) ||
            !MailAddress.TryCreate(email, out var parsedEmail) ||
            !string.Equals(parsedEmail.Address, email, StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "Enter a valid email address." });
        if (string.IsNullOrWhiteSpace(mobileNumber))
            return BadRequest(new { message = "Mobile number is required." });

        if (await db.Users.AnyAsync(x => x.UserId == userId))
            return Conflict(new { message = "That User ID is already registered." });

        var user = new AppUser
        {
            UserId = userId,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
            MobileNumber = mobileNumber,
            Email = email,
            IsActive = true,
            CreatedAtUtc = DateTime.UtcNow
        };
        db.Users.Add(user);

        try
        {
            await db.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (ex.InnerException is MySqlException { Number: 1062 })
        {
            return Conflict(new { message = "That User ID is already registered." });
        }

        return StatusCode(StatusCodes.Status201Created,
            new { message = "Account created successfully. You can now sign in.", userId = user.UserId });
    }

    [HttpGet("captcha")]
    public IActionResult GetCaptcha()
    {
        var code = Convert.ToHexString(RandomNumberGenerator.GetBytes(3));
        var id = Guid.NewGuid().ToString("N");
        cache.Set($"captcha:{id}", code, TimeSpan.FromMinutes(5));
        // Demo returns the code so the app can be tested without an image-CAPTCHA provider.
        return Ok(new { captchaId = id, captchaText = code, expiresInMinutes = 5 });
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.UserId) || !request.UserId.All(char.IsDigit))
            return BadRequest(new { message = "User ID must contain numbers only." });

        if (!cache.TryGetValue($"captcha:{request.CaptchaId}", out string? expected) ||
            !string.Equals(expected, request.CaptchaText?.Trim(), StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "CAPTCHA is invalid or expired. Please refresh it." });

        cache.Remove($"captcha:{request.CaptchaId}");
        var user = await db.Users.SingleOrDefaultAsync(x => x.UserId == request.UserId);
        if (user is null || !user.IsActive || !BCrypt.Net.BCrypt.Verify(request.Password ?? "", user.PasswordHash))
            return Unauthorized(new { message = "Invalid User ID or password." });

        var refreshDays = request.RememberMe ? 30 : 1;
        var refreshToken = Convert.ToBase64String(RandomNumberGenerator.GetBytes(48));
        var session = new UserSession
        {
            UserId = user.Id,
            RefreshTokenHash = Hash(refreshToken),
            CreatedAtUtc = DateTime.UtcNow,
            LastActivityUtc = DateTime.UtcNow,
            ExpiresAtUtc = DateTime.UtcNow.AddDays(refreshDays)
        };
        db.UserSessions.Add(session);
        await db.SaveChangesAsync();
        SetRefreshCookie(refreshToken, refreshDays);

        return Ok(new
        {
            accessToken = CreateAccessToken(user),
            expiresInMinutes = 15,
            user = new { userId = user.UserId, email = user.Email, mobileNumber = user.MobileNumber }
        });
    }

    [HttpPost("refresh")]
    public async Task<IActionResult> Refresh()
    {
        if (!Request.Cookies.TryGetValue(RefreshCookie, out var token))
            return Unauthorized(new { message = "Session expired. Please log in again." });

        var hash = Hash(token);
        var session = await db.UserSessions.SingleOrDefaultAsync(x =>
            x.RefreshTokenHash == hash && !x.IsRevoked && x.ExpiresAtUtc > DateTime.UtcNow);
        if (session is null)
            return Unauthorized(new { message = "Session expired. Please log in again." });

        // Normal sessions expire after 15 minutes of inactivity.
        if (session.ExpiresAtUtc - session.CreatedAtUtc < TimeSpan.FromDays(2) &&
            DateTime.UtcNow - session.LastActivityUtc > TimeSpan.FromMinutes(15))
        {
            session.IsRevoked = true;
            await db.SaveChangesAsync();
            Response.Cookies.Delete(RefreshCookie);
            return Unauthorized(new { message = "Session timed out. Please log in again." });
        }

        session.LastActivityUtc = DateTime.UtcNow;
        var newToken = Convert.ToBase64String(RandomNumberGenerator.GetBytes(48));
        session.RefreshTokenHash = Hash(newToken);
        await db.SaveChangesAsync();
        SetRefreshCookie(newToken, Math.Max(1, (int)Math.Ceiling((session.ExpiresAtUtc - DateTime.UtcNow).TotalDays)));
        var user = await db.Users.FindAsync(session.UserId);
        if (user is null) return Unauthorized();
        return Ok(new { accessToken = CreateAccessToken(user), expiresInMinutes = 15 });
    }

    [Authorize]
    [HttpGet("profile")]
    public async Task<IActionResult> Profile()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var user = await db.Users.SingleOrDefaultAsync(x => x.Id.ToString() == userId);
        if (user is null) return Unauthorized();
        return Ok(new { userId = user.UserId, email = user.Email, mobileNumber = user.MobileNumber });
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        if (Request.Cookies.TryGetValue(RefreshCookie, out var token))
        {
            var session = await db.UserSessions.SingleOrDefaultAsync(x => x.RefreshTokenHash == Hash(token));
            if (session is not null)
            {
                session.IsRevoked = true;
                await db.SaveChangesAsync();
            }
        }
        Response.Cookies.Delete(RefreshCookie);
        return Ok(new { message = "Logged out successfully." });
    }

    private string CreateAccessToken(AppUser user)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(config["Jwt:Key"]!));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Name, user.UserId)
        };
        var token = new JwtSecurityToken(
            issuer: config["Jwt:Issuer"],
            audience: config["Jwt:Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(15),
            signingCredentials: credentials);
        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private void SetRefreshCookie(string token, int days)
    {
        Response.Cookies.Append(RefreshCookie, token, new CookieOptions
        {
            HttpOnly = true,
            Secure = !environment.IsDevelopment(),
            SameSite = SameSiteMode.Lax,
            Expires = DateTimeOffset.UtcNow.AddDays(days),
            Path = "/api/auth"
        });
    }

    private static string Hash(string value) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));
}

public record LoginRequest(string UserId, string Password, string CaptchaId, string CaptchaText, bool RememberMe);
public record RegisterRequest(string UserId, string Password, string Email, string MobileNumber);
