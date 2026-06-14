namespace inMVC.Services;

public interface IPaymentGateway
{
    Task<GatewayCheckoutResult> CreateCheckoutAsync(decimal amount, string currency, string description);
    Task<GatewayRefundResult> CreateRefundAsync(string externalPaymentId, decimal amount, string reason);
    Task<bool> VerifyWebhookAsync(string payload, string signature);
}

public record GatewayCheckoutResult(string ExternalPaymentId, string CheckoutReference);
public record GatewayRefundResult(string ExternalRefundId, string Status);
