// Load environment variables
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const horizonService = require('./services/horizon');

const app = express();
const PORT = process.env.PORT || 3001;

// Pi Platform API Configuration
const PI_API_BASE = process.env.PI_API_BASE || 'https://api.minepi.com/v2';
const PI_API_KEY = process.env.PI_API_KEY || ''; // Set this in your environment variables

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Initialize SQLite database
const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Database connected successfully');
  }
});

// Initialize database tables
db.serialize(() => {
  // Checkout links table
  db.run(`
    CREATE TABLE IF NOT EXISTS checkout_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      link_id TEXT UNIQUE NOT NULL,
      merchant_address TEXT NOT NULL,
      product_name TEXT NOT NULL,
      description TEXT,
      amount REAL NOT NULL,
      payment_type TEXT NOT NULL,
      stock INTEGER DEFAULT 0,
      current_stock INTEGER DEFAULT 0,
      active BOOLEAN DEFAULT 1,
      redirect_url TEXT,
      internal_name TEXT,
      questions TEXT,
      waitlist_enabled BOOLEAN DEFAULT 0,
      auto_expire_days INTEGER,
      free_trial_days INTEGER,
      initial_fee REAL DEFAULT 0,
      split_pay_installments INTEGER DEFAULT 0,
      cancellation_discount_percent REAL DEFAULT 0,
      cancellation_discount_type TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Payments table
  db.run(`
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_id TEXT UNIQUE NOT NULL,
      pi_payment_id TEXT,
      link_id TEXT NOT NULL,
      payer_address TEXT NOT NULL,
      payer_uid TEXT,
      amount REAL NOT NULL,
      status TEXT NOT NULL,
      tx_hash TEXT,
      paid_at DATETIME,
      refunded BOOLEAN DEFAULT 0,
      metadata TEXT,
      developer_approved BOOLEAN DEFAULT 0,
      developer_completed BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Merchants table for Pi wallet addresses
  db.run(`
    CREATE TABLE IF NOT EXISTS merchants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wallet_address TEXT UNIQUE NOT NULL,
      pi_uid TEXT,
      username TEXT,
      payment_wallet_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Products table
  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      merchant_address TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('Error creating products table:', err);
    } else {
      console.log('Database tables initialized successfully');
    }
  });
});

// Generate unique link ID
function generateLinkId() {
  return 'link_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// API Routes

// Get all products for a merchant
app.get('/api/products', (req, res) => {
  const merchantAddress = req.query.merchant;
  
  if (!merchantAddress) {
    return res.status(400).json({ error: 'Merchant address required' });
  }

  db.all(
    'SELECT * FROM products WHERE merchant_address = ? ORDER BY created_at DESC',
    [merchantAddress],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(rows);
    }
  );
});

// Create a product
app.post('/api/products', (req, res) => {
  const { name, description, merchant_address } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Product name is required' });
  }

  if (!merchant_address || !merchant_address.trim()) {
    return res.status(400).json({ error: 'Merchant address is required' });
  }

  db.run(
    'INSERT INTO products (name, description, merchant_address) VALUES (?, ?, ?)',
    [name.trim(), (description || '').trim(), merchant_address.trim()],
    function(err) {
      if (err) {
        console.error('Error creating product:', err);
        return res.status(500).json({ 
          error: 'Failed to create product',
          details: err.message 
        });
      }
      res.json({ 
        id: this.lastID, 
        name: name.trim(), 
        description: description || '', 
        merchant_address: merchant_address.trim(),
        created_at: new Date().toISOString()
      });
    }
  );
});

// Create a checkout link
app.post('/api/checkout-links', (req, res) => {
  const {
    merchant_address,
    product_name,
    description,
    amount,
    payment_type,
    stock,
    redirect_url,
    internal_name,
    questions,
    waitlist_enabled,
    auto_expire_days,
    free_trial_days,
    initial_fee,
    split_pay_installments,
    cancellation_discount_percent,
    cancellation_discount_type
  } = req.body;

  // Validate required fields
  if (!merchant_address || !merchant_address.trim()) {
    return res.status(400).json({ error: 'Merchant address is required' });
  }

  if (!product_name || !product_name.trim()) {
    return res.status(400).json({ error: 'Product name is required' });
  }

  if (!payment_type || !['Free', 'One-time', 'Recurring'].includes(payment_type)) {
    return res.status(400).json({ error: 'Valid payment type is required (Free, One-time, or Recurring)' });
  }

  const linkId = generateLinkId();
  // Ensure stock is a valid number
  const stockNum = typeof stock === 'number' ? stock : (parseInt(stock) || 0);
  const currentStock = stockNum > 0 ? stockNum : 0;

  // Validate amount for paid types
  if (payment_type !== 'Free') {
    const amountNum = parseFloat(amount);
    if (!amount || isNaN(amountNum) || amountNum < 0) {
      return res.status(400).json({ error: 'Valid amount greater than or equal to 0 is required for paid payment types' });
    }
  }

  db.run(
    `INSERT INTO checkout_links (
      link_id, merchant_address, product_name, description, amount, payment_type,
      stock, current_stock, redirect_url, internal_name, questions,
      waitlist_enabled, auto_expire_days, free_trial_days, initial_fee,
      split_pay_installments, cancellation_discount_percent, cancellation_discount_type
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      linkId, 
      merchant_address.trim(), 
      product_name.trim(), 
      (description || '').trim(), 
      payment_type === 'Free' ? 0 : parseFloat(amount) || 0,
      payment_type, 
      stockNum, 
      currentStock, 
      (redirect_url || '').trim(),
      (internal_name || '').trim(), 
      JSON.stringify(questions || []), 
      waitlist_enabled ? 1 : 0,
      auto_expire_days || null, 
      free_trial_days || null, 
      parseFloat(initial_fee) || 0,
      parseInt(split_pay_installments) || 0, 
      parseFloat(cancellation_discount_percent) || 0,
      cancellation_discount_type || null
    ],
    function(err) {
      if (err) {
        console.error('Database error creating checkout link:', err);
        return res.status(500).json({ 
          error: 'Failed to create checkout link',
          details: err.message 
        });
      }

      res.json({
        id: this.lastID,
        link_id: linkId,
        merchant_address: merchant_address.trim(),
        product_name: product_name.trim(),
        description: description || '',
        amount: payment_type === 'Free' ? 0 : parseFloat(amount) || 0,
        payment_type,
        stock: currentStock,
        redirect_url: redirect_url || '',
        internal_name: internal_name || '',
        active: true,
        created_at: new Date().toISOString()
      });
    }
  );
});

// Get checkout link by ID
app.get('/api/checkout-links/:linkId', (req, res) => {
  const { linkId } = req.params;

  db.get(
    'SELECT * FROM checkout_links WHERE link_id = ?',
    [linkId],
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (!row) {
        return res.status(404).json({ error: 'Checkout link not found' });
      }

      // Parse questions JSON
      if (row.questions) {
        try {
          row.questions = JSON.parse(row.questions);
        } catch (e) {
          row.questions = [];
        }
      }

      res.json(row);
    }
  );
});

