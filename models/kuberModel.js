import HttpService from '../services/httpService.js';
import { v4 as uuidv4 } from 'uuid';

class KuberModel {
  constructor() {
    this.httpService = HttpService;
    this.deviceId = uuidv4();
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

    try {
      const response = await this.httpService.post(url, data, headers);
      return response;
    } catch (error) {
      console.error('Error generating token:', error);
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

    try {
      const response = await this.httpService.post(url, payload, headers);
      return response;
    } catch (error) {
      console.error('Error adding checkout item:', error);
      throw error;
    }
  }
}

export default new KuberModel();