namespace DeepFreezeBackend.Models;

public class User
{
    public int Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public bool IsAdmin { get; set; } = false;

    public ICollection<Score> Scores { get; set; } = new List<Score>();
}
