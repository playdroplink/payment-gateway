import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import './CheckoutPage.css';
import { API_BASE } from '../config/api';

function CheckoutPage() {
  const { linkId } = useParams();
  const [link, setLink] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [formData, setFormData] = useState({
    email: '',
    answers: {}
  });
  const [processing, setProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState(null);

  useEffect(() => {
    if (linkId) {
      loadLink();
      authenticateUser();
    }
  }, [linkId]);

  const authenticateUser = async () => {
    // Check if Pi SDK is available
    if (typeof window.Pi === 'undefined') {
      console.warn('Pi SDK not loaded. Running in non-Pi environment.');
      setAuthenticated(true); // Allow testing without Pi SDK
      return;
    }

    try {
      const scopes = ['username', 'payments', 'wallet_address'];
      const authResult = await window.Pi.authenticate(scopes, handleIncompletePayment);
      setUser(authResult.user);
      setAuthenticated(true);
      
      // Verify with backend
      try {
        await axios.post(`${API_BASE}/auth/verify`, {
          accessToken: authResult.accessToken,
          uid: authResult.user.uid,
          username: authResult.user.username
        });
      } catch (error) {
        console.error('Backend verification failed:', error);
      }
    } catch (error) {
      console.error('Authentication failed:', error);
      setPaymentError('Authentication failed. Please try again.');
    }
  };

  const handleIncompletePayment = async (payment) => {
    console.log('Incomplete payment found:', payment);
    // Handle incomplete payment
    try {
      await axios.post(`${API_BASE}/payments/pi/${payment.identifier}/complete`, {
        txid: payment.transaction?.txid
      });
    } catch (error) {
      console.error('Error completing incomplete payment:', error);
    }
  };

  const loadLink = async () => {
    try {
      const response = await axios.get(`${API_BASE}/checkout-links/${linkId}`);
      setLink(response.data);
      
      // Initialize answers for questions
      if (response.data.questions) {
        const questions = typeof response.data.questions === 'string' 
          ? JSON.parse(response.data.questions) 
          : response.data.questions;
        
        const initialAnswers = {};
        questions.forEach((q, index) => {
          initialAnswers[index] = '';
        });
        setFormData(prev => ({ ...prev, answers: initialAnswers }));
      }
    } catch (error) {
      if (error.code === 'ERR_NETWORK' || error.message.includes('Network Error')) {
        setPaymentError('Network error: Please check if the backend server is running.');
      } else if (error.response) {
        console.error('Error loading checkout link:', error.response.status, error.response.data);
        setPaymentError('Failed to load checkout link: ' + (error.response.data?.error || 'Server error'));
      } else {
        console.error('Error loading checkout link:', error.message);
        setPaymentError('Failed to load checkout link');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFreeJoin = async () => {
    setProcessing(true);
    try {
      // For free links, record the access (optional - you can add a backend endpoint for this)
      // For now, just complete the flow
      console.log('Free access granted for:', link.product_name);
      
      // Small delay for better UX
      await new Promise(resolve => setTimeout(resolve, 500));
      
      alert('✅ Successfully joined!');
      
      if (link.redirect_url) {
        window.location.href = link.redirect_url;
      }
    } catch (error) {
      console.error('Error processing free join:', error);
      setPaymentError('Failed to process request');
    } finally {
      setProcessing(false);
    }
  };

  const handlePayment = async () => {
    if (link.payment_type === 'Free') {
      return handleFreeJoin();
    }

    if (!authenticated || !user) {
      setPaymentError('Please authenticate first');
      return;
    }

    if (typeof window.Pi === 'undefined') {
      setPaymentError('Pi SDK not available. Please use Pi Browser.');
      return;
    }

    setProcessing(true);
    setPaymentError(null);

    try {
      // Get merchant's payment wallet address
      let recipientWallet = null;
      try {
        const merchantResponse = await axios.get(`${API_BASE}/merchants/${link.merchant_address}`);
        recipientWallet = merchantResponse.data.payment_wallet_address;
        
        if (!recipientWallet) {
          setPaymentError('Merchant has not set up a payment wallet address. Please contact the merchant.');
          setProcessing(false);
          return;
        }
      } catch (error) {
        console.error('Error fetching merchant wallet:', error);
        setPaymentError('Failed to retrieve merchant payment information. Please try again.');
        setProcessing(false);
        return;
      }

      // Create payment using Pi SDK
      window.Pi.createPayment(
        {
          amount: parseFloat(link.amount),
          memo: `Payment for ${link.product_name}`,
          recipient: recipientWallet,
          metadata: {
            link_id: linkId,
            product_name: link.product_name,
            email: formData.email,
            answers: formData.answers
          }
        },
        {
          onReadyForServerApproval: async (paymentId) => {
            try {
              // Create payment record in our database
              await axios.post(`${API_BASE}/payments`, {
                link_id: linkId,
                pi_payment_id: paymentId,
                payer_uid: user.uid,
                amount: link.amount,
                metadata: {
                  email: formData.email,
                  answers: formData.answers,
                  product_name: link.product_name
                }
              });

              // Server-side approval
              await axios.post(`${API_BASE}/payments/pi/${paymentId}/approve`);
            } catch (error) {
              console.error('Error in server approval:', error);
              setPaymentError('Failed to approve payment');
            }
          },
          onReadyForServerCompletion: async (paymentId, txid) => {
            try {
              // Server-side completion
              const response = await axios.post(`${API_BASE}/payments/pi/${paymentId}/complete`, {
                txid
              });

              if (response.data.status.developer_completed) {
                alert('✅ Payment successful! Thank you for your purchase.');
                if (link.redirect_url) {
                  window.location.href = link.redirect_url;
                } else {
                  // Redirect to dashboard or show success page
                  setTimeout(() => {
                    window.location.href = '/';
                  }, 2000);
                }
              } else {
                setPaymentError('Payment verification pending. Please wait...');
              }
            } catch (error) {
              console.error('Error in server completion:', error);
              setPaymentError('Failed to complete payment. Please contact support.');
            } finally {
              setProcessing(false);
            }
          },
          onCancel: (paymentId) => {
            console.log('Payment cancelled:', paymentId);
            setPaymentError('Payment cancelled');
            setProcessing(false);
          },
          onError: (error, payment) => {
            console.error('Payment error:', error, payment);
            setPaymentError(error.message || 'Payment failed');
            setProcessing(false);
          }
        }
      );
    } catch (error) {
      console.error('Error initiating payment:', error);
      setPaymentError('Failed to initiate payment');
      setProcessing(false);
    }
  };

  if (loading) {
    return <div className="checkout-loading">Loading...</div>;
  }

  if (!link) {
    return <div className="checkout-error">Checkout link not found</div>;
  }

  const questions = typeof link.questions === 'string' 
    ? JSON.parse(link.questions || '[]') 
    : (link.questions || []);

  const displayAmount = link.payment_type === 'Free' 
    ? 'Free' 
    : `${parseFloat(link.amount).toFixed(2)} π${link.payment_type === 'Recurring' ? ' / month' : ''}`;

  return (
    <div className="checkout-page">
      <div className="checkout-container">
        <div className="checkout-header">
          <div className="logo-placeholder">📊</div>
          <h1>{link.product_name}</h1>
        </div>

        {!authenticated && typeof window.Pi !== 'undefined' && (
          <div className="auth-prompt">
            <p>Please authenticate to continue with payment</p>
            <button onClick={authenticateUser} className="auth-btn">
              Authenticate with Pi
            </button>
          </div>
        )}

        {authenticated && user && (
          <div className="user-info">
            <p>Logged in as: <strong>{user.username || user.uid}</strong></p>
          </div>
        )}

        <div className="checkout-description">
          <h3>Description</h3>
          <p>{link.description || 'No description provided'}</p>
        </div>

        <div className="checkout-price">
          <span className="price-amount">{displayAmount}</span>
          {link.payment_type === 'Recurring' && link.free_trial_days && (
            <span className="free-trial">Free trial for {link.free_trial_days} days</span>
          )}
        </div>

        <form onSubmit={(e) => { e.preventDefault(); handlePayment(); }} className="checkout-form">
          <div className="form-section">
            <label>Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="your.email@example.com"
              required
            />
          </div>

          {questions.length > 0 && (
            <div className="form-section">
              <h3>Questions</h3>
              {questions.map((q, index) => (
                <div key={index} className="question-field">
                  <label>
                    {q.title}
                    {!q.optional && <span className="required">*</span>}
                  </label>
                  <input
                    type="text"
                    value={formData.answers[index] || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      answers: { ...formData.answers, [index]: e.target.value }
                    })}
                    placeholder={q.placeholder || 'Your answer'}
                    required={!q.optional}
                  />
                </div>
              ))}
            </div>
          )}

          {link.payment_type !== 'Free' && (
            <div className="form-section">
              <label>Payment Method</label>
              <div className="payment-method-info">
                <p>💎 Pay with Pi Network</p>
                <p className="payment-info-text">Your payment will be processed securely through Pi Network</p>
              </div>
            </div>
          )}

          {paymentError && (
            <div className="error-message">
              {paymentError}
            </div>
          )}

          <div className="checkout-total">
            <span>Total</span>
            <span className="total-amount">{displayAmount}</span>
          </div>

          <button 
            type="submit" 
            className="checkout-btn"
            disabled={processing || (!authenticated && typeof window.Pi !== 'undefined')}
          >
            {processing 
              ? 'Processing...' 
              : link.payment_type === 'Free' 
                ? 'Join Free' 
                : authenticated || typeof window.Pi === 'undefined'
                  ? 'Pay with Pi' 
                  : 'Please Authenticate First'
            }
          </button>

          <div className="checkout-footer">
            <span>🔒 Secured by Pi Network</span>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CheckoutPage;
