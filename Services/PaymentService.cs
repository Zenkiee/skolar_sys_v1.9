using Microsoft.EntityFrameworkCore;
using inMVC.Data;
using inMVC.Models;

namespace inMVC.Services;

public class PaymentService
{
    private readonly AppDbContext _context;
    private readonly IPaymentGateway _gateway;

    public PaymentService(AppDbContext context, IPaymentGateway gateway)
    {
        _context = context;
        _gateway = gateway;
    }

    public async Task<PaymentTransaction> CreateCheckoutAsync(
        int learnerId,
        string bookingGroupId,
        decimal amount,
        string description)
    {
        var gatewayResult = await _gateway.CreateCheckoutAsync(amount, "PHP", description);
        var transaction = new PaymentTransaction
        {
            LearnerId = learnerId,
            BookingGroupId = bookingGroupId,
            ExternalPaymentId = gatewayResult.ExternalPaymentId,
            CheckoutReference = gatewayResult.CheckoutReference,
            Amount = amount,
            Status = "Pending"
        };

        _context.PaymentTransactions.Add(transaction);
        await _context.SaveChangesAsync();
        return transaction;
    }

    public async Task<PaymentTransaction?> ApplyCheckoutResultAsync(int transactionId, string result, string paymentMethod)
    {
        var transaction = await _context.PaymentTransactions.FindAsync(transactionId);
        if (transaction == null) return null;

        var normalized = result.Trim().ToLowerInvariant();
        var status = normalized switch
        {
            "success" => "Paid",
            "pending" => "Pending",
            "failed" => "Failed",
            "cancelled" => "Cancelled",
            _ => "Pending"
        };

        var eventId = $"evt_{transaction.ExternalPaymentId}_{status.ToLowerInvariant()}";
        var alreadyProcessed = await _context.PaymentWebhookEvents
            .AnyAsync(item => item.ExternalEventId == eventId);
        if (alreadyProcessed) return transaction;

        _context.PaymentWebhookEvents.Add(new PaymentWebhookEvent
        {
            ExternalEventId = eventId,
            EventType = $"payment.{status.ToLowerInvariant()}",
            Payload = $"{{\"transactionId\":{transaction.Id},\"status\":\"{status}\"}}"
        });

        transaction.Status = status;
        transaction.PaymentMethod = string.IsNullOrWhiteSpace(paymentMethod) ? "Payment Provider" : paymentMethod.Trim();
        transaction.UpdatedAt = DateTime.UtcNow;
        if (status == "Paid") transaction.PaidAt = DateTime.UtcNow;

        var bookings = await _context.Bookings
            .Where(item => item.PaymentTransactionId == transaction.Id)
            .ToListAsync();

        foreach (var booking in bookings)
        {
            booking.PaymentStatus = status;
            booking.Status = status switch
            {
                "Paid" => "Pending",
                "Failed" => "PaymentFailed",
                "Cancelled" => "PaymentCancelled",
                _ => "AwaitingPayment"
            };
        }

        await _context.SaveChangesAsync();
        return transaction;
    }

    public async Task<CancellationQuote?> GetCancellationQuoteAsync(int bookingId, string actor)
    {
        var booking = await _context.Bookings.FindAsync(bookingId);
        if (booking == null || booking.PaymentStatus != "Paid") return null;

        CancellationQuote quote;
        if (actor == "learner")
        {
            var priorAdvancedWarnings = await _context.CancellationRecords.CountAsync(item =>
                item.LearnerId == booking.LearnerId &&
                item.RequestedByRole == "learner" &&
                item.HoursBeforeSession >= 72m &&
                item.WarningIssued);

            quote = PaymentPolicyCalculator.CalculateLearnerQuote(booking, priorAdvancedWarnings);
        }
        else
        {
            quote = PaymentPolicyCalculator.CalculateTutorQuote(booking);
        }

        return quote.HoursBeforeSession > 0m ? quote : null;
    }

