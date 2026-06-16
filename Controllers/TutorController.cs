using System.Globalization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using inMVC.Data;
using inMVC.Helpers;
using inMVC.Models;
using inMVC.Services;

namespace inMVC.Controllers;

public class TutorController : Controller
{
    private readonly AppDbContext _context;
    private readonly PaymentService _payments;

    public TutorController(AppDbContext context, PaymentService payments)
    {
        _context = context;
        _payments = payments;
    }

    [HttpGet]
    public async Task<IActionResult> List()
    {
        var tutors = await _context.TutorProfiles
            .Select(t => new
            {
                t.Id,
                t.UserId,
                t.TutorName,
                t.Rate,
                t.Education,
                t.Bio,
                t.Subjects,
                t.ProfilePhoto
            })
            .ToListAsync();

        var availability = (await _context.TutorAvailabilities
            .Where(a => a.Time != "")
            .Select(a => new { a.TutorId, a.Date, a.Time })
            .ToListAsync())
            .Where(a => IsCurrentOrFutureDate(a.Date))
            .ToList();

        var activeBookings = await _context.Bookings
            .Where(b => b.Status == "AwaitingPayment" || b.Status == "Pending" || b.Status == "Confirmed")
            .Select(b => new { b.TutorId, b.Date, b.Time })
            .ToListAsync();

        var bookedSlots = activeBookings
            .Select(b => $"{b.TutorId}|{b.Date:yyyy-MM-dd}|{b.Time}")
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var result = tutors.Select(t => new
        {
            t.Id,
            t.UserId,
            t.TutorName,
            t.Rate,
            t.Education,
            t.Bio,
            t.Subjects,
            t.ProfilePhoto,
            IsAvailable = availability.Any(a =>
                a.TutorId == t.Id &&
                !bookedSlots.Contains($"{a.TutorId}|{a.Date}|{a.Time}"))
        });

        return Json(result);
    }

    public IActionResult TutorDashboard() => View();
    public IActionResult Bookings() => View();
    public IActionResult Calendar() => View();
    public IActionResult EditProfile() => View();
    public IActionResult Reviews() => View();
    public IActionResult Settings() => View();
    public IActionResult TutorProfile() => View();

    // Bookings
    [HttpGet]
    public async Task<IActionResult> MyBookings()
    {
        var userId = HttpContext.Session.GetUserId();
        if (userId == null || !HttpContext.Session.HasRole("tutor")) return Unauthorized();

        var tutor = await _context.TutorProfiles
            .FirstOrDefaultAsync(t => t.UserId == userId.Value);
        if (tutor == null) return Ok(new List<object>());

        await SessionCompletionHelper.ApplyAutomaticCompletionsAsync(_context);

        var bookings = await _context.Bookings
            .Where(booking => booking.TutorId == tutor.Id && booking.PaymentStatus != "PendingIntegration" && booking.PaymentStatus != "Unpaid" && booking.PaymentStatus != "Failed" && booking.PaymentStatus != "Cancelled")
            .Select(booking => new
            {
                booking.Id,
                booking.LearnerName,
                booking.LearnerEmail,
                booking.LearnerContact,
                booking.Subject,
                booking.Date,
                booking.Time,
                booking.PaymentMethod,
                booking.ReferenceNumber,
                booking.ProofOfPayment,
                booking.Status,
                booking.CreatedAt,
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
                CanTutorMarkDone = booking.Status == "Confirmed" &&
                    booking.TutorMarkedDoneAt == null &&
                    booking.CompletionIssueReportedAt == null,
                CanTutorRespondToIssue = booking.CompletionIssueReportedAt != null &&
                    booking.AdminIssueResolvedAt == null &&
                    (booking.Status == "Disputed" || booking.Status == "UnderReview")
            })
            .ToListAsync();

        return Json(bookings);
    }

