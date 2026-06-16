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
        var host     = _config["Email:SmtpHost"]!;
        var port     = int.Parse(_config["Email:SmtpPort"]!);
        var sender   = _config["Email:SenderEmail"]!;
        var name     = _config["Email:SenderName"]!;
        var password = _config["Email:AppPassword"]!;

        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(name, sender));
        message.To.Add(MailboxAddress.Parse(toEmail));
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

        using var client = new SmtpClient();
        await client.ConnectAsync(host, port, SecureSocketOptions.StartTls);
        await client.AuthenticateAsync(sender, password);
        await client.SendAsync(message);
        await client.DisconnectAsync(true);
    }
}
