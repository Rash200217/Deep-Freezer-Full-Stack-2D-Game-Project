using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using DeepFreezeBackend.Data;
using DeepFreezeBackend.Models;
using System.Security.Cryptography;
using System.Text;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.IdentityModel.Tokens;

namespace DeepFreezeBackend.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly GameDbContext _dbContext;
    private readonly IConfiguration _configuration;
    // Change this to your own secret!
    private const string AdminSecret = "FREEZE_ADMIN_2024";

    public AuthController(GameDbContext dbContext, IConfiguration configuration)
    {
        _dbContext = dbContext;
        _configuration = configuration;
    }

    private string HashPassword(string password)
    {
        using var sha256 = SHA256.Create();
        var bytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(password));
        return Convert.ToBase64String(bytes);
    }

    private string GenerateJwtToken(User user)
    {
        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Username),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim("uid", user.Id.ToString()),
            new Claim("isAdmin", user.IsAdmin.ToString().ToLower()),
            new Claim(ClaimTypes.Role, user.IsAdmin ? "Admin" : "Player")
        };

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_configuration["JwtSettings:Secret"]!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: _configuration["JwtSettings:Issuer"],
            audience: _configuration["JwtSettings:Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddDays(7),
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterDto dto)
    {
        if (await _dbContext.Users.AnyAsync(u => u.Username == dto.Username))
            return BadRequest(new { Message = "Username already exists" });

        if (string.IsNullOrEmpty(dto.Password) || dto.Password.Length < 6 || dto.Password.Length > 8)
            return BadRequest(new { Message = "Password must be between 6 and 8 characters" });

        bool isAdmin = dto.AdminCode == AdminSecret;

        var user = new User
        {
            Username = dto.Username,
            PasswordHash = HashPassword(dto.Password),
            IsAdmin = isAdmin
        };

        _dbContext.Users.Add(user);
        await _dbContext.SaveChangesAsync();

        return Ok(new { Message = isAdmin ? "Admin registered successfully" : "User registered successfully", IsAdmin = isAdmin });
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginDto dto)
    {
        var user = await _dbContext.Users.FirstOrDefaultAsync(u => u.Username == dto.Username);
        if (user == null || user.PasswordHash != HashPassword(dto.Password))
            return Unauthorized(new { Message = "Invalid username or password" });

        var token = GenerateJwtToken(user);
        return Ok(new AuthResponseDto { Token = token, Username = user.Username, IsAdmin = user.IsAdmin });
    }
}
