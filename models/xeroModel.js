import HttpService from '../services/httpService.js';
import xeroConfig from '../config/xero-config.js';
import TokenService from '../services/tokenService.js';

class XeroModel {
  constructor() {
    this.httpService = HttpService;
    this.tokenService = TokenService;
    // Remove shared this.token — will use per-request token instead
  }

  async getAccessToken(merchantConfig) {
    const token = await this.tokenService.getNewToken(merchantConfig);
    return token.access_token;
  }

  async getActiveBankAccounts(merchantConfig) {
    const token = await this.getAccessToken(merchantConfig);
    const url = `${xeroConfig.apiUrl}/Accounts`;
    
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
      'xero-tenant-id': merchantConfig.xeroTenantId
    };

    try {
      const response = await this.httpService.get(url, headers);
      const bankAccounts = response.Accounts.filter(account => 
        account.Type === "BANK" && account.Status === "ACTIVE"
      );
      
      if (bankAccounts.length === 0) {
        throw new Error('No active bank accounts found');
      }
      
      return bankAccounts;
    } catch (error) {
      console.error('Error getting bank accounts:', error);
      throw error;
    }
  }

  async getInvoice(invoiceNo, merchantConfig) {
    const token = await this.getAccessToken(merchantConfig);
    const url = `${xeroConfig.apiUrl}/Invoices/${invoiceNo}`;
    
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
      'xero-tenant-id': merchantConfig.xeroTenantId
    };

    try {
      const response = await this.httpService.get(url, headers);
      return response;
    } catch (error) {
      console.error('Error getting invoice:', error);
      throw error;
    }
  }

  async createPayment(payload, merchantConfig, existingToken) {
    const token = existingToken || await this.getAccessToken(merchantConfig);
    const url = `${xeroConfig.apiUrl}/Payments`;
    
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Xero-tenant-id': merchantConfig.xeroTenantId,
      'Content-Type': 'application/json'
    };

    try {
      const response = await this.httpService.post(url, payload, headers);
      return response;
    } catch (error) {
      throw error;
    }
  }
}

export default new XeroModel();