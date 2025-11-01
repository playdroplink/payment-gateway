# Pi Network Integration Guide

This application is fully integrated with Pi Network for payments. Merchants can create checkout links and receive payments in Pi (π) from customers.

## Setup Instructions

### 1. Register Your App in Pi Developer Portal

1. Open Pi Browser and navigate to `pi://develop.pi` or visit `https://develop.pinet.com`
2. Click "New App" to register your application
3. Fill in the required fields:
   - **App Network**: Choose Mainnet for production or Testnet for testing
   - **URL**: Your app's URL
   - **Payment Wallet**: Your Pi wallet address for receiving payments

### 2. Get Your Server API Key

1. In the Developer Portal, navigate to your app settings
2. Find your **Server API Key**
3. Copy this key - you'll need it for the backend

### 3. Configure Backend Environment

1. Create a `.env` file in the `backend` directory:
```bash
cd backend
cp .env.example .env
```

2. Edit `.env` and add your Pi API Key:
```
PI_API_KEY=your_server_api_key_here
PI_API_BASE=https://api.minepi.com/v2
PORT=3001
```

For testing/sandbox:
```
PI_API_KEY=your_testnet_api_key_here
PI_API_BASE=https://sandbox.minepi.com/v2
PORT=3001
```

### 4. Start the Application

1. **Backend**:
```bash
cd backend
npm install
npm start
```

2. **Frontend**:
```bash
cd frontend
npm install
npm run dev
```

## How It Works

### For Merchants (Sellers)

1. **Authenticate with Pi**: Click "Authenticate with Pi" button in the dashboard
2. **Create Checkout Links**: 
   - Go to "Create Link"
   - Enter product details
   - Set pricing in Pi (π)
   - Configure advanced options
   - Create the link
3. **Share Your Link**: Copy and share your checkout link with customers
4. **Receive Payments**: Payments go directly to your Pi wallet address

### For Customers (Buyers)

1. **Open Checkout Link**: Click on the checkout link shared by the merchant
2. **Authenticate**: Authenticate with Pi Network (required for payments)
3. **Complete Payment**: 
   - Review product details
   - Answer any questions
   - Confirm payment
   - Payment is processed through Pi Network

## Payment Flow

The application follows Pi Network's recommended payment flow:

1. **Payment Creation**: Customer initiates payment via `Pi.createPayment()`
2. **Server-Side Approval**: Backend approves payment via Pi Platform API
3. **User Transaction**: Customer signs and submits transaction on Pi Blockchain
4. **Server-Side Completion**: Backend verifies and completes payment via Pi Platform API
5. **Delivery**: Product/service is delivered to customer

## Important Notes

### Security

- **Never expose your Server API Key** to the frontend
- Always verify payments server-side before delivering products
- Use the Pi Platform API to verify payment status
- Check `status.developer_completed` before fulfilling orders

### Testing

- Use Pi Testnet for development and testing
- Test payments with small amounts first
- Verify payment flow end-to-end before going live

### Production Checklist

- [ ] App registered in Pi Developer Portal
- [ ] Server API Key configured in backend `.env`
- [ ] App wallet connected to receive payments
- [ ] Domain verified in Developer Portal
- [ ] HTTPS enabled for production
- [ ] Payment flow tested on Testnet
- [ ] Error handling implemented
- [ ] Payment verification logic in place

## API Endpoints

### Backend Endpoints

- `POST /api/auth/verify` - Verify Pi user authentication
- `POST /api/payments` - Create payment record
- `POST /api/payments/pi/:piPaymentId/approve` - Approve Pi payment
- `POST /api/payments/pi/:piPaymentId/complete` - Complete Pi payment
- `GET /api/payments/pi/:piPaymentId` - Get Pi payment status

### Frontend Integration

The frontend uses Pi SDK methods:
- `Pi.authenticate()` - Authenticate user
- `Pi.createPayment()` - Create payment

## Troubleshooting

### Payment Not Processing

1. Check that Pi API Key is correctly configured
2. Verify the payment was approved server-side
3. Check Pi Platform API response for errors
4. Verify payment status in Developer Portal

### Authentication Issues

1. Ensure Pi SDK is loaded (check browser console)
2. Verify app is opened in Pi Browser
3. Check that user has granted necessary scopes
4. Verify backend authentication endpoint is working

### Sandbox/Testnet

- Use `sandbox: true` in Pi SDK init for testnet
- Set `PI_API_BASE` to sandbox URL in backend
- Test payments are not real Pi - they're for testing only

## Support

For Pi Network specific issues:
- [Pi Developer Portal](https://develop.pinet.com)
- [Pi Platform API Docs](https://developers.minepi.com)
- [Pi SDK Documentation](https://developers.minepi.com/sdk)

For application issues, check the main README.md file.

