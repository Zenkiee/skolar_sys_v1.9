namespace inMVC.Models;

public class Review
{
    public int Id { get; set; }
    public int? BookingId { get; set; }
    public int LearnerId { get; set; }
    public int TutorId { get; set; }
    public string LearnerName { get; set; } = "";
    public string TutorName { get; set; } = "";
    public int Rating { get; set; }
    public string Comment { get; set; } = "";
    public string Status { get; set; } = "Published";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
