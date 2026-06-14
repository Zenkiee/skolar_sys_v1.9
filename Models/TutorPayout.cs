namespace inMVC.Models;

public class TutorPayout
{
    public int Id { get; set; }
    public int TutorId { get; set; }
    public int BookingId { get; set; }
    public decimal GrossAmount { get; set; }
    public decimal PlatformFeeAmount { get; set; }
    public decimal CompensationAmount { get; set; }
    public decimal FineAmount { get; set; }
    public decimal NetAmount { get; set; }
    public string Status { get; set; } = "Pending";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ReleasedAt { get; set; }
}
