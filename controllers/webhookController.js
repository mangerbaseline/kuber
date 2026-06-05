import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import XeroModel from '../models/xeroModel.js';
import HttpService from '../services/httpService.js';
import TokenService from '../services/tokenService.js';
import config from '../config/config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_KUBER_BASE_URL = 'https://kuberfinancial.com.au/api/order/checkout';

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

      console.log(`Webhook: Processing payment for merchant: ${merchantId}`);

      // Fetch merchant config from Kuber API
      const apiResponse = await HttpService.post(
        `${config.kuberApiUrl}/api/payments/getXeroData`,
        { merchantID: merchantId }
      );
      const merchantData = apiResponse.data;
      if (!merchantData) {
        throw new Error(`No configuration found for merchant: ${merchantId}`);
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