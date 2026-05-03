using Microsoft.EntityFrameworkCore;
using DeepFreezeBackend.Data;
using DeepFreezeBackend.Hubs;
using DeepFreezeBackend.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

// Render assigns a dynamic PORT — this reads it automatically
builder.WebHost.UseIISIntegration();

// Add Database via PostgreSQL (Neon)
builder.Services.AddDbContext<GameDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// Add JWT Auth
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["JwtSettings:Issuer"],
            ValidAudience = builder.Configuration["JwtSettings:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(builder.Configuration["JwtSettings:Secret"]!))
        };
    });
builder.Services.AddAuthorization();

// Add services to the container.
builder.Services.AddControllers();
builder.Services.AddSignalR();
builder.Services.AddGrpc();
builder.Services.AddOpenApi();

// CORS for Frontend (Required for SignalR with Credentials)
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll",
        policy => policy
            .WithOrigins(
                "http://localhost:5173",
                "http://localhost:5174",
                "http://localhost:5175",
                "https://deep-freezer-game.vercel.app"  // ← Vercel frontend URL (update to your real URL)
            )
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials()
    );
});

var app = builder.Build();

app.UseCors("AllowAll");
app.UseGrpcWeb(); // Must be after CORS and Routing, before Authentication
app.MapOpenApi();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapHub<GameHub>("/gamehub");
app.MapGrpcService<TelemetryService>().EnableGrpcWeb();

// Health check — prevents Render/browser 404 on GET /
app.MapGet("/", () => Results.Ok(new { status = "Deep Freezer API is running 🧠❄️", version = "1.0" }));

// Fully manual SQL schema - gives 100% control over nullable columns
using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<GameDbContext>();
    var conn = dbContext.Database.GetDbConnection();
    conn.Open();
    using var cmd = conn.CreateCommand();
    cmd.CommandText = @"
        CREATE TABLE IF NOT EXISTS ""Users"" (
            ""Id"" SERIAL PRIMARY KEY,
            ""Username"" TEXT NOT NULL UNIQUE,
            ""PasswordHash"" TEXT NOT NULL,
            ""CreatedAt"" TIMESTAMP NOT NULL,
            ""IsAdmin"" BOOLEAN NOT NULL DEFAULT false
        );
        CREATE TABLE IF NOT EXISTS ""Scores"" (
            ""Id"" SERIAL PRIMARY KEY,
            ""UserId"" INTEGER NOT NULL,
            ""Value"" BIGINT NOT NULL,
            ""AchievedAt"" TIMESTAMP NOT NULL,
            FOREIGN KEY(""UserId"") REFERENCES ""Users""(""Id"") ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS ""Levels"" (
            ""Id"" SERIAL PRIMARY KEY,
            ""UserId"" INTEGER NULL,
            ""AuthorName"" TEXT NOT NULL DEFAULT 'Guest',
            ""Name"" TEXT NOT NULL,
            ""GridData"" TEXT NOT NULL,
            ""Thumbnail"" TEXT NULL,
            ""PlayCount"" INTEGER NOT NULL DEFAULT 0,
            ""CreatedAt"" TIMESTAMP NOT NULL
        );
        CREATE TABLE IF NOT EXISTS ""LevelRatings"" (
            ""Id"" SERIAL PRIMARY KEY,
            ""LevelId"" INTEGER NOT NULL,
            ""UserId"" INTEGER NOT NULL,
            ""Vote"" INTEGER NOT NULL,
            UNIQUE(""LevelId"", ""UserId""),
            FOREIGN KEY(""LevelId"") REFERENCES ""Levels""(""Id"") ON DELETE CASCADE,
            FOREIGN KEY(""UserId"") REFERENCES ""Users""(""Id"") ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS ""Achievements"" (
            ""Id"" SERIAL PRIMARY KEY,
            ""UserId"" INTEGER NOT NULL,
            ""AchievementKey"" TEXT NOT NULL,
            ""AchievedAt"" TIMESTAMP NOT NULL,
            UNIQUE(""UserId"", ""AchievementKey""),
            FOREIGN KEY(""UserId"") REFERENCES ""Users""(""Id"") ON DELETE CASCADE
        );
    ";
    cmd.ExecuteNonQuery();
    conn.Close();
}

app.Run();
