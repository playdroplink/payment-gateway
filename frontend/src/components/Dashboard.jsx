import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Dashboard.css';
import { API_BASE } from '../config/api';

function Dashboard({ merchantAddress }) {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [merchantWallet, setMerchantWallet] = useState(null);

  useEffect(() => {
    if (merchantAddress) {
      loadLinks();
      loadMerchantWallet();
    }
  }, [merchantAddress]);

  const loadMerchantWallet = async () => {
    if (!merchantAddress) return;
    
    try {
      const response = await axios.get(`${API_BASE}/merchants/${merchantAddress}`);
      setMerchantWallet(response.data.payment_wallet_address);
    } catch (error) {
      // Silently fail - merchant might not exist yet
      if (error.response?.status !== 404) {
        console.error('Error loading merchant wallet:', error);
      }
    }
  };

  const loadLinks = async () => {
    if (!merchantAddress) return;
    
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE}/checkout-links`, {
        params: { merchant: merchantAddress }
      });
      setLinks(response.data);
    } catch (error) {
      // Only log errors that aren't network/connection issues to reduce console noise
      if (error.response) {
        console.error('Error loading links:', error.response.status, error.response.data);
      } else if (error.code !== 'ERR_NETWORK' && !error.message.includes('Network Error')) {
        console.error('Error loading links:', error.message);
      }
      // Silently fail for network errors when backend isn't available
    } finally {
      setLoading(false);
    }
  };

  const toggleLinkStatus = async (linkId, currentStatus) => {
    try {
      await axios.put(`${API_BASE}/checkout-links/${linkId}`, {
        active: !currentStatus
      });
      loadLinks();
    } catch (error) {
      console.error('Error updating link:', error);
      alert('Failed to update link status');
    }
  };

  const copyLink = (linkId) => {
    const link = `${window.location.origin}/checkout/${linkId}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(link).then(() => {
        alert('Checkout link copied to clipboard!\n\n' + link);
      }).catch(() => {
        // Fallback
        copyToClipboardFallback(link);
      });
    } else {
      copyToClipboardFallback(link);
    }
  };

  const copyToClipboardFallback = (text) => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      alert('Checkout link copied to clipboard!\n\n' + text);
    } catch (err) {
      alert('Please copy this link manually:\n\n' + text);
    }
    document.body.removeChild(textarea);
  };

  if (!merchantAddress) {
    return (
      <div className="dashboard-empty">
        <p>Please enter a merchant address to view your checkout links</p>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div>
          <h2>Checkout Links</h2>
          {merchantWallet ? (
            <p className="wallet-info">Payment Wallet: <span className="wallet-address">{merchantWallet}</span></p>
          ) : (
            <p className="wallet-warning">⚠️ No payment wallet set. Go to Settings to configure.</p>
          )}
        </div>
        <button onClick={loadLinks} className="refresh-btn">Refresh</button>
      </div>

      {loading ? (
        <div className="loading">Loading...</div>
      ) : links.length === 0 ? (
        <div className="dashboard-empty">
          <p>No checkout links found. Create one to get started!</p>
        </div>
      ) : (
        <div className="links-grid">
          {links.map((link) => (
            <div key={link.id} className="link-card">
              <div className="link-header">
                <h3>{link.product_name}</h3>
                <span className={`status ${link.active ? 'active' : 'inactive'}`}>
                  {link.active ? 'Active' : 'Inactive'}
                </span>
              </div>
              
              <p className="link-description">{link.description || 'No description'}</p>
              
              <div className="link-details">
                <div className="detail-item">
                  <span className="detail-label">Type:</span>
                  <span className="detail-value">{link.payment_type}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Amount:</span>
                  <span className="detail-value">
                    {link.payment_type === 'Free' 
                      ? 'Free' 
                      : `${parseFloat(link.amount).toFixed(2)} π`
                    }
                  </span>
                </div>
                {link.stock > 0 && (
                  <div className="detail-item">
                    <span className="detail-label">Stock:</span>
                    <span className="detail-value">{link.current_stock} / {link.stock}</span>
                  </div>
                )}
              </div>

              <div className="link-actions">
                <button
                  onClick={() => copyLink(link.link_id)}
                  className="action-btn copy-btn"
                >
                  Copy Link
                </button>
                <button
                  onClick={() => toggleLinkStatus(link.link_id, link.active)}
                  className={`action-btn ${link.active ? 'deactivate' : 'activate'}`}
                >
                  {link.active ? 'Deactivate' : 'Activate'}
                </button>
              </div>

              <div className="link-id">
                ID: {link.link_id}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Dashboard;

