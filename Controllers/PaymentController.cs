using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using inMVC.Data;
using inMVC.Helpers;
using inMVC.Models;
using inMVC.Services;
using System.IO;
using System.Net;
using System.Text;
using System.Text.Json;

namespace inMVC.Controllers;

public class PaymentController : Controller
{
    private readonly AppDbContext _context;
    private readonly PaymentService _payments;
    private readonly IPaymentGateway _gateway;
    private readonly ILogger<PaymentController> _logger;

    public PaymentController(
        AppDbContext context,
        PaymentService payments,
        IPaymentGateway gateway,
        ILogger<PaymentController> logger)
    {
        _context = context;
        _payments = payments;
        _gateway = gateway;
        _logger = logger;
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
    public async Task<IActionResult> RetryCheckout(string checkoutReference)
    {
        var userId = HttpContext.Session.GetUserId();
        if (userId == null || !HttpContext.Session.HasRole("learner")) return Unauthorized();

        var transaction = await _context.PaymentTransactions
            .FirstOrDefaultAsync(t => t.CheckoutReference == checkoutReference && t.LearnerId == userId.Value);

        if (transaction == null) return NotFound(new { message = "Payment transaction not found." });

        if (transaction.Status == "Paid")
            return BadRequest(new { message = "This payment has already been processed." });

        return Ok(new { checkoutUrl = transaction.CheckoutReference });
    }

    [HttpGet]
    public IActionResult History()
    {
        if (!HttpContext.Session.HasRole("learner")) return Unauthorized();
        return View();
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> ConfirmCheckoutReturn([FromBody] ConfirmCheckoutRequest? request)
    {
        var userId = HttpContext.Session.GetUserId();
        if (userId == null || !HttpContext.Session.HasRole("learner")) return Unauthorized();

        var bookingGroupId = request?.BookingGroupId?.Trim() ?? "";
        if (string.IsNullOrWhiteSpace(bookingGroupId))
            return BadRequest(new { message = "The booking reference is missing." });

        var transaction = await _context.PaymentTransactions
            .FirstOrDefaultAsync(item =>
                item.BookingGroupId == bookingGroupId &&
                item.LearnerId == userId.Value);

        if (transaction == null)
            return NotFound(new { message = "Payment transaction not found." });

        if (transaction.Status == "Paid")
        {
            return Ok(new
            {
                status = "Paid",
                transactionId = transaction.Id,
                paymentMethod = transaction.PaymentMethod
            });
        }

        var transactionId = transaction.Id;

        try
        {
            var checkout = await _gateway.RetrieveCheckoutAsync(transaction.ExternalPaymentId);

            if (checkout.Status == "Paid")
            {
                if (checkout.Amount.HasValue && checkout.Amount.Value != transaction.Amount)
                {
                    _logger.LogWarning(
                        "PayMongo amount mismatch for transaction {TransactionId}. Expected {ExpectedAmount}, received {ReceivedAmount}.",
                        transaction.Id,
                        transaction.Amount,
                        checkout.Amount.Value);

                    return Conflict(new
                    {
                        status = "AmountMismatch",
                        message = "The payment amount could not be verified. Please contact support."
                    });
                }

                transaction = await _payments.ApplyCheckoutResultAsync(
                    transaction.Id,
                    "success",
                    checkout.PaymentMethod);
            }

            return Ok(new
            {
                status = transaction?.Status ?? checkout.Status,
                transactionId = transaction?.Id,
                paymentMethod = transaction?.PaymentMethod ?? checkout.PaymentMethod
            });
        }
        catch (Exception error)
        {
            _logger.LogError(
                error,
                "Unable to verify PayMongo checkout for transaction {TransactionId}.",
                transactionId);

            return StatusCode(StatusCodes.Status503ServiceUnavailable, new
            {
                status = "VerificationUnavailable",
                message = "Payment verification is temporarily unavailable. Your payment record has not been changed."
            });
        }
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
    public async Task<IActionResult> Receipt(int id)
    {
        var userId = HttpContext.Session.GetUserId();
        if (userId == null || !HttpContext.Session.HasRole("learner")) return Unauthorized();

        var receipt = await GetLearnerReceiptAsync(id, userId.Value);
        if (receipt == null) return NotFound();

        ViewBag.Transaction = receipt.Transaction;
        ViewBag.Bookings = receipt.Bookings;
        ViewBag.Refunds = receipt.Refunds;
        ViewBag.Learner = receipt.Learner;
        return View();
    }

    [HttpGet]
    public async Task<IActionResult> DownloadReceipt(int id)
    {
        var userId = HttpContext.Session.GetUserId();
        if (userId == null || !HttpContext.Session.HasRole("learner")) return Unauthorized();

        var receipt = await GetLearnerReceiptAsync(id, userId.Value);
        if (receipt == null) return NotFound();

        var html = BuildReceiptDownloadHtml(receipt);
        var fileName = $"skolar-receipt-{receipt.Transaction.Id}.html";
        return File(Encoding.UTF8.GetBytes(html), "text/html", fileName);
    }

    private async Task<PaymentReceiptData?> GetLearnerReceiptAsync(int transactionId, int learnerId)
    {
        var transaction = await _context.PaymentTransactions
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.Id == transactionId && item.LearnerId == learnerId);
        if (transaction == null) return null;

        var learner = await _context.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.Id == learnerId);
        if (learner == null) return null;

        var bookings = await _context.Bookings
            .AsNoTracking()
            .Where(item => item.PaymentTransactionId == transaction.Id)
            .OrderBy(item => item.Date)
            .ThenBy(item => item.Time)
            .ToListAsync();

        var refunds = await _context.RefundTransactions
            .AsNoTracking()
            .Where(item => item.PaymentTransactionId == transaction.Id)
            .OrderByDescending(item => item.CreatedAt)
            .ToListAsync();

        return new PaymentReceiptData(transaction, learner, bookings, refunds);
    }

    private static string BuildReceiptDownloadHtml(PaymentReceiptData receipt)
    {
        var transaction = receipt.Transaction;
        var learner = receipt.Learner;
        var bookingRows = receipt.Bookings.Count == 0
            ? "<tr><td colspan=\"5\">No sessions found for this transaction.</td></tr>"
            : string.Join("", receipt.Bookings.Select(booking => $"""
                <tr>
                    <td>{Html(booking.Subject)}</td>
                    <td>{Html(booking.TutorName)}</td>
                    <td>{booking.Date:MMM dd, yyyy}</td>
                    <td>{Html(booking.Time)}</td>
                    <td>{Money(booking.SessionAmount)}</td>
                </tr>
                """));
        var refundRows = receipt.Refunds.Count == 0
            ? "<tr><td colspan=\"4\">No refund requests for this transaction.</td></tr>"
            : string.Join("", receipt.Refunds.Select(refund => $"""
                <tr>
                    <td>{Html(refund.ExternalRefundId)}</td>
                    <td>{Html(refund.Reason)}</td>
                    <td>{Money(refund.Amount)}</td>
                    <td>{Html(refund.Status)}</td>
                </tr>
                """));

        return $$"""
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <title>Skolar Receipt #{{transaction.Id}}</title>
                <style>
                    body { font-family: Arial, sans-serif; color: #173042; margin: 32px; }
                    .receipt { max-width: 860px; margin: 0 auto; }
                    .brand { color: #003f5c; font-size: 28px; font-weight: 800; }
                    .muted { color: #6f7d86; }
                    .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 24px 0; }
                    .summary div { border: 1px solid #dce5e9; border-radius: 10px; padding: 14px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 14px; }
                    th, td { border-bottom: 1px solid #dce5e9; padding: 11px; text-align: left; }
                    th { background: #f4f8fa; color: #003f5c; }
                    h1, h2 { color: #003f5c; }
                </style>
            </head>
            <body>
                <main class="receipt">
                    <div class="brand">Skolar</div>
                    <p class="muted">Official learner receipt</p>
                    <h1>Receipt #{{transaction.Id}}</h1>
                    <p><strong>Learner:</strong> {{Html(learner.Name)}} ({{Html(learner.Email)}})</p>
                    <p><strong>Reference:</strong> {{Html(transaction.CheckoutReference)}}</p>
                    <section class="summary">
                        <div><span class="muted">Status</span><br><strong>{{Html(transaction.Status)}}</strong></div>
                        <div><span class="muted">Payment method</span><br><strong>{{Html(string.IsNullOrWhiteSpace(transaction.PaymentMethod) ? "Payment provider" : transaction.PaymentMethod)}}</strong></div>
                        <div><span class="muted">Amount paid</span><br><strong>{{Money(transaction.Amount)}}</strong></div>
                    </section>
                    <p><strong>Created:</strong> {{transaction.CreatedAt:MMM dd, yyyy h:mm tt}}</p>
                    <p><strong>Paid:</strong> {{(transaction.PaidAt == null ? "Not confirmed" : transaction.PaidAt.Value.ToString("MMM dd, yyyy h:mm tt"))}}</p>
                    <h2>Sessions</h2>
                    <table>
                        <thead><tr><th>Subject</th><th>Tutor</th><th>Date</th><th>Time</th><th>Amount</th></tr></thead>
                        <tbody>{{bookingRows}}</tbody>
                    </table>
                    <h2>Refunds</h2>
                    <table>
                        <thead><tr><th>Reference</th><th>Reason</th><th>Amount</th><th>Status</th></tr></thead>
                        <tbody>{{refundRows}}</tbody>
                    </table>
                    <p class="muted">Generated by Skolar on {{DateTime.Now:MMM dd, yyyy h:mm tt}}.</p>
                </main>
            </body>
            </html>
            """;

        static string Html(string value) => WebUtility.HtmlEncode(value ?? "");
        static string Money(decimal value) => $"PHP {value:N2}";
    }

    private static string NormalizeGcashAccountNumber(string? value)
    {
        var raw = (value ?? "").Trim();
        if (string.IsNullOrWhiteSpace(raw)) return "";

        var normalized = new string(raw
            .Where(character => char.IsDigit(character) || character == '+')
            .ToArray());

        if (normalized.StartsWith("+639") && normalized.Length == 13)
            return normalized;

        if (normalized.StartsWith("639") && normalized.Length == 12)
            return $"+{normalized}";

        if (normalized.StartsWith("9") && normalized.Length == 10)
            return $"+63{normalized}";

        if (normalized.StartsWith("09") && normalized.Length == 11)
            return $"+63{normalized[1..]}";

        return "";
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

        var tutor = await _context.TutorProfiles
            .AsNoTracking()
            .Where(item => item.UserId == userId.Value)
            .Select(item => new
            {
                item.Id,
                item.TotalHoursTaught
            })
            .FirstOrDefaultAsync();
        if (tutor == null) return NotFound(new { message = "Tutor profile not found." });

        var tutorId = tutor.Id;

        var payouts = await _context.TutorPayouts
            .AsNoTracking()
            .Where(item => item.TutorId == tutorId)
            .OrderByDescending(item => item.CreatedAt)
            .ToListAsync();

        var withdrawals = await _context.TutorWithdrawals
            .AsNoTracking()
            .Where(item => item.TutorId == tutorId)
            .OrderByDescending(item => item.RequestedAt)
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
                item.PlatformFeeAmount,
                item.CompensationAmount,
                item.FineAmount,
                item.NetAmount,
                item.Status,
                item.WithdrawalId,
                item.CreatedAt,
                item.ReleasedAt,
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
                platformFeeAmount = payouts.Sum(item => item.PlatformFeeAmount),
                compensationAmount = payouts.Sum(item => item.CompensationAmount),
                fineAmount = payouts.Sum(item => item.FineAmount),
                netAmount = payouts.Sum(item => item.NetAmount),
                heldAmount = payouts.Where(item => item.Status == "Held").Sum(item => item.NetAmount),
                availableAmount = payouts
                    .Where(item => item.Status == "Pending" && item.WithdrawalId == null)
                    .Sum(item => item.NetAmount),
                requestedAmount = payouts
                    .Where(item => item.Status == "WithdrawalRequested" || item.Status == "Processing")
                    .Sum(item => item.NetAmount),
                releasedAmount = payouts
                    .Where(item => item.Status == "Released")
                    .Sum(item => item.NetAmount),
                totalHoursTaught = tutor.TotalHoursTaught,
                platformFeePercentage = PaymentPolicyCalculator.GetPlatformFeePercentage(tutor.TotalHoursTaught),
                minimumPlatformFeePercentage = PaymentPolicyCalculator.MinimumPlatformFeePercentage,
                pendingPenalties = penalties.Count(item => item.Status == "Pending"),
                warnings
            },
            payouts = rows,
            withdrawals = withdrawals.Select(item => new
            {
                item.Id,
                item.Amount,
                item.Method,
                item.GCashAccountName,
                item.GCashAccountNumber,
                item.Status,
                item.RequestedAt,
                item.ProcessedAt,
                item.AdminNote
            }),
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

    [HttpPost]
    public async Task<IActionResult> RequestTutorWithdrawal([FromBody] TutorWithdrawalRequest request)
    {
        var userId = HttpContext.Session.GetUserId();
        if (userId == null || !HttpContext.Session.HasRole("tutor")) return Unauthorized();

        var tutor = await _context.TutorProfiles
            .AsNoTracking()
            .Where(item => item.UserId == userId.Value)
            .Select(item => new
            {
                item.Id,
                item.TotalHoursTaught
            })
            .FirstOrDefaultAsync();
        if (tutor == null) return NotFound(new { message = "Tutor profile not found." });

        var tutorId = tutor.Id;

        var method = request.Method?.Trim() ?? "";
        var accountName = request.GCashAccountName?.Trim() ?? "";
        var accountNumber = NormalizeGcashAccountNumber(request.GCashAccountNumber);

        if (!string.Equals(method, "GCash", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "GCash is the only supported withdrawal method for now." });

        method = "GCash";

        if (accountName.Length is < 2 or > 120 || !accountName.Any(char.IsLetter))
            return BadRequest(new { message = "Enter the GCash account name." });

        if (accountNumber.Length == 0)
            return BadRequest(new { message = "Enter the 10 digits after +63 for the GCash mobile number." });

        var availablePayouts = await _context.TutorPayouts
            .Where(item =>
                item.TutorId == tutorId &&
                item.Status == "Pending" &&
                item.WithdrawalId == null &&
                item.NetAmount > 0m)
            .OrderBy(item => item.CreatedAt)
            .ToListAsync();

        if (availablePayouts.Count == 0)
            return Conflict(new { message = "There are no available earnings to withdraw yet." });

        await using var transaction = await _context.Database.BeginTransactionAsync();

        var withdrawal = new TutorWithdrawal
        {
            TutorId = tutorId,
            Amount = availablePayouts.Sum(item => item.NetAmount),
            Method = method,
            GCashAccountName = accountName,
            GCashAccountNumber = accountNumber,
            Status = "Requested"
        };

        _context.TutorWithdrawals.Add(withdrawal);
        await _context.SaveChangesAsync();

        foreach (var payout in availablePayouts)
        {
            payout.WithdrawalId = withdrawal.Id;
            payout.Status = "WithdrawalRequested";
        }

        await _context.SaveChangesAsync();
        await transaction.CommitAsync();

        return Ok(new
        {
            success = true,
            withdrawalId = withdrawal.Id,
            amount = withdrawal.Amount,
            status = withdrawal.Status,
            message = "Withdrawal request submitted for admin processing."
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
            _logger.LogError(error, "Payment provider refund failed for booking {BookingId}.", request.BookingId);
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new
            {
                message = "Cancellation could not be completed right now. Please try again later or contact support."
            });
        }
    }



    [HttpPost]
    [IgnoreAntiforgeryToken]
    public async Task<IActionResult> PayMongoWebhook()
    {
        using var reader = new StreamReader(Request.Body);
        var payload = await reader.ReadToEndAsync();
        var signature = Request.Headers["Paymongo-Signature"].ToString();

        var verified = await _gateway.VerifyWebhookAsync(payload, signature);
        if (!verified)
        {
            return BadRequest("Signature verification failed.");
        }

        try
        {
            using var doc = JsonDocument.Parse(payload);
            var root = doc.RootElement;
            var dataNode = root.GetProperty("data");
            var attributes = dataNode.GetProperty("attributes");
            var type = attributes.GetProperty("type").GetString();

            if (type == "checkout_session.payment.paid")
            {
                var eventData = attributes.GetProperty("data");
                var checkoutSessionId = eventData.GetProperty("id").GetString() ?? "";
                
                var paymentMethod = "gcash";
                try
                {
                    var payments = eventData.GetProperty("attributes").GetProperty("payments");
                    if (payments.GetArrayLength() > 0)
                    {
                        var firstPayment = payments[0];
                        paymentMethod = firstPayment.GetProperty("attributes").GetProperty("source").GetProperty("type").GetString() ?? "gcash";
                    }
                }
                catch {}

                var transaction = await _context.PaymentTransactions
                    .FirstOrDefaultAsync(t => t.ExternalPaymentId == checkoutSessionId);
                if (transaction != null)
                {
                    await _payments.ApplyCheckoutResultAsync(transaction.Id, "success", paymentMethod);
                }
            }
            else if (type == "checkout_session.payment.failed")
            {
                var eventData = attributes.GetProperty("data");
                var checkoutSessionId = eventData.GetProperty("id").GetString() ?? "";
                
                var transaction = await _context.PaymentTransactions
                    .FirstOrDefaultAsync(t => t.ExternalPaymentId == checkoutSessionId);
                if (transaction != null)
                {
                    await _payments.ApplyCheckoutResultAsync(transaction.Id, "failed", "Payment Provider");
                }
            }

            return Ok();
        }
        catch (Exception ex)
        {
            return BadRequest($"Error processing webhook: {ex.Message}");
        }
    }

    private sealed record PaymentReceiptData(
        PaymentTransaction Transaction,
        User Learner,
        List<Booking> Bookings,
        List<RefundTransaction> Refunds);
}

public class ConfirmCheckoutRequest
{
    public string BookingGroupId { get; set; } = "";
}

public class CancelPaymentSessionRequest
{
    public int BookingId { get; set; }
}

public class TutorWithdrawalRequest
{
    public string Method { get; set; } = "";
    public string GCashAccountName { get; set; } = "";
    public string GCashAccountNumber { get; set; } = "";
}
