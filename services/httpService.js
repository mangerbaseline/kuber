import axios from 'axios';

class HttpService {
  constructor() {
    this.axios = axios;
    console.log(`[HttpService] Initialized`);
  }

  async post(url, data, headers = {}) {
    console.log(`[HttpService.post] URL: ${url}, Method: POST`);
    console.log(`[HttpService.post] Request Data: ${JSON.stringify(data)}`);
    console.log(`[HttpService.post] Request Headers: ${JSON.stringify(headers)}`);
    try {
      const response = await this.axios.post(url, data, { headers });
      console.log(`[HttpService.post] Response received from: ${url} - Status: ${response.status}`);
      console.log(`[HttpService.post] Response Data: ${JSON.stringify(response.data)}`);
      return response.data;
    } catch (error) {
      console.error(`[HttpService.post] Error for URL: ${url} - Status: ${error.response?.status}, Message: ${error.message}`);
      if (error.response?.data) {
        console.error(`[HttpService.post] Error Response Data: ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }

  async get(url, headers = {}) {
    console.log(`[HttpService.get] URL: ${url}, Method: GET`);
    console.log(`[HttpService.get] Request Headers: ${JSON.stringify(headers)}`);
    try {
      const response = await this.axios.get(url, { headers });
      console.log(`[HttpService.get] Response received from: ${url} - Status: ${response.status}`);
      return response.data;
    } catch (error) {
      console.error('[HTTP GET Error]:', error.message);
      throw error;
    }
  }
}

export default new HttpService();