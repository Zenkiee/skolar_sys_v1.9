namespace inMVC.Models;

public class TutorAvailability
{
    public int Id { get; set; }
    public int TutorId { get; set; }
    public TutorProfile? Tutor { get; set; }
    public string Date { get; set; } = "";
    public string Time { get; set; } = "";
}