    [HttpPost]
    public async Task<IActionResult> UpdateBookingStatus([FromBody] UpdateStatusRequest request)
    {
        var userId = HttpContext.Session.GetUserId();
        if (userId == null || !HttpContext.Session.HasRole("tutor")) return Unauthorized();

        var tutor = await _context.TutorProfiles.FirstOrDefaultAsync(item => item.UserId == userId.Value);
        if (tutor == null) return Unauthorized();

        var allowedStatuses = new[] { "Confirmed", "Rejected" };
        if (!allowedStatuses.Contains(request.Status))
            return BadRequest(new { message = "Invalid booking status." });

        var booking = await _context.Bookings.FindAsync(request.Id);
        if (booking == null) return NotFound();
        if (booking.TutorId != tutor.Id) return Forbid();

        var groupId = booking.BookingGroupId;
        var bookings = string.IsNullOrWhiteSpace(groupId)
            ? new List<Booking> { booking }
            : await _context.Bookings
                .Where(item => item.TutorId == tutor.Id && item.BookingGroupId == groupId)
                .ToListAsync();

        if (request.Status == "Rejected")
        {
            var paidBookings = bookings.Where(item => item.PaymentStatus == "Paid").ToList();
            if (paidBookings.Count > 0)
            {
                if (string.IsNullOrWhiteSpace(groupId))
                    await _payments.CancelBookingAsync(booking.Id, "tutor", true);
                else
                    await _payments.RejectBookingGroupAsync(groupId, tutor.Id);
            }

            foreach (var item in bookings.Where(item => item.PaymentStatus != "Paid"))
                item.Status = "Rejected";

            await _context.SaveChangesAsync();
            return Ok(new { success = true, updated = bookings.Count, refundRequested = paidBookings.Count });
        }

        foreach (var item in bookings)
        {
            if (item.PaymentStatus != "Paid" && item.PaymentStatus != "PendingIntegration")
                return Conflict(new { message = "The booking is not ready for confirmation." });
            item.Status = "Confirmed";
        }

        await _context.SaveChangesAsync();
        return Ok(new { success = true, updated = bookings.Count });
    }

    [HttpPost]
    public async Task<IActionResult> MarkSessionDone([FromBody] SessionCompletionRequest request)
    {
        var userId = HttpContext.Session.GetUserId();
        if (userId == null || !HttpContext.Session.HasRole("tutor")) return Unauthorized();

        var tutor = await _context.TutorProfiles
            .FirstOrDefaultAsync(item => item.UserId == userId.Value);
        if (tutor == null) return Unauthorized();

        await SessionCompletionHelper.ApplyAutomaticCompletionsAsync(_context);

        var booking = await _context.Bookings.FirstOrDefaultAsync(item =>
            item.Id == request.BookingId && item.TutorId == tutor.Id);

        if (booking == null)
            return NotFound(new { message = "Session not found." });

        if (booking.Status == "Completed")
            return Ok(new { success = true, message = "Session is already completed." });

        if (booking.Status != "Confirmed")
            return BadRequest(new { message = "Only confirmed sessions can be marked done." });

        if (booking.CompletionIssueReportedAt != null)
            return Conflict(new { message = "This session has a reported issue." });

        if (booking.TutorMarkedDoneAt != null)
            return Ok(new { success = true, message = "Waiting for learner confirmation." });

        if (!SessionCompletionHelper.HasSessionEnded(booking))
            return BadRequest(new { message = "You can mark the session done after its scheduled end time." });

        booking.TutorMarkedDoneAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return Ok(new
        {
            success = true,
            message = "Session marked done. Waiting for learner confirmation.",
            autoCompletesAt = booking.TutorMarkedDoneAt.Value.AddHours(24)
        });
    }

    // Session Issues
    [HttpPost]
    public async Task<IActionResult> RespondToSessionIssue([FromBody] TutorIssueResponseRequest request)
    {
        var userId = HttpContext.Session.GetUserId();
        if (userId == null || !HttpContext.Session.HasRole("tutor")) return Unauthorized();

        var tutor = await _context.TutorProfiles
            .FirstOrDefaultAsync(item => item.UserId == userId.Value);
        if (tutor == null) return Unauthorized();

        var responseText = request.Response?.Trim() ?? "";
        if (responseText.Length is < 10 or > 1000)
            return BadRequest(new { message = "Response must be 10 to 1,000 characters." });

        var booking = await _context.Bookings.FirstOrDefaultAsync(item =>
            item.Id == request.BookingId && item.TutorId == tutor.Id);

        if (booking == null)
            return NotFound(new { message = "Session not found." });

        if (booking.CompletionIssueReportedAt == null)
            return BadRequest(new { message = "This session has no reported issue." });

        if (booking.AdminIssueResolvedAt != null || booking.Status == "Completed" || booking.Status == "Cancelled")
            return Conflict(new { message = "This issue has already been resolved." });

        if (booking.Status != "Disputed" && booking.Status != "UnderReview")
            return Conflict(new { message = "This issue is not open for a response." });

        booking.TutorIssueResponse = responseText;
        booking.TutorIssueRespondedAt = DateTime.UtcNow;
        booking.CompletionIssueStatus = "Under Review";
        booking.Status = "UnderReview";
        await _context.SaveChangesAsync();

        return Ok(new
        {
            success = true,
            message = "Your response was submitted for administrative review."
        });
    }

