// import KuberModel from '../models/kuberModel.js';
// import XeroModel from '../models/xeroModel.js';
// import HttpService from '../services/httpService.js';
// import TokenService from '../services/tokenService.js';
// import config from '../config/config.js';

// const DEFAULT_KUBER_BASE_URL = 'https://kuberfinancial.com.au/api/order/checkout';

// class KuberController {
//     async processPayment(req, res) {
//         let merchantId;
//         try {
//             const params = req.params;
//             merchantId = params.merchantId;
//             const invoiceNo = params.invoiceNo;

//             console.log(`[processPayment] Entry - merchantId: ${merchantId}, invoiceNo: ${invoiceNo}`);

//             if (!invoiceNo || invoiceNo === 'undefined') {
//                 console.log(`[processPayment] No valid invoiceNo provided for merchant: ${merchantId}, returning default response`);
//                 return res.status(200).json({
//                     message: "Payment processed successfully. Return to merchant."
//                 });
//             }

//             console.log(`Processing payment for merchant: ${merchantId}, invoice: ${invoiceNo}`);

//             // Fetch merchant config from Kuber API
//             console.log(`[processPayment] Fetching merchant config for merchant: ${merchantId}`);
//             const apiResponse = await HttpService.post(
//                 `${config.kuberApiUrl}/api/payments/getXeroData`,
//                 { merchantID: merchantId }
//             );
//             const merchantData = apiResponse.data;
//             if (!merchantData) {
//                 console.log(`[processPayment] No merchant data found for merchant: ${merchantId}`);
//                 return res.status(400).json({
//                     error: "Invalid merchant",
//                     details: `No configuration found for merchant: ${merchantId}`
//                 });
//             }
//             console.log(`[processPayment] Merchant config fetched successfully for merchant: ${merchantId}`);

//             const merchantConfig = {
//                 merchantID: merchantData.merchantID,
//                 postmanToken: merchantData.postmanToken,
//                 xeroClientId: merchantData.xeroClientId,
//                 xeroClientSecret: merchantData.xeroClientSecret,
//                 xeroTenantId: merchantData.xeroTenantId,
//                 baseUrl: merchantData.baseUrl || DEFAULT_KUBER_BASE_URL,
//                 paymentUrl: merchantData.paymentUrl,
//                 userID: merchantData.userID,
//                 webhookURL: merchantData.webhookURL,
//                 refreshToken: merchantData.refreshToken
//             };

//             // Generate Kuber token
//             console.log(`[processPayment] Generating Kuber token for merchant: ${merchantId}`);
//             const tokenResponse = await KuberModel.generateToken(merchantConfig);
//             console.log(`[processPayment] Kuber token generated successfully for merchant: ${merchantId}`);

//             if (!tokenResponse.data?.token) {
//                 throw new Error("Invalid token response from Kuber");
//             }

//             const deviceId = tokenResponse.data.deviceID;
//             const accessToken = tokenResponse.data.token;

//             // Fetch invoice from Xero
//             console.log(`[processPayment] Fetching invoice ${invoiceNo} from Xero for merchant: ${merchantId}`);
//             const invoice = await XeroModel.getInvoice(invoiceNo, merchantConfig);
//             console.log(`[processPayment] Invoice ${invoiceNo} fetched successfully from Xero`);

//             // Build checkout payload
//             const checkoutPayload = {
//                 menuList: [{
//                     itemName: invoice.Invoices[0].LineItems[0].Description,
//                     mode: invoiceNo,
//                     itemCategoryName: invoice.Invoices[0].Contact.Name,
//                     amount: invoice.Invoices[0].SubTotal
//                 }],
//                 amount: invoice.Invoices[0].Total
//             };
//             console.log(`[processPayment] Checkout payload built for merchant: ${merchantId}, amount: ${checkoutPayload.amount}`);

//             // Send checkout to Kuber
//             console.log(`[processPayment] Sending checkout to Kuber for merchant: ${merchantId}`);
//             const checkoutResponse = await KuberModel.addCheckoutItem(
//                 accessToken,
//                 deviceId,
//                 checkoutPayload,
//                 merchantConfig
//             );
//             console.log(`[processPayment] Checkout response received: ${checkoutResponse.message}`);

//             if (['Checkout item added', 'Checkout item updated'].includes(checkoutResponse.message)) {
//                 console.log(`[processPayment] Redirecting merchant: ${merchantId} to: ${checkoutResponse.data.redirectURL}`);
//                 return res.redirect(checkoutResponse.data.redirectURL);
//             }

//             throw new Error(`Kuber API Error: ${checkoutResponse.message || JSON.stringify(checkoutResponse)}`);

//         } catch (error) {
//             console.error('[processPayment] Payment failed:', error.message, error.response?.data);
//             res.status(500).json({
//                 error: "Payment failed",
//                 details: error.message
//             });
//         } finally {
//             console.log(`[processPayment] Clearing cache for merchant: ${merchantId}`);
//             TokenService.clearCache(merchantId);
//         }
//     }

// }

// export default new KuberController();

import KuberModel from '../models/kuberModel.js';
import XeroModel from '../models/xeroModel.js';
import HttpService from '../services/httpService.js';
import TokenService from '../services/tokenService.js';
import config from '../config/config.js';

const DEFAULT_KUBER_BASE_URL = 'https://www.kuberfinancial.com.au/api/order/checkout';

// ─────────────────────────────────────────────────────────────────
// 🧪 LOCAL TESTING FLAG
// Set USE_DUMMY_DATA = true to skip all real API calls and use the
// dummy checkoutResponse below. Flip back to false for production.
// ─────────────────────────────────────────────────────────────────
const USE_DUMMY_DATA = true;

