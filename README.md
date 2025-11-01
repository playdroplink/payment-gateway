# Quantum Pay - Pi Network Checkout Links Application

A comprehensive payment gateway system integrated with Pi Network, allowing merchants to create checkout links for their digital products and receive payments in Pi (π).

## Features

### Pi Network Integration
- ✅ **Full Pi SDK Integration**: Authenticate users and process payments
- ✅ **Server-Side Payment Flow**: Follows Pi Network's recommended payment flow
- ✅ **Payment Approval & Completion**: Proper server-side approval and completion
- ✅ **User Authentication**: Seamless Pi Network authentication
- ✅ **Payment Verification**: Verify all payments via Pi Platform API

### Smart Contract (Solidity)
- ✅ Create checkout links with various payment types (Free, One-time, Recurring)
- ✅ Process payments with automatic fee distribution
- ✅ Stock management
- ✅ Refund functionality
- ✅ Payment status tracking

### Backend API (Node.js/Express)
- ✅ RESTful API for checkout links management
- ✅ Pi Platform API integration for payments
- ✅ Product management
- ✅ Payment processing with Pi Network
- ✅ SQLite database for data persistence
- ✅ Advanced options support:
  - Stock management
  - Waitlist functionality
  - Pre-checkout questions
  - Auto-expire access
  - Redirect URLs
  - Internal naming
  - Free trials
  - Split payments/installments
  - Cancellation discounts

### Frontend (React)
- ✅ Dashboard for viewing all checkout links
- ✅ Pi Network authentication
- ✅ Checkout link creation interface
- ✅ Customer-facing checkout page with Pi payments
- ✅ Responsive design with dark theme

## Quick Start

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Pi Browser (for Pi Network features)
- Pi Developer Portal account

### Installation

1. **Clone and install dependencies**:
```bash
npm run install-all
```

Or manually:
```bash
cd backend && npm install && cd ../frontend && npm install
```

2. **Configure Pi Network API** (Required for payments):

Create `backend/.env`:
```bash
cd backend
cp .env.example .env
```

Edit `.env` and add your Pi Server API Key:
```
PI_API_KEY=your_server_api_key_here
PI_API_BASE=https://api.minepi.com/v2
PORT=3001
```

**To get your API Key:**
1. Open Pi Browser
2. Go to `pi://develop.pi` or visit `https://develop.pinet.com`
3. Register your app (or use existing)
4. Copy your Server API Key from app settings

3. **Start Development Servers**:

Option 1 - Run both together:
```bash
npm run dev
```

Option 2 - Run separately:

Terminal 1 (Backend):
```bash
cd backend
npm run dev
```

Terminal 2 (Frontend):
```bash
cd frontend
npm run dev
```

4. **Open the application**:
- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:3001`

## Usage

### For Merchants

1. **Authenticate with Pi**:
   - Click "Authenticate with Pi" button in the dashboard
   - Grant necessary permissions (username, payments, wallet_address)
   - Your Pi UID will be used as your merchant address

2. **Create Checkout Links**:
   - Click "Create Link"
   - Enter product details
   - Set price in Pi (π)
   - Configure advanced options (stock, questions, etc.)
   - Click "Create checkout link"

3. **Share Your Links**:
   - Go to Dashboard
   - Click "Copy Link" on any checkout link
   - Share with your customers

### For Customers

1. **Open Checkout Link**:
   - Click the checkout link shared by merchant
   - Review product details

2. **Authenticate & Pay**:
   - Authenticate with Pi Network (required)
   - Answer any questions
   - Complete payment using Pi
   - Payment is processed securely through Pi Network

## Payment Flow

The application follows Pi Network's recommended payment flow:

```
1. Customer → Creates payment via Pi.createPayment()
   ↓
2. Backend → Server-Side Approval (Pi Platform API)
   ↓
3. Customer → Signs and submits transaction (Pi Blockchain)
   ↓
4. Backend → Server-Side Completion (Pi Platform API)
   ↓