    // Reviews
    [HttpGet]
    public async Task<IActionResult> MyReviews()
    {
        var userId = HttpContext.Session.GetUserId();
        if (userId == null || !HttpContext.Session.HasRole("tutor")) return Unauthorized();

        var tutor = await _context.TutorProfiles
            .FirstOrDefaultAsync(item => item.UserId == userId.Value);
        if (tutor == null) return Ok(new List<object>());

        var reviews = await (
            from review in _context.Reviews
            join booking in _context.Bookings
                on review.BookingId equals (int?)booking.Id into bookingGroup
            from booking in bookingGroup.DefaultIfEmpty()
            where review.TutorId == tutor.Id && review.Status == "Published"
            orderby review.CreatedAt descending
            select new
            {
                review.Id,
                review.LearnerName,
                review.Rating,
                review.Comment,
                review.CreatedAt,
                Subject = booking != null ? booking.Subject : "",
                SessionDate = booking != null ? (DateTime?)booking.Date : null,
                SessionTime = booking != null ? booking.Time : "",
                IsReported = _context.ReviewReports.Any(report =>
                    report.ReviewId == review.Id && report.TutorId == tutor.Id)
            })
            .ToListAsync();

        return Json(reviews);
    }

    [HttpPost]
    public async Task<IActionResult> ReportReview([FromBody] ReportReviewRequest request)
    {
        var userId = HttpContext.Session.GetUserId();
        if (userId == null || !HttpContext.Session.HasRole("tutor")) return Unauthorized();

        var tutor = await _context.TutorProfiles
            .FirstOrDefaultAsync(item => item.UserId == userId.Value);
        if (tutor == null) return Unauthorized();

        var allowedReasons = new[]
        {
            "Offensive or abusive language",
            "Harassment or personal attack",
            "False or unrelated content",
            "Spam",
            "Private information",
            "Other"
        };

        var reason = request.Reason?.Trim() ?? "";
        var details = request.Details?.Trim() ?? "";

        if (request.ReviewId <= 0 || !allowedReasons.Contains(reason))
            return BadRequest(new { message = "Select a valid reason for the report." });

        if (reason == "Other" && string.IsNullOrWhiteSpace(details))
            return BadRequest(new { message = "Please explain why you are reporting this review." });

        if (details.Length > 500)
            return BadRequest(new { message = "Report details must be 500 characters or fewer." });

        var reviewExists = await _context.Reviews
            .AnyAsync(review => review.Id == request.ReviewId && review.TutorId == tutor.Id);
        if (!reviewExists) return NotFound(new { message = "Review not found." });

        var alreadyReported = await _context.ReviewReports
            .AnyAsync(report => report.ReviewId == request.ReviewId && report.TutorId == tutor.Id);
        if (alreadyReported)
            return Conflict(new { message = "You have already reported this review." });

        _context.ReviewReports.Add(new ReviewReport
        {
            ReviewId = request.ReviewId,
            TutorId = tutor.Id,
            Reason = reason,
            Details = details,
            Status = "Pending"
        });

        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            return Conflict(new { message = "You have already reported this review." });
        }

        return Ok(new
        {
            success = true,
            message = "Review reported for moderation. It will remain published while the report is reviewed."
        });
    }

    // Portal
    [HttpGet]
    public async Task<IActionResult> MyPortalProfile()
    {
        var userId = HttpContext.Session.GetUserId();
        if (userId == null || !HttpContext.Session.HasRole("tutor")) return Unauthorized();

        var tutor = await _context.TutorProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.UserId == userId.Value);
        if (tutor == null) return NotFound();

        return Json(new
        {
            tutor.Id,
            tutor.TutorName,
            tutor.Education,
            tutor.ProfilePhoto
        });
    }

