import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import HttpService from './httpService.js';
import xeroConfig from '../config/xero-config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class TokenService {
  constructor() {
    this.tokenPath = path.join(__dirname, '../refresh_token.txt');
    this.httpService = HttpService;
    this.tokenCache = {}; // Cache tokens per merchant per request
  }

  merchantTokenFileExists(merchantId) {
    const tokenFile = path.join(__dirname, `../refresh_token_${merchantId}.txt`);
    return fs.existsSync(tokenFile);
  }

  getRefreshToken(merchantId) {
    try {
      const tokenFile = path.join(__dirname, `../refresh_token_${merchantId}.txt`);
      
      try {
        return fs.readFileSync(tokenFile, 'utf8').trim();
      } catch (e) {
        console.log(`No token file found for merchant ${merchantId}, trying default`);
        try {
          return fs.readFileSync(this.tokenPath, 'utf8').trim();
        } catch (e2) {
          console.log('No default token file found either');
          return null;
        }
      }
    } catch (error) {
      console.error('Error reading refresh token:', error);
      throw error;
    }
  }

  getRefreshTokenFromAPI(merchantData) {
    return merchantData.refreshToken || null;
  }

  saveRefreshToken(token, merchantId) {
    try {
      const tokenFile = path.join(__dirname, `../refresh_token_${merchantId}.txt`);
      fs.writeFileSync(tokenFile, token);
    } catch (error) {
      console.error('Error saving refresh token:', error);
      throw error;
    }
  }

  async getNewToken(merchantConfig, retryCount = 0) {
    const maxRetries = 3;
    const merchantId = merchantConfig.merchantID;

    // Return cached token if available (prevents multiple Xero calls in same request)
    if (this.tokenCache[merchantId]) {
      return this.tokenCache[merchantId];
    }

    const refreshToken = this.getRefreshToken(merchantId);
    const authString = Buffer.from(`${merchantConfig.xeroClientId}:${merchantConfig.xeroClientSecret}`).toString('base64');
    
    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${authString}`
    };

    const data = `grant_type=refresh_token&refresh_token=${refreshToken}`;

    try {
      const response = await this.httpService.post(xeroConfig.tokenUrl, data, headers);
      
      this.saveRefreshToken(response.refresh_token, merchantId);
      this.tokenCache[merchantId] = response; // Cache the response
      return response;
    } catch (error) {
      if (error.response?.data?.error === 'invalid_grant' && retryCount < maxRetries) {
        console.log(`Token invalid (race condition), retrying... (${retryCount + 1}/${maxRetries})`);
        delete this.tokenCache[merchantId]; // Clear cache on failure
        return this.getNewToken(merchantConfig, retryCount + 1);
      }
      throw error;
    }
  }

  // Clear cache after request is complete (call this at end of each request)
  clearCache(merchantId) {
    delete this.tokenCache[merchantId];
  }
}

export default new TokenService();