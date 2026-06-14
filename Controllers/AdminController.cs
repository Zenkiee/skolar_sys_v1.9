using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using inMVC.Data;
using inMVC.Helpers;
using inMVC.Services;

namespace inMVC.Controllers;

public class AdminController : Controller
{
    private readonly AppDbContext _context;
    private readonly PaymentService _payments;

    public AdminController(AppDbContext context, PaymentService payments)
    {
        _context = context;
        _payments = payments;
    }

    public IActionResult Issues()
    {
        if (!HttpContext.Session.HasRole("admin"))
            return Redirect("/Home/Account?role=admin");

        return View();
    }

    [HttpGet]
    public async Task<IActionResult> SessionIssues()
    {
        if (!HttpContext.Session.HasRole("admin")) return Unauthorized();

        var issues = await _context.Bookings
            .Where(booking => booking.CompletionIssueReportedAt != null)
            .OrderByDescending(booking => booking.CompletionIssueReportedAt)
            .Select(booking => new
            {
                booking.Id,
                booking.LearnerName,
                booking.LearnerEmail,
                booking.TutorName,
                booking.Subject,
                booking.Date,
                booking.Time,
                booking.Status,
                booking.CompletionIssueReason,
                booking.CompletionIssueReportedAt,
                booking.CompletionIssueStatus,
                booking.TutorIssueResponse,
                booking.TutorIssueRespondedAt,
                booking.AdminIssueResolution,
                booking.AdminIssueResolutionNote,
                booking.AdminIssueResolvedAt
            })
            .ToListAsync();

        return Json(issues);
    }

    [HttpPost]
    public async Task<IActionResult> ResolveSessionIssue([FromBody] ResolveSessionIssueRequest request)
    {
        var adminId = HttpContext.Session.GetUserId();
        if (adminId == null || !HttpContext.Session.HasRole("admin")) return Unauthorized();

        var action = request.Action?.Trim().ToLowerInvariant() ?? "";
        var note = request.Note?.Trim() ?? "";

        if (action != "complete" && action != "cancel" && action != "requestinfo")
            return BadRequest(new { message = "Choose a valid resolution." });

        if (note.Length > 1000)
            return BadRequest(new { message = "Administrative note must be 1,000 characters or fewer." });

        if (action == "requestinfo" && note.Length < 5)
            return BadRequest(new { message = "Explain what additional information is needed." });

        var booking = await _context.Bookings.FirstOrDefaultAsync(item => item.Id == request.BookingId);
        if (booking == null)
            return NotFound(new { message = "Session issue not found." });

        if (booking.CompletionIssueReportedAt == null)
            return BadRequest(new { message = "This session has no reported issue." });

        if (action == "requestinfo")
        {
            booking.Status = "UnderReview";
            booking.CompletionIssueStatus = "More Information Requested";
            booking.AdminIssueResolution = "Request Information";
            booking.AdminIssueResolutionNote = note;
            booking.AdminIssueResolvedAt = null;
            booking.AdminIssueResolvedBy = null;
        }
        else
        {
            booking.AdminIssueResolvedAt = DateTime.UtcNow;
            booking.AdminIssueResolvedBy = adminId.Value;
            booking.AdminIssueResolutionNote = note;

            if (action == "complete")
            {
                booking.Status = "Completed";
                booking.LearnerConfirmedDoneAt ??= DateTime.UtcNow;
                booking.CompletionIssueStatus = "Resolved — Session Completed";
                booking.AdminIssueResolution = "Completed";
            }
            else
            {
                if (booking.PaymentStatus == "Paid")
                    await _payments.CancelBookingAsync(booking.Id, "admin", true);

                booking.Status = "Cancelled";
                booking.CompletionIssueStatus = "Resolved — Session Cancelled";
                booking.AdminIssueResolution = "Cancelled";
            }
        }

        await _context.SaveChangesAsync();
        if (booking.Status == "Completed")
            await TutorPayoutHelper.EnsurePayoutAsync(_context, booking);

        return Ok(new
        {
            success = true,
            message = action switch
            {
                "complete" => "Issue resolved and session marked completed.",
                "cancel" => "Issue resolved and session cancelled.",
                _ => "Additional information was requested."
            }
        });
    }
    [HttpGet]
    public async Task<IActionResult> ReviewReports()
    {
        if (!HttpContext.Session.HasRole("admin")) return Unauthorized();

        var reports = await (
            from report in _context.ReviewReports
            join review in _context.Reviews on report.ReviewId equals review.Id
            join booking in _context.Bookings
                on review.BookingId equals (int?)booking.Id into bookingGroup
            from booking in bookingGroup.DefaultIfEmpty()
            orderby report.CreatedAt descending
            select new
            {
                report.Id,
                report.ReviewId,
                report.Reason,
                report.Details,
                report.Status,
                report.CreatedAt,
                review.LearnerName,
                review.TutorName,
                review.Rating,
                review.Comment,
                ReviewStatus = review.Status,
                Subject = booking != null ? booking.Subject : "",
                SessionDate = booking != null ? (DateTime?)booking.Date : null,
                SessionTime = booking != null ? booking.Time : ""
            })
            .ToListAsync();

        return Json(reports);
    }

    [HttpPost]
    public async Task<IActionResult> ResolveReviewReport([FromBody] ResolveReviewReportRequest request)
    {
        if (!HttpContext.Session.HasRole("admin")) return Unauthorized();

        var action = request.Action?.Trim().ToLowerInvariant() ?? "";
        if (action is not ("keep" or "remove"))
            return BadRequest(new { message = "Choose a valid review decision." });

        var report = await _context.ReviewReports
            .FirstOrDefaultAsync(item => item.Id == request.ReportId);

        if (report == null)
            return NotFound(new { message = "Review report not found." });

        if (!string.Equals(report.Status, "Pending", StringComparison.OrdinalIgnoreCase))
            return Conflict(new { message = "This review report has already been decided." });

        var review = await _context.Reviews.FindAsync(report.ReviewId);
        if (review == null)
            return NotFound(new { message = "Reported review not found." });

        if (action == "remove")
        {
            review.Status = "Removed";
            report.Status = "Review Removed";
        }
        else
        {
            review.Status = "Published";
            report.Status = "Dismissed";
        }

        await _context.SaveChangesAsync();

        return Ok(new
        {
            success = true,
            message = action == "remove"
                ? "The review was removed from the platform."
                : "The report was dismissed and the review remains published."
        });
    }

}

public class ResolveSessionIssueRequest
{
    public int BookingId { get; set; }
    public string Action { get; set; } = "";
    public string Note { get; set; } = "";
}


public class ResolveReviewReportRequest
{
    public int ReportId { get; set; }
    public string Action { get; set; } = "";
}
