namespace inMVC.Models;

public class TutorWithdrawal
{
    public int Id { get; set; }
    public int TutorId { get; set; }
    public decimal Amount { get; set; }
    public string Method { get; set; } = "";
    public string GCashAccountName { get; set; } = "";
    public string GCashAccountNumber { get; set; } = "";
    public string Status { get; set; } = "Requested";
    public DateTime RequestedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ProcessedAt { get; set; }
    public string AdminNote { get; set; } = "";
}
