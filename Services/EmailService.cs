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

    public async Task SendOtpEmailAsync(string toEmail, string otp)
    {
        var message = new MimeMessage();
        message.Subject = "Your Skolar Password Reset Code";

        message.Body = new TextPart("html")
        {
            Text = $"""
                <div style="font-family:Inter,sans-serif;max-width:480px;margin:auto;padding:32px;">
                  <h2 style="color:#0d4f6c;">Password Reset Code</h2>
                  <p>Use the code below to reset your Skolar password.
                     It expires in <strong>10 minutes</strong>.</p>
                  <div style="font-size:36px;font-weight:700;letter-spacing:8px;
                              color:#c0392b;margin:24px 0;">{otp}</div>
                  <p style="color:#888;font-size:13px;">
                    If you didn't request this, ignore this email.
                  </p>
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
