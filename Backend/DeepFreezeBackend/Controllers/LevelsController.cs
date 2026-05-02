using Microsoft.AspNetCore.Mvc;
using Npgsql;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;
using DeepFreezeBackend.Data;
using DeepFreezeBackend.Models;

namespace DeepFreezeBackend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class LevelsController : ControllerBase
    {
        private readonly GameDbContext _context;
        public LevelsController(GameDbContext context) { _context = context; }

        // GET: api/levels?limit=20&sort=top
        [HttpGet]
        public async Task<ActionResult<IEnumerable<object>>> GetLevels(
            [FromQuery] int limit = 20,
            [FromQuery] string sort = "new")
        {
            var levels = new List<object>();
            var conn = _context.Database.GetDbConnection();
            await conn.OpenAsync();
            using var cmd = conn.CreateCommand();

            string orderBy = sort == "top"
                ? @"COALESCE((SELECT SUM(""Vote"") FROM ""LevelRatings"" WHERE ""LevelId"" = l.""Id""), 0) DESC"
                : @"l.""CreatedAt"" DESC";

            cmd.CommandText = $@"
                SELECT l.""Id"", l.""AuthorName"", l.""Name"", l.""PlayCount"", l.""CreatedAt"", l.""GridData"", l.""Thumbnail"",
                       COALESCE((SELECT SUM(""Vote"") FROM ""LevelRatings"" WHERE ""LevelId"" = l.""Id""), 0) AS Rating,
                       COALESCE((SELECT COUNT(*) FROM ""LevelRatings"" WHERE ""LevelId"" = l.""Id"" AND ""Vote"" = 1), 0) AS Upvotes,
                       COALESCE((SELECT COUNT(*) FROM ""LevelRatings"" WHERE ""LevelId"" = l.""Id"" AND ""Vote"" = -1), 0) AS Downvotes
                FROM ""Levels"" l
                ORDER BY {orderBy}
                LIMIT {limit}";

            using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                levels.Add(new {
                    id         = reader.GetInt32(0),
                    authorName = reader.GetString(1),
                    name       = reader.GetString(2),
                    playCount  = reader.GetInt32(3),
                    createdAt  = reader.GetDateTime(4).ToString("yyyy-MM-ddTHH:mm:ssZ"),
                    gridData   = reader.GetString(5),
                    thumbnail  = reader.IsDBNull(6) ? null : reader.GetString(6),
                    rating     = Convert.ToInt32(reader.GetValue(7)),
                    upvotes    = Convert.ToInt32(reader.GetValue(8)),
                    downvotes  = Convert.ToInt32(reader.GetValue(9))
                });
            }
            await conn.CloseAsync();
            return Ok(levels);
        }

        // POST: api/levels/publish — requires login
        [HttpPost("publish")]
        [Authorize]
        public async Task<ActionResult> PublishLevel(LevelPublishDto dto)
        {
            var userIdClaim = User.Claims.FirstOrDefault(c => c.Type == "uid")?.Value;
            if (userIdClaim == null || !int.TryParse(userIdClaim, out int userId))
                return Unauthorized();

            var user = await _context.Users.FindAsync(userId);
            if (user == null) return Unauthorized();
            if (user.IsAdmin) return StatusCode(403, new { message = "Admins cannot publish levels." });

            string name = string.IsNullOrWhiteSpace(dto.Name) ? "Unnamed Map" : dto.Name;
            DateTime createdAt = DateTime.UtcNow;
            string? thumbnail = dto.Thumbnail; // base64 PNG data URL

            var conn = _context.Database.GetDbConnection();
            await conn.OpenAsync();
            using var cmd = conn.CreateCommand();
            cmd.CommandText = @"INSERT INTO ""Levels"" (""UserId"", ""AuthorName"", ""Name"", ""GridData"", ""Thumbnail"", ""PlayCount"", ""CreatedAt"") 
                               VALUES (@uid, @author, @name, @grid, @thumb, 0, @created)";
            cmd.Parameters.Add(new NpgsqlParameter("@uid", userId));
            cmd.Parameters.Add(new NpgsqlParameter("@author", user.Username));
            cmd.Parameters.Add(new NpgsqlParameter("@name", name));
            cmd.Parameters.Add(new NpgsqlParameter("@grid", dto.GridData));
            cmd.Parameters.Add(new NpgsqlParameter("@thumb", (object?)thumbnail ?? DBNull.Value));
            cmd.Parameters.Add(new NpgsqlParameter("@created", createdAt));
            await cmd.ExecuteNonQueryAsync();
            await conn.CloseAsync();

            return Ok(new { success = true, message = "Level published!" });
        }

        // POST: api/levels/{id}/vote — requires login
        [HttpPost("{id}/vote")]
        [Authorize]
        public async Task<ActionResult> Vote(int id, [FromBody] VoteDto dto)
        {
            var userIdClaim = User.Claims.FirstOrDefault(c => c.Type == "uid")?.Value;
            if (userIdClaim == null || !int.TryParse(userIdClaim, out int userId))
                return Unauthorized();

            var user = await _context.Users.FindAsync(userId);
            if (user != null && user.IsAdmin) return StatusCode(403, new { message = "Admins cannot vote on levels." });

            if (dto.Vote != 1 && dto.Vote != -1)
                return BadRequest(new { message = "Vote must be 1 or -1" });

            var conn = _context.Database.GetDbConnection();
            await conn.OpenAsync();
            using var cmd = conn.CreateCommand();
            // UPSERT — update if exists, insert if not
            cmd.CommandText = @"
                INSERT INTO ""LevelRatings"" (""LevelId"", ""UserId"", ""Vote"") VALUES (@lid, @uid, @vote)
                ON CONFLICT(""LevelId"", ""UserId"") DO UPDATE SET ""Vote"" = @vote";
            cmd.Parameters.Add(new NpgsqlParameter("@lid", id));
            cmd.Parameters.Add(new NpgsqlParameter("@uid", userId));
            cmd.Parameters.Add(new NpgsqlParameter("@vote", dto.Vote));
            await cmd.ExecuteNonQueryAsync();

            // Return new totals
            using var cmd2 = conn.CreateCommand();
            cmd2.CommandText = @"
                SELECT COALESCE(SUM(""Vote""), 0),
                       COALESCE(SUM(CASE WHEN ""Vote"" = 1 THEN 1 ELSE 0 END), 0),
                       COALESCE(SUM(CASE WHEN ""Vote"" = -1 THEN 1 ELSE 0 END), 0)
                FROM ""LevelRatings"" WHERE ""LevelId"" = @lid";
            cmd2.Parameters.Add(new NpgsqlParameter("@lid", id));
            using var r = await cmd2.ExecuteReaderAsync();
            await r.ReadAsync();
            var result = new { rating = Convert.ToInt32(r.GetValue(0)), upvotes = Convert.ToInt32(r.GetValue(1)), downvotes = Convert.ToInt32(r.GetValue(2)) };
            await conn.CloseAsync();

            return Ok(result);
        }

        // GET: api/levels/{id}/myvote — what did the current user vote?
        [HttpGet("{id}/myvote")]
        [Authorize]
        public async Task<ActionResult> GetMyVote(int id)
        {
            var userIdClaim = User.Claims.FirstOrDefault(c => c.Type == "uid")?.Value;
            if (userIdClaim == null || !int.TryParse(userIdClaim, out int userId)) return Unauthorized();

            var conn = _context.Database.GetDbConnection();
            await conn.OpenAsync();
            using var cmd = conn.CreateCommand();
            cmd.CommandText = @"SELECT ""Vote"" FROM ""LevelRatings"" WHERE ""LevelId"" = @lid AND ""UserId"" = @uid";
            cmd.Parameters.Add(new NpgsqlParameter("@lid", id));
            cmd.Parameters.Add(new NpgsqlParameter("@uid", userId));
            var val = await cmd.ExecuteScalarAsync();
            await conn.CloseAsync();
            return Ok(new { vote = val == null ? 0 : Convert.ToInt32(val) });
        }
    }

    public class VoteDto { public int Vote { get; set; } }
}
