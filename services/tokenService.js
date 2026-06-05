import HttpService from './httpService.js';
import xeroConfig from '../config/xero-config.js';
import config from '../config/config.js';

class TokenService {
  constructor() {
    this.httpService = HttpService;
    this.tokenCache = {};
    console.log(`[TokenService] Initialized`);
  }

  async saveRefreshToken(token, merchantId) {
    console.log(`[TokenService.saveRefreshToken] Saving refresh token for merchant: ${merchantId}`);
    try {
      await this.httpService.post(
        `${config.kuberApiUrl}/api/payments/updateRefreshTokenXero`,
        { merchantID: merchantId, refreshToken: token }
      );
      console.log(`[TokenService.saveRefreshToken] Successfully updated refresh token for merchant ${merchantId} via API`);
    } catch (error) {
      console.error(`[TokenService.saveRefreshToken] Failed to update refresh token for merchant ${merchantId} via API:`, error.message);
      throw error;
    }
    
    // Update cache
    this.tokenCache[merchantId] = token;
    console.log(`[TokenService.saveRefreshToken] Token cache updated for merchant: ${merchantId}`);
  }

  async getNewToken(merchantConfig, retryCount = 0) {
    const maxRetries = 2;
    const merchantId = merchantConfig.merchantID;

    console.log(`[TokenService.getNewToken] Getting new token for merchant: ${merchantId}, retryCount: ${retryCount}`);

    // Use token from cache if available, otherwise from the merchantConfig
    let refreshToken = this.tokenCache[merchantId] || merchantConfig.refreshToken;
    
    if (!refreshToken) {
      console.log(`[TokenService.getNewToken] No refresh token in cache/config for merchant: ${merchantId}, fetching from API`);
      // Fallback: fetch from getXeroData API if not present in config
      try {
        const apiResponse = await this.httpService.post(
          `${config.kuberApiUrl}/api/payments/getXeroData`,
          { merchantID: merchantId }
        );
        refreshToken = apiResponse.data?.refreshToken;
        if (refreshToken) {
          console.log(`[TokenService.getNewToken] Refresh token fetched from API for merchant: ${merchantId}`);
        } else {
          console.log(`[TokenService.getNewToken] No refresh token found in API response for merchant: ${merchantId}`);
        }
      } catch (err) {
        console.error(`[TokenService.getNewToken] Failed to fetch refresh token from API for merchant ${merchantId}:`, err.message);
      }
    } else {
      console.log(`[TokenService.getNewToken] Using existing refresh token for merchant: ${merchantId}`);
    }

    if (!refreshToken) {
      console.error(`[TokenService.getNewToken] No refresh token available for merchant: ${merchantId}`);
      throw new Error(`No refresh token available for merchant: ${merchantId}`);
    }

    const authString = Buffer.from(`${merchantConfig.xeroClientId}:${merchantConfig.xeroClientSecret}`).toString('base64');
    
    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${authString}`
    };

    const data = `grant_type=refresh_token&refresh_token=${refreshToken}`;

    console.log(`[TokenService.getNewToken] Requesting new token from Xero token endpoint for merchant: ${merchantId}`);

    try {
      const response = await this.httpService.post(xeroConfig.tokenUrl, data, headers);
      
      console.log(`[TokenService.getNewToken] New token received from Xero for merchant: ${merchantId}`);
      
      // Save the NEW refresh token back to the API database
      console.log(`[TokenService.getNewToken] Saving new refresh token to DB for merchant: ${merchantId}`);
      await this.saveRefreshToken(response.refresh_token, merchantId);
      console.log(`[TokenService.getNewToken] Refresh token successfully saved to DB for merchant: ${merchantId}`);
      
      return response;
    } catch (error) {
      if (error.response?.data?.error === 'invalid_grant' && retryCount < maxRetries) {
        console.log(`[TokenService.getNewToken] Invalid grant for merchant: ${merchantId}, clearing cache and retrying (${retryCount + 1}/${maxRetries})`);
        delete this.tokenCache[merchantId];
        return this.getNewToken(merchantConfig, retryCount + 1);
      }
      console.error(`[TokenService.getNewToken] Error getting new token for merchant: ${merchantId}:`, error.response?.data || error.message);
      throw error;
    }
  }

  clearCache(merchantId) {
    console.log(`[TokenService.clearCache] Clearing cache for merchant: ${merchantId}`);
    delete this.tokenCache[merchantId];
  }
}

export default new TokenService();