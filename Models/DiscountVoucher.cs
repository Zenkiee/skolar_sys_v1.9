namespace inMVC.Models;

public class DiscountVoucher
{
    public int Id { get; set; }
    public int LearnerId { get; set; }
    public int SourceBookingId { get; set; }
    public string Code { get; set; } = "";
    public decimal Percentage { get; set; }
    public decimal MaximumAmount { get; set; }
    public string Status { get; set; } = "Available";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime ExpiresAt { get; set; } = DateTime.UtcNow.AddMonths(6);
}