// Get all checkout links for a merchant
app.get('/api/checkout-links', (req, res) => {
  const merchantAddress = req.query.merchant;

  if (!merchantAddress) {
    return res.status(400).json({ error: 'Merchant address required' });
  }

  db.all(
    'SELECT * FROM checkout_links WHERE merchant_address = ? ORDER BY created_at DESC',
    [merchantAddress],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      // Parse questions JSON for each row
      rows.forEach(row => {
        if (row.questions) {
          try {
            row.questions = JSON.parse(row.questions);
          } catch (e) {
            row.questions = [];
          }
        }
      });

      res.json(rows);
    }
  );
});

// Update checkout link
app.put('/api/checkout-links/:linkId', (req, res) => {
  const { linkId } = req.params;
  const updates = req.body;

  const allowedFields = [
    'product_name', 'description', 'amount', 'payment_type', 'stock',
    'redirect_url', 'internal_name', 'questions', 'waitlist_enabled',
    'auto_expire_days', 'active', 'free_trial_days', 'initial_fee',
    'split_pay_installments', 'cancellation_discount_percent', 'cancellation_discount_type'
  ];

  const setClause = [];
  const values = [];

  allowedFields.forEach(field => {
    if (updates[field] !== undefined) {
      setClause.push(`${field} = ?`);
      if (field === 'questions') {
        values.push(JSON.stringify(updates[field]));
      } else {
        values.push(updates[field]);
      }
    }
  });

  if (setClause.length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }

  values.push(linkId);

  db.run(
    `UPDATE checkout_links SET ${setClause.join(', ')} WHERE link_id = ?`,
    values,
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ message: 'Updated successfully', changes: this.changes });
    }
  );
});

// Create a payment (Pi payment initiated from frontend)
app.post('/api/payments', (req, res) => {
  const {
    link_id,
    pi_payment_id,
    payer_uid,
    amount,
    metadata
  } = req.body;

  if (!link_id || !pi_payment_id || !payer_uid) {
    return res.status(400).json({ error: 'Required fields missing' });
  }

  const paymentId = 'pay_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

  // First, verify the checkout link exists and is active
  db.get(
    'SELECT * FROM checkout_links WHERE link_id = ? AND active = 1',
    [link_id],
    (err, link) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (!link) {
        return res.status(404).json({ error: 'Checkout link not found or inactive' });
      }

      // Check stock if applicable
      if (link.stock > 0 && link.current_stock <= 0) {
        return res.status(400).json({ error: 'Out of stock' });
      }

      // Create payment record
      db.run(
        `INSERT INTO payments (
          payment_id, pi_payment_id, link_id, payer_uid, amount, status, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          paymentId, 
          pi_payment_id, 
          link_id, 
          payer_uid, 
          amount || link.amount, 
          'pending', 
          JSON.stringify(metadata || {})
        ],
        function(paymentErr) {
          if (paymentErr) {
            return res.status(500).json({ error: paymentErr.message });
          }

          res.json({
            id: this.lastID,
            payment_id: paymentId,
            pi_payment_id,
            link_id,
            payer_uid,
            amount,
            status: 'pending'
          });
        }
      );
    }
  );
});

// Approve a Pi payment (Server-Side Approval)
app.post('/api/payments/:piPaymentId/approve', async (req, res) => {
  const { piPaymentId } = req.params;

  if (!PI_API_KEY) {
    return res.status(500).json({ error: 'Pi API Key not configured' });
  }

  try {
    // Call Pi Platform API to approve the payment
    const response = await axios.post(
      `${PI_API_BASE}/payments/${piPaymentId}/approve`,
      {},
      {
        headers: {
          'Authorization': `Key ${PI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // Update payment status in database
    db.run(
      'UPDATE payments SET developer_approved = 1 WHERE pi_payment_id = ?',
      [piPaymentId],
      (err) => {
        if (err) {
          console.error('Error updating payment approval status:', err);
        }
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error('Error approving payment:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: 'Failed to approve payment',
      details: error.response?.data || error.message
    });
  }
});

// Complete a Pi payment (Server-Side Completion)
app.post('/api/payments/:piPaymentId/complete', async (req, res) => {
  const { piPaymentId } = req.params;
  const { txid } = req.body;

  if (!PI_API_KEY) {
    return res.status(500).json({ error: 'Pi API Key not configured' });
  }

  if (!txid) {
    return res.status(400).json({ error: 'Transaction ID (txid) required' });
  }

  try {
    // Get payment record first to verify recipient
    const payment = await new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM payments WHERE pi_payment_id = ?',
        [piPaymentId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!payment) {
      return res.status(404).json({ error: 'Payment record not found' });
    }

    // Get checkout link to find merchant address
    const link = await new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM checkout_links WHERE link_id = ?',
        [payment.link_id],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!link) {
      return res.status(404).json({ error: 'Checkout link not found' });
    }

    // Get merchant payment wallet address
    const merchant = await new Promise((resolve, reject) => {
      db.get(
        'SELECT payment_wallet_address FROM merchants WHERE wallet_address = ?',
        [link.merchant_address],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    const recipientWallet = merchant?.payment_wallet_address || link.merchant_address;

    // Verify transaction on-chain using Horizon API
    let chainVerification = null;
    try {
      chainVerification = await horizonService.verifyPaymentTransaction(
        txid,
        recipientWallet,
        parseFloat(payment.amount)
      );

      if (!chainVerification.verified) {
        console.warn('Chain verification failed:', chainVerification.error);
        // Continue with Pi API completion but log the issue
      } else {
        console.log('Payment verified on-chain:', {
          txid,
          recipient: chainVerification.recipient,
          amount: chainVerification.amount
        });
      }
    } catch (verifyError) {
      console.error('Error verifying transaction on-chain:', verifyError);
      // Continue with Pi API completion even if chain verification fails
    }

    // Call Pi Platform API to complete the payment
    const response = await axios.post(
      `${PI_API_BASE}/payments/${piPaymentId}/complete`,
      { txid },
      {
        headers: {
          'Authorization': `Key ${PI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // Verify payment status from Pi API response
    if (response.data.status.developer_completed) {
      // Update stock if applicable
      if (link && link.stock > 0) {
        db.run(
          'UPDATE checkout_links SET current_stock = current_stock - 1 WHERE link_id = ?',
          [payment.link_id],
          (stockErr) => {
            if (stockErr) {
              console.error('Error updating stock:', stockErr);
            }
          }
        );
      }

      // Update payment status in database with chain verification info
      const metadata = JSON.parse(payment.metadata || '{}');
      if (chainVerification && chainVerification.verified) {
        metadata.chain_verified = true;
        metadata.chain_verification_time = new Date().toISOString();
      } else {
        metadata.chain_verified = false;
      }

      db.run(
        `UPDATE payments 
         SET status = ?, tx_hash = ?, developer_completed = 1, paid_at = CURRENT_TIMESTAMP, metadata = ? 
         WHERE pi_payment_id = ?`,
        ['completed', txid, JSON.stringify(metadata), piPaymentId],
        (err) => {
          if (err) {
            console.error('Error updating payment completion status:', err);
          }
        }
      );
    }

    res.json({
      ...response.data,
      chain_verification: chainVerification
    });
  } catch (error) {
    console.error('Error completing payment:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: 'Failed to complete payment',
      details: error.response?.data || error.message
    });
  }
});

// Get Pi payment status
app.get('/api/payments/pi/:piPaymentId', async (req, res) => {
  const { piPaymentId } = req.params;

  if (!PI_API_KEY) {
    return res.status(500).json({ error: 'Pi API Key not configured' });
  }

  try {
    const response = await axios.get(
      `${PI_API_BASE}/payments/${piPaymentId}`,
      {
        headers: {
          'Authorization': `Key ${PI_API_KEY}`
        }
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error('Error fetching payment:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: 'Failed to fetch payment',
      details: error.response?.data || error.message
    });
  }
});

// Get payment details
app.get('/api/payments/:paymentId', (req, res) => {
  const { paymentId } = req.params;

  db.get(
    'SELECT * FROM payments WHERE payment_id = ?',
    [paymentId],
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (!row) {
        return res.status(404).json({ error: 'Payment not found' });
      }

      if (row.metadata) {
        try {
          row.metadata = JSON.parse(row.metadata);
        } catch (e) {
          row.metadata = {};
        }
      }

      res.json(row);
    }
  );
});

// Get payments for a checkout link
app.get('/api/checkout-links/:linkId/payments', (req, res) => {
  const { linkId } = req.params;

  db.all(
    'SELECT * FROM payments WHERE link_id = ? ORDER BY created_at DESC',
    [linkId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      rows.forEach(row => {
        if (row.metadata) {
          try {
            row.metadata = JSON.parse(row.metadata);
          } catch (e) {
            row.metadata = {};
          }
        }
      });

      res.json(rows);
    }
  );
});

// Verify user authentication
app.post('/api/auth/verify', async (req, res) => {
  const { accessToken, uid, username } = req.body;

  if (!accessToken) {
    return res.status(400).json({ error: 'Access token required' });
  }

  try {
    // Verify with Pi Platform API
    const response = await axios.get(`${PI_API_BASE}/me`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    const merchantId = response.data.uid || uid;
    
    // Check if merchant exists and get payment wallet if set
    db.get(
      'SELECT payment_wallet_address FROM merchants WHERE wallet_address = ?',
      [merchantId],
      (err, existing) => {
        if (err) {
          console.error('Error checking merchant:', err);
        }
        
        // Store/update merchant info (preserve payment_wallet_address if exists)
        const paymentWallet = existing?.payment_wallet_address || null;
        db.run(
          `INSERT OR REPLACE INTO merchants (wallet_address, pi_uid, username, payment_wallet_address, updated_at) 
           VALUES (?, ?, ?, COALESCE(?, payment_wallet_address), CURRENT_TIMESTAMP)`,
          [merchantId, merchantId, username || response.data.username, paymentWallet],
          (err) => {
            if (err) {
              console.error('Error storing merchant:', err);
            }
          }
        );
      }
    );

    res.json({ verified: true, user: response.data });
  } catch (error) {
    console.error('Auth verification error:', error.response?.data || error.message);
    res.status(error.response?.status || 401).json({
      error: 'Authentication failed',
      details: error.response?.data || error.message
    });
  }
});

// Get merchant info including payment wallet
app.get('/api/merchants/:merchantAddress', (req, res) => {
  const { merchantAddress } = req.params;

  db.get(
    'SELECT wallet_address, pi_uid, username, payment_wallet_address, created_at, updated_at FROM merchants WHERE wallet_address = ?',
    [merchantAddress],
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (!row) {
        return res.status(404).json({ error: 'Merchant not found' });
      }
      res.json(row);
    }
  );
});

// Update merchant payment wallet address
app.put('/api/merchants/:merchantAddress/wallet', async (req, res) => {
  const { merchantAddress } = req.params;
  const { payment_wallet_address } = req.body;

  if (!payment_wallet_address || !payment_wallet_address.trim()) {
    return res.status(400).json({ error: 'Payment wallet address is required' });
  }

  // Basic validation - Pi wallet addresses are typically alphanumeric
  const walletPattern = /^[A-Za-z0-9]+$/;
  if (!walletPattern.test(payment_wallet_address.trim())) {
    return res.status(400).json({ error: 'Invalid wallet address format' });
  }

  // Verify wallet address exists on Pi Network using Horizon API
  try {
    const accountExists = await horizonService.accountExists(payment_wallet_address.trim());
    if (!accountExists) {
      return res.status(400).json({ 
        error: 'Wallet address does not exist on Pi Network',
        suggestion: 'Please verify the wallet address is correct'
      });
    }
  } catch (verifyError) {
    console.error('Error verifying wallet address:', verifyError);
    // Continue anyway - Horizon API might be temporarily unavailable
  }

  db.run(
    `UPDATE merchants 
     SET payment_wallet_address = ?, updated_at = CURRENT_TIMESTAMP 
     WHERE wallet_address = ?`,
    [payment_wallet_address.trim(), merchantAddress],
    function(err) {
      if (err) {
        console.error('Error updating payment wallet:', err);
        return res.status(500).json({ error: 'Failed to update payment wallet address', details: err.message });
      }
      if (this.changes === 0) {
        // Merchant doesn't exist, create it
        db.run(
          'INSERT INTO merchants (wallet_address, payment_wallet_address) VALUES (?, ?)',
          [merchantAddress, payment_wallet_address.trim()],
          function(insertErr) {
            if (insertErr) {
              return res.status(500).json({ error: 'Failed to create merchant record', details: insertErr.message });
            }
            res.json({ 
              message: 'Payment wallet address set successfully',
              wallet_address: merchantAddress,
              payment_wallet_address: payment_wallet_address.trim()
            });
          }
        );
      } else {
        res.json({ 
          message: 'Payment wallet address updated successfully',
          wallet_address: merchantAddress,
          payment_wallet_address: payment_wallet_address.trim()
        });
      }
    }
  );
});

// Get account information from Pi Network Horizon API
app.get('/api/horizon/account/:accountId', async (req, res) => {
  const { accountId } = req.params;

  try {
    const account = await horizonService.getAccount(accountId);
    res.json(account);
  } catch (error) {
    res.status(error.message === 'Account not found' ? 404 : 500).json({
      error: error.message
    });
  }
});

// Get account balance
app.get('/api/horizon/account/:accountId/balance', async (req, res) => {
  const { accountId } = req.params;

  try {
    const balance = await horizonService.getBalance(accountId);
    res.json({ account: accountId, balance });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

// Get account transactions
app.get('/api/horizon/account/:accountId/transactions', async (req, res) => {
  const { accountId } = req.params;
  const { limit = 10, cursor, order = 'desc' } = req.query;

  try {
    const transactions = await horizonService.getAccountTransactions(accountId, {
      limit: parseInt(limit),
      cursor,
      order
    });
    res.json(transactions);
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

// Get account payments (received)
app.get('/api/horizon/account/:accountId/payments', async (req, res) => {
  const { accountId } = req.params;
  const { limit = 10, cursor } = req.query;

  try {
    const payments = await horizonService.getAccountPayments(accountId, {
      limit: parseInt(limit),
      cursor
    });
    res.json(payments);
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

// Verify a transaction
app.post('/api/horizon/verify-transaction', async (req, res) => {
  const { txid, recipient, amount } = req.body;

  if (!txid || !recipient) {
    return res.status(400).json({
      error: 'Transaction hash (txid) and recipient are required'
    });
  }

  try {
    const verification = await horizonService.verifyPaymentTransaction(
      txid,
      recipient,
      amount ? parseFloat(amount) : null
    );
    res.json(verification);
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

// Get transaction details
app.get('/api/horizon/transaction/:txid', async (req, res) => {
  const { txid } = req.params;

  try {
    const transaction = await horizonService.getTransaction(txid);
    res.json(transaction);
  } catch (error) {
    res.status(error.message === 'Transaction not found' ? 404 : 500).json({
      error: error.message
    });
  }
});

// Get network info
app.get('/api/horizon/network', async (req, res) => {
  try {
    const networkInfo = await horizonService.getNetworkInfo();
    res.json(networkInfo);
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

// Health check
app.get('/api/health', async (req, res) => {
  let horizonStatus = 'unknown';
  try {
    const networkInfo = await horizonService.getNetworkInfo();
    horizonStatus = 'connected';
  } catch (error) {
    horizonStatus = 'disconnected';
  }

  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    pi_api_configured: !!PI_API_KEY,
    database: 'connected',
    horizon_api: horizonStatus
  });
});

// Test database connection
app.get('/api/test-db', (req, res) => {
  db.get('SELECT 1 as test', (err, row) => {
    if (err) {
      return res.status(500).json({ 
        status: 'error', 
        error: 'Database connection failed',
        details: err.message 
      });
    }
    res.json({ 
      status: 'ok', 
      message: 'Database connection successful',
      test: row 
    });
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Quantum Pay Backend Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🔧 Database: ${dbPath}`);
  if (!PI_API_KEY) {
    console.warn('⚠️  WARNING: PI_API_KEY not set. Payment processing will not work.');
  }
});

