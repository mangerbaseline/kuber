import TokenService from '../services/tokenService.js';
import HttpService from '../services/httpService.js';
import config from '../config/config.js';

const DEFAULT_KUBER_BASE_URL = 'https://kuberfinancial.com.au/api/order/checkout';

class TokenController {
  async refreshToken(req, res) {
    let merchantId;
    try {
      merchantId = req.query.merchantId || 'default';

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