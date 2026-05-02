using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using DeepFreezeBackend.Data;
using DeepFreezeBackend.Models;
using System.Security.Claims;

namespace DeepFreezeBackend.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ScoresController : ControllerBase
{
    private readonly GameDbContext _dbContext;

    public ScoresController(GameDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    [HttpGet("leaderboard")]
    public async Task<IActionResult> GetLeaderboard([FromQuery] int limit = 10)
    {
        var scores = await _dbContext.Scores
            .OrderByDescending(s => s.Value)
            .Take(limit)
            .Select(s => new
            {
                username = _dbContext.Users
                    .Where(u => u.Id == s.UserId)
                    .Select(u => u.Username)
                    .FirstOrDefault() ?? "Unknown Player",
                value = s.Value,
                achievedAt = s.AchievedAt
            })
            .ToListAsync();

        return Ok(scores);
    }

    [Authorize]
    [HttpPost]
    public async Task<IActionResult> SubmitScore([FromBody] ScoreDto dto)
    {
        var userIdClaim = User.Claims.FirstOrDefault(c => c.Type == "uid")?.Value;
        if (userIdClaim == null || !int.TryParse(userIdClaim, out var userId))
            return Unauthorized();

        // BLOCK ADMINS FROM SCORING
        var user = await _dbContext.Users.FindAsync(userId);
        if (user != null && user.IsAdmin)
        {
            return StatusCode(403, new { Message = "Admins are restricted from competitive gameplay." });
        }

        // Check if user already has a score
        var existingScore = await _dbContext.Scores.FirstOrDefaultAsync(s => s.UserId == userId);

        if (existingScore != null)
        {
            // Only update if the new score is higher
            if (dto.Value > existingScore.Value)
            {
                existingScore.Value = dto.Value;
                existingScore.AchievedAt = DateTime.UtcNow;
                await _dbContext.SaveChangesAsync();
                return Ok(new { Message = "High score updated!", ScoreId = existingScore.Id });
            }
            return Ok(new { Message = "Score submitted, but not a new high score.", ScoreId = existingScore.Id });
        }

        // New score entry for this user
        var score = new Score
        {
            UserId = userId,
            Value = dto.Value,
            AchievedAt = DateTime.UtcNow
        };

        _dbContext.Scores.Add(score);
        await _dbContext.SaveChangesAsync();

        return Ok(new { Message = "Score submitted successfully", ScoreId = score.Id });
    }
}

public class ScoreDto
{
    public long Value { get; set; }
}
