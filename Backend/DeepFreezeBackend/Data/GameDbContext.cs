using Microsoft.EntityFrameworkCore;
using DeepFreezeBackend.Models;

namespace DeepFreezeBackend.Data;

public class GameDbContext : DbContext
{
    public GameDbContext(DbContextOptions<GameDbContext> options) : base(options) { }

    public DbSet<User> Users { get; set; } = null!;
    public DbSet<Score> Scores { get; set; } = null!;
    public DbSet<Level> Levels { get; set; } = null!;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.Username).IsUnique();
        });

        modelBuilder.Entity<Score>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasOne(e => e.User)
                  .WithMany(u => u.Scores)
                  .HasForeignKey(e => e.UserId);
        });

        modelBuilder.Entity<Level>(entity =>
        {
            entity.HasKey(e => e.Id);
        });
    }
}
