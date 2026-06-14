namespace inMVC.Models;

public class LearnerProfile
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string GradeLevel { get; set; } = string.Empty;
    public string Subjects { get; set; } = string.Empty;
    public string School { get; set; } = string.Empty;
    public string Birthday { get; set; } = string.Empty;
    public string ContactNumber { get; set; } = string.Empty;
    public string AccountManager { get; set; } = "Learner";
    public string GuardianName { get; set; } = string.Empty;
    public string GuardianRelationship { get; set; } = string.Empty;
    public string GuardianContactNumber { get; set; } = string.Empty;
    public string GuardianEmail { get; set; } = string.Empty;
    public string LearningGoals { get; set; } = string.Empty;
    public string PreferredSchedule { get; set; } = string.Empty;
    public string ProfilePhoto { get; set; } = string.Empty;
    public User? User { get; set; }
}
