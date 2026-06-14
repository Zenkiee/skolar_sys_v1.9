using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using inMVC.Data;
using inMVC.Helpers;
using inMVC.Services;

namespace inMVC.Controllers;

public class PaymentController : Controller
{
    private readonly AppDbContext _context;
    private readonly PaymentService _payments;

    public PaymentController(AppDbContext context, PaymentService payments)
    {
        _context = context;
        _payments = payments;
    }

    [HttpGet]
    public async Task<IActionResult> Result(int id)
    {
        var userId = HttpContext.Session.GetUserId();
        if (userId == null || !HttpContext.Session.HasRole("learner")) return Unauthorized();

        var transaction = await _context.PaymentTransactions
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.Id == id && item.LearnerId == userId.Value);
        if (transaction == null) return NotFound();

        var bookings = await _context.Bookings
            .AsNoTracking()
            .Where(item => item.PaymentTransactionId == id)
            .OrderBy(item => item.Date)
            .ToListAsync();

        ViewBag.Transaction = transaction;
        ViewBag.Bookings = bookings;
        return View();
    }

    [HttpGet]
    public IActionResult History()
    {
        if (!HttpContext.Session.HasRole("learner")) return Unauthorized();
        return View();
    }

    [HttpGet]
    public async Task<IActionResult> MyTransactions()
    {
        var userId = HttpContext.Session.GetUserId();
        if (userId == null || !HttpContext.Session.HasRole("learner")) return Unauthorized();

        var paymentRows = await _context.PaymentTransactions
            .AsNoTracking()
            .Where(item => item.LearnerId == userId.Value)
            .OrderByDescending(item => item.CreatedAt)
            .ToListAsync();

        var paymentIds = paymentRows.Select(item => item.Id).ToList();
        var bookings = await _context.Bookings
            .AsNoTracking()
            .Where(item => item.PaymentTransactionId != null && paymentIds.Contains(item.PaymentTransactionId.Value))
            .OrderBy(item => item.Date)
            .ToListAsync();

        var refunds = await _context.RefundTransactions
            .AsNoTracking()
            .Where(item => paymentIds.Contains(item.PaymentTransactionId))
            .OrderByDescending(item => item.CreatedAt)
            .ToListAsync();

        var transactions = paymentRows.Select(item => new
        {
            item.Id,
            item.CheckoutReference,
            item.PaymentMethod,
            item.Amount,
            item.Currency,
            item.Status,
            item.CreatedAt,
            item.PaidAt,
            Sessions = bookings
                .Where(booking => booking.PaymentTransactionId == item.Id)
                .Select(booking => new
                {
                    booking.Id,
                    booking.TutorName,
                    booking.Subject,
                    booking.Date,
                    booking.Time,
                    booking.Status,
                    booking.PaymentStatus,
                    booking.SessionAmount
                })
                .ToList(),
            Refunds = refunds
                .Where(refund => refund.PaymentTransactionId == item.Id)
                .Select(refund => new
                {
                    refund.Id,
                    refund.BookingId,
                    refund.ExternalRefundId,
                    refund.Amount,
                    refund.Status,
                    refund.Reason,
                    refund.CreatedAt
                })
                .ToList()
        }).ToList();

        var vouchers = await _context.DiscountVouchers
            .AsNoTracking()
            .Where(item => item.LearnerId == userId.Value)
            .OrderByDescending(item => item.CreatedAt)
            .Select(item => new
            {
                item.Code,
                item.Percentage,
                item.MaximumAmount,
                item.Status,
                item.ExpiresAt
            })
            .ToListAsync();

        return Json(new { transactions, vouchers });
    }

    [HttpGet]
    public IActionResult TutorFinance()
    {
        if (!HttpContext.Session.HasRole("tutor")) return Unauthorized();
        return View();
    }

    [HttpGet]
    public async Task<IActionResult> TutorFinanceData()
    {
        var userId = HttpContext.Session.GetUserId();
        if (userId == null || !HttpContext.Session.HasRole("tutor")) return Unauthorized();

        var tutorId = await _context.TutorProfiles
            .Where(item => item.UserId == userId.Value)
            .Select(item => item.Id)
            .FirstOrDefaultAsync();
        if (tutorId <= 0) return NotFound(new { message = "Tutor profile not found." });

        var payouts = await _context.TutorPayouts
            .AsNoTracking()
            .Where(item => item.TutorId == tutorId)
            .OrderByDescending(item => item.CreatedAt)
            .ToListAsync();

        var bookingIds = payouts.Select(item => item.BookingId).Distinct().ToList();
        var bookings = await _context.Bookings
            .AsNoTracking()
            .Where(item => bookingIds.Contains(item.Id))
            .Select(item => new { item.Id, item.LearnerName, item.Subject, item.Date, item.Time })
            .ToListAsync();

        var penalties = await _context.TutorPenalties
            .AsNoTracking()
            .Where(item => item.TutorId == tutorId)
            .OrderByDescending(item => item.CreatedAt)
            .ToListAsync();

        var warnings = await _context.CancellationRecords
            .AsNoTracking()
            .CountAsync(item => item.TutorId == tutorId && item.RequestedByRole == "tutor" && item.WarningIssued);

        var rows = payouts.Select(item =>
        {
            var booking = bookings.FirstOrDefault(value => value.Id == item.BookingId);
            return new
            {
                item.Id,
                item.BookingId,
                item.GrossAmount,
                item.CompensationAmount,
                item.FineAmount,
                item.NetAmount,
                item.Status,
                item.CreatedAt,
                LearnerName = booking?.LearnerName ?? "Learner",
                Subject = booking?.Subject ?? "Session",
                Date = booking?.Date,
                Time = booking?.Time ?? ""
            };
        }).ToList();

        return Json(new
        {
            summary = new
            {
                grossAmount = payouts.Sum(item => item.GrossAmount),
                compensationAmount = payouts.Sum(item => item.CompensationAmount),
                fineAmount = payouts.Sum(item => item.FineAmount),
                netAmount = payouts.Sum(item => item.NetAmount),
                pendingPenalties = penalties.Count(item => item.Status == "Pending"),
                warnings
            },
            payouts = rows,
            penalties = penalties.Select(item => new
            {
                item.Id,
                item.SourceBookingId,
                item.Percentage,
                item.AppliedAmount,
                item.AppliedBookingId,
                item.Status,
                item.CreatedAt,
                item.AppliedAt
            })
        });
    }

    [HttpGet]
    public async Task<IActionResult> CancellationPreview(int bookingId)
    {
        var userId = HttpContext.Session.GetUserId();
        var role = HttpContext.Session.GetUserRole()?.ToLowerInvariant();
        if (userId == null || (role != "learner" && role != "tutor")) return Unauthorized();

        var booking = await _context.Bookings.FindAsync(bookingId);
        if (booking == null) return NotFound(new { message = "Session not found." });

        if (role == "learner" && booking.LearnerId != userId.Value) return Forbid();
        if (role == "tutor")
        {
            var tutorId = await _context.TutorProfiles
                .Where(item => item.UserId == userId.Value)
                .Select(item => item.Id)
                .FirstOrDefaultAsync();
            if (booking.TutorId != tutorId) return Forbid();
        }

        if (booking.PaymentStatus != "Paid")
        {
            var sessionStart = PaymentPolicyCalculator.GetSessionStart(booking);
            var hoursBeforeSession = Math.Max(0m, (decimal)(sessionStart - DateTime.Now).TotalHours);

            return Json(new
            {
                booking.Id,
                booking.TutorName,
                booking.LearnerName,
                booking.Subject,
                booking.Date,
                booking.Time,
                HoursBeforeSession = hoursBeforeSession,
                SessionAmount = booking.SessionAmount,
                RefundPercentage = 0m,
                RefundAmount = 0m,
                RetainedAmount = 0m,
                TutorCompensationAmount = 0m,
                VoucherPercentage = 0m,
                VoucherAmount = 0m,
                TutorFinePercentage = 0m,
                WarningIssued = false,
                RuleCode = "PAYMENT_NOT_PROCESSED",
                PaymentRequired = false
            });
        }

        var quote = await _payments.GetCancellationQuoteAsync(bookingId, role);
        if (quote == null)
            return BadRequest(new { message = "This paid session can no longer be cancelled automatically." });

        return Json(new
        {
            booking.Id,
            booking.TutorName,
            booking.LearnerName,
            booking.Subject,
            booking.Date,
            booking.Time,
            quote.HoursBeforeSession,
            quote.SessionAmount,
            quote.RefundPercentage,
            quote.RefundAmount,
            quote.RetainedAmount,
            quote.TutorCompensationAmount,
            quote.VoucherPercentage,
            quote.VoucherAmount,
            quote.TutorFinePercentage,
            quote.WarningIssued,
            quote.RuleCode,
            PaymentRequired = true
        });
    }

    [HttpPost]
    public async Task<IActionResult> CancelSession([FromBody] CancelPaymentSessionRequest request)
    {
        var userId = HttpContext.Session.GetUserId();
        var role = HttpContext.Session.GetUserRole()?.ToLowerInvariant();
        if (userId == null || (role != "learner" && role != "tutor")) return Unauthorized();

        var booking = await _context.Bookings.FindAsync(request.BookingId);
        if (booking == null) return NotFound(new { message = "Session not found." });

        if (role == "learner" && booking.LearnerId != userId.Value) return Forbid();
        if (role == "tutor")
        {
            var tutorId = await _context.TutorProfiles
                .Where(item => item.UserId == userId.Value)
                .Select(item => item.Id)
                .FirstOrDefaultAsync();
            if (booking.TutorId != tutorId) return Forbid();
        }

        if (booking.Status != "Pending" && booking.Status != "Confirmed")
            return Conflict(new { message = "Only active sessions can be cancelled." });

        if (booking.PaymentStatus != "Paid")
        {
            booking.Status = "Cancelled";
            booking.CancelledAt = DateTime.UtcNow;
            booking.CancelledByRole = role;
            booking.PaymentStatus = "NotProcessed";
            await _context.SaveChangesAsync();

            return Ok(new
            {
                success = true,
                refundStatus = "NotRequired",
                amount = 0m,
                message = "Session cancelled. No refund was required because payment has not been processed."
            });
        }

        try
        {
            var refund = await _payments.CancelBookingAsync(request.BookingId, role);
            if (refund == null)
                return BadRequest(new { message = "The cancellation could not be processed." });

            return Ok(new
            {
                success = true,
                refundId = refund.Id,
                refundStatus = refund.Status,
                amount = refund.Amount,
                message = "Cancellation recorded and refund request submitted to the payment provider."
            });
        }
        catch (InvalidOperationException error)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new { message = error.Message });
        }
    }


}

public class CancelPaymentSessionRequest
{
    public int BookingId { get; set; }
}
