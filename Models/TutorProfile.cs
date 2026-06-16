namespace inMVC.Models;

public class TutorProfile
{
    public int Id { get; set; }

    // Links this profile to the User table
    public int UserId { get; set; }
    public User? User { get; set; }

    public string TutorName { get; set; } = "";
    public string Rate { get; set; } = "";
    public string Education { get; set; } = "";
    public string ContactNumber { get; set; } = "";
    public string Bio { get; set; } = "";
    public string Subjects { get; set; } = "";  // e.g. "Math,English,Reading"
    public string ProfilePhoto { get; set; } = "";  // stores the file path
    public string IdentityVerificationStatus { get; set; } = "Pending";
    public string IdentityLegalName { get; set; } = "";
    public string IdentityBirthdate { get; set; } = "";
    public string IdentityDocumentType { get; set; } = "";
    public string IdentityDocumentNumber { get; set; } = "";
    public string IdentityDocumentFile { get; set; } = "";
    public string IdentitySelfieFile { get; set; } = "";
    public string IdentityVerificationNote { get; set; } = "";
    public DateTime? IdentityVerifiedAt { get; set; }
}
