using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using DeepFreezeBackend.Data;

namespace DeepFreezeBackend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Admin")]
    public class AdminController : ControllerBase
    {
        private readonly GameDbContext _context;
        public AdminController(GameDbContext context) { _context = context; }

        // ─── USERS ────────────────────────────────────────────────────────
        [HttpGet("users")]
        public async Task<IActionResult> GetUsers()
        {
            var users = await _context.Users
                .Select(u => new { u.Id, u.Username, u.IsAdmin, CreatedAt = u.CreatedAt.ToString("yyyy-MM-dd HH:mm") })
                .ToListAsync();
            return Ok(users);
        }

        [HttpDelete("users/{id}")]
        public async Task<IActionResult> DeleteUser(int id)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null) return NotFound();
            // Prevent self-deletion
            var myId = User.Claims.FirstOrDefault(c => c.Type == "uid")?.Value;
            if (myId == id.ToString()) return BadRequest(new { message = "Cannot delete your own account" });
            _context.Users.Remove(user);
            await _context.SaveChangesAsync();
            return Ok(new { message = "User deleted" });
        }

        [HttpPatch("users/{id}/toggle-admin")]
        public async Task<IActionResult> ToggleAdmin(int id)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null) return NotFound();
            var myId = User.Claims.FirstOrDefault(c => c.Type == "uid")?.Value;
            if (myId == id.ToString()) return BadRequest(new { message = "Cannot change your own admin status" });
            user.IsAdmin = !user.IsAdmin;
            await _context.SaveChangesAsync();
            return Ok(new { message = "Updated", isAdmin = user.IsAdmin });
        }

        // ─── LEVELS ───────────────────────────────────────────────────────
        [HttpGet("levels")]
        public async Task<IActionResult> GetLevels()
        {
            var levels = new List<object>();
            var conn = _context.Database.GetDbConnection();
            await conn.OpenAsync();
            using var cmd = conn.CreateCommand();
            cmd.CommandText = @"SELECT ""Id"", ""AuthorName"", ""Name"", ""PlayCount"", ""CreatedAt"" FROM ""Levels"" ORDER BY ""CreatedAt"" DESC";
            using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                levels.Add(new {
                    id = reader.GetInt32(0),
                    authorName = reader.GetString(1),
                    name = reader.GetString(2),
                    playCount = reader.GetInt32(3),
                    createdAt = reader.GetDateTime(4).ToString("yyyy-MM-dd HH:mm")
                });
            }
            await conn.CloseAsync();
            return Ok(levels);
        }

        [HttpPatch("levels/{id}")]
        public async Task<IActionResult> UpdateLevelName(int id, [FromBody] LevelNameDto dto)
        {
            var conn = _context.Database.GetDbConnection();
            await conn.OpenAsync();
            using var cmd = conn.CreateCommand();
            cmd.CommandText = @"UPDATE ""Levels"" SET ""Name"" = @name WHERE ""Id"" = @id";
            cmd.Parameters.Add(new NpgsqlParameter("@name", dto.Name));
            cmd.Parameters.Add(new NpgsqlParameter("@id", id));
            var rows = await cmd.ExecuteNonQueryAsync();
            await conn.CloseAsync();
            if (rows == 0) return NotFound();
            return Ok(new { message = "Level updated" });
        }

        [HttpDelete("levels/{id}")]
        public async Task<IActionResult> DeleteLevel(int id)
        {
            var conn = _context.Database.GetDbConnection();
            await conn.OpenAsync();
            using var cmd = conn.CreateCommand();
            cmd.CommandText = @"DELETE FROM ""Levels"" WHERE ""Id"" = @id";
            cmd.Parameters.Add(new NpgsqlParameter("@id", id));
            var rows = await cmd.ExecuteNonQueryAsync();
            await conn.CloseAsync();
            if (rows == 0) return NotFound();
            return Ok(new { message = "Level deleted" });
        }

        // ─── SCORES ───────────────────────────────────────────────────────
        [HttpGet("scores")]
        public async Task<IActionResult> GetScores()
        {
            var scores = await _context.Scores
                .Include(s => s.User)
                .OrderByDescending(s => s.Value)
                .Select(s => new { s.Id, Username = s.User!.Username, s.Value, AchievedAt = s.AchievedAt.ToString("yyyy-MM-dd HH:mm") })
                .ToListAsync();
            return Ok(scores);
        }

        [HttpDelete("scores/{id}")]
        public async Task<IActionResult> DeleteScore(int id)
        {
            var score = await _context.Scores.FindAsync(id);
            if (score == null) return NotFound();
            _context.Scores.Remove(score);
            await _context.SaveChangesAsync();
            return Ok(new { message = "Score deleted" });
        }

        // ─── STATS ────────────────────────────────────────────────────────
        [HttpGet("stats")]
        public async Task<IActionResult> GetStats()
        {
            var userCount  = await _context.Users.CountAsync();
            var adminCount = await _context.Users.CountAsync(u => u.IsAdmin);
            var scoreCount = await _context.Scores.CountAsync();

            int levelCount = 0;
            var conn = _context.Database.GetDbConnection();
            await conn.OpenAsync();
            using var cmd = conn.CreateCommand();
            cmd.CommandText = @"SELECT COUNT(*) FROM ""Levels""";
            levelCount = Convert.ToInt32(await cmd.ExecuteScalarAsync());
            await conn.CloseAsync();

            return Ok(new { userCount, adminCount, scoreCount, levelCount });
        }
    }

    public class LevelNameDto { public string Name { get; set; } = ""; }
}
