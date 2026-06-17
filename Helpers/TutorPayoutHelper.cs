using Microsoft.EntityFrameworkCore;
using inMVC.Data;
using inMVC.Models;
using inMVC.Services;

namespace inMVC.Helpers;

public static class TutorPayoutHelper
{
    public static async Task<TutorPayout?> EnsurePayoutAsync(AppDbContext context, Booking booking)
    {
        if (booking.Status != "Completed" || booking.SessionAmount <= 0m)
            return null;

        var existing = await context.TutorPayouts
            .FirstOrDefaultAsync(item => item.BookingId == booking.Id);
        if (existing != null && existing.Status != "Held") return existing;

        var tutor = await context.TutorProfiles
            .FirstOrDefaultAsync(item => item.Id == booking.TutorId);
        if (tutor == null) return null;

        var penalty = await context.TutorPenalties
            .Where(item => item.TutorId == booking.TutorId && item.Status == "Pending")
            .OrderBy(item => item.CreatedAt)
            .FirstOrDefaultAsync();

        var fineAmount = penalty == null
            ? 0m
            : Math.Round(booking.SessionAmount * penalty.Percentage / 100m, 2);

        if (penalty != null)
        {
            penalty.AppliedAmount = fineAmount;
            penalty.AppliedBookingId = booking.Id;
            penalty.AppliedAt = DateTime.UtcNow;
            penalty.Status = "Applied";
        }

        var completedHours = booking.DurationHours > 0m
            ? booking.DurationHours
            : PaymentPolicyCalculator.GetDurationHours(booking.Time);
        var hoursAfterSession = Math.Max(0m, tutor.TotalHoursTaught + completedHours);
        var platformFee = PaymentPolicyCalculator.CalculatePlatformFee(booking.SessionAmount, hoursAfterSession);
        var netAmount = Math.Max(0m, booking.SessionAmount - platformFee - fineAmount);

        var payout = existing ?? new TutorPayout
        {
            TutorId = booking.TutorId,
            BookingId = booking.Id,
        };

        payout.GrossAmount = booking.SessionAmount;
        payout.PlatformFeeAmount = platformFee;
        payout.CompensationAmount = 0m;
        payout.FineAmount = fineAmount;
        payout.NetAmount = netAmount;
        payout.Status = "Pending";

        tutor.TotalHoursTaught = hoursAfterSession;

        if (existing == null)
            context.TutorPayouts.Add(payout);

        await context.SaveChangesAsync();
        return payout;
    }
}
