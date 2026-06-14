namespace inMVC.Models;

public class TutorNotificationSettings
{
    public int Id { get; set; }
    public int TutorId { get; set; }
    public bool EmailNotificationsEnabled { get; set; } = true;
    public bool PushNotificationsEnabled { get; set; }
    public bool NewReviewAlertsEnabled { get; set; } = true;
    public DateTime? LastNotificationReadAt { get; set; }
}
