import HttpService from '../services/httpService.js';
import { v4 as uuidv4 } from 'uuid';

class KuberModel {
  constructor() {
    this.httpService = HttpService;
    this.deviceId = uuidv4();
    console.log(`[KuberModel] Initialized with deviceId: ${this.deviceId}`);
  }

  async generateToken(merchantConfig) {
    const url = `${merchantConfig.baseUrl}/generateToken`;
    const data = {
      merchantID: merchantConfig.merchantID,
      deviceID: this.deviceId
    };

    const headers = {
      'Content-Type': 'application/json',
      'postman-auth-token': merchantConfig.postmanToken
    };

    console.log(`[KuberModel.generateToken] Generating token for merchant: ${merchantConfig.merchantID} at URL: ${url}`);

    try {
      const response = await this.httpService.post(url, data, headers);
      console.log(`[KuberModel.generateToken] Token generated successfully for merchant: ${merchantConfig.merchantID}`);
      return response;
    } catch (error) {
      console.error('[KuberModel.generateToken] Error generating token:', error.message);
      throw error;
    }
  }

  async addCheckoutItem(accessToken, deviceId, payload, merchantConfig) {
    const url = `${merchantConfig.baseUrl}/addCheckoutItem`;
    
    const headers = {
      'Content-Type': 'application/json',
      'access_token': accessToken,
      'deviceID': deviceId,
      'postman-auth-token': merchantConfig.postmanToken
    };

    console.log(`[KuberModel.addCheckoutItem] Adding checkout item for merchant: ${merchantConfig.merchantID} at URL: ${url}`);
    console.log(`[KuberModel.addCheckoutItem] Payload: ${JSON.stringify(payload)}`);

    try {
      const response = await this.httpService.post(url, payload, headers);
      console.log(`[KuberModel.addCheckoutItem] Checkout item added successfully for merchant: ${merchantConfig.merchantID}`);
      return response;
    } catch (error) {
      console.error('[KuberModel.addCheckoutItem] Error adding checkout item:', error.message);
      throw error;
    }
  }
}

export default new KuberModel();