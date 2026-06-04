import axios from 'axios';

class HttpService {
  constructor() {
    this.axios = axios;
  }

  async post(url, data, headers = {}) {
    try {
      console.log("url", url)
      console.log("data", data)
      console.log("headers", headers)
      const response = await this.axios.post(url, data, { headers });
      return response.data;
    } catch (error) {
      // console.error('HTTP POST Error:', error.message);
      throw error;
    }
  }

  async get(url, headers = {}) {
    try {
      const response = await this.axios.get(url, { headers });
      return response.data;
    } catch (error) {
      console.error('HTTP GET Error:', error);
      throw error;
    }
  }
}

export default new HttpService();