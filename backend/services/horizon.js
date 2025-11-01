const axios = require('axios');

// Pi Network Horizon API base URL
const HORIZON_API_BASE = 'https://api.mainnet.minepi.com';

/**
 * Pi Network Horizon API Service
 * Provides utilities to interact with the Pi Network blockchain
 */
class HorizonService {
  constructor() {
    this.baseURL = HORIZON_API_BASE;
  }

  /**
   * Get account information by account ID (wallet address)
   * @param {string} accountId - Pi wallet address
   * @returns {Promise<Object>} Account information including balances
   */
  async getAccount(accountId) {
    try {
      const response = await axios.get(`${this.baseURL}/accounts/${accountId}`);
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        throw new Error('Account not found');
      }
      throw new Error(`Failed to fetch account: ${error.message}`);
    }
  }

  /**
   * Get account balance for PI token
   * @param {string} accountId - Pi wallet address
   * @returns {Promise<number>} PI balance
   */
  async getBalance(accountId) {
    try {
      const account = await this.getAccount(accountId);
      // Find PI token balance (native asset or PI asset)
      const piBalance = account.balances?.find(b => 
        b.asset_type === 'native' || 
        (b.asset_code === 'PI' && b.asset_issuer === '')
      );
      return parseFloat(piBalance?.balance || '0');
    } catch (error) {
      console.error('Error getting balance:', error);
      return 0;
    }
  }

  /**
   * Get transactions for an account
   * @param {string} accountId - Pi wallet address
   * @param {Object} options - Query options (limit, cursor, order)
   * @returns {Promise<Object>} Transaction list
   */
  async getAccountTransactions(accountId, options = {}) {
    try {
      const params = new URLSearchParams();
      if (options.limit) params.append('limit', options.limit);
      if (options.cursor) params.append('cursor', options.cursor);
      if (options.order) params.append('order', options.order);

      const url = `${this.baseURL}/accounts/${accountId}/transactions${params.toString() ? '?' + params.toString() : ''}`;
      const response = await axios.get(url);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch transactions: ${error.message}`);
    }
  }

  /**
   * Get payment operations for an account (received payments)
   * @param {string} accountId - Pi wallet address
   * @param {Object} options - Query options (limit, cursor)
   * @returns {Promise<Object>} Payment operations
   */
  async getAccountPayments(accountId, options = {}) {
    try {
      const params = new URLSearchParams();
      params.append('to', accountId); // Payments received by this account
      if (options.limit) params.append('limit', options.limit);
      if (options.cursor) params.append('cursor', options.cursor);

      const url = `${this.baseURL}/payments?${params.toString()}`;
      const response = await axios.get(url);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch payments: ${error.message}`);
    }
  }

  /**
   * Get transaction details by hash
   * @param {string} transactionHash - Transaction hash
   * @returns {Promise<Object>} Transaction details
   */
  async getTransaction(transactionHash) {
    try {
      const response = await axios.get(`${this.baseURL}/transactions/${transactionHash}`);
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        throw new Error('Transaction not found');
      }
      throw new Error(`Failed to fetch transaction: ${error.message}`);
    }
  }

  /**
   * Verify a payment transaction
   * Checks if a transaction hash corresponds to a payment to a specific account
   * @param {string} transactionHash - Transaction hash from Pi payment
   * @param {string} expectedRecipient - Expected recipient wallet address
   * @param {number} expectedAmount - Expected payment amount (optional)
   * @returns {Promise<Object>} Verification result with transaction details
   */
  async verifyPaymentTransaction(transactionHash, expectedRecipient, expectedAmount = null) {
    try {
      const transaction = await this.getTransaction(transactionHash);
      
      // Check if transaction succeeded
      if (transaction.successful !== true) {
        return {
          verified: false,
          error: 'Transaction was not successful',
          transaction: transaction
        };
      }

      // Find payment operations in the transaction
      const paymentOps = transaction.operations?.filter(op => 
        op.type === 'payment' || op.type_i === 1
      );

      if (!paymentOps || paymentOps.length === 0) {
        return {
          verified: false,
          error: 'No payment operations found in transaction',
          transaction: transaction
        };
      }

      // Check if any payment matches expected recipient
      const matchingPayment = paymentOps.find(op => {
        const recipient = op.to || op.destination;
        const amount = parseFloat(op.amount || '0');
        
        const recipientMatch = recipient === expectedRecipient;
        const amountMatch = expectedAmount === null || 
          Math.abs(amount - expectedAmount) < 0.0001; // Allow small floating point differences
        
        return recipientMatch && amountMatch;
      });

      if (!matchingPayment) {
        return {
          verified: false,
          error: 'No matching payment found in transaction',
          transaction: transaction,
          expectedRecipient,
          expectedAmount
        };
      }

      return {
        verified: true,
        transaction: transaction,
        payment: matchingPayment,
        recipient: matchingPayment.to || matchingPayment.destination,
        amount: parseFloat(matchingPayment.amount || '0'),
        timestamp: transaction.created_at
      };
    } catch (error) {
      return {
        verified: false,
        error: error.message,
        transaction: null
      };
    }
  }

  /**
   * Get recent payments received by an account
   * @param {string} accountId - Pi wallet address
   * @param {number} limit - Number of recent payments to fetch
   * @returns {Promise<Array>} Array of payment operations
   */
  async getRecentPayments(accountId, limit = 10) {
    try {
      const response = await this.getAccountPayments(accountId, { limit });
      return response._embedded?.records || [];
    } catch (error) {
      console.error('Error getting recent payments:', error);
      return [];
    }
  }

  /**
   * Check if an account exists
   * @param {string} accountId - Pi wallet address
   * @returns {Promise<boolean>} True if account exists
   */
  async accountExists(accountId) {
    try {
      await this.getAccount(accountId);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get network info
   * @returns {Promise<Object>} Network information
   */
  async getNetworkInfo() {
    try {
      const response = await axios.get(this.baseURL);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch network info: ${error.message}`);
    }
  }
}

module.exports = new HorizonService();

