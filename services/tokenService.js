import HttpService from './httpService.js';
import xeroConfig from '../config/xero-config.js';
import config from '../config/config.js';

class TokenService {
  constructor() {
    this.httpService = HttpService;
    this.tokenCache = {};
  }

  async saveRefreshToken(token, merchantId) {
    try {
      await this.httpService.post(
        `${config.kuberApiUrl}/api/payments/updateRefreshTokenXero`,
        { merchantID: merchantId, refreshToken: token }
      );
      console.log(`Successfully updated refresh token for merchant ${merchantId} via API`);
    } catch (error) {
      console.error(`Failed to update refresh token for merchant ${merchantId} via API:`, error.message);
      throw error;
    }
    
    // Update cache
    this.tokenCache[merchantId] = token;
  }

  async getNewToken(merchantConfig, retryCount = 0) {
    const maxRetries = 2;
    const merchantId = merchantConfig.merchantID;

    // Use token from cache if available, otherwise from the merchantConfig
    let refreshToken = this.tokenCache[merchantId] || merchantConfig.refreshToken;
    
    if (!refreshToken) {
      // Fallback: fetch from getXeroData API if not present in config
      try {
        const apiResponse = await this.httpService.post(
          `${config.kuberApiUrl}/api/payments/getXeroData`,
          { merchantID: merchantId }
        );
        refreshToken = apiResponse.data?.refreshToken;
      } catch (err) {
        console.error(`Failed to fetch refresh token from API for merchant ${merchantId}:`, err.message);
      }
    }

    if (!refreshToken) {
      throw new Error(`No refresh token available for merchant: ${merchantId}`);
    }

    const authString = Buffer.from(`${merchantConfig.xeroClientId}:${merchantConfig.xeroClientSecret}`).toString('base64');
    
    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${authString}`
    };

    const data = `grant_type=refresh_token&refresh_token=${refreshToken}`;

    try {
      const response = await this.httpService.post(xeroConfig.tokenUrl, data, headers);
      
      // Save the NEW refresh token back to the API database
      await this.saveRefreshToken(response.refresh_token, merchantId);
      return response;
    } catch (error) {
      if (error.response?.data?.error === 'invalid_grant' && retryCount < maxRetries) {
        delete this.tokenCache[merchantId];
        return this.getNewToken(merchantConfig, retryCount + 1);
      }
      throw error;
    }
  }

  clearCache(merchantId) {
    delete this.tokenCache[merchantId];
  }
}

export default new TokenService();