namespace inMVC.Models;

public class ReviewReport
{
    public int Id { get; set; }
    public int ReviewId { get; set; }
    public int TutorId { get; set; }
    public string Reason { get; set; } = "";
    public string Details { get; set; } = "";
    public string Status { get; set; } = "Pending";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
