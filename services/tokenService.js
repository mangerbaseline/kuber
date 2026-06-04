import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import HttpService from './httpService.js';
import xeroConfig from '../config/xero-config.js';
import TokenModel from '../models/tokenModel.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class TokenService {
  constructor() {
    this.tokenPath = path.join(__dirname, '../refresh_token.txt');
    this.httpService = HttpService;
    this.tokenCache = {};
  }

  async getRefreshTokenFromDB(merchantId) {
    try {
      const tokenDoc = await TokenModel.findOne({ merchantId });
      return tokenDoc ? tokenDoc.refreshToken : null;
    } catch {
      return null;
    }
  }

  async saveRefreshTokenToDB(token, merchantId) {
    try {
      await TokenModel.findOneAndUpdate(
        { merchantId },
        { refreshToken: token, updatedAt: new Date() },
        { upsert: true }
      );
      return true;
    } catch {
      return false;
    }
  }

  async merchantTokenExists(merchantId) {
    // Check MongoDB first
    const fromDB = await this.getRefreshTokenFromDB(merchantId);
    if (fromDB) return true;
    
    // Fallback to file
    try {
      const tokenFile = path.join(__dirname, `../refresh_token_${merchantId}.txt`);
      return fs.existsSync(tokenFile);
    } catch {
      return false;
    }
  }

  async getRefreshToken(merchantId) {
    // Check in-memory cache
    if (this.tokenCache[merchantId]) {
      return this.tokenCache[merchantId];
    }

    // Check MongoDB
    const fromDB = await this.getRefreshTokenFromDB(merchantId);
    if (fromDB) {
      this.tokenCache[merchantId] = fromDB;
      return fromDB;
    }

    // Fallback to file
    try {
      const tokenFile = path.join(__dirname, `../refresh_token_${merchantId}.txt`);
      const fromFile = fs.readFileSync(tokenFile, 'utf8').trim();
      if (fromFile) {
        this.tokenCache[merchantId] = fromFile;
        return fromFile;
      }
    } catch (e) {}

    return null;
  }

  getRefreshTokenFromAPI(merchantData) {
    return merchantData.refreshToken || null;
  }

  async saveRefreshToken(token, merchantId) {
    // Save to MongoDB
    await this.saveRefreshTokenToDB(token, merchantId);
    
    // Update in-memory cache
    this.tokenCache[merchantId] = token;
    
    // Try saving to file as fallback (will fail on Vercel but that's OK)
    try {
      const tokenFile = path.join(__dirname, `../refresh_token_${merchantId}.txt`);
      fs.writeFileSync(tokenFile, token);
    } catch (error) {
      // Ignore file errors on serverless
    }
  }

  async getNewToken(merchantConfig, retryCount = 0) {
    const maxRetries = 2;
    const merchantId = merchantConfig.merchantID;

    const refreshToken = await this.getRefreshToken(merchantId);
    
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
      
      // Save the new refresh token to MongoDB + cache
      await this.saveRefreshToken(response.refresh_token, merchantId);
      return response;
    } catch (error) {
      if (error.response?.data?.error === 'invalid_grant' && retryCount < maxRetries) {
        // Clear cache so next retry fetches fresh from DB
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