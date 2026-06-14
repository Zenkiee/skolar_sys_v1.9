using System.Globalization;
using Microsoft.EntityFrameworkCore;
using inMVC.Data;
using inMVC.Models;

namespace inMVC.Helpers;

public static class SessionCompletionHelper
{
    public static async Task<int> ApplyAutomaticCompletionsAsync(AppDbContext context)
    {
        var cutoff = DateTime.UtcNow.AddHours(-24);
        var sessions = await context.Bookings
            .Where(booking =>
                booking.Status == "Confirmed" &&
                booking.TutorMarkedDoneAt != null &&
                booking.TutorMarkedDoneAt <= cutoff &&
                booking.LearnerConfirmedDoneAt == null &&
                booking.CompletionIssueReportedAt == null)
            .ToListAsync();

        foreach (var session in sessions)
        {
            session.LearnerConfirmedDoneAt = session.TutorMarkedDoneAt!.Value.AddHours(24);
            session.Status = "Completed";
        }

        if (sessions.Count > 0)
        {
            await context.SaveChangesAsync();
            foreach (var session in sessions)
                await TutorPayoutHelper.EnsurePayoutAsync(context, session);
        }

        return sessions.Count;
    }

    public static bool HasSessionEnded(Booking booking)
    {
        var parts = booking.Time.Split(" - ", StringSplitOptions.TrimEntries);
        if (parts.Length != 2 || !TryParseTime(parts[1], out var endTime))
            return booking.Date.Date < PhilippineNow().Date;

        var sessionEnd = booking.Date.Date.Add(endTime.TimeOfDay);
        return PhilippineNow() >= sessionEnd;
    }

    private static DateTime PhilippineNow()
    {
        try
        {
            var zone = TimeZoneInfo.FindSystemTimeZoneById("Asia/Manila");
            return TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, zone);
        }
        catch (TimeZoneNotFoundException)
        {
            return DateTime.UtcNow.AddHours(8);
        }
        catch (InvalidTimeZoneException)
        {
            return DateTime.UtcNow.AddHours(8);
        }
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
