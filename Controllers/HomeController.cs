using System.ComponentModel.DataAnnotations;
using System.Diagnostics;
using System.Globalization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using inMVC.Models;
using inMVC.Data;
using inMVC.Helpers;
using inMVC.Services;

namespace inMVC.Controllers;

public class HomeController : Controller
{
    
    private readonly AppDbContext _context;
    private readonly IConfiguration _configuration;
    private readonly ILogger<HomeController> _logger;

    private const string PasswordResetUserIdKey = "passwordResetUserId";
    private const string PasswordResetRoleKey = "passwordResetRole";

    private const string PasswordResetOtpKey = "passwordResetOtp";
    private const string PasswordResetOtpExpiryKey = "passwordResetOtpExpiry";

    

    private static readonly string[] AllowedYearLevels =
    {
        "Preschool",
        "Kindergarten",
        "Grade 1",
        "Grade 2",
        "Grade 3",
        "Grade 4",
        "Grade 5",
        "Grade 6"
    };

    private static readonly string[] AllowedSubjects =
    {
        "English",
        "Math",
        "Reading",
        "Writing",
        "Filipino",
        "Early Learning Skills",
        "Science",
        "Social Studies",
        "Literacy, Language & Communication",
        "Socio-Emotional Development",
        "Values Development",
        "Physical Health and Motor Development",
        "Aesthetic/Creative Development",
        "Cognitive Development",
        "Language",
        "Reading and Literacy",
        "Mathematics",
        "Makabansa",
        "GMRC",
        "AP",
        "MAPEH",
        "EPP",
        "TLE",
        "ESP"
    };

    private readonly EmailService _emailService;

    public HomeController(
        AppDbContext context,
        IConfiguration configuration,
        EmailService emailService,
        ILogger<HomeController> logger)
    {
        _context = context;
        _configuration = configuration;
        _emailService = emailService;
        _logger = logger;
    }

    public IActionResult Index() => View();

    public IActionResult Account() => View();

    public IActionResult ForgotPassword()
    {
        ClearPasswordResetSession();
        return View();
    }

    public IActionResult TermsLearner() => View();

    public IActionResult TermsTutor() => View();

    [HttpGet]
    public IActionResult Signup() => View();

