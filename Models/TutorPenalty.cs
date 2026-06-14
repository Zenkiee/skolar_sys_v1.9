namespace inMVC.Models;

public class TutorPenalty
{
    public int Id { get; set; }
    public int TutorId { get; set; }
    public int SourceBookingId { get; set; }
    public string Type { get; set; } = "NextCompletedSessionFine";
    public decimal Percentage { get; set; }
    public decimal AppliedAmount { get; set; }
    public int? AppliedBookingId { get; set; }
    public string Status { get; set; } = "Pending";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? AppliedAt { get; set; }
}
