using System.ComponentModel.DataAnnotations;
using System.Globalization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using inMVC.Data;
using inMVC.Models;
using inMVC.Helpers;
using inMVC.Services;

namespace inMVC.Controllers;

public class LearnerController : Controller
{
    private readonly AppDbContext _context;
    private readonly PaymentService _payments;

    public LearnerController(AppDbContext context, PaymentService payments)
    {
        _context = context;
        _payments = payments;
    }

    public IActionResult TutorProfile() => View();
    public IActionResult Booking() => View();
    public IActionResult Contract() => View();
    public IActionResult LearnerPortal() => View();

    private static readonly string[] AllowedGradeLevels =
    {
        "Preschool", "Kindergarten", "Grade 1", "Grade 2",
        "Grade 3", "Grade 4", "Grade 5", "Grade 6"
    };

    private static readonly string[] AllowedSubjects =
    {
        "English", "Math", "Reading", "Writing", "Filipino",
        "Early Learning Skills", "Science", "Social Studies"
    };

    private static readonly string[] AllowedSchedules =
    {
        "Weekday Mornings", "Weekday Afternoons", "Weekday Evenings",
        "Weekends", "Flexible"
    };

    // Profile
    [HttpGet]
    public async Task<IActionResult> GetProfile()
    {
        var userId = HttpContext.Session.GetUserId();
        if (userId == null || !HttpContext.Session.HasRole("learner"))
            return Unauthorized();

        var user = await _context.Users.FindAsync(userId.Value);
        if (user == null) return Unauthorized();

        var profile = await _context.LearnerProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.UserId == userId.Value);

