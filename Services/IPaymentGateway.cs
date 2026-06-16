namespace inMVC.Services;

public interface IPaymentGateway
{
    Task<GatewayCheckoutResult> CreateCheckoutAsync(decimal amount, string currency, string description, string successUrl, string cancelUrl);
    Task<GatewayCheckoutStatus> RetrieveCheckoutAsync(string externalPaymentId);
    Task<GatewayRefundResult> CreateRefundAsync(string externalPaymentId, decimal amount, string reason);
    Task<bool> VerifyWebhookAsync(string payload, string signature);
}

public record GatewayCheckoutResult(string ExternalPaymentId, string CheckoutReference);
public record GatewayCheckoutStatus(string Status, string PaymentMethod, decimal? Amount, string PaymentId);
public record GatewayRefundResult(string ExternalRefundId, string Status);
