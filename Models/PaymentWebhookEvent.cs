namespace inMVC.Models;

public class PaymentWebhookEvent
{
    public int Id { get; set; }
    public string Provider { get; set; } = "PaymentProvider";
    public string ExternalEventId { get; set; } = "";
    public string EventType { get; set; } = "";
    public string Payload { get; set; } = "";
    public DateTime ProcessedAt { get; set; } = DateTime.UtcNow;
}
