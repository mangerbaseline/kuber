import KuberModel from '../models/kuberModel.js';
import XeroModel from '../models/xeroModel.js';
import HttpService from '../services/httpService.js';
import TokenService from '../services/tokenService.js';
import config from '../config/config.js';

const DEFAULT_KUBER_BASE_URL = 'https://kuberfinancial.com.au/api/order/checkout';

class KuberController {
    async processPayment(req, res) {
        let merchantId;
        try {
            const params = req.params;
            merchantId = params.merchantId;
            const invoiceNo = params.invoiceNo;

            if (!invoiceNo || invoiceNo === 'undefined') {
                return res.status(200).json({
                    message: "Payment processed successfully. Return to merchant."
                });
            }

            console.log(`Processing payment for merchant: ${merchantId}, invoice: ${invoiceNo}`);

            // Fetch merchant config from Kuber API
            const apiResponse = await HttpService.post(
                `${config.kuberApiUrl}/api/payments/getXeroData`,
                { merchantID: merchantId }
            );
            const merchantData = apiResponse.data;
            if (!merchantData) {
                return res.status(400).json({
                    error: "Invalid merchant",
                    details: `No configuration found for merchant: ${merchantId}`
                });
            }
            const merchantConfig = {
                merchantID: merchantData.merchantID,
                postmanToken: merchantData.postmanToken,
                xeroClientId: merchantData.xeroClientId,
                xeroClientSecret: merchantData.xeroClientSecret,
                xeroTenantId: merchantData.xeroTenantId,
                baseUrl: merchantData.baseUrl || DEFAULT_KUBER_BASE_URL,
                paymentUrl: merchantData.paymentUrl,
                userID: merchantData.userID,
                webhookURL: merchantData.webhookURL,
                refreshToken: merchantData.refreshToken
            };

            // Generate Kuber token
            const tokenResponse = await KuberModel.generateToken(merchantConfig);

            if (!tokenResponse.data?.token) {
                throw new Error("Invalid token response from Kuber");
            }

            const deviceId = tokenResponse.data.deviceID;
            const accessToken = tokenResponse.data.token;

            // Fetch invoice from Xero
            const invoice = await XeroModel.getInvoice(invoiceNo, merchantConfig);

            // Build checkout payload
            const checkoutPayload = {
                menuList: [{
                    itemName: invoice.Invoices[0].LineItems[0].Description,
                    mode: invoiceNo,
                    itemCategoryName: invoice.Invoices[0].Contact.Name,
                    amount: invoice.Invoices[0].SubTotal
                }],
                amount: invoice.Invoices[0].Total
            };

            // Send checkout to Kuber
            const checkoutResponse = await KuberModel.addCheckoutItem(
                accessToken,
                deviceId,
                checkoutPayload,
                merchantConfig
            );

            if (['Checkout item added', 'Checkout item updated'].includes(checkoutResponse.message)) {
                return res.redirect(checkoutResponse.data.redirectURL);
            }

            throw new Error(`Kuber API Error: ${checkoutResponse.message || JSON.stringify(checkoutResponse)}`);

        } catch (error) {
            console.error('Payment failed:', error.message, error.response?.data);
            res.status(500).json({
                error: "Payment failed",
                details: error.message
            });
        } finally {
            TokenService.clearCache(merchantId);
        }
    }

}

export default new KuberController();