5. Merchant → Receives payment in Pi wallet
```

## Project Structure

```
payment-gateway/
├── contracts/
│   └── PaymentGateway.sol          # Solidity smart contract
├── backend/
│   ├── server.js                    # Express API server with Pi integration
│   ├── package.json
│   ├── .env.example                 # Environment variables template
│   └── database.sqlite              # SQLite database (auto-created)
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── CheckoutLinkCreator.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   └── CheckoutPage.jsx
│   │   ├── App.jsx                  # Main app with Pi auth
│   │   └── main.jsx
│   ├── index.html                   # Includes Pi SDK
│   └── package.json
├── PI_INTEGRATION.md                # Pi Network integration guide
└── README.md                        # This file
```

## API Endpoints

### Authentication
- `POST /api/auth/verify` - Verify Pi user authentication

### Products
- `GET /api/products?merchant={uid}` - Get all products
- `POST /api/products` - Create a product

### Checkout Links
- `GET /api/checkout-links?merchant={uid}` - Get all links
- `GET /api/checkout-links/:linkId` - Get specific link
- `POST /api/checkout-links` - Create a link
- `PUT /api/checkout-links/:linkId` - Update a link

### Payments (Pi Network)
- `POST /api/payments` - Create payment record
- `POST /api/payments/pi/:piPaymentId/approve` - Approve payment
- `POST /api/payments/pi/:piPaymentId/complete` - Complete payment
- `GET /api/payments/pi/:piPaymentId` - Get payment status
- `GET /api/checkout-links/:linkId/payments` - Get link payments

## Configuration

### Environment Variables (Backend)

Create `backend/.env`:

```env
# Required for Pi Network payments
PI_API_KEY=your_server_api_key_from_developer_portal
PI_API_BASE=https://api.minepi.com/v2

# Optional
PORT=3001

# For Testnet/Sandbox
# PI_API_BASE=https://sandbox.minepi.com/v2
```

### Frontend Configuration

The frontend automatically detects if it's running in Pi Browser and initializes the SDK accordingly. No configuration needed.

## Testing

### Testing Without Pi Browser

The app will work without Pi Browser for development, but:
- Payments won't work (Pi SDK required)
- You can manually enter merchant UID/address
- Use for UI/UX testing only

### Testing with Pi Browser

1. Use Pi Testnet for testing:
   - Set `PI_API_BASE=https://sandbox.minepi.com/v2` in backend `.env`
   - Register test app in Developer Portal (Testnet)

2. Test payment flow:
   - Create a checkout link with small amount
   - Test complete payment flow
   - Verify payment in Developer Portal

## Production Deployment

### Checklist

- [ ] App registered in Pi Developer Portal (Mainnet)
- [ ] Server API Key configured
- [ ] App wallet connected
- [ ] Domain verified
- [ ] HTTPS enabled
- [ ] Environment variables set
- [ ] Payment flow tested
- [ ] Error handling verified
- [ ] Database backed up

### Important Security Notes

- **Never expose Server API Key** to frontend
- Always verify payments server-side before delivery
- Use Pi Platform API to verify payment status
- Check `status.developer_completed` before fulfilling orders
- Implement proper error handling and logging

## Advanced Features

### Free Trial
For recurring subscriptions, add a free trial period (7, 14, or 30 days).

### Split Payments
Enable installment payments by setting the number of installments.

### Pre-checkout Questions
Add custom questions that customers must answer before checkout.

### Stock Management
Set stock limits. Links become unavailable when stock reaches zero.

### Auto-expire Access
Automatically revoke access after specified days.

## Troubleshooting

### Payment Not Processing
1. Verify Pi API Key is correctly set in `.env`
2. Check payment was approved server-side (check logs)
3. Verify Pi Platform API response
4. Check payment status in Developer Portal

### Authentication Issues
1. Ensure app is in Pi Browser
2. Check Pi SDK loaded (browser console)
3. Verify user granted necessary scopes
4. Check backend authentication endpoint

### `npm run dev` Not Working
1. Install dependencies: `npm run install-all`
2. Check both backend and frontend have `node_modules`
3. Ensure ports 3000 and 3001 are available
4. Install concurrently: `npm install -g concurrently` or use separate terminals

## Documentation

- [Pi Integration Guide](./PI_INTEGRATION.md) - Detailed Pi Network setup
- [Pi Developer Portal](https://develop.pinet.com) - Register your app
- [Pi Platform API Docs](https://developers.minepi.com) - API reference
- [Pi SDK Documentation](https://developers.minepi.com/sdk) - SDK reference

## License

MIT License - feel free to use this project for your own applications.

## Support

For Pi Network specific issues:
- Pi Developer Portal: https://develop.pinet.com
- Pi Platform API: https://developers.minepi.com

For application issues, check the troubleshooting section or open an issue.
