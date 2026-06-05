import TokenService from '../services/tokenService.js';
import HttpService from '../services/httpService.js';
import config from '../config/config.js';

const DEFAULT_KUBER_BASE_URL = 'https://kuberfinancial.com.au/api/order/checkout';

class TokenController {
  async refreshToken(req, res) {
    let merchantId;
    try {
      merchantId = req.query.merchantId || 'default';
      console.log(`[refreshToken] Entry - merchantId: ${merchantId}`);

      // Fetch merchant config from Kuber API
      console.log(`[refreshToken] Fetching merchant config for merchant: ${merchantId}`);
      const apiResponse = await HttpService.post(
        `${config.kuberApiUrl}/api/payments/getXeroData`,
        { merchantID: merchantId }
      );
      const merchantData = apiResponse.data;
      if (!merchantData) {
        console.log(`[refreshToken] No merchant data found for merchant: ${merchantId}`);
        return res.status(400).json({
          error: "Invalid merchant",
          details: `No configuration found for merchant: ${merchantId}`
        });
      }
      console.log(`[refreshToken] Merchant config fetched successfully for merchant: ${merchantId}`);

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

      console.log(`[refreshToken] Requesting new token from Xero for merchant: ${merchantId}`);
      const token = await TokenService.getNewToken(merchantConfig);
      console.log(`[refreshToken] New token received successfully for merchant: ${merchantId}`);
      
      res.status(200).json(token);
    } catch (error) {
      console.error('[refreshToken] Token refresh error:', error);
      res.status(500).json({ error: error.message });
    } finally {
      console.log(`[refreshToken] Clearing cache for merchant: ${merchantId}`);
      TokenService.clearCache(merchantId);
    }
  }
}

export default new TokenController();