        return Json(new
        {
            user.Id,
            user.Name,
            user.Email,
            gradeLevel = profile?.GradeLevel ?? "",
            school = profile?.School ?? "",
            birthday = profile?.Birthday ?? "",
            contactNumber = profile?.ContactNumber ?? "",
            accountManager = string.IsNullOrWhiteSpace(profile?.AccountManager) ? "Learner" : profile.AccountManager,
            guardianName = profile?.GuardianName ?? "",
            guardianRelationship = profile?.GuardianRelationship ?? "",
            guardianContactNumber = profile?.GuardianContactNumber ?? "",
            guardianEmail = profile?.GuardianEmail ?? "",
            subjects = (profile?.Subjects ?? "")
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries),
            learningGoals = profile?.LearningGoals ?? "",
            preferredSchedule = profile?.PreferredSchedule ?? "",
            profilePhoto = profile?.ProfilePhoto ?? ""
        });
    }

    [HttpPost]
    public async Task<IActionResult> SaveProfile([FromBody] LearnerProfileRequest request)
    {
        var userId = HttpContext.Session.GetUserId();
        if (userId == null || !HttpContext.Session.HasRole("learner"))
            return Unauthorized();

        var user = await _context.Users.FindAsync(userId.Value);
        if (user == null) return Unauthorized();

        var name = request.Name?.Trim() ?? "";
        var gradeLevel = request.GradeLevel?.Trim() ?? "";
        var school = request.School?.Trim() ?? "";
        var birthdayText = request.Birthday?.Trim() ?? "";
        var contactNumber = NormalizeProfileContact(request.ContactNumber, false);
        var accountManager = request.AccountManager?.Trim() ?? "Learner";
        var guardianName = request.GuardianName?.Trim() ?? "";
        var guardianRelationship = request.GuardianRelationship?.Trim() ?? "";
        var guardianContactNumber = NormalizeProfileContact(request.GuardianContactNumber, accountManager == "Guardian");
        var guardianEmail = request.GuardianEmail?.Trim().ToLowerInvariant() ?? "";
        var learningGoals = request.LearningGoals?.Trim() ?? "";
        var preferredSchedule = request.PreferredSchedule?.Trim() ?? "";

        if (name.Length is < 2 or > 60 || !name.Any(char.IsLetter))
            return BadRequest(new { field = "profileName", message = "Name must be 2 to 60 characters and contain a letter." });

        if (!AllowedGradeLevels.Contains(gradeLevel, StringComparer.Ordinal))
            return BadRequest(new { field = "profileGradeLevel", message = "Select a valid year level." });

        if (school.Length > 100)
            return BadRequest(new { field = "profileSchool", message = "School must be 100 characters or fewer." });

        if (!DateTime.TryParseExact(
                birthdayText,
                "yyyy-MM-dd",
                CultureInfo.InvariantCulture,
                DateTimeStyles.None,
                out var birthday) || birthday.Date > DateTime.Today)
        {
            return BadRequest(new { field = "profileBirthday", message = "Enter a valid birthdate that is not in the future." });
        }

        if (!string.IsNullOrWhiteSpace(request.ContactNumber) && contactNumber == null)
            return BadRequest(new { field = "profileContact", message = "Use 09XXXXXXXXX or +639XXXXXXXXX." });

        if (accountManager is not ("Learner" or "Guardian"))
            return BadRequest(new { field = "profileAccountManager", message = "Select who manages this account." });

        if (accountManager == "Guardian")
        {
            if (guardianName.Length is < 2 or > 60 || !guardianName.Any(char.IsLetter))
                return BadRequest(new { field = "guardianName", message = "Guardian name must be 2 to 60 characters." });

            if (guardianRelationship.Length is < 2 or > 40)
                return BadRequest(new { field = "guardianRelationship", message = "Relationship must be 2 to 40 characters." });

            if (guardianContactNumber == null)
                return BadRequest(new { field = "guardianContact", message = "Use 09XXXXXXXXX or +639XXXXXXXXX." });

            if (guardianEmail.Length > 254 || !new EmailAddressAttribute().IsValid(guardianEmail))
                return BadRequest(new { field = "guardianEmail", message = "Enter a valid guardian email address." });
        }
        else
        {
            guardianName = "";
            guardianRelationship = "";
            guardianContactNumber = "";
            guardianEmail = "";
        }

        var subjects = (request.Subjects ?? new List<string>())
            .Select(subject => subject.Trim())
            .Where(subject => AllowedSubjects.Contains(subject, StringComparer.Ordinal))
            .Distinct(StringComparer.Ordinal)
            .ToList();

        if (subjects.Count > 5)
            return BadRequest(new { field = "profileSubjects", message = "Choose up to five subjects." });

        if (learningGoals.Length > 500)
            return BadRequest(new { field = "profileLearningGoals", message = "Learning goals must be 500 characters or fewer." });

        if (!string.IsNullOrWhiteSpace(preferredSchedule) &&
            !AllowedSchedules.Contains(preferredSchedule, StringComparer.Ordinal))
        {
            return BadRequest(new { field = "profilePreferredSchedule", message = "Select a valid preferred schedule." });
        }

        var profile = await _context.LearnerProfiles
            .FirstOrDefaultAsync(item => item.UserId == userId.Value);

        if (profile == null)
        {
            profile = new LearnerProfile { UserId = userId.Value };
            _context.LearnerProfiles.Add(profile);
        }

        user.Name = name;
        profile.GradeLevel = gradeLevel;
        profile.School = school;
        profile.Birthday = birthdayText;
        profile.ContactNumber = contactNumber ?? "";
        profile.AccountManager = accountManager;
        profile.GuardianName = guardianName;
        profile.GuardianRelationship = guardianRelationship;
        profile.GuardianContactNumber = guardianContactNumber ?? "";
        profile.GuardianEmail = guardianEmail;
        profile.Subjects = string.Join(",", subjects);
        profile.LearningGoals = learningGoals;
        profile.PreferredSchedule = preferredSchedule;

        await _context.SaveChangesAsync();
        HttpContext.Session.SetString("userName", user.Name);

        return Ok(new
        {
            success = true,
            message = "Profile updated successfully.",
            name = user.Name,
            profile.ProfilePhoto
        });
    }

    [HttpPost]
    public async Task<IActionResult> UploadProfilePhoto(IFormFile photo)
    {
        var userId = HttpContext.Session.GetUserId();
        if (userId == null || !HttpContext.Session.HasRole("learner"))
            return Unauthorized();

        if (photo == null || photo.Length == 0)
            return BadRequest(new { message = "Choose a profile image." });

        if (photo.Length > 5 * 1024 * 1024)
            return BadRequest(new { message = "Profile image must be 5 MB or smaller." });

        var allowedTypes = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["image/jpeg"] = ".jpg",
            ["image/png"] = ".png",
            ["image/webp"] = ".webp"
        };

        if (!allowedTypes.TryGetValue(photo.ContentType, out var extension))
            return BadRequest(new { message = "Use a JPG, PNG, or WebP image." });

        var profile = await _context.LearnerProfiles
            .FirstOrDefaultAsync(item => item.UserId == userId.Value);

        if (profile == null)
        {
            profile = new LearnerProfile { UserId = userId.Value };
            _context.LearnerProfiles.Add(profile);
        }

        var uploadsDirectory = Path.Combine(
            Directory.GetCurrentDirectory(),
            "wwwroot",
            "uploads",
            "learner-photos");

        Directory.CreateDirectory(uploadsDirectory);

        if (!string.IsNullOrWhiteSpace(profile.ProfilePhoto))
        {
            var oldFileName = Path.GetFileName(profile.ProfilePhoto);
            var oldFilePath = Path.Combine(uploadsDirectory, oldFileName);
            if (System.IO.File.Exists(oldFilePath)) System.IO.File.Delete(oldFilePath);
        }

        var fileName = $"learner_{userId.Value}_{Guid.NewGuid():N}{extension}";
        var filePath = Path.Combine(uploadsDirectory, fileName);

        await using (var stream = new FileStream(filePath, FileMode.Create))
        {
            await photo.CopyToAsync(stream);
        }

        profile.ProfilePhoto = $"/uploads/learner-photos/{fileName}";
        await _context.SaveChangesAsync();

        return Ok(new
        {
            success = true,
            message = "Profile photo updated.",
            photoUrl = profile.ProfilePhoto
        });
    }

    [HttpPost]
    public async Task<IActionResult> RemoveProfilePhoto()
    {
        var userId = HttpContext.Session.GetUserId();
        if (userId == null || !HttpContext.Session.HasRole("learner"))
            return Unauthorized();

        var profile = await _context.LearnerProfiles
            .FirstOrDefaultAsync(item => item.UserId == userId.Value);

        if (profile == null)
            return NotFound(new { message = "Learner profile not found." });

        if (!string.IsNullOrWhiteSpace(profile.ProfilePhoto))
        {
            var uploadsDirectory = Path.Combine(
                Directory.GetCurrentDirectory(),
                "wwwroot",
                "uploads",
                "learner-photos");
            var fileName = Path.GetFileName(profile.ProfilePhoto);
            var filePath = Path.Combine(uploadsDirectory, fileName);

            if (System.IO.File.Exists(filePath))
                System.IO.File.Delete(filePath);
        }

        profile.ProfilePhoto = "";
        await _context.SaveChangesAsync();

        return Ok(new
        {
            success = true,
            message = "Profile photo removed."
        });
    }

    private static string? NormalizeProfileContact(string? value, bool required)
    {
        var contact = (value ?? "").Trim().Replace(" ", "").Replace("-", "");
        if (contact.Length == 0) return required ? null : "";
        if (contact.StartsWith("+639") && contact.Length == 13)
            contact = "0" + contact[3..];
        return contact.Length == 11 && contact.StartsWith("09") && contact.All(char.IsDigit)
            ? contact
            : null;
    }

    // Sessions
    public async Task<IActionResult> MySessions()
    {
        var userId = HttpContext.Session.GetUserId();
        if (userId == null || !HttpContext.Session.HasRole("learner"))
            return Unauthorized();

        await SessionCompletionHelper.ApplyAutomaticCompletionsAsync(_context);

        var sessions = await _context.Bookings
            .Where(booking => booking.LearnerId == userId.Value)
            .OrderBy(booking => booking.Date)
            .Select(booking => new
            {
                booking.Id,
                booking.Subject,
                booking.TutorName,
                booking.Date,
                booking.Time,
                booking.Status,
                booking.BookingGroupId,
                booking.BookingType,
                booking.TutorMarkedDoneAt,
                booking.LearnerConfirmedDoneAt,
                booking.CompletionIssueReportedAt,
                booking.CompletionIssueReason,
                booking.CompletionIssueStatus,
                booking.TutorIssueResponse,
                booking.TutorIssueRespondedAt,
                booking.AdminIssueResolution,
                booking.AdminIssueResolutionNote,
                booking.AdminIssueResolvedAt,
                booking.PaymentStatus,
                booking.SessionAmount,
                booking.CancelledAt,
                booking.CancelledByRole,
                Refund = _context.RefundTransactions
                    .Where(refund => refund.BookingId == booking.Id)
                    .OrderByDescending(refund => refund.CreatedAt)
                    .Select(refund => new { refund.Id, refund.Amount, refund.Status, refund.ExternalRefundId })
                    .FirstOrDefault(),
                HasReview = _context.Reviews.Any(review => review.BookingId == booking.Id),
                AutoCompletesAt = booking.TutorMarkedDoneAt == null
                    ? (DateTime?)null
                    : booking.TutorMarkedDoneAt.Value.AddHours(24)
            })
            .ToListAsync();

        return Json(sessions);
    }

    [HttpPost]
    public async Task<IActionResult> ConfirmSessionDone([FromBody] SessionCompletionRequest request)
    {
        var userId = HttpContext.Session.GetUserId();
        if (userId == null || !HttpContext.Session.HasRole("learner"))
            return Unauthorized();

        await SessionCompletionHelper.ApplyAutomaticCompletionsAsync(_context);

        var booking = await _context.Bookings.FirstOrDefaultAsync(item =>
            item.Id == request.BookingId && item.LearnerId == userId.Value);

        if (booking == null)
            return NotFound(new { message = "Session not found." });

        if (booking.Status == "Completed")
            return Ok(new { success = true, message = "Session is already completed." });

        if (booking.Status != "Confirmed" || booking.TutorMarkedDoneAt == null)
            return BadRequest(new { message = "The tutor must mark the session done first." });

        if (booking.CompletionIssueReportedAt != null)
            return Conflict(new { message = "This session has a reported issue and cannot be completed yet." });

        booking.LearnerConfirmedDoneAt = DateTime.UtcNow;
        booking.Status = "Completed";
        await _context.SaveChangesAsync();
        await TutorPayoutHelper.EnsurePayoutAsync(_context, booking);

        return Ok(new { success = true, message = "Session completed. You can now leave a review." });
    }

    [HttpPost]
    public async Task<IActionResult> ReportSessionIssue([FromBody] SessionIssueRequest request)
    {
        var userId = HttpContext.Session.GetUserId();
        if (userId == null || !HttpContext.Session.HasRole("learner"))
            return Unauthorized();

        var reason = request.Reason?.Trim() ?? "";
        if (reason.Length < 5 || reason.Length > 500)
            return BadRequest(new { message = "Explain the issue in 5 to 500 characters." });

        await SessionCompletionHelper.ApplyAutomaticCompletionsAsync(_context);

        var booking = await _context.Bookings.FirstOrDefaultAsync(item =>
            item.Id == request.BookingId && item.LearnerId == userId.Value);

        if (booking == null)
            return NotFound(new { message = "Session not found." });

        if (booking.Status != "Confirmed" || booking.TutorMarkedDoneAt == null)
            return BadRequest(new { message = "An issue can only be reported after the tutor marks the session done." });

        if (booking.CompletionIssueReportedAt != null)
            return Conflict(new { message = "You have already reported an issue for this session." });

        booking.CompletionIssueReportedAt = DateTime.UtcNow;
        booking.CompletionIssueReason = reason;
        booking.CompletionIssueStatus = "Awaiting Tutor Response";
        booking.TutorIssueResponse = "";
        booking.TutorIssueRespondedAt = null;
        booking.AdminIssueResolution = "";
        booking.AdminIssueResolutionNote = "";
        booking.AdminIssueResolvedAt = null;
        booking.AdminIssueResolvedBy = null;
        booking.Status = "Disputed";
        await _context.SaveChangesAsync();

        return Ok(new { success = true, message = "Issue reported. Session completion is paused." });
    }

    // Booking
    [HttpPost]
    public async Task<IActionResult> SubmitBooking([FromForm] BookingRequest request)
    {
        var userId = HttpContext.Session.GetUserId();
        if (userId == null || !HttpContext.Session.HasRole("learner"))
            return Unauthorized();

        var bookingType = request.BookingType.Equals("Range", StringComparison.OrdinalIgnoreCase)
            ? "Range"
            : "Single";

        var requestedDates = request.Dates
            .Where(date => !string.IsNullOrWhiteSpace(date))
            .Select(date => date.Trim())
            .Distinct(StringComparer.Ordinal)
            .ToList();

        if (requestedDates.Count == 0 && !string.IsNullOrWhiteSpace(request.Date))
            requestedDates.Add(request.Date.Trim());

        if (bookingType == "Single" && requestedDates.Count != 1)
            return BadRequest(new { message = "Select one date for a single-day booking." });

        if (bookingType == "Range" && requestedDates.Count < 2)
            return BadRequest(new { message = "Select at least two available dates for a date-range booking." });

        if (requestedDates.Count > 31)
            return BadRequest(new { message = "A booking request can contain up to 31 sessions." });

        var parsedDates = new List<DateTime>();
        foreach (var date in requestedDates)
        {
            if (!DateTime.TryParseExact(
                date,
                "yyyy-MM-dd",
                CultureInfo.InvariantCulture,
                DateTimeStyles.None,
                out var parsedDate) || parsedDate.Date < DateTime.Today)
            {
                return BadRequest(new { message = "One or more selected dates are invalid." });
            }

            parsedDates.Add(parsedDate.Date);
        }

        parsedDates = parsedDates.Distinct().OrderBy(date => date).ToList();
        if (parsedDates[^1] > parsedDates[0].AddDays(90))
            return BadRequest(new { message = "The selected date range cannot exceed 90 calendar days." });

        var normalizedDates = parsedDates
            .Select(date => date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture))
            .ToList();
        var time = request.Time.Trim();

        if (request.TutorId <= 0 || string.IsNullOrWhiteSpace(time))
            return BadRequest(new { message = "Tutor and time are required." });

        if (string.IsNullOrWhiteSpace(request.Subject) ||
            string.IsNullOrWhiteSpace(request.LearnerName) ||
            string.IsNullOrWhiteSpace(request.LearnerEmail))
        {
            return BadRequest(new { message = "Complete all required booking details." });
        }

        var tutor = await _context.TutorProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.Id == request.TutorId);
        if (tutor == null) return NotFound(new { message = "Tutor not found." });

        var hourlyRate = PaymentPolicyCalculator.ParseHourlyRate(tutor.Rate);
        var durationHours = PaymentPolicyCalculator.GetDurationHours(time);
        if (hourlyRate <= 0m)
            return BadRequest(new { message = "The tutor must set a valid hourly rate before accepting bookings." });
        if (durationHours < 1m)
            return BadRequest(new { message = "Each tutoring session must be at least one hour." });

        var availableSlots = await _context.TutorAvailabilities
            .Where(item => item.TutorId == request.TutorId &&
                normalizedDates.Contains(item.Date) &&
                item.Time == time)
            .Select(item => item.Date)
            .Distinct()
            .ToListAsync();

        if (availableSlots.Count != normalizedDates.Count)
            return Conflict(new { message = "The selected time is not available on every chosen date." });

        var hasConflict = await _context.Bookings.AnyAsync(booking =>
            booking.TutorId == request.TutorId &&
            parsedDates.Contains(booking.Date) &&
            booking.Time == time &&
            (booking.Status == "AwaitingPayment" || booking.Status == "Pending" || booking.Status == "Confirmed"));

        if (hasConflict)
            return Conflict(new { message = "One or more selected sessions were just reserved by another learner." });

        var groupId = Guid.NewGuid().ToString("N");
        var sessionAmount = Math.Round(hourlyRate * durationHours, 2);
        var totalAmount = sessionAmount * parsedDates.Count;

        var bookings = parsedDates.Select(date => new Booking
        {
            LearnerId = userId.Value,
            TutorId = request.TutorId,
            LearnerName = request.LearnerName.Trim(),
            LearnerEmail = request.LearnerEmail.Trim(),
            LearnerContact = request.LearnerContact.Trim(),
            LearnerGrade = request.LearnerGrade ?? "",
            Subject = request.Subject.Trim(),
            TutorName = tutor.TutorName,
            Date = date,
            Time = time,
            BookingGroupId = groupId,
            BookingType = bookingType,
            PaymentMethod = "",
            ReferenceNumber = "",
            Status = "AwaitingPayment",
            HourlyRate = hourlyRate,
            DurationHours = durationHours,
            SessionAmount = sessionAmount,
            PaymentStatus = "Unpaid",
            PaymentTransactionId = null
        }).ToList();

        _context.Bookings.AddRange(bookings);
        await _context.SaveChangesAsync();

        try
        {
            var transaction = await _payments.CreateCheckoutAsync(
                learnerId: userId.Value,
                bookingGroupId: groupId,
                amount: totalAmount,
                description: $"Booking {bookings.Count} session(s) of {request.Subject} with Tutor {tutor.TutorName}"
            );

            foreach (var b in bookings)
            {
                b.PaymentTransactionId = transaction.Id;
            }
            await _context.SaveChangesAsync();

            return Ok(new
            {
                success = true,
                bookingGroupId = groupId,
                sessionCount = bookings.Count,
                amount = totalAmount,
                checkoutUrl = transaction.CheckoutReference,
                message = "Booking request created successfully. Please complete payment."
            });
        }
        catch (Exception ex)
        {
            _context.Bookings.RemoveRange(bookings);
            await _context.SaveChangesAsync();
            return StatusCode(500, new { message = $"Payment provider error: {ex.Message}" });
        }
    }

    // Reviews
    [HttpGet]
    public async Task<IActionResult> GetReviewableSessions()
    {
        var userId = HttpContext.Session.GetUserId();
        if (userId == null || !HttpContext.Session.HasRole("learner"))
            return Unauthorized();

        await SessionCompletionHelper.ApplyAutomaticCompletionsAsync(_context);

        var sessions = await _context.Bookings
            .Where(booking =>
                booking.LearnerId == userId.Value &&
                booking.Status == "Completed" &&
                !_context.Reviews.Any(review => review.BookingId == booking.Id))
            .OrderByDescending(booking => booking.Date)
            .Select(booking => new
            {
                bookingId = booking.Id,
                booking.TutorId,
                booking.TutorName,
                booking.Subject,
                booking.Date,
                booking.Time
            })
            .ToListAsync();

        return Json(sessions);
    }

    [HttpPost]
    public async Task<IActionResult> SubmitReview([FromBody] ReviewRequest request)
    {
        var userId = HttpContext.Session.GetUserId();
        if (userId == null || !HttpContext.Session.HasRole("learner"))
            return Unauthorized();

        if (request.BookingId <= 0 || request.Rating is < 1 or > 5 || string.IsNullOrWhiteSpace(request.Comment))
            return BadRequest(new { message = "Select a completed session, rating, and review." });

        if (request.Comment.Trim().Length > 1000)
            return BadRequest(new { message = "Review must be 1,000 characters or fewer." });

        var booking = await _context.Bookings
            .FirstOrDefaultAsync(item =>
                item.Id == request.BookingId &&
                item.LearnerId == userId.Value &&
                item.Status == "Completed");

        if (booking == null)
            return BadRequest(new { message = "Only your completed sessions can be reviewed." });

        var alreadyReviewed = await _context.Reviews
            .AnyAsync(review => review.BookingId == booking.Id);

        if (alreadyReviewed)
            return Conflict(new { message = "You have already reviewed this session." });

        var user = await _context.Users.FindAsync(userId.Value);
        var review = new Review
        {
            BookingId = booking.Id,
            LearnerId = userId.Value,
            TutorId = booking.TutorId,
            LearnerName = user?.Name ?? booking.LearnerName,
            TutorName = booking.TutorName,
            Rating = request.Rating,
            Comment = request.Comment.Trim(),
            Status = "Published"
        };

        _context.Reviews.Add(review);

        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            return Conflict(new { message = "You have already reviewed this session." });
        }

        return Ok(new { success = true, message = "Review submitted and published." });
    }

    [HttpGet]
    public async Task<IActionResult> GetBookingGroupDetails(string bookingGroupId)
    {
        var userId = HttpContext.Session.GetUserId();
        if (userId == null || !HttpContext.Session.HasRole("learner"))
            return Unauthorized();

        var bookings = await _context.Bookings
            .Where(b => b.BookingGroupId == bookingGroupId && b.LearnerId == userId.Value)
            .OrderBy(b => b.Date)
            .ToListAsync();

        if (bookings.Count == 0)
            return NotFound(new { message = "Booking group not found." });

        var transaction = await _context.PaymentTransactions
            .FirstOrDefaultAsync(t => t.BookingGroupId == bookingGroupId && t.LearnerId == userId.Value);

        var first = bookings[0];
        var totalAmount = bookings.Sum(b => b.SessionAmount);

        return Json(new
        {
            bookingGroupId = first.BookingGroupId,
            tutorId = first.TutorId,
            tutorName = first.TutorName,
            subject = first.Subject,
            time = first.Time,
            dates = bookings.Select(b => b.Date.ToString("yyyy-MM-dd")).ToList(),
            bookingType = first.BookingType,
            learnerName = first.LearnerName,
            learnerEmail = first.LearnerEmail,
            learnerContact = first.LearnerContact,
            totalAmount = totalAmount,
            checkoutUrl = transaction?.CheckoutReference ?? ""
        });
    }

    [HttpPost]
    public async Task<IActionResult> CancelUnpaidBooking([FromBody] CancelUnpaidRequest request)
    {
        var userId = HttpContext.Session.GetUserId();
        if (userId == null || !HttpContext.Session.HasRole("learner"))
            return Unauthorized();

        var bookings = await _context.Bookings
            .Where(b => b.BookingGroupId == request.BookingGroupId && b.LearnerId == userId.Value && b.PaymentStatus != "Paid")
            .ToListAsync();

        if (bookings.Count > 0)
        {
            _context.Bookings.RemoveRange(bookings);
        }

        var transaction = await _context.PaymentTransactions
            .FirstOrDefaultAsync(t => t.BookingGroupId == request.BookingGroupId && t.LearnerId == userId.Value && t.Status != "Paid");

        if (transaction != null)
        {
            _context.PaymentTransactions.Remove(transaction);
        }

        await _context.SaveChangesAsync();
        return Ok(new { success = true, message = "Booking request cancelled." });
    }

    public class CancelUnpaidRequest
    {
        public string BookingGroupId { get; set; } = "";
    }

    public class LearnerProfileRequest
    {
        public string Name { get; set; } = "";
        public string GradeLevel { get; set; } = "";
        public string School { get; set; } = "";
        public string Birthday { get; set; } = "";
        public string ContactNumber { get; set; } = "";
        public string AccountManager { get; set; } = "Learner";
        public string GuardianName { get; set; } = "";
        public string GuardianRelationship { get; set; } = "";
        public string GuardianContactNumber { get; set; } = "";
        public string GuardianEmail { get; set; } = "";
        public List<string> Subjects { get; set; } = new();
        public string LearningGoals { get; set; } = "";
        public string PreferredSchedule { get; set; } = "";
    }

    public class BookingRequest
    {
        public int LearnerId { get; set; }
        public int TutorId { get; set; }
        public string LearnerName { get; set; } = "";
        public string LearnerEmail { get; set; } = "";
        public string LearnerContact { get; set; } = "";
        public string LearnerGrade { get; set; } = "";
        public string Subject { get; set; } = "";
        public string TutorName { get; set; } = "";
        public string Date { get; set; } = "";
        public List<string> Dates { get; set; } = new();
        public string BookingType { get; set; } = "Single";
        public string Time { get; set; } = "";
        public string PaymentMethod { get; set; } = "";
        public string ReferenceNumber { get; set; } = "";
    }

    public class ReviewRequest
    {
        public int BookingId { get; set; }
        public int Rating { get; set; }
        public string Comment { get; set; } = "";
    }

    public class SessionCompletionRequest
    {
        public int BookingId { get; set; }
    }

    public class SessionIssueRequest
    {
        public int BookingId { get; set; }
        public string Reason { get; set; } = "";
    }
}
