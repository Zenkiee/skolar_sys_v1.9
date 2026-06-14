using Microsoft.Extensions.Configuration;
using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using System.Security.Cryptography;

namespace inMVC.Services;

public class PayMongoGateway : IPaymentGateway
{
    private readonly IConfiguration _config;
    private readonly HttpClient _client;

    public PayMongoGateway(IConfiguration config, HttpClient client)
    {
        _config = config;
        _client = client;
    }

    private string? SecretKey => _config["PayMongo:SecretKey"];
    private string? PublicKey => _config["PayMongo:PublicKey"];
    private string? WebhookSecret => _config["PayMongo:WebhookSecret"];

    public async Task<GatewayCheckoutResult> CreateCheckoutAsync(decimal amount, string currency, string description, string successUrl, string cancelUrl)
    {
        var amountInCents = (int)Math.Round(amount * 100);
        var requestBody = new
        {
            data = new
            {
                attributes = new
                {
                    line_items = new[]
                    {
                        new
                        {
                            amount = amountInCents,
                            currency = currency,
                            name = description,
                            quantity = 1
                        }
                    },
                    payment_method_types = new[] { "gcash", "card", "paymaya", "grab_pay" },
                    send_email_receipt = false,
                    show_description = true,
                    show_line_items = true,
                    description = description,
                    success_url = successUrl,
                    cancel_url = cancelUrl
                }
            }
        };

        var json = JsonSerializer.Serialize(requestBody);
        var request = new HttpRequestMessage(HttpMethod.Post, "https://api.paymongo.com/v1/checkout_sessions")
        {
            Content = new StringContent(json, Encoding.UTF8, "application/json")
        };

        var base64Key = Convert.ToBase64String(Encoding.UTF8.GetBytes(SecretKey + ":"));
        request.Headers.Authorization = new AuthenticationHeaderValue("Basic", base64Key);

        var response = await _client.SendAsync(request);
        if (!response.IsSuccessStatusCode)
        {
            var err = await response.Content.ReadAsStringAsync();
            throw new InvalidOperationException($"PayMongo API error: {response.StatusCode} - {err}");
        }

        var responseContent = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(responseContent);
        var root = doc.RootElement;
        var dataNode = root.GetProperty("data");
        var id = dataNode.GetProperty("id").GetString() ?? "";
        var checkoutUrl = dataNode.GetProperty("attributes").GetProperty("checkout_url").GetString() ?? "";

        return new GatewayCheckoutResult(id, checkoutUrl);
    }

    public async Task<GatewayRefundResult> CreateRefundAsync(string externalPaymentId, decimal amount, string reason)
    {
        var amountInCents = (int)Math.Round(amount * 100);
        var requestBody = new
        {
            data = new
            {
                attributes = new
                {
                    amount = amountInCents,
                    payment_intent_id = externalPaymentId, // In PayMongo, refund refers to payment_intent_id
                    reason = reason // duplicate, fraudulent, customer_return
                }
            }
        };

        var json = JsonSerializer.Serialize(requestBody);
        var request = new HttpRequestMessage(HttpMethod.Post, "https://api.paymongo.com/v1/refunds")
        {
            Content = new StringContent(json, Encoding.UTF8, "application/json")
        };

        var base64Key = Convert.ToBase64String(Encoding.UTF8.GetBytes(SecretKey + ":"));
        request.Headers.Authorization = new AuthenticationHeaderValue("Basic", base64Key);

        var response = await _client.SendAsync(request);
        if (!response.IsSuccessStatusCode)
        {
            var err = await response.Content.ReadAsStringAsync();
            throw new InvalidOperationException($"PayMongo API Refund error: {response.StatusCode} - {err}");
        }

        var responseContent = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(responseContent);
        var root = doc.RootElement;
        var dataNode = root.GetProperty("data");
        var id = dataNode.GetProperty("id").GetString() ?? "";
        var status = dataNode.GetProperty("attributes").GetProperty("status").GetString() ?? "";

        return new GatewayRefundResult(id, status);
    }

    public Task<bool> VerifyWebhookAsync(string payload, string signature)
    {
        if (string.IsNullOrWhiteSpace(signature) || string.IsNullOrWhiteSpace(WebhookSecret))
        {
            return Task.FromResult(false);
        }

        try
        {
            // PayMongo signature header format: t=<timestamp>,te=<signature>
            var parts = signature.Split(',');
            string timestamp = "";
            string testSig = "";
            string liveSig = "";

            foreach (var part in parts)
            {
                var kv = part.Split('=');
                if (kv.Length == 2)
                {
                    var key = kv[0].Trim();
                    var val = kv[1].Trim();
                    if (key == "t") timestamp = val;
                    else if (key == "te") testSig = val;
                    else if (key == "li") liveSig = val;
                }
            }

            var sigToVerify = !string.IsNullOrEmpty(testSig) ? testSig : liveSig;
            if (string.IsNullOrEmpty(timestamp) || string.IsNullOrEmpty(sigToVerify))
            {
                return Task.FromResult(false);
            }

            // PayMongo signature computes HMAC SHA256 over: timestamp + "." + payload
            var signedPayload = timestamp + "." + payload;
            var keyBytes = Encoding.UTF8.GetBytes(WebhookSecret);
            var payloadBytes = Encoding.UTF8.GetBytes(signedPayload);

            using var hmac = new HMACSHA256(keyBytes);
            var hashBytes = hmac.ComputeHash(payloadBytes);
            var computedSignature = BitConverter.ToString(hashBytes).Replace("-", "").ToLowerInvariant();

            return Task.FromResult(computedSignature == sigToVerify);
        }
        catch
        {
            return Task.FromResult(false);
        }
    }
}
