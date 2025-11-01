import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './MerchantSettings.css';
import { API_BASE } from '../config/api';

function MerchantSettings({ merchantAddress, user }) {
  const [walletAddress, setWalletAddress] = useState('');
  const [currentWallet, setCurrentWallet] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (merchantAddress) {
      loadMerchantInfo();
    }
  }, [merchantAddress]);

  const loadMerchantInfo = async () => {
    if (!merchantAddress) return;
    
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE}/merchants/${merchantAddress}`);
      setCurrentWallet(response.data.payment_wallet_address || '');
      setWalletAddress(response.data.payment_wallet_address || '');
    } catch (error) {
      if (error.response?.status !== 404) {
        console.error('Error loading merchant info:', error);
      }
      // If merchant doesn't exist, that's okay - they can set it up
    } finally {
      setLoading(false);
    }
  };

  const handleSaveWallet = async (e) => {
    e.preventDefault();
    
    if (!walletAddress.trim()) {
      setMessage('Please enter a payment wallet address');
      return;
    }

    setSaving(true);
    setMessage('');
    
    try {
      await axios.put(`${API_BASE}/merchants/${merchantAddress}/wallet`, {
        payment_wallet_address: walletAddress.trim()
      });
      
      setCurrentWallet(walletAddress.trim());
      setMessage('✅ Payment wallet address saved successfully!');
      
      // Clear message after 3 seconds
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      if (error.response) {
        setMessage('❌ ' + (error.response.data?.error || 'Failed to save wallet address'));
      } else if (error.code === 'ERR_NETWORK' || error.message.includes('Network Error')) {
        setMessage('❌ Network error: Please check if the backend server is running.');
      } else {
        setMessage('❌ Failed to save wallet address: ' + error.message);
      }
    } finally {
      setSaving(false);
    }
  };

  // Get wallet from Pi user if available
  const getPiWallet = async () => {
    if (typeof window.Pi !== 'undefined' && user?.walletAddress) {
      setWalletAddress(user.walletAddress);
    } else {
      // Try to get from authenticated user
      try {
        if (user?.uid) {
          // Use UID as wallet if no separate wallet address
          setWalletAddress(user.uid);
        }
      } catch (error) {
        console.error('Error getting Pi wallet:', error);
      }
    }
  };

  const [walletValid, setWalletValid] = useState(null);
  const [walletBalance, setWalletBalance] = useState(null);
  const [checkingWallet, setCheckingWallet] = useState(false);

  const checkWalletAddress = async (address) => {
    if (!address || !address.trim()) {
      setWalletValid(null);
      setWalletBalance(null);
      return;
    }

    setCheckingWallet(true);
    try {
      // Check if wallet exists and get balance
      const [accountResponse, balanceResponse] = await Promise.all([
        axios.get(`${API_BASE}/horizon/account/${address.trim()}`).catch(() => null),
        axios.get(`${API_BASE}/horizon/account/${address.trim()}/balance`).catch(() => null)
      ]);

      if (accountResponse && accountResponse.data) {
        setWalletValid(true);
        if (balanceResponse && balanceResponse.data) {
          setWalletBalance(balanceResponse.data.balance);
        }
      } else {
        setWalletValid(false);
        setWalletBalance(null);
      }
    } catch (error) {
      setWalletValid(false);
      setWalletBalance(null);
    } finally {
      setCheckingWallet(false);
    }
  };

  useEffect(() => {
    // Debounce wallet validation
    const timer = setTimeout(() => {
      if (walletAddress.trim()) {
        checkWalletAddress(walletAddress);
      } else {
        setWalletValid(null);
        setWalletBalance(null);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [walletAddress]);

  if (loading) {
    return <div className="merchant-settings-loading">Loading settings...</div>;
  }

  return (
    <div className="merchant-settings">
      <div className="settings-card">
        <h2>Payment Wallet Setup</h2>
        <p className="settings-description">
          Set your Pi wallet address where you'll receive payments from customers.
        </p>

        <form onSubmit={handleSaveWallet} className="wallet-form">
          <div className="form-group">
            <label htmlFor="wallet-address">Payment Wallet Address</label>
            <div className="wallet-input-group">
              <input
                id="wallet-address"
                type="text"
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                placeholder="Enter your Pi wallet address"
                className={`wallet-input ${walletValid === false ? 'invalid' : ''} ${walletValid === true ? 'valid' : ''}`}
                required
              />
              {user && (
                <button
                  type="button"
                  onClick={getPiWallet}
                  className="use-pi-wallet-btn"
                  title="Use your Pi account wallet"
                >
                  Use Pi Wallet
                </button>
              )}
            </div>
            <div className="wallet-validation">
              {checkingWallet && (
                <span className="validation-checking">Checking wallet...</span>
              )}
              {!checkingWallet && walletValid === true && (
                <span className="validation-valid">
                  ✓ Valid wallet address
                  {walletBalance !== null && (
                    <span className="wallet-balance"> • Balance: {parseFloat(walletBalance).toFixed(2)} π</span>
                  )}
                </span>
              )}
              {!checkingWallet && walletValid === false && walletAddress.trim() && (
                <span className="validation-invalid">
                  ✗ Invalid wallet address or account does not exist
                </span>
              )}
            </div>
            <p className="input-hint">
              This is where payments will be sent when customers purchase your products.
            </p>
          </div>

          {message && (
            <div className={`settings-message ${message.startsWith('✅') ? 'success' : 'error'}`}>
              {message}
            </div>
          )}

          <div className="current-wallet-info">
            {currentWallet ? (
              <div className="wallet-display">
                <span className="wallet-label">Current Payment Wallet:</span>
                <span className="wallet-value">{currentWallet}</span>
              </div>
            ) : (
              <div className="wallet-warning">
                ⚠️ No payment wallet set. Payments cannot be received until you set one.
              </div>
            )}
          </div>

          <button 
            type="submit" 
            className="save-wallet-btn"
            disabled={saving || !walletAddress.trim()}
          >
            {saving ? 'Saving...' : currentWallet ? 'Update Wallet Address' : 'Set Wallet Address'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default MerchantSettings;

