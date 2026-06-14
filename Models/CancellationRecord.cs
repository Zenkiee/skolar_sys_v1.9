namespace inMVC.Models;

public class CancellationRecord
{
    public int Id { get; set; }
    public int BookingId { get; set; }
    public int LearnerId { get; set; }
    public int TutorId { get; set; }
    public string RequestedByRole { get; set; } = "";
    public decimal HoursBeforeSession { get; set; }
    public decimal RefundPercentage { get; set; }
    public decimal RefundAmount { get; set; }
    public decimal RetainedAmount { get; set; }
    public decimal TutorCompensationAmount { get; set; }
    public decimal LearnerVoucherPercentage { get; set; }
    public decimal LearnerVoucherAmount { get; set; }
    public decimal TutorFinePercentage { get; set; }
    public bool WarningIssued { get; set; }
    public string RuleCode { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
