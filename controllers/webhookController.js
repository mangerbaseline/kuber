import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import XeroModel from '../models/xeroModel.js';
import HttpService from '../services/httpService.js';
import TokenService from '../services/tokenService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_KUBER_BASE_URL = 'https://kuberfinancial.com.au/api/order/checkout';

function getMerchantConfig(merchantId) {
    const configPath = path.join(__dirname, '../static_merchant_config.json');
    const allConfigs = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const config = allConfigs[merchantId];
    
    if (!config) {
        throw new Error(`No configuration found for merchant: ${merchantId}`);
    }
    
    return {
        merchantID: config.merchantID,
        postmanToken: config.postmanToken,
        xeroClientId: config.xeroClientId,
        xeroClientSecret: config.xeroClientSecret,
        xeroTenantId: config.xeroTenantId,
        baseUrl: config.baseUrl || DEFAULT_KUBER_BASE_URL,
        paymentUrl: config.paymentUrl || "",
        userID: config.userID || merchantId,
        webhookURL: config.webhookURL || ""
    };
}

class WebhookController {

  async handleWebhook(req, res) {
    try {
      const currentDate = new Date().toISOString().split('T')[0];
      const responseData = req.body;

      const responsePath = path.join(__dirname, '../response.json');
      fs.writeFileSync(responsePath, JSON.stringify(responseData, null, 2));

      const invoiceNo = responseData.invoiceNo;
      const status = responseData.status;
      const merchantId = responseData.merchantId || responseData.merchantID || 'default';

      console.log(`Webhook: Using static config for merchant: ${merchantId}`);

      // COMMENTED: Fetch merchant config from Kuber API (for production)
      // const apiResponse = await HttpService.post(
      //   'https://www.kuberfinancial.com.au/api/payments/getXeroData',
      //   { merchantID: merchantId }
      // );
      // const merchantData = apiResponse.data;
      // if (!merchantData) {
      //   throw new Error(`No configuration found for merchant: ${merchantId}`);
      // }
      // const merchantConfig = {
      //   merchantID: merchantData.merchantID,
      //   postmanToken: merchantData.postmanToken,
      //   xeroClientId: merchantData.xeroClientId,
      //   xeroClientSecret: merchantData.xeroClientSecret,
      //   xeroTenantId: merchantData.xeroTenantId,
      //   baseUrl: merchantData.baseUrl || DEFAULT_KUBER_BASE_URL,
      //   paymentUrl: merchantData.paymentUrl,
      //   userID: merchantData.userID,
      //   webhookURL: merchantData.webhookURL
      // };
      // const hasLocalToken = await TokenService.merchantTokenExists(merchantConfig.merchantID);
      // if (!hasLocalToken && merchantData.refreshToken) {
      //   await TokenService.saveRefreshToken(merchantData.refreshToken, merchantConfig.merchantID);
      // }

      // Using static config from JSON file
      const merchantConfig = getMerchantConfig(merchantId);
      console.log("Webhook: Using config for merchant:", merchantId, "tenantId:", merchantConfig.xeroTenantId);

      if (status === 'Success') {
        const invoice = await XeroModel.getInvoice(invoiceNo, merchantConfig);

        const xeroInvoiceId = invoice.Invoices[0].InvoiceID;
        const xeroAmount = invoice.Invoices[0].Total;

        const bankAccounts = await XeroModel.getActiveBankAccounts(merchantConfig);
        const bankAccountId = bankAccounts[0].AccountID;

        const paymentPayload = {
          Invoice: {
            InvoiceID: xeroInvoiceId
          },
          Account: {
            AccountID: bankAccountId
          },
          Date: currentDate,
          Amount: xeroAmount,
          Reference: "Paid via API"
        };

        await XeroModel.createPayment(paymentPayload, merchantConfig);

        res.status(200).json({ message: 'Payment processed successfully' });
      } else {
        res.status(200).json({ message: 'Payment not successful, no action taken' });
      }
    } catch (error) {
      res.set('Content-Type', 'application/xml');
      res.status(500).json({ error: error.message });
    }
  }
}

export default new WebhookController();