namespace inMVC.Models;

public class RefundTransaction
{
    public int Id { get; set; }
    public int PaymentTransactionId { get; set; }
    public int BookingId { get; set; }
    public string ExternalRefundId { get; set; } = "";
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "PHP";
    public string Status { get; set; } = "Processing";
    public string Reason { get; set; } = "";
    public string RequestedByRole { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? CompletedAt { get; set; }
}