// Notifications
    [HttpGet]
    public async Task<IActionResult> GetNotificationSettings()
    {
        var userId = HttpContext.Session.GetUserId();

        if (userId == null ||
            !HttpContext.Session.HasRole("tutor"))
        {
            return Unauthorized();
        }

        var tutor = await _context.TutorProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(item =>
                item.UserId == userId.Value);

        if (tutor == null)
        {
            return NotFound();
        }

        var settings = await _context.TutorNotificationSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(item =>
                item.TutorId == tutor.Id);

        return Json(new
        {
            pushNotificationsEnabled =
                settings?.PushNotificationsEnabled ?? false,

            newReviewAlertsEnabled =
                settings?.NewReviewAlertsEnabled ?? true
        });
    }

    [HttpPost]
    public async Task<IActionResult> UpdateNotificationSettings(
        [FromBody] UpdateNotificationSettingsRequest request)
    {
        var userId = HttpContext.Session.GetUserId();

        if (userId == null ||
            !HttpContext.Session.HasRole("tutor"))
        {
            return Unauthorized();
        }

        var tutor = await _context.TutorProfiles
            .FirstOrDefaultAsync(item =>
                item.UserId == userId.Value);

        if (tutor == null)
        {
            return NotFound();
        }

        var settings = await _context.TutorNotificationSettings
            .FirstOrDefaultAsync(item =>
                item.TutorId == tutor.Id);

        if (settings == null)
        {
            settings = new TutorNotificationSettings
            {
                TutorId = tutor.Id
            };

            _context.TutorNotificationSettings.Add(settings);
        }

        settings.PushNotificationsEnabled =
            request.PushNotificationsEnabled;

        settings.NewReviewAlertsEnabled =
            request.NewReviewAlertsEnabled;

        await _context.SaveChangesAsync();

        return Ok(new
        {
            success = true
        });
    }

    [HttpGet]
    public async Task<IActionResult> Notifications()
    {
        var userId = HttpContext.Session.GetUserId();
        if (userId == null || !HttpContext.Session.HasRole("tutor")) return Unauthorized();

        var tutor = await _context.TutorProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.UserId == userId.Value);
        if (tutor == null) return Json(new { unreadCount = 0, items = Array.Empty<object>() });

        var settings = await _context.TutorNotificationSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.TutorId == tutor.Id);

        var bookingRows = await _context.Bookings
            .AsNoTracking()
            .Where(booking => booking.TutorId == tutor.Id && booking.Status == "Pending" && booking.PaymentStatus == "Paid")
            .Select(booking => new
            {
                booking.Id,
                booking.BookingGroupId,
                booking.LearnerName,
                booking.Subject,
                booking.CreatedAt
            })
            .ToListAsync();

        var items = bookingRows
            .GroupBy(booking => string.IsNullOrWhiteSpace(booking.BookingGroupId)
                ? $"single-{booking.Id}"
                : booking.BookingGroupId)
            .Select(group =>
            {
                var first = group.First();
                var sessionCount = group.Count();
                var scheduleText = sessionCount == 1 ? "a session" : $"{sessionCount} sessions";
                return new TutorNotificationItem
                {
                    Id = $"booking-{group.Key}",
                    Type = "booking",
                    Title = "New booking request",
                    Message = $"{first.LearnerName} requested {scheduleText} for {first.Subject}.",
                    CreatedAt = group.Min(booking => booking.CreatedAt),
                    Url = "/Tutor/Bookings"
                };
            })
            .ToList();

        var issueRows = await _context.Bookings
            .AsNoTracking()
            .Where(booking =>
                booking.TutorId == tutor.Id &&
                booking.CompletionIssueReportedAt != null &&
                booking.AdminIssueResolvedAt == null)
            .OrderByDescending(booking => booking.CompletionIssueReportedAt)
            .Take(20)
            .Select(booking => new
            {
                booking.Id,
                booking.LearnerName,
                booking.Subject,
                booking.CompletionIssueReportedAt,
                booking.TutorIssueRespondedAt
            })
            .ToListAsync();

        items.AddRange(issueRows.Select(issue => new TutorNotificationItem
        {
            Id = $"issue-{issue.Id}-{issue.TutorIssueRespondedAt?.Ticks ?? 0}",
            Type = "issue",
            Title = issue.TutorIssueRespondedAt == null ? "Session issue reported" : "Session issue under review",
            Message = issue.TutorIssueRespondedAt == null
                ? $"{issue.LearnerName} reported an issue for {issue.Subject}."
                : $"Your response for {issue.Subject} is awaiting review.",
            CreatedAt = issue.TutorIssueRespondedAt ?? issue.CompletionIssueReportedAt!.Value,
            Url = "/Tutor/Bookings"
        }));

        if (settings?.NewReviewAlertsEnabled ?? true)
        {
            var reviewRows = await _context.Reviews
                .AsNoTracking()
                .Where(review => review.TutorId == tutor.Id && review.Status == "Published")
                .OrderByDescending(review => review.CreatedAt)
                .Take(20)
                .Select(review => new
                {
                    review.Id,
                    review.LearnerName,
                    review.Rating,
                    review.CreatedAt
                })
                .ToListAsync();

            items.AddRange(reviewRows.Select(review => new TutorNotificationItem
            {
                Id = $"review-{review.Id}",
                Type = "review",
                Title = "New review published",
                Message = $"{review.LearnerName} left a {review.Rating}-star review.",
                CreatedAt = review.CreatedAt,
                Url = "/Tutor/Reviews"
            }));
        }

        items = items
            .OrderByDescending(item => item.CreatedAt)
            .Take(20)
            .ToList();

        var clearedAt = settings?.LastNotificationClearedAt;
        if (clearedAt != null)
        {
            items = items
                .Where(item => item.CreatedAt > clearedAt.Value)
                .ToList();
        }

        var lastReadAt = settings?.LastNotificationReadAt;
        var unreadCount = items.Count(item => lastReadAt == null || item.CreatedAt > lastReadAt.Value);

        return Json(new
        {
            unreadCount,
            pushNotificationsEnabled = settings?.PushNotificationsEnabled ?? false,
            items
        });
    }

    [HttpPost]
    public async Task<IActionResult> MarkNotificationsRead()
    {
        var userId = HttpContext.Session.GetUserId();
        if (userId == null || !HttpContext.Session.HasRole("tutor")) return Unauthorized();

        var tutor = await _context.TutorProfiles
            .FirstOrDefaultAsync(item => item.UserId == userId.Value);
        if (tutor == null) return NotFound();

        var settings = await _context.TutorNotificationSettings
            .FirstOrDefaultAsync(item => item.TutorId == tutor.Id);

        if (settings == null)
        {
            settings = new TutorNotificationSettings { TutorId = tutor.Id };
            _context.TutorNotificationSettings.Add(settings);
        }

        settings.LastNotificationReadAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();
        return Ok(new { success = true });
    }

    [HttpPost]
    public async Task<IActionResult> ClearNotifications()
    {
        var userId = HttpContext.Session.GetUserId();
        if (userId == null || !HttpContext.Session.HasRole("tutor")) return Unauthorized();

        var tutor = await _context.TutorProfiles
            .FirstOrDefaultAsync(item => item.UserId == userId.Value);
        if (tutor == null) return NotFound();

        var settings = await _context.TutorNotificationSettings
            .FirstOrDefaultAsync(item => item.TutorId == tutor.Id);

        if (settings == null)
        {
            settings = new TutorNotificationSettings { TutorId = tutor.Id };
            _context.TutorNotificationSettings.Add(settings);
        }

        var now = DateTime.UtcNow;
        settings.LastNotificationReadAt = now;
        settings.LastNotificationClearedAt = now;

        await _context.SaveChangesAsync();
        return Ok(new { success = true });
    }

    // Profile
    [HttpGet]
    public async Task<IActionResult> GetProfile(int id)
    {
        var tutor = await _context.TutorProfiles
            .Include(t => t.User)
            .FirstOrDefaultAsync(t => t.Id == id);

        if (tutor == null) return NotFound();

        var reviews = await _context.Reviews
            .Where(r => r.TutorId == id && r.Status == "Published")
            .OrderByDescending(r => r.CreatedAt)
            .Select(r => new { r.LearnerName, r.Rating, r.Comment, r.CreatedAt })
            .ToListAsync();

        var availableDates = (await _context.TutorAvailabilities
            .Where(a => a.TutorId == id && a.Time != "")
            .Select(a => a.Date)
            .Distinct()
            .ToListAsync())
            .Where(IsCurrentOrFutureDate)
            .OrderBy(date => date)
            .ToList();

        var completedLessons = await _context.Bookings
            .CountAsync(b => b.TutorId == id && b.Status == "Completed");

        return Json(new
        {
            tutor.Id,
            tutor.TutorName,
            tutor.ProfilePhoto,
            tutor.Rate,
            tutor.Education,
            tutor.ContactNumber,
            tutor.Bio,
            tutor.Subjects,
            Email = tutor.User?.Email ?? "",
            CompletedLessons = completedLessons,
            AvailableDates = availableDates,
            Reviews = reviews
        });
    }

    // Availability
    [HttpGet]
    public async Task<IActionResult> GetAvailability(int tutorId)
    {
        if (tutorId <= 0) return Json(Array.Empty<object>());

        var availability = (await _context.TutorAvailabilities
            .Where(a => a.TutorId == tutorId && a.Time != "")
            .Select(a => new { a.Date, a.Time })
            .ToListAsync())
            .Where(a => IsCurrentOrFutureDate(a.Date))
            .ToList();

        var bookings = await _context.Bookings
            .Where(b => b.TutorId == tutorId &&
                (b.Status == "AwaitingPayment" || b.Status == "Pending" || b.Status == "Confirmed"))
            .Select(b => new { b.Date, b.Time })
            .ToListAsync();

        var bookedSlots = bookings
            .Select(b => $"{b.Date:yyyy-MM-dd}|{b.Time}")
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var result = availability
            .Where(a => IsValidTimeSlot(a.Time))
            .Where(a => !bookedSlots.Contains($"{a.Date}|{a.Time}"))
            .GroupBy(a => a.Date)
            .OrderBy(group => group.Key)
            .Select(group => new
            {
                date = group.Key,
                timeSlots = group
                    .Select(a => a.Time)
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .OrderBy(TimeSlotStartMinutes)
                    .ToList()
            })
            .ToList();

        return Json(result);
    }

    [HttpGet]
    public async Task<IActionResult> GetMyAvailability()
    {
        var userId = HttpContext.Session.GetUserId();
        if (userId == null || !HttpContext.Session.HasRole("tutor")) return Unauthorized();

        var tutor = await _context.TutorProfiles
            .FirstOrDefaultAsync(t => t.UserId == userId.Value);
        if (tutor == null) return NotFound();

        var availability = (await _context.TutorAvailabilities
            .Where(a => a.TutorId == tutor.Id && a.Time != "")
            .Select(a => new { a.Date, a.Time })
            .ToListAsync())
            .Where(a => IsCurrentOrFutureDate(a.Date))
            .ToList();

        var result = availability
            .Where(a => IsValidTimeSlot(a.Time))
            .GroupBy(a => a.Date)
            .OrderBy(group => group.Key)
            .Select(group => new
            {
                date = group.Key,
                timeSlots = group
                    .Select(a => a.Time)
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .OrderBy(TimeSlotStartMinutes)
                    .ToList()
            })
            .ToList();

        return Json(result);
    }

    [HttpPost]
    public async Task<IActionResult> SaveAvailability([FromBody] SaveAvailabilityRequest request)
    {
        var userId = HttpContext.Session.GetUserId();
        if (userId == null || !HttpContext.Session.HasRole("tutor")) return Unauthorized();

        var tutor = await _context.TutorProfiles
            .FirstOrDefaultAsync(t => t.UserId == userId.Value);
        if (tutor == null) return NotFound();

        var normalizedSlots = new List<(string Date, string Time)>();
        var uniqueSlots = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var day in request.Availability)
        {
            if (!DateTime.TryParseExact(
                day.Date,
                "yyyy-MM-dd",
                CultureInfo.InvariantCulture,
                DateTimeStyles.None,
                out var date) || date.Date < DateTime.Today)
            {
                return BadRequest(new { message = "One or more availability dates are invalid." });
            }

            foreach (var rawTime in day.TimeSlots)
            {
                var time = rawTime.Trim();
                if (!IsValidTimeSlot(time))
                {
                    return BadRequest(new { message = "Each time slot must be valid and at least one hour long." });
                }

                var key = $"{day.Date}|{time}";
                if (uniqueSlots.Add(key))
                {
                    normalizedSlots.Add((day.Date, time));
                }
            }
        }

        foreach (var dateGroup in normalizedSlots.GroupBy(slot => slot.Date))
        {
            var ordered = dateGroup
                .Select(slot => GetTimeSlotRange(slot.Time))
                .OrderBy(range => range.Start)
                .ToList();

            for (var index = 1; index < ordered.Count; index++)
            {
                if (ordered[index].Start < ordered[index - 1].End)
                {
                    return BadRequest(new { message = "Time slots on the same date cannot overlap." });
                }
            }
        }

        var existing = _context.TutorAvailabilities.Where(a => a.TutorId == tutor.Id);
        _context.TutorAvailabilities.RemoveRange(existing);

        foreach (var slot in normalizedSlots)
        {
            _context.TutorAvailabilities.Add(new TutorAvailability
            {
                TutorId = tutor.Id,
                Date = slot.Date,
                Time = slot.Time
            });
        }

        await _context.SaveChangesAsync();
        return Ok(new { success = true });
    }

    private static bool IsCurrentOrFutureDate(string date)
    {
        return DateTime.TryParseExact(
            date,
            "yyyy-MM-dd",
            CultureInfo.InvariantCulture,
            DateTimeStyles.None,
            out var parsedDate) && parsedDate.Date >= DateTime.Today;
    }

    private static bool IsValidTimeSlot(string timeSlot)
    {
        var parts = timeSlot.Split(" - ", StringSplitOptions.TrimEntries);
        if (parts.Length != 2) return false;

        return TryParseTime(parts[0], out var start) &&
            TryParseTime(parts[1], out var end) &&
            (end - start).TotalHours >= 1;
    }

    private static int TimeSlotStartMinutes(string timeSlot)
    {
        return GetTimeSlotRange(timeSlot).Start;
    }

    private static (int Start, int End) GetTimeSlotRange(string timeSlot)
    {
        var parts = timeSlot.Split(" - ", StringSplitOptions.TrimEntries);
        if (parts.Length != 2 ||
            !TryParseTime(parts[0], out var start) ||
            !TryParseTime(parts[1], out var end))
        {
            return (int.MaxValue, int.MaxValue);
        }

        return (
            start.Hour * 60 + start.Minute,
            end.Hour * 60 + end.Minute
        );
    }

    private static bool TryParseTime(string value, out DateTime time)
    {
        return DateTime.TryParseExact(
            value,
            new[] { "h:mm tt", "hh:mm tt" },
            CultureInfo.InvariantCulture,
            DateTimeStyles.None,
            out time);
    }
}

public class UpdateStatusRequest
{
    public int Id { get; set; }
    public string Status { get; set; } = "";
}

public class SessionCompletionRequest
{
    public int BookingId { get; set; }
}

public class TutorIssueResponseRequest
{
    public int BookingId { get; set; }
    public string Response { get; set; } = "";
}

public class SaveAvailabilityRequest
{
    public List<AvailabilityDayRequest> Availability { get; set; } = new();
}

public class AvailabilityDayRequest
{
    public string Date { get; set; } = "";
    public List<string> TimeSlots { get; set; } = new();
}

public class UpdateNotificationSettingsRequest
{
    public bool PushNotificationsEnabled { get; set; }
    public bool NewReviewAlertsEnabled { get; set; }
}

public class TutorNotificationItem
{
    public string Id { get; set; } = "";
    public string Type { get; set; } = "";
    public string Title { get; set; } = "";
    public string Message { get; set; } = "";
    public DateTime CreatedAt { get; set; }
    public string Url { get; set; } = "";
}

public class ReportReviewRequest
{
    public int ReviewId { get; set; }
    public string Reason { get; set; } = "";
    public string Details { get; set; } = "";
}
