import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import TokenService from '../services/tokenService.js';
import HttpService from '../services/httpService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_KUBER_BASE_URL = 'https://kuberfinancial.com.au/api/order/checkout';

// Load static merchant config from JSON file (for testing)
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

class TokenController {
  async refreshToken(req, res) {
    let merchantId;
    try {
      merchantId = req.query.merchantId || 'default';

      // COMMENTED: Fetch from Kuber API (for production)
      // const apiResponse = await HttpService.post(
      //   'https://www.kuberfinancial.com.au/api/payments/getXeroData',
      //   { merchantID: merchantId }
      // );
      // const merchantData = apiResponse.data;
      // if (!merchantData) {
      //   return res.status(400).json({
      //     error: "Invalid merchant",
      //     details: `No configuration found for merchant: ${merchantId}`
      //   });
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
      // if (merchantData.refreshToken) {
      //   TokenService.saveRefreshToken(merchantData.refreshToken, merchantConfig.merchantID);
      // }
      // Using static config from JSON file
      const merchantConfig = getMerchantConfig(merchantId);
      console.log("TokenController: Using static config for merchant:", merchantId);

      const token = await TokenService.getNewToken(merchantConfig);
      res.status(200).json(token);
    } catch (error) {
      console.error('Token refresh error:', error);
      res.status(500).json({ error: error.message });
    } finally {
      TokenService.clearCache(merchantId);
    }
  }
}

export default new TokenController();