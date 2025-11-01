import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import axios from 'axios';
import CheckoutLinkCreator from './components/CheckoutLinkCreator';
import CheckoutPage from './components/CheckoutPage';
import Dashboard from './components/Dashboard';
import './App.css';

function AppContent() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [merchantAddress, setMerchantAddress] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Try to authenticate if Pi SDK is available
    if (typeof window.Pi !== 'undefined') {
      authenticateMerchant();
    }
  }, []);

  const authenticateMerchant = async () => {
    try {
      const scopes = ['username', 'payments', 'wallet_address'];
      const authResult = await window.Pi.authenticate(scopes, handleIncompletePayment);
      setUser(authResult.user);
      setAuthenticated(true);
      
      // Use Pi UID as merchant address
      if (authResult.user.uid) {
        setMerchantAddress(authResult.user.uid);
      }
      
      // Verify with backend
      try {
        const { API_BASE } = await import('./config/api');
        await axios.post(`${API_BASE}/auth/verify`, {
          accessToken: authResult.accessToken,
          uid: authResult.user.uid,
          username: authResult.user.username
        });
      } catch (error) {
        // Only log non-network errors to reduce console noise
        if (error.response) {
          console.error('Backend verification failed:', error.response.status, error.response.data);
        } else if (error.code !== 'ERR_NETWORK' && !error.message.includes('Network Error')) {
          console.error('Backend verification failed:', error.message);
        }
        // Silently fail for network errors when backend isn't available
      }
    } catch (error) {
      console.error('Authentication failed:', error);
    }
  };

  const handleIncompletePayment = async (payment) => {
    console.log('Incomplete payment found:', payment);
    // Handle incomplete payment if needed
  };

  return (
    <div className="app">
      <Routes>
        <Route path="/checkout/:linkId" element={<CheckoutPageWrapper />} />
        <Route path="/*" element={
          <>
            <nav className="navbar">
              <div className="nav-container">
                <h1 className="logo">Quantum Pay</h1>
                <div className="nav-links">
                  <button 
                    className={currentPage === 'dashboard' ? 'active' : ''}
                    onClick={() => setCurrentPage('dashboard')}
                  >
                    Dashboard
                  </button>
                  <button 
                    className={currentPage === 'create' ? 'active' : ''}
                    onClick={() => setCurrentPage('create')}
                  >
                    Create Link
                  </button>
                </div>
                {authenticated && user ? (
                  <div className="user-badge">
                    <span>{user.username || user.uid}</span>
                  </div>
                ) : typeof window.Pi !== 'undefined' ? (
                  <button onClick={authenticateMerchant} className="auth-btn-nav">
                    Authenticate with Pi
                  </button>
                ) : (
                  <input
                    type="text"
                    placeholder="Enter Pi wallet address or UID"
                    value={merchantAddress}
                    onChange={(e) => setMerchantAddress(e.target.value)}
                    className="merchant-input"
                  />
                )}
              </div>
            </nav>

            <main className="main-content">
              {currentPage === 'dashboard' && (
                <Dashboard merchantAddress={merchantAddress} />
              )}
              {currentPage === 'create' && (
                <CheckoutLinkCreator 
                  merchantAddress={merchantAddress}
                  onLinkCreated={() => setCurrentPage('dashboard')}
                />
              )}
            </main>
          </>
        } />
      </Routes>
    </div>
  );
}

function CheckoutPageWrapper() {
  const navigate = useNavigate();

  return (
    <div className="app">
      <nav className="navbar">
        <div className="nav-container">
          <h1 className="logo">Quantum Pay</h1>
          <button onClick={() => navigate('/')} className="back-btn">
            ← Back to Dashboard
          </button>
        </div>
      </nav>
      <CheckoutPage />
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
