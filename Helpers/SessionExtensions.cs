using Microsoft.AspNetCore.Http;

namespace inMVC.Helpers;

public static class SessionExtensions
{
    public static int? GetUserId(this ISession session)
    {
        var raw = session.GetString("userId");
        if (string.IsNullOrEmpty(raw)) return null;
        return int.TryParse(raw, out var id) ? id : null;
    }

    public static string? GetUserRole(this ISession session)
    {
        var role = session.GetString("userRole");
        return string.IsNullOrEmpty(role) ? null : role;
    }

    public static bool IsLoggedIn(this ISession session) => session.GetUserId() != null;

    public static bool HasRole(this ISession session, string role) =>
        string.Equals(session.GetUserRole(), role, StringComparison.OrdinalIgnoreCase);
}