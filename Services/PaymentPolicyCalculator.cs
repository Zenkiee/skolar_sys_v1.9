using System.Globalization;
using inMVC.Models;

namespace inMVC.Services;

public static class PaymentPolicyCalculator
{
    public const decimal MaximumPlatformFeePercentage = 35m;
    public const decimal MinimumPlatformFeePercentage = 15m;

    public static decimal GetPlatformFeePercentage(decimal totalHoursTaught)
    {
        if (totalHoursTaught >= 150m) return 15m;
        if (totalHoursTaught >= 125m) return 20m;
        if (totalHoursTaught >= 100m) return 25m;
        if (totalHoursTaught >= 75m) return 30m;
        return 35m;
    }

    public static decimal CalculatePlatformFee(decimal amount, decimal totalHoursTaught)
    {
        var percentage = GetPlatformFeePercentage(totalHoursTaught);
        return Math.Round(Math.Max(0m, amount) * percentage / 100m, 2);
    }

    public static decimal ParseHourlyRate(string value)
    {
        var numeric = new string((value ?? "").Where(character => char.IsDigit(character) || character == '.').ToArray());
        return decimal.TryParse(numeric, NumberStyles.Number, CultureInfo.InvariantCulture, out var rate)
            ? rate
            : 0m;
    }

    public static decimal GetDurationHours(string timeSlot)
    {
        var parts = (timeSlot ?? "").Split(" - ", StringSplitOptions.TrimEntries);
        if (parts.Length != 2 || !TryParseTime(parts[0], out var start) || !TryParseTime(parts[1], out var end))
            return 0m;

        return Math.Round((decimal)(end - start).TotalHours, 2, MidpointRounding.AwayFromZero);
    }

    public static DateTime GetSessionStart(Booking booking)
    {
        var parts = booking.Time.Split(" - ", StringSplitOptions.TrimEntries);
        if (parts.Length == 0 || !TryParseTime(parts[0], out var start))
            return booking.Date.Date;

        return booking.Date.Date.Add(start.TimeOfDay);
    }

    public static CancellationQuote CalculateLearnerQuote(Booking booking, int priorAdvancedWarnings)
    {
        var hours = (decimal)(GetSessionStart(booking) - PhilippineNow()).TotalHours;
        var percentage = 0m;
        var warning = false;
        var rule = "";

        if (hours >= 72m)
        {
            warning = true;
            var penaltyApplies = priorAdvancedWarnings > 0 && priorAdvancedWarnings % 3 == 0;
            percentage = penaltyApplies ? 50m : 100m;
            rule = penaltyApplies ? "Learner72PlusWarningPenalty" : "Learner72Plus";
        }
        else if (hours >= 48m)
        {
            percentage = 70m;
            rule = "Learner48To72";
        }
        else if (hours >= 24m)
        {
            percentage = 50m;
            rule = "Learner24To48";
        }
        else
        {
            percentage = 50m;
            rule = "LearnerUnder24";
        }

        return BuildQuote(booking, "learner", hours, percentage, warning, 0m, 0m, rule);
    }

    public static CancellationQuote CalculateTutorQuote(Booking booking, bool isRejection = false)
    {
        var hours = (decimal)(GetSessionStart(booking) - PhilippineNow()).TotalHours;
        if (isRejection)
            return BuildQuote(booking, "tutor", hours, 100m, false, 0m, 0m, "TutorRejectedBooking");

        if (hours >= 48m)
            return BuildQuote(booking, "tutor", hours, 100m, false, 0m, 0m, "Tutor48Plus");

        if (hours >= 24m)
            return BuildQuote(booking, "tutor", hours, 100m, true, 0m, 0m, "Tutor24To48");

        return BuildQuote(booking, "tutor", hours, 100m, false, 20m, 20m, "TutorUnder24");
    }

    private static CancellationQuote BuildQuote(
        Booking booking,
        string actor,
        decimal hours,
        decimal refundPercentage,
        bool warning,
        decimal voucherPercentage,
        decimal tutorFinePercentage,
        string rule)
    {
        var sessionAmount = booking.SessionAmount;
        var refund = Math.Round(sessionAmount * refundPercentage / 100m, 2);
        var retained = Math.Max(0m, sessionAmount - refund);
        var compensation = actor == "learner" ? retained : 0m;
        var voucher = Math.Round(sessionAmount * voucherPercentage / 100m, 2);

        return new CancellationQuote(
            booking.Id,
            actor,
            Math.Round(hours, 1),
            sessionAmount,
            refundPercentage,
            refund,
            retained,
            compensation,
            voucherPercentage,
            voucher,
            tutorFinePercentage,
            warning,
            rule);
    }


    private static DateTime PhilippineNow()
    {
        try
        {
            var zone = TimeZoneInfo.FindSystemTimeZoneById("Asia/Manila");
            return TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, zone);
        }
        catch
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

public record CancellationQuote(
    int BookingId,
    string Actor,
    decimal HoursBeforeSession,
    decimal SessionAmount,
    decimal RefundPercentage,
    decimal RefundAmount,
    decimal RetainedAmount,
    decimal TutorCompensationAmount,
    decimal VoucherPercentage,
    decimal VoucherAmount,
    decimal TutorFinePercentage,
    bool WarningIssued,
    string RuleCode);