const DUMMY_CHECKOUT_RESPONSE = {
    message: 'Checkout item added',
    data: {
        _id: 'dummy_checkout_id_001',
        merchantID: 'DUMMY_MERCHANT',
        deviceId: 'dummy-device-id-1234',
        amount: 1.1,
        finalAmount: 1.1,
        paymentStatus: 'Pending',
        currentStatus: 'Pending',
        paymentMode: 'pay2',
        orderedThrough: 'Checkout',
        menuList: [
            {
                itemName: 'DUMMY ITEM (local test)',
                mode: 'INV-0000',
                itemCategoryName: 'Test Customer',
                amount: 1.0,
                quantity: 1,
            }
        ]
    },
    redirectURL: 'https://www.kuberfinancial.com.au/checkout/?f2c01b40e89bea725a9db084a03144b9:d758c456bd22c7fde7bb8a833ddc50bd894df1df6d2f88cf10b0874ac5f6a4b44fad0f73d9a2a77c1d385cd18304d5e4df22b2746408b5be1b602e5c7d24159d'
};

class KuberController {
    async processPayment(req, res) {
        let merchantId;
        try {
            const params = req.params;
            merchantId = params.merchantId;
            const invoiceNo = params.invoiceNo;

            console.log(`[processPayment] Entry - merchantId: ${merchantId}, invoiceNo: ${invoiceNo}`);

            if (!invoiceNo || invoiceNo === 'undefined') {
                console.log(`[processPayment] No valid invoiceNo provided for merchant: ${merchantId}, returning default response`);
                return res.status(200).json({
                    message: "Payment processed successfully. Return to merchant."
                });
            }

            console.log(`Processing payment for merchant: ${merchantId}, invoice: ${invoiceNo}`);

            let checkoutResponse;

            if (USE_DUMMY_DATA) {
                // ── DUMMY MODE ──────────────────────────────────────────────
                console.log(`[processPayment] 🧪 USE_DUMMY_DATA=true — skipping all real API calls`);
                checkoutResponse = {
                    ...DUMMY_CHECKOUT_RESPONSE,
                    // Stamp in the real merchantId & invoiceNo so logs are accurate
                    data: {
                        ...DUMMY_CHECKOUT_RESPONSE.data,
                        merchantID: merchantId,
                        menuList: [{
                            ...DUMMY_CHECKOUT_RESPONSE.data.menuList[0],
                            mode: invoiceNo
                        }]
                    }
                };
                // ────────────────────────────────────────────────────────────
            } else {
                // Fetch merchant config from Kuber API
                console.log(`[processPayment] Fetching merchant config for merchant: ${merchantId}`);
                const apiResponse = await HttpService.post(
                    `${config.kuberApiUrl}/api/payments/getXeroData`,
                    { merchantID: merchantId }
                );
                const merchantData = apiResponse.data;
                if (!merchantData) {
                    console.log(`[processPayment] No merchant data found for merchant: ${merchantId}`);
                    return res.status(400).json({
                        error: "Invalid merchant",
                        details: `No configuration found for merchant: ${merchantId}`
                    });
                }
                console.log(`[processPayment] Merchant config fetched successfully for merchant: ${merchantId}`);

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
                console.log(`[processPayment] Generating Kuber token for merchant: ${merchantId}`);
                const tokenResponse = await KuberModel.generateToken(merchantConfig);
                console.log(`[processPayment] Kuber token generated successfully for merchant: ${merchantId}`);

                if (!tokenResponse.data?.token) {
                    throw new Error("Invalid token response from Kuber");
                }

                const deviceId = tokenResponse.data.deviceID;
                const accessToken = tokenResponse.data.token;

                // Fetch invoice from Xero
                console.log(`[processPayment] Fetching invoice ${invoiceNo} from Xero for merchant: ${merchantId}`);
                const invoice = await XeroModel.getInvoice(invoiceNo, merchantConfig);
                console.log(`[processPayment] Invoice ${invoiceNo} fetched successfully from Xero`);

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
                console.log(`[processPayment] Checkout payload built for merchant: ${merchantId}, amount: ${checkoutPayload.amount}`);

                // Send checkout to Kuber
                console.log(`[processPayment] Sending checkout to Kuber for merchant: ${merchantId}`);
                checkoutResponse = await KuberModel.addCheckoutItem(
                    accessToken,
                    deviceId,
                    checkoutPayload,
                    merchantConfig
                );
            }
            console.log(`[processPayment] Checkout response received: ${checkoutResponse.message}`);

            if (['Checkout item added', 'Checkout item updated'].includes(checkoutResponse.message)) {
                const redirectURL = checkoutResponse.redirectURL;
                console.log(`[processPayment] Redirecting merchant: ${merchantId} to: ${redirectURL}`);
                if (!redirectURL) {
                    throw new Error('Kuber API returned no redirectURL in response');
                }
                return res.redirect(redirectURL);
            }

            throw new Error(`Kuber API Error: ${checkoutResponse.message || JSON.stringify(checkoutResponse)}`);

        } catch (error) {
            console.error('[processPayment] Payment failed:', error.message, error.response?.data);
            res.status(500).json({
                error: "Payment failed",
                details: error.message
            });
        } finally {
            console.log(`[processPayment] Clearing cache for merchant: ${merchantId}`);
            TokenService.clearCache(merchantId);
        }
    }

}

export default new KuberController();