    public async Task<RefundTransaction?> CancelBookingAsync(int bookingId, string actor, bool isRejection = false)
    {
        var booking = await _context.Bookings.FindAsync(bookingId);
        if (booking == null || booking.PaymentTransactionId == null || booking.PaymentStatus != "Paid") return null;
        if (booking.Status == "Cancelled" || booking.Status == "Rejected") return null;

        var existingRefund = await _context.RefundTransactions.AnyAsync(item =>
            item.BookingId == booking.Id && item.Status != "Failed");
        if (existingRefund) return null;

        CancellationQuote quote;
        if (actor == "learner")
        {
            var priorWarnings = await _context.CancellationRecords.CountAsync(item =>
                item.LearnerId == booking.LearnerId &&
                item.RequestedByRole == "learner" &&
                item.HoursBeforeSession >= 72m &&
                item.WarningIssued);
            quote = PaymentPolicyCalculator.CalculateLearnerQuote(booking, priorWarnings);
        }
        else
        {
            quote = PaymentPolicyCalculator.CalculateTutorQuote(booking, isRejection);
        }

        if (!isRejection && quote.HoursBeforeSession <= 0m) return null;

        var payment = await _context.PaymentTransactions.FindAsync(booking.PaymentTransactionId.Value);
        if (payment == null) return null;

        var gatewayRefund = await _gateway.CreateRefundAsync(
            payment.ExternalPaymentId,
            quote.RefundAmount,
            quote.RuleCode);

        var cancellation = new CancellationRecord
        {
            BookingId = booking.Id,
            LearnerId = booking.LearnerId,
            TutorId = booking.TutorId,
            RequestedByRole = actor,
            HoursBeforeSession = quote.HoursBeforeSession,
            RefundPercentage = quote.RefundPercentage,
            RefundAmount = quote.RefundAmount,
            RetainedAmount = quote.RetainedAmount,
            TutorCompensationAmount = quote.TutorCompensationAmount,
            LearnerVoucherPercentage = quote.VoucherPercentage,
            LearnerVoucherAmount = quote.VoucherAmount,
            TutorFinePercentage = quote.TutorFinePercentage,
            WarningIssued = quote.WarningIssued,
            RuleCode = quote.RuleCode
        };

        var refund = new RefundTransaction
        {
            PaymentTransactionId = payment.Id,
            BookingId = booking.Id,
            ExternalRefundId = gatewayRefund.ExternalRefundId,
            Amount = quote.RefundAmount,
            Status = gatewayRefund.Status,
            Reason = quote.RuleCode,
            RequestedByRole = actor
        };

        _context.CancellationRecords.Add(cancellation);
        _context.RefundTransactions.Add(refund);

        if (quote.VoucherPercentage > 0m)
        {
            _context.DiscountVouchers.Add(new DiscountVoucher
            {
                LearnerId = booking.LearnerId,
                SourceBookingId = booking.Id,
                Code = $"SKOLAR20-{Guid.NewGuid().ToString("N")[..8].ToUpperInvariant()}",
                Percentage = quote.VoucherPercentage,
                MaximumAmount = quote.VoucherAmount
            });
        }

        if (quote.TutorFinePercentage > 0m)
        {
            _context.TutorPenalties.Add(new TutorPenalty
            {
                TutorId = booking.TutorId,
                SourceBookingId = booking.Id,
                Percentage = quote.TutorFinePercentage
            });
        }

        if (quote.TutorCompensationAmount > 0m)
        {
            var hasCompensation = await _context.TutorPayouts.AnyAsync(item => item.BookingId == booking.Id);
            if (!hasCompensation)
            {
                _context.TutorPayouts.Add(new TutorPayout
                {
                    TutorId = booking.TutorId,
                    BookingId = booking.Id,
                    GrossAmount = 0m,
                    PlatformFeeAmount = 0m,
                    CompensationAmount = quote.TutorCompensationAmount,
                    FineAmount = 0m,
                    NetAmount = quote.TutorCompensationAmount,
                    Status = "Pending"
                });
            }
        }

        booking.Status = isRejection ? "Rejected" : "Cancelled";
        booking.CancelledAt = DateTime.UtcNow;
        booking.CancelledByRole = actor;
        booking.PaymentStatus = "RefundProcessing";

        var existingRefundAmounts = await _context.RefundTransactions
            .Where(item => item.PaymentTransactionId == payment.Id && item.Status != "Failed")
            .Select(item => item.Amount)
            .ToListAsync();
        var requestedRefundTotal = existingRefundAmounts.Sum() + quote.RefundAmount;
        payment.Status = requestedRefundTotal >= payment.Amount ? "RefundProcessing" : "PartiallyRefunding";
        payment.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return refund;
    }

    public async Task<List<RefundTransaction>> RejectBookingGroupAsync(string bookingGroupId, int tutorId)
    {
        var bookings = await _context.Bookings
            .Where(item => item.BookingGroupId == bookingGroupId && item.TutorId == tutorId)
            .OrderBy(item => item.Date)
            .ToListAsync();

        var refunds = new List<RefundTransaction>();
        foreach (var booking in bookings)
        {
            var refund = await CancelBookingAsync(booking.Id, "tutor", true);
            if (refund != null) refunds.Add(refund);
        }

        return refunds;
    }

    public async Task<RefundTransaction?> ApplyRefundResultAsync(int refundId, string result)
    {
        var refund = await _context.RefundTransactions.FindAsync(refundId);
        if (refund == null) return null;

        var status = result.Trim().ToLowerInvariant() == "success" ? "Refunded" : "Failed";
        var eventId = $"evt_{refund.ExternalRefundId}_{status.ToLowerInvariant()}";
        var alreadyProcessed = await _context.PaymentWebhookEvents.AnyAsync(item => item.ExternalEventId == eventId);
        if (alreadyProcessed) return refund;

        _context.PaymentWebhookEvents.Add(new PaymentWebhookEvent
        {
            ExternalEventId = eventId,
            EventType = $"refund.{status.ToLowerInvariant()}",
            Payload = $"{{\"refundId\":{refund.Id},\"status\":\"{status}\"}}"
        });

        refund.Status = status;
        refund.UpdatedAt = DateTime.UtcNow;
        if (status == "Refunded") refund.CompletedAt = DateTime.UtcNow;

        var booking = await _context.Bookings.FindAsync(refund.BookingId);
        var payment = await _context.PaymentTransactions.FindAsync(refund.PaymentTransactionId);
        if (booking != null)
            booking.PaymentStatus = status == "Refunded" ? "Refunded" : "RefundFailed";

        if (payment != null)
        {
            var refundedAmounts = await _context.RefundTransactions
                .Where(item => item.PaymentTransactionId == payment.Id && item.Status == "Refunded" && item.Id != refund.Id)
                .Select(item => item.Amount)
                .ToListAsync();
            var refundedTotal = refundedAmounts.Sum();

            if (status == "Refunded") refundedTotal += refund.Amount;
            payment.Status = status == "Failed"
                ? refundedTotal > 0m ? "PartiallyRefunded" : "Paid"
                : refundedTotal >= payment.Amount ? "Refunded" : "PartiallyRefunded";
            payment.UpdatedAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();
        return refund;
    }
}
