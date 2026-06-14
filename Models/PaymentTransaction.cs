namespace inMVC.Models;

public class PaymentTransaction
{
    public int Id { get; set; }
    public int LearnerId { get; set; }
    public string BookingGroupId { get; set; } = "";
    public string Provider { get; set; } = "PaymentProvider";
    public string ExternalPaymentId { get; set; } = "";
    public string CheckoutReference { get; set; } = "";
    public string PaymentMethod { get; set; } = "";
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "PHP";
    public string Status { get; set; } = "Pending";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? PaidAt { get; set; }
}
