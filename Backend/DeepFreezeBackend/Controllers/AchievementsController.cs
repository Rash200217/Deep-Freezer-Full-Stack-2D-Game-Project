using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Npgsql;
using Microsoft.EntityFrameworkCore;
using DeepFreezeBackend.Data;

namespace DeepFreezeBackend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class AchievementsController : ControllerBase
    {
        private readonly GameDbContext _context;
        public AchievementsController(GameDbContext context) { _context = context; }

        private static readonly Dictionary<string, (string Icon, string Title, string Desc)> ACHIEVEMENTS = new()
        {
            ["FIRST_BLOOD"]   = ("🩸", "FIRST BLOOD",    "Defeat your first enemy"),
            ["UNTOUCHABLE"]   = ("🛡", "UNTOUCHABLE",     "Clear a stage without taking damage"),
            ["SPEEDRUNNER"]   = ("⚡", "SPEEDRUNNER",     "Clear a stage in under 30 seconds"),
            ["MAP_MAKER"]     = ("🗺", "MAP MAKER",       "Publish your first community map"),
            ["BOSS_SLAYER"]   = ("👑", "BOSS SLAYER",     "Defeat the final boss"),
            ["SHIELD_BASH"]   = ("🔰", "SHIELD BASH",    "Defeat a shield carrier from behind"),
        };

        // GET: api/achievements/mine
        [HttpGet("mine")]
        public async Task<IActionResult> GetMine()
        {
            var userIdClaim = User.Claims.FirstOrDefault(c => c.Type == "uid")?.Value;
            if (userIdClaim == null || !int.TryParse(userIdClaim, out int userId)) return Unauthorized();

            var conn = _context.Database.GetDbConnection();
            await conn.OpenAsync();
            using var cmd = conn.CreateCommand();
            cmd.CommandText = @"SELECT ""AchievementKey"", ""AchievedAt"" FROM ""Achievements"" WHERE ""UserId"" = @uid ORDER BY ""AchievedAt"" DESC";
            cmd.Parameters.Add(new NpgsqlParameter("@uid", userId));
            using var reader = await cmd.ExecuteReaderAsync();
            var earned = new List<object>();
            while (await reader.ReadAsync())
            {
                var key = reader.GetString(0);
                var at = reader.GetDateTime(1).ToString("yyyy-MM-dd HH:mm");
                if (ACHIEVEMENTS.TryGetValue(key, out var meta))
                    earned.Add(new { key, icon = meta.Icon, title = meta.Title, description = meta.Desc, achievedAt = at });
            }
            await conn.CloseAsync();

            // Also return all possible achievements with unlocked flag
            var all = ACHIEVEMENTS.Select(kvp => new {
                key = kvp.Key,
                icon = kvp.Value.Icon,
                title = kvp.Value.Title,
                description = kvp.Value.Desc,
                unlocked = earned.Any(e => ((dynamic)e).key == kvp.Key)
            }).ToList();

            return Ok(new { earned, all });
        }

        // POST: api/achievements/unlock
        [HttpPost("unlock")]
        public async Task<IActionResult> Unlock([FromBody] UnlockDto dto)
        {
            var userIdClaim = User.Claims.FirstOrDefault(c => c.Type == "uid")?.Value;
            if (userIdClaim == null || !int.TryParse(userIdClaim, out int userId)) return Unauthorized();

            if (!ACHIEVEMENTS.ContainsKey(dto.Key)) return BadRequest(new { message = "Unknown achievement" });

            var conn = _context.Database.GetDbConnection();
            await conn.OpenAsync();
            using var cmd = conn.CreateCommand();
            cmd.CommandText = @"
                INSERT INTO ""Achievements"" (""UserId"", ""AchievementKey"", ""AchievedAt"")
                VALUES (@uid, @key, @at)
                ON CONFLICT DO NOTHING";
            cmd.Parameters.Add(new NpgsqlParameter("@uid", userId));
            cmd.Parameters.Add(new NpgsqlParameter("@key", dto.Key));
            cmd.Parameters.Add(new NpgsqlParameter("@at", DateTime.UtcNow));
            var rows = await cmd.ExecuteNonQueryAsync();
            await conn.CloseAsync();

            var meta = ACHIEVEMENTS[dto.Key];
            bool isNew = rows > 0;
            return Ok(new { isNew, icon = meta.Icon, title = meta.Title, description = meta.Desc });
        }
    }

    public class UnlockDto { public string Key { get; set; } = ""; }
}
