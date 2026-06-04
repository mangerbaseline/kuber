import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import HttpService from './httpService.js';
import xeroConfig from '../config/xero-config.js';
import TokenModel from '../models/tokenModel.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Initial token for testing (used ONLY if no token exists in DB or file)
const INITIAL_REFRESH_TOKEN = 'UeAFB5vngVsVcmeny50WwD2Kah0mA5I2acLpdhvXBFg';

class TokenService {
  constructor() {
    this.tokenPath = path.join(__dirname, '../refresh_token.txt');
    this.httpService = HttpService;
    this.tokenCache = {};
  }

  isDBConnected() {
    return mongoose.connection.readyState === 1;
  }

  async getRefreshTokenFromDB(merchantId) {
    if (!this.isDBConnected()) return null;
    try {
      const tokenDoc = await TokenModel.findOne({ merchantId }).maxTimeMS(2000);
      return tokenDoc ? tokenDoc.refreshToken : null;
    } catch {
      return null;
    }
  }

  async saveRefreshTokenToDB(token, merchantId) {
    if (!this.isDBConnected()) return false;
    try {
      await TokenModel.findOneAndUpdate(
        { merchantId },
        { refreshToken: token, updatedAt: new Date() },
        { upsert: true, maxTimeMS: 2000 }
      );
      return true;
    } catch (err) {
      console.error('MongoDB write error:', err.message);
      return false;
    }
  }

  async merchantTokenExists(merchantId) {
    if (this.isDBConnected()) {
      try {
        const count = await TokenModel.countDocuments({ merchantId }).maxTimeMS(2000);
        if (count > 0) return true;
      } catch {}
    }
    
    try {
      const tokenFile = path.join(__dirname, `../refresh_token_${merchantId}.txt`);
      return fs.existsSync(tokenFile);
    } catch {
      return false;
    }
  }

  async getRefreshToken(merchantId) {
    // 1. Check in-memory cache first
    if (this.tokenCache[merchantId]) {
      return this.tokenCache[merchantId];
    }

    // 2. Check MongoDB (only if connected)
    if (this.isDBConnected()) {
      const fromDB = await this.getRefreshTokenFromDB(merchantId);
      if (fromDB) {
        this.tokenCache[merchantId] = fromDB;
        return fromDB;
      }
    }

    // 3. Check file
    try {
      const tokenFile = path.join(__dirname, `../refresh_token_${merchantId}.txt`);
      const fromFile = fs.readFileSync(tokenFile, 'utf8').trim();
      if (fromFile) {
        if (this.isDBConnected()) {
          await this.saveRefreshTokenToDB(fromFile, merchantId);
        }
        this.tokenCache[merchantId] = fromFile;
        return fromFile;
      }
    } catch (e) {}

    // 4. Use hardcoded initial token (first run only)
    console.log(`No token found for ${merchantId}, using hardcoded initial token`);
    if (this.isDBConnected()) {
      await this.saveRefreshTokenToDB(INITIAL_REFRESH_TOKEN, merchantId);
    }
    this.tokenCache[merchantId] = INITIAL_REFRESH_TOKEN;
    return INITIAL_REFRESH_TOKEN;
  }

  async saveRefreshToken(token, merchantId) {
    // Save to DB only if connected
    if (this.isDBConnected()) {
      await this.saveRefreshTokenToDB(token, merchantId);
    }
    
    // Always save to file (fast, always works locally)
    try {
      const tokenFile = path.join(__dirname, `../refresh_token_${merchantId}.txt`);
      fs.writeFileSync(tokenFile, token);
    } catch (error) {}
    
    // Update cache
    this.tokenCache[merchantId] = token;
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
      
      // Save the NEW refresh token to both file and DB
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