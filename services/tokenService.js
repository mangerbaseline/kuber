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
    this.inMemoryRefreshTokens = {}; // For serverless environments (Vercel) where file write is not allowed
    this.isVercel = process.env.VERCEL === '1' || process.env.VERCEL === 'true';
  }

  merchantTokenFileExists(merchantId) {
    try {
      const tokenFile = path.join(__dirname, `../refresh_token_${merchantId}.txt`);
      return fs.existsSync(tokenFile);
    } catch {
      return !!this.inMemoryRefreshTokens[merchantId];
    }
  }

  getRefreshToken(merchantId) {
    // First check in-memory cache (for serverless/same session)
    if (this.inMemoryRefreshTokens[merchantId]) {
      return this.inMemoryRefreshTokens[merchantId];
    }

    // Then try reading from file
    try {
      const tokenFile = path.join(__dirname, `../refresh_token_${merchantId}.txt`);
      try {
        const token = fs.readFileSync(tokenFile, 'utf8').trim();
        if (token) return token;
      } catch (e) {
        // File read failed
      }
    } catch (error) {
      // Ignore file errors
    }

    return null;
  }

  getRefreshTokenFromAPI(merchantData) {
    return merchantData.refreshToken || null;
  }

  saveRefreshToken(token, merchantId) {
    // Always save in memory (works everywhere)
    this.inMemoryRefreshTokens[merchantId] = token;
    
    // Try to save to file (will fail on Vercel but we handle it gracefully)
    if (!this.isVercel) {
      try {
        const tokenFile = path.join(__dirname, `../refresh_token_${merchantId}.txt`);
        fs.writeFileSync(tokenFile, token);
      } catch (error) {
        console.log('Note: Could not write token file (read-only filesystem). Using in-memory cache.');
      }
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
      
      // Save the new refresh token (in memory for Vercel, file + memory for others)
      this.saveRefreshToken(response.refresh_token, merchantId);
      this.tokenCache[merchantId] = response;
      return response;
    } catch (error) {
      if (error.response?.data?.error === 'invalid_grant' && retryCount < maxRetries) {
        console.log(`Token invalid, retrying... (${retryCount + 1}/${maxRetries})`);
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