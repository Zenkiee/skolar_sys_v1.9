using Microsoft.EntityFrameworkCore;
using inMVC.Data;
using inMVC.Models;

namespace inMVC.Helpers;

public static class TutorPayoutHelper
{
    public static async Task<TutorPayout?> EnsurePayoutAsync(AppDbContext context, Booking booking)
    {
        if (booking.Status != "Completed" || booking.SessionAmount <= 0m)
            return null;

        var existing = await context.TutorPayouts
            .FirstOrDefaultAsync(item => item.BookingId == booking.Id);
        if (existing != null) return existing;

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

        var payout = new TutorPayout
        {
            TutorId = booking.TutorId,
            BookingId = booking.Id,
            GrossAmount = booking.SessionAmount,
            PlatformFeeAmount = 0m,
            CompensationAmount = 0m,
            FineAmount = fineAmount,
            NetAmount = Math.Max(0m, booking.SessionAmount - fineAmount),
            Status = "Pending"
        };

        context.TutorPayouts.Add(payout);
        await context.SaveChangesAsync();
        return payout;
    }
}
