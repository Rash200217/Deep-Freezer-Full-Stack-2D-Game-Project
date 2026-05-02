namespace DeepFreezeBackend.Models;

public class Score
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    public long Value { get; set; }
    public DateTime AchievedAt { get; set; } = DateTime.UtcNow;
}
