namespace inMVC.Services;

public class PaymentGatewayPlaceholder : IPaymentGateway
{
    private static InvalidOperationException NotConfigured()
    {
        return new InvalidOperationException("The payment API has not been configured yet.");
    }

    public Task<GatewayCheckoutResult> CreateCheckoutAsync(decimal amount, string currency, string description, string successUrl, string cancelUrl)
    {
        return Task.FromException<GatewayCheckoutResult>(NotConfigured());
    }

    public Task<GatewayRefundResult> CreateRefundAsync(string externalPaymentId, decimal amount, string reason)
    {
        return Task.FromException<GatewayRefundResult>(NotConfigured());
    }

    public Task<bool> VerifyWebhookAsync(string payload, string signature)
    {
        return Task.FromResult(false);
    }
}
