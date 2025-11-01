// Load environment variables
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
      // Get payment record to update stock
      db.get(
        'SELECT * FROM payments WHERE pi_payment_id = ?',
        [piPaymentId],
        (err, payment) => {
          if (!err && payment) {
            // Update stock if applicable
            db.get(
              'SELECT * FROM checkout_links WHERE link_id = ?',
              [payment.link_id],
              (linkErr, link) => {
                if (!linkErr && link && link.stock > 0) {
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
              }
            );
          }
        }
      );

      // Update payment status in database
      db.run(
        'UPDATE payments SET status = ?, tx_hash = ?, developer_completed = 1, paid_at = CURRENT_TIMESTAMP WHERE pi_payment_id = ?',
        ['completed', txid, piPaymentId],
        (err) => {
          if (err) {
            console.error('Error updating payment completion status:', err);
          }
        }
      );
    }

    res.json(response.data);
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

    // Store/update merchant info
    db.run(
      `INSERT OR REPLACE INTO merchants (wallet_address, pi_uid, username) 
       VALUES (?, ?, ?)`,
      [response.data.uid || uid, response.data.uid || uid, username || response.data.username],
      (err) => {
        if (err) {
          console.error('Error storing merchant:', err);
        }
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

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    pi_api_configured: !!PI_API_KEY,
    database: 'connected'
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