    [HttpGet]
    public IActionResult AdminSetup()
    {
        return Redirect("/Home/Account?role=admin");
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> VerifyResetAccount(
        [FromBody] VerifyResetAccountRequest request)
    {
        ClearPasswordResetSession();

        var email = request.Email?.Trim().ToLowerInvariant() ?? "";
        var role  = request.Role?.Trim().ToLowerInvariant() ?? "";

        if (role is not ("learner" or "tutor"))
            return BadRequest(new { error = "Select a valid account role." });

        if (email.Length > 254 || !new EmailAddressAttribute().IsValid(email))
            return BadRequest(new { error = "Enter a valid email address." });

        var matchingUsers = await _context.Users
            .Where(u => u.Email.ToLower() == email && u.Role.ToLower() == role)
            .Take(2)
            .ToListAsync();

        if (matchingUsers.Count == 0)
            return NotFound(new { error = $"No {role} account was found with this email." });

        if (matchingUsers.Count > 1)
            return Conflict(new { error = "Multiple accounts use this email and role." });

        var user = matchingUsers[0];

        if (string.Equals(user.Role, "admin", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { error = "The administrator password cannot be reset here." });

        // Generate 6-digit OTP
        var otp = Random.Shared.Next(100000, 999999).ToString();
        var expiry = DateTimeOffset.UtcNow.AddMinutes(10).ToUnixTimeSeconds();

        HttpContext.Session.SetInt32(PasswordResetUserIdKey, user.Id);
        HttpContext.Session.SetString(PasswordResetRoleKey, role);
        HttpContext.Session.SetString(PasswordResetOtpKey, otp);
        HttpContext.Session.SetString(PasswordResetOtpExpiryKey, expiry.ToString());

        try
        {
            await _emailService.SendOtpEmailAsync(user.Email, otp);
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ex,
                "Failed to send password reset OTP for user {UserId}.",
                user.Id);

            ClearPasswordResetSession();

            return StatusCode(500, new
            {
                error = "We couldn't send the verification code right now. Please try again later."
            });
        }

        return Ok(new { success = true, message = "A verification code was sent to your email." });
    }
    

    [HttpPost]
    [ValidateAntiForgeryToken]
    public IActionResult VerifyOtp([FromBody] VerifyOtpRequest request)
    {
        var userId  = HttpContext.Session.GetInt32(PasswordResetUserIdKey);
        var storedOtp = HttpContext.Session.GetString(PasswordResetOtpKey);
        var expiryStr = HttpContext.Session.GetString(PasswordResetOtpExpiryKey);

        if (userId == null || storedOtp == null || expiryStr == null)
            return Unauthorized(new { error = "Session expired. Start over." });

        if (!long.TryParse(expiryStr, out var expiry) ||
            DateTimeOffset.UtcNow.ToUnixTimeSeconds() > expiry)
        {
            ClearPasswordResetSession();
            return BadRequest(new { error = "The verification code has expired. Start over." });
        }

        if (request.Otp?.Trim() != storedOtp)
            return BadRequest(new { error = "Incorrect verification code. Try again." });

        // OTP verified — clear it so it can't be reused
        HttpContext.Session.Remove(PasswordResetOtpKey);
        HttpContext.Session.Remove(PasswordResetOtpExpiryKey);

        return Ok(new { success = true });
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> ResetPassword(
        [FromBody] ResetPasswordRequest request)
    {
        var userId = HttpContext.Session.GetInt32(
            PasswordResetUserIdKey);

        var pendingRole = HttpContext.Session.GetString(
            PasswordResetRoleKey);

        if (userId == null ||
            string.IsNullOrWhiteSpace(pendingRole))
        {
            ClearPasswordResetSession();

            return Unauthorized(new
            {
                error =
                    "Your password-reset session has expired. " +
                    "Enter your email again."
            });
        }

        var newPassword = request.NewPassword ?? "";
        var confirmPassword = request.ConfirmPassword ?? "";

        if (newPassword != confirmPassword)
        {
            return BadRequest(new
            {
                error = "Passwords do not match."
            });
        }

        if (newPassword.Length is < 8 or > 64 ||
            !newPassword.Any(char.IsLetter) ||
            !newPassword.Any(char.IsDigit))
        {
            return BadRequest(new
            {
                error =
                    "Password must be 8–64 characters and " +
                    "include a letter and number."
            });
        }

        var user = await _context.Users
            .FirstOrDefaultAsync(item =>
                item.Id == userId.Value &&
                item.Role.ToLower() == pendingRole &&
                item.Role.ToLower() != "admin");

        if (user == null)
        {
            ClearPasswordResetSession();

            return NotFound(new
            {
                error = "The account could not be found."
            });
        }

        user.PasswordHash =
            BCrypt.Net.BCrypt.HashPassword(newPassword);

        await _context.SaveChangesAsync();

        ClearPasswordResetSession();

        return Ok(new
        {
            success = true,
            message = "Password reset successfully."
        });
    }

    [HttpPost]
    public async Task<IActionResult> SaveTutorProfile(
        [FromBody] SaveTutorRequest request)
    {
        var userId = HttpContext.Session.GetUserId();

        if (userId == null ||
            !HttpContext.Session.HasRole("tutor"))
        {
            return Unauthorized();
        }

        if (request == null)
        {
            return BadRequest(new
            {
                message = "Profile details are required."
            });
        }

        var user = await _context.Users.FindAsync(userId.Value);

        if (user == null)
        {
            return Unauthorized();
        }

        var tutorName = request.TutorName?.Trim() ?? "";
        var email = user.Email?.Trim().ToLowerInvariant() ?? "";
        var education = request.Education?.Trim() ?? "";
        var contactNumber = NormalizeContactNumber(request.ContactNumber);
        var bio = request.Bio?.Trim() ?? "";
        var subjects = NormalizeSubjects(
            (request.Subjects ?? "")
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries));
        var hourlyRate = PaymentPolicyCalculator.ParseHourlyRate(request.Rate ?? "");

        if (tutorName.Length is < 2 or > 60 ||
            !tutorName.Any(char.IsLetter))
        {
            return BadRequest(new
            {
                field = "epFirstName",
                message = "Tutor name must be 2 to 60 characters and contain a letter."
            });
        }

        if (email.Length > 254 ||
            !new EmailAddressAttribute().IsValid(email))
        {
            return BadRequest(new
            {
                field = "epGmail",
                message = "Enter a valid email address."
            });
        }

        if (hourlyRate is < 1m or > 10000m)
        {
            return BadRequest(new
            {
                field = "epSessionRate",
                message = "Enter a rate from PHP 1 to PHP 10,000 per hour."
            });
        }

        if (education.Length is < 3 or > 120)
        {
            return BadRequest(new
            {
                field = "epDisplayTitle",
                message = "Display title must be 3 to 120 characters."
            });
        }

        if (contactNumber == null)
        {
            return BadRequest(new
            {
                field = "epPhone",
                message = "Use 09XXXXXXXXX or +639XXXXXXXXX."
            });
        }

        if (bio.Length is < 20 or > 500)
        {
            return BadRequest(new
            {
                field = "epBio",
                message = "Bio must be 20 to 500 characters."
            });
        }

        if (subjects == null ||
            subjects.Count is < 1 or > 5)
        {
            return BadRequest(new
            {
                field = "epSubjectInput",
                message = "Choose 1 to 5 valid subjects."
            });
        }

        var rateText = hourlyRate.ToString(
            "0.##",
            CultureInfo.InvariantCulture);

        var existing = await _context.TutorProfiles
            .FirstOrDefaultAsync(profile =>
                profile.UserId == user.Id);

        if (existing != null)
        {
            existing.TutorName = tutorName;
            existing.Rate = $"\u20B1{rateText}/hr";
            existing.Education = education;
            existing.ContactNumber = contactNumber;
            existing.Bio = bio;
            existing.Subjects = string.Join(",", subjects);
        }
        else
        {
            var profile = new TutorProfile
            {
                UserId = user.Id,
                TutorName = tutorName,
                Rate = $"\u20B1{rateText}/hr",
                Education = education,
                ContactNumber = contactNumber,
                Bio = bio,
                Subjects = string.Join(",", subjects)
            };

            _context.TutorProfiles.Add(profile);
        }

        user.Name = tutorName;

        await _context.SaveChangesAsync();

        return Ok(new
        {
            success = true,
            email
        });
    }

    [ResponseCache(
        Duration = 0,
        Location = ResponseCacheLocation.None,
        NoStore = true)]
    public IActionResult Error()
    {
        return View(new ErrorViewModel
        {
            RequestId =
                Activity.Current?.Id ??
                HttpContext.TraceIdentifier
        });
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Signup(
        [FromBody] SignupRequest request)
    {
        var name = request.Name?.Trim() ?? "";

        var email = request.Email?
            .Trim()
            .ToLowerInvariant() ?? "";

        var password = request.Password ?? "";

        var role = request.Role?
            .Trim()
            .ToLowerInvariant() ?? "";

        if (!request.AcceptedTerms)
        {
            return SignupError(
                "agreeTerms",
                "You must accept the Terms and Conditions.");
        }

        if (role is not ("learner" or "tutor"))
        {
            return SignupError(
                "",
                "Select a valid account role.");
        }

        if (name.Length is < 2 or > 60 ||
            !name.Any(char.IsLetter))
        {
            return SignupError(
                role == "tutor"
                    ? "tutorName"
                    : "learnerName",
                "Name must be 2 to 60 characters " +
                "and contain a letter.");
        }

        if (email.Length > 254 ||
            !new EmailAddressAttribute().IsValid(email))
        {
            return SignupError(
                "signupEmail",
                "Enter a valid email address.");
        }

        if (password.Length is < 8 or > 64 ||
            !password.Any(char.IsLetter) ||
            !password.Any(char.IsDigit))
        {
            return SignupError(
                "signupPassword",
                "Password must be 8–64 characters " +
                "and include a letter and number.");
        }

        TutorProfile? tutorProfile = null;
        LearnerProfile? learnerProfile = null;

        if (role == "tutor")
        {
            if (request.TutorProfile == null)
            {
                return SignupError(
                    "",
                    "Tutor profile information is required.");
            }

            var education =
                request.TutorProfile.Education?.Trim() ?? "";

            var contactNumber = NormalizeContactNumber(
                request.TutorProfile.ContactNumber);

            var bio =
                request.TutorProfile.Bio?.Trim() ?? "";

            var subjects = NormalizeSubjects(
                request.TutorProfile.Subjects);

            if (request.TutorProfile.Rate is < 1 or > 10000)
            {
                return SignupError(
                    "rate",
                    "Enter a rate from ₱1 to ₱10,000 per hour.");
            }

            if (education.Length is < 3 or > 120)
            {
                return SignupError(
                    "education",
                    "Education must be 3 to 120 characters.");
            }

            if (contactNumber == null)
            {
                return SignupError(
                    "contactNumber",
                    "Use 09XXXXXXXXX or +639XXXXXXXXX.");
            }

            if (bio.Length is < 20 or > 500)
            {
                return SignupError(
                    "bio",
                    "Bio must be 20 to 500 characters.");
            }

            if (subjects == null ||
                subjects.Count is < 1 or > 5)
            {
                return SignupError(
                    "subjectDropdownTrigger",
                    "Choose 1 to 5 valid subjects.");
            }

            var rateText =
                request.TutorProfile.Rate.ToString(
                    "0.##",
                    CultureInfo.InvariantCulture);

            tutorProfile = new TutorProfile
            {
                TutorName = name,
                Rate = $"₱{rateText}/hr",
                Education = education,
                ContactNumber = contactNumber,
                Bio = bio,
                Subjects = string.Join(",", subjects)
            };
        }
        else
        {
            if (request.LearnerProfile == null)
            {
                return SignupError(
                    "",
                    "Learner profile information is required.");
            }

            var gradeLevel =
                request.LearnerProfile.GradeLevel?.Trim() ?? "";

            var school =
                request.LearnerProfile.School?.Trim() ?? "";

            var birthdayText =
                request.LearnerProfile.Birthday?.Trim() ?? "";

            if (!AllowedYearLevels.Contains(
                    gradeLevel,
                    StringComparer.Ordinal))
            {
                return SignupError(
                    "yearLevel",
                    "Select a valid year level.");
            }

            if (school.Length > 100)
            {
                return SignupError(
                    "school",
                    "School must be 100 characters or fewer.");
            }

            if (!DateTime.TryParseExact(
                    birthdayText,
                    "yyyy-MM-dd",
                    CultureInfo.InvariantCulture,
                    DateTimeStyles.None,
                    out var birthday))
            {
                return SignupError(
                    "birthday",
                    "Enter a valid birthdate.");
            }

            if (birthday.Date > DateTime.Today)
            {
                return SignupError(
                    "birthday",
                    "Birthdate cannot be in the future.");
            }

            learnerProfile = new LearnerProfile
            {
                GradeLevel = gradeLevel,
                School = school,
                Birthday = birthdayText,
                Subjects = ""
            };
        }

        await using var transaction =
            await _context.Database.BeginTransactionAsync();

        var emailExists = await _context.Users
            .AnyAsync(user =>
                user.Email.ToLower() == email);

        if (emailExists)
        {
            return SignupError(
                "signupEmail",
                "Email is already registered.");
        }

        var user = new User
        {
            Name = name,
            Email = email,
            PasswordHash =
                BCrypt.Net.BCrypt.HashPassword(password),
            Role = role
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        if (tutorProfile != null)
        {
            tutorProfile.UserId = user.Id;
            _context.TutorProfiles.Add(tutorProfile);
        }

        if (learnerProfile != null)
        {
            learnerProfile.UserId = user.Id;
            _context.LearnerProfiles.Add(learnerProfile);
        }

        await _context.SaveChangesAsync();
        await transaction.CommitAsync();

        HttpContext.Session.SetString(
            "userId",
            user.Id.ToString());

        HttpContext.Session.SetString(
            "userName",
            user.Name);

        HttpContext.Session.SetString(
            "userEmail",
            user.Email);

        HttpContext.Session.SetString(
            "userRole",
            user.Role);

        return Ok(new
        {
            success = true,
            role = user.Role
        });
    }

    [HttpPost]
    public async Task<IActionResult> Login(
        [FromBody] LoginRequest request)
    {
        var email = request.Email?
            .Trim()
            .ToLowerInvariant() ?? "";

        var role = request.Role?
            .Trim()
            .ToLowerInvariant() ?? "";

        if (role == "admin")
        {
            var adminEmail =
                (_configuration["AdminCredentials:Email"] ??
                 "skolartutors.ph@gmail.com")
                .Trim()
                .ToLowerInvariant();

            if (!string.Equals(
                    email,
                    adminEmail,
                    StringComparison.Ordinal))
            {
                return Unauthorized(new
                {
                    error =
                        "Invalid administrator email or password."
                });
            }
        }

        var user = await _context.Users
            .FirstOrDefaultAsync(item =>
                item.Email.ToLower() == email &&
                item.Role.ToLower() == role);

        if (user == null ||
            string.IsNullOrEmpty(user.PasswordHash))
        {
            return Unauthorized(new
            {
                error = "Invalid email or password."
            });
        }

        if (!BCrypt.Net.BCrypt.Verify(
                request.Password,
                user.PasswordHash))
        {
            return Unauthorized(new
            {
                error = "Invalid email or password."
            });
        }

        HttpContext.Session.SetString(
            "userId",
            user.Id.ToString());

        HttpContext.Session.SetString(
            "userName",
            user.Name);

        HttpContext.Session.SetString(
            "userEmail",
            user.Email);

        HttpContext.Session.SetString(
            "userRole",
            user.Role);

        return Ok(new
        {
            success = true,
            role = user.Role
        });
    }

    [HttpPost]
    public IActionResult Logout()
    {
        HttpContext.Session.Clear();

        return Ok(new
        {
            success = true
        });
    }

    [HttpGet]
    public async Task<IActionResult> Me()
    {
        var userId =
            HttpContext.Session.GetString("userId");

        if (userId == null ||
            !int.TryParse(userId, out var parsedUserId))
        {
            return Unauthorized();
        }

        var user =
            await _context.Users.FindAsync(parsedUserId);

        if (user == null)
        {
            return Unauthorized();
        }

        var profilePhoto = "";

        if (user.Role.Equals(
                "learner",
                StringComparison.OrdinalIgnoreCase))
        {
            profilePhoto = await _context.LearnerProfiles
                .Where(profile =>
                    profile.UserId == user.Id)
                .Select(profile =>
                    profile.ProfilePhoto)
                .FirstOrDefaultAsync() ?? "";
        }
        else if (user.Role.Equals(
                     "tutor",
                     StringComparison.OrdinalIgnoreCase))
        {
            profilePhoto = await _context.TutorProfiles
                .Where(profile =>
                    profile.UserId == user.Id)
                .Select(profile =>
                    profile.ProfilePhoto)
                .FirstOrDefaultAsync() ?? "";
        }

        return Json(new
        {
            user.Id,
            user.Name,
            user.Email,
            user.Role,
            profilePhoto
        });
    }

    [HttpPost]
    public async Task<IActionResult> UploadTutorPhoto(
        IFormFile photo)
    {
        var userId = HttpContext.Session.GetUserId();

        if (userId == null ||
            !HttpContext.Session.HasRole("tutor"))
        {
            return Unauthorized();
        }

        if (photo == null || photo.Length == 0)
        {
            return BadRequest(new
            {
                error = "No file."
            });
        }

        var uploadsDirectory = Path.Combine(
            Directory.GetCurrentDirectory(),
            "wwwroot",
            "uploads",
            "tutor-photos");

        Directory.CreateDirectory(uploadsDirectory);

        var extension =
            Path.GetExtension(photo.FileName);

        var fileName =
            $"tutor_{userId.Value}{extension}";

        var filePath = Path.Combine(
            uploadsDirectory,
            fileName);

        await using (var stream =
                     new FileStream(
                         filePath,
                         FileMode.Create))
        {
            await photo.CopyToAsync(stream);
        }

        var photoUrl =
            $"/uploads/tutor-photos/{fileName}";

        var profile = await _context.TutorProfiles
            .FirstOrDefaultAsync(item =>
                item.UserId == userId.Value);

        if (profile != null)
        {
            profile.ProfilePhoto = photoUrl;
            await _context.SaveChangesAsync();
        }

        return Ok(new
        {
            success = true,
            photoUrl
        });
    }

    [HttpPost]
    public async Task<IActionResult> RemoveTutorPhoto()
    {
        var userId = HttpContext.Session.GetUserId();

        if (userId == null ||
            !HttpContext.Session.HasRole("tutor"))
        {
            return Unauthorized();
        }

        var profile = await _context.TutorProfiles
            .FirstOrDefaultAsync(item =>
                item.UserId == userId.Value);

        if (profile == null)
        {
            return NotFound(new
            {
                message = "Tutor profile not found."
            });
        }

        if (!string.IsNullOrWhiteSpace(
                profile.ProfilePhoto))
        {
            var uploadsDirectory = Path.Combine(
                Directory.GetCurrentDirectory(),
                "wwwroot",
                "uploads",
                "tutor-photos");

            var fileName =
                Path.GetFileName(profile.ProfilePhoto);

            var filePath = Path.Combine(
                uploadsDirectory,
                fileName);

            if (System.IO.File.Exists(filePath))
            {
                System.IO.File.Delete(filePath);
            }
        }

        profile.ProfilePhoto = "";

        await _context.SaveChangesAsync();

        return Ok(new
        {
            success = true,
            message = "Profile photo removed."
        });
    }

    private IActionResult SignupError(
        string field,
        string message)
    {
        return BadRequest(new
        {
            field,
            error = message
        });
    }

    private void ClearPasswordResetSession()
    {
        HttpContext.Session.Remove(PasswordResetUserIdKey);
        HttpContext.Session.Remove(PasswordResetRoleKey);
        HttpContext.Session.Remove(PasswordResetOtpKey);
        HttpContext.Session.Remove(PasswordResetOtpExpiryKey);
    }

    private static string? NormalizeContactNumber(
        string? value)
    {
        var contact = (value ?? "")
            .Replace(" ", "")
            .Replace("-", "")
            .Trim();

        if (contact.Length == 11 &&
            contact.StartsWith("09") &&
            contact.All(char.IsDigit))
        {
            return $"+63{contact[1..]}";
        }

        if (contact.Length == 13 &&
            contact.StartsWith("+639") &&
            contact[1..].All(char.IsDigit))
        {
            return contact;
        }

        return null;
    }

    private static List<string>? NormalizeSubjects(
        IEnumerable<string>? values)
    {
        if (values == null)
        {
            return null;
        }

        var requested = values
            .Select(value => value?.Trim() ?? "")
            .Where(value => value.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (requested.Any(value =>
                !AllowedSubjects.Contains(
                    value,
                    StringComparer.OrdinalIgnoreCase)))
        {
            return null;
        }

        return requested
            .Select(value =>
                AllowedSubjects.First(subject =>
                    subject.Equals(
                        value,
                        StringComparison.OrdinalIgnoreCase)))
            .ToList();
    }
}

public record VerifyOtpRequest(string? Otp);

public class VerifyResetAccountRequest
{
    public string Email { get; set; } = "";
    public string Role { get; set; } = "";
}

public class ResetPasswordRequest
{
    public string NewPassword { get; set; } = "";
    public string ConfirmPassword { get; set; } = "";
}

public class SaveTutorRequest
{
    public string Email { get; set; } = "";
    public string TutorName { get; set; } = "";
    public string Rate { get; set; } = "";
    public string Education { get; set; } = "";
    public string ContactNumber { get; set; } = "";
    public string Bio { get; set; } = "";
    public string Subjects { get; set; } = "";
}

public class LoginRequest
{
    public string Email { get; set; } = "";
    public string Password { get; set; } = "";
    public string Role { get; set; } = "";
}

public class TutorProfileData
{
    public decimal Rate { get; set; }
    public string Education { get; set; } = "";
    public string ContactNumber { get; set; } = "";
    public string Bio { get; set; } = "";
    public List<string> Subjects { get; set; } = new();
}

public class LearnerProfileData
{
    public string GradeLevel { get; set; } = "";
    public string School { get; set; } = "";
    public string Birthday { get; set; } = "";
}

public class SignupRequest
{
    public string Name { get; set; } = "";
    public string Email { get; set; } = "";
    public string Password { get; set; } = "";
    public string Role { get; set; } = "";
    public bool AcceptedTerms { get; set; }

    public TutorProfileData? TutorProfile { get; set; }

    public LearnerProfileData? LearnerProfile { get; set; }
}
