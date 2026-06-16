namespace inMVC.Models;

public class Booking
{
    public int Id { get; set; }
    public int LearnerId { get; set; }
    public string Subject { get; set; } = "";
    public string TutorName { get; set; } = "";
    public DateTime Date { get; set; }
    public string Time { get; set; } = "";
    public string Status { get; set; } = "Pending";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? TutorMarkedDoneAt { get; set; }
    public DateTime? LearnerConfirmedDoneAt { get; set; }
    public DateTime? CompletionIssueReportedAt { get; set; }
    public string CompletionIssueReason { get; set; } = "";
    public string CompletionIssueStatus { get; set; } = "";
    public string TutorIssueResponse { get; set; } = "";
    public DateTime? TutorIssueRespondedAt { get; set; }
    public string AdminIssueResolution { get; set; } = "";
    public string AdminIssueResolutionNote { get; set; } = "";
    public DateTime? AdminIssueResolvedAt { get; set; }
    public int? AdminIssueResolvedBy { get; set; }
    public string BookingGroupId { get; set; } = "";
    public string BookingType { get; set; } = "Single";
    public int TutorId { get; set; }
    public string LearnerName { get; set; } = "";
    public string LearnerEmail { get; set; } = "";
    public string LearnerContact { get; set; } = "";
    public string PaymentMethod { get; set; } = "";
    public string ReferenceNumber { get; set; } = "";
    public string ProofOfPayment { get; set; } = "";
    public decimal HourlyRate { get; set; }
    public decimal DurationHours { get; set; }
    public decimal SessionAmount { get; set; }
    public string PaymentStatus { get; set; } = "Unpaid";
    public int? PaymentTransactionId { get; set; }
    public DateTime? CancelledAt { get; set; }
    public string CancelledByRole { get; set; } = "";
}
