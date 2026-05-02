using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace DeepFreezeBackend.Models
{
    public class Level
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int UserId { get; set; }

        [ForeignKey("UserId")]
        [JsonIgnore]
        public User? User { get; set; }

        public string AuthorName { get; set; } = string.Empty;

        [Required]
        [MaxLength(100)]
        public string Name { get; set; } = string.Empty;

        [Required]
        public string GridData { get; set; } = string.Empty; // JSON structure

        public int PlayCount { get; set; } = 0;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

    public class LevelPublishDto
    {
        public string Name { get; set; } = string.Empty;
        public string GridData { get; set; } = string.Empty;
        public string? AuthorName { get; set; }
        public string? Thumbnail { get; set; } // base64 PNG data URL
    }
}
