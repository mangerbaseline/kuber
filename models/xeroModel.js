import HttpService from '../services/httpService.js';
import xeroConfig from '../config/xero-config.js';
import TokenService from '../services/tokenService.js';

class XeroModel {
  constructor() {
    this.httpService = HttpService;
    this.tokenService = TokenService;
    console.log(`[XeroModel] Initialized`);
  }

  async getAccessToken(merchantConfig) {
    console.log(`[XeroModel.getAccessToken] Getting access token for merchant: ${merchantConfig.merchantID}`);
    const token = await this.tokenService.getNewToken(merchantConfig);
    console.log(`[XeroModel.getAccessToken] Access token obtained successfully for merchant: ${merchantConfig.merchantID}`);
    return token.access_token;
  }

  async getActiveBankAccounts(merchantConfig) {
    console.log(`[XeroModel.getActiveBankAccounts] Fetching active bank accounts for merchant: ${merchantConfig.merchantID}`);
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
      
      console.log(`[XeroModel.getActiveBankAccounts] Found ${bankAccounts.length} active bank accounts for merchant: ${merchantConfig.merchantID}`);

      if (bankAccounts.length === 0) {
        console.error(`[XeroModel.getActiveBankAccounts] No active bank accounts found for merchant: ${merchantConfig.merchantID}`);
        throw new Error('No active bank accounts found');
      }
      
      return bankAccounts;
    } catch (error) {
      console.error('[XeroModel.getActiveBankAccounts] Error getting bank accounts:', error.message);
      throw error;
    }
  }

  async getInvoice(invoiceNo, merchantConfig) {
    console.log(`[XeroModel.getInvoice] Fetching invoice ${invoiceNo} for merchant: ${merchantConfig.merchantID}`);
    const token = await this.getAccessToken(merchantConfig);
    const url = `${xeroConfig.apiUrl}/Invoices/${invoiceNo}`;
    
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
      'xero-tenant-id': merchantConfig.xeroTenantId
    };

    try {
      const response = await this.httpService.get(url, headers);
      console.log(`[XeroModel.getInvoice] Invoice ${invoiceNo} fetched successfully for merchant: ${merchantConfig.merchantID}`);
      return response;
    } catch (error) {
      console.error('[XeroModel.getInvoice] Error getting invoice:', error.message);
      throw error;
    }
  }

  async createPayment(payload, merchantConfig, existingToken) {
    console.log(`[XeroModel.createPayment] Creating payment for merchant: ${merchantConfig.merchantID}`);
    const token = existingToken || await this.getAccessToken(merchantConfig);
    const url = `${xeroConfig.apiUrl}/Payments`;
    
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Xero-tenant-id': merchantConfig.xeroTenantId,
      'Content-Type': 'application/json'
    };

    try {
      const response = await this.httpService.post(url, payload, headers);
      console.log(`[XeroModel.createPayment] Payment created successfully for merchant: ${merchantConfig.merchantID}`);
      return response;
    } catch (error) {
      console.error('[XeroModel.createPayment] Error creating payment:', error.message);
      throw error;
    }
  }
}

export default new XeroModel();