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

    public async Task<GatewayCheckoutStatus> RetrieveCheckoutAsync(string externalPaymentId)
    {
        if (string.IsNullOrWhiteSpace(externalPaymentId))
            throw new InvalidOperationException("The checkout session reference is missing.");

        if (string.IsNullOrWhiteSpace(SecretKey))
            throw new InvalidOperationException("The PayMongo secret key is not configured.");

        var request = new HttpRequestMessage(
            HttpMethod.Get,
            $"https://api.paymongo.com/v1/checkout_sessions/{Uri.EscapeDataString(externalPaymentId)}");

        var base64Key = Convert.ToBase64String(Encoding.UTF8.GetBytes(SecretKey + ":"));
        request.Headers.Authorization = new AuthenticationHeaderValue("Basic", base64Key);
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        var response = await _client.SendAsync(request);
        if (!response.IsSuccessStatusCode)
        {
            var error = await response.Content.ReadAsStringAsync();
            throw new InvalidOperationException(
                $"PayMongo checkout verification error: {response.StatusCode} - {error}");
        }

        var responseContent = await response.Content.ReadAsStringAsync();
        using var document = JsonDocument.Parse(responseContent);

        var data = document.RootElement.GetProperty("data");
        var returnedId = data.GetProperty("id").GetString() ?? "";
        if (!string.Equals(returnedId, externalPaymentId, StringComparison.Ordinal))
            throw new InvalidOperationException("PayMongo returned a different checkout session.");

        var attributes = data.GetProperty("attributes");

        if (attributes.TryGetProperty("payments", out var payments) &&
            payments.ValueKind == JsonValueKind.Array)
        {
            foreach (var payment in payments.EnumerateArray())
            {
                if (!payment.TryGetProperty("attributes", out var paymentAttributes))
                    continue;

                var paymentStatus = paymentAttributes.TryGetProperty("status", out var statusNode)
                    ? statusNode.GetString() ?? ""
                    : "";

                if (!string.Equals(paymentStatus, "paid", StringComparison.OrdinalIgnoreCase))
                    continue;

                var paymentMethod = "Payment Provider";
                if (paymentAttributes.TryGetProperty("source", out var source) &&
                    source.ValueKind == JsonValueKind.Object &&
                    source.TryGetProperty("type", out var sourceType))
                {
                    paymentMethod = sourceType.GetString() ?? paymentMethod;
                }

                decimal? amount = null;
                if (paymentAttributes.TryGetProperty("amount", out var amountNode) &&
                    amountNode.TryGetInt64(out var amountInCentavos))
                {
                    amount = amountInCentavos / 100m;
                }

                var paymentId = payment.TryGetProperty("id", out var paymentIdNode)
                    ? paymentIdNode.GetString() ?? ""
                    : "";

                return new GatewayCheckoutStatus("Paid", paymentMethod, amount, paymentId);
            }
        }

        if (attributes.TryGetProperty("payment_intent", out var paymentIntent) &&
            paymentIntent.ValueKind == JsonValueKind.Object &&
            paymentIntent.TryGetProperty("attributes", out var intentAttributes))
        {
            var intentStatus = intentAttributes.TryGetProperty("status", out var intentStatusNode)
                ? intentStatusNode.GetString() ?? ""
                : "";

            if (string.Equals(intentStatus, "succeeded", StringComparison.OrdinalIgnoreCase))
            {
                decimal? amount = null;
                if (intentAttributes.TryGetProperty("amount", out var amountNode) &&
                    amountNode.TryGetInt64(out var amountInCentavos))
                {
                    amount = amountInCentavos / 100m;
                }

                return new GatewayCheckoutStatus("Paid", "Payment Provider", amount, "");
            }
        }

        return new GatewayCheckoutStatus("Pending", "", null, "");
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
