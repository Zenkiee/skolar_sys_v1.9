using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;

namespace inMVC.Services;

public class EmailService
{
    private readonly IConfiguration _config;

    public EmailService(IConfiguration config)
    {
        _config = config;
    }

    public Task SendOtpEmailAsync(string toEmail, string otp)
    {
        return SendVerificationCodeEmailAsync(
            toEmail,
            otp,
            "Your Skolar Password Reset Code",
            "Password Reset Code",
            "Use the code below to reset your Skolar password.",
            "If you didn't request a password reset, ignore this email.");
    }

    public Task SendLoginOtpEmailAsync(
        string toEmail,
        string otp,
        string role)
    {
        var accountLabel = role.Equals(
            "admin",
            StringComparison.OrdinalIgnoreCase)
            ? "administrator"
            : role.ToLowerInvariant();

        return SendVerificationCodeEmailAsync(
            toEmail,
            otp,
            "Your Skolar Login Verification Code",
            "Login Verification Code",
            $"Use the code below to finish signing in to your Skolar {accountLabel} account.",
            "If you didn't try to log in, change your password and ignore this email.");
    }

    public Task SendSignupOtpEmailAsync(
        string toEmail,
        string otp)
    {
        return SendVerificationCodeEmailAsync(
            toEmail,
            otp,
            "Verify Your Skolar Email Address",
            "Email Verification Code",
            "Use the code below to verify your email and finish creating your Skolar account.",
            "No account will be created unless this code is verified.");
    }

    private async Task SendVerificationCodeEmailAsync(
        string toEmail,
        string otp,
        string subject,
        string heading,
        string instruction,
        string footer)
    {
        var safeHeading = System.Net.WebUtility.HtmlEncode(heading);
        var safeInstruction = System.Net.WebUtility.HtmlEncode(instruction);
        var safeFooter = System.Net.WebUtility.HtmlEncode(footer);
        var safeOtp = System.Net.WebUtility.HtmlEncode(otp);

        var message = new MimeMessage();
        message.Subject = subject;
        message.Body = new TextPart("html")
        {
            Text = $"""
                <div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:auto;padding:32px;color:#0d2f3f;">
                  <h2 style="color:#0d4f6c;">{safeHeading}</h2>
                  <p>{safeInstruction}</p>
                  <p>This code expires in <strong>10 minutes</strong>.</p>
                  <div style="font-size:36px;font-weight:700;letter-spacing:8px;color:#8b0000;margin:24px 0;">{safeOtp}</div>
                  <p style="color:#777;font-size:13px;">{safeFooter}</p>
                </div>
            """
        };

        await SendEmailAsync(toEmail, message);
    }

    public async Task SendTutorApprovalEmailAsync(string toEmail, string tutorName)
    {
        var rawFirstName = string.IsNullOrWhiteSpace(tutorName)
            ? "Tutor"
            : tutorName.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries)[0];
        var firstName = System.Net.WebUtility.HtmlEncode(rawFirstName);

        var message = new MimeMessage();
        message.Subject = "Your Skolar tutor profile has been approved";

        message.Body = new TextPart("html")
        {
            Text = $"""
                <div style="font-family:Inter,sans-serif;max-width:520px;margin:auto;padding:32px;color:#0d2f3f;">
                  <h2 style="color:#0d4f6c;margin-bottom:12px;">Your tutor profile is approved</h2>
                  <p>Hi {firstName},</p>
                  <p>Your Skolar tutor identity verification has been approved.</p>
                  <p>Your profile can now appear to learners, and they can view your availability when booking lessons.</p>
                  <p style="margin-top:28px;">Thank you for being part of Skolar.</p>
                </div>
            """
        };

        await SendEmailAsync(toEmail, message);
    }

    public async Task SendTutorRejectionEmailAsync(
        string toEmail,
        string tutorName,
        string rejectionNote)
    {
        var rawFirstName = string.IsNullOrWhiteSpace(tutorName)
            ? "Tutor"
            : tutorName.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries)[0];
        var firstName = System.Net.WebUtility.HtmlEncode(rawFirstName);
        var reason = System.Net.WebUtility.HtmlEncode(
            string.IsNullOrWhiteSpace(rejectionNote)
                ? "Please review and resubmit your identity details."
                : rejectionNote.Trim());

        var message = new MimeMessage();
        message.Subject = "Your Skolar tutor verification needs resubmission";

        message.Body = new TextPart("html")
        {
            Text = $"""
                <div style="font-family:Inter,sans-serif;max-width:520px;margin:auto;padding:32px;color:#0d2f3f;">
                  <h2 style="color:#0d4f6c;margin-bottom:12px;">Please resubmit your verification</h2>
                  <p>Hi {firstName},</p>
                  <p>Your Skolar tutor identity verification needs a few updates before your profile can be shown to learners.</p>
                  <p><strong>Reason:</strong> {reason}</p>
                  <p>Please visit the Skolar website and resubmit your identity verification details.</p>
                  <p style="margin-top:28px;">Thank you for helping us keep tutor profiles complete.</p>
                </div>
            """
        };

        await SendEmailAsync(toEmail, message);
    }

    private async Task SendEmailAsync(string toEmail, MimeMessage message)
    {
        var host = _config["Email:SmtpHost"]!;
        var port = int.Parse(_config["Email:SmtpPort"]!);
        var sender = _config["Email:SenderEmail"]!;
        var name = _config["Email:SenderName"]!;
        var password = _config["Email:AppPassword"]!;

        message.From.Add(new MailboxAddress(name, sender));
        message.To.Add(MailboxAddress.Parse(toEmail));

        using var client = new SmtpClient();
        await client.ConnectAsync(host, port, SecureSocketOptions.StartTls);
        await client.AuthenticateAsync(sender, password);
        await client.SendAsync(message);
        await client.DisconnectAsync(true);
    }
}
