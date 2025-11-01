# Quick Start Guide

Get your payment gateway checkout links app running in minutes!

## Prerequisites
- Node.js 16+ installed
- npm or yarn

## Step 1: Install Dependencies

Install all dependencies for backend and frontend:

```bash
npm run install-all
```

Or manually:
```bash
cd backend && npm install && cd ../frontend && npm install
```

## Step 2: Start the Backend

In a terminal window:

```bash
cd backend
npm start
```

The backend will run on `http://localhost:3001`

## Step 3: Start the Frontend

In another terminal window:

```bash
cd frontend
npm run dev
```

The frontend will run on `http://localhost:3000`

## Step 4: Use the Application

1. Open `http://localhost:3000` in your browser
2. Enter a merchant address (any Ethereum address format works for testing)
3. Click "Create Link" to create a checkout link
4. Fill in the form and create your checkout link
5. Copy the checkout link and share it with customers

## Testing the Checkout Page

To test a checkout link, navigate to:
```
http://localhost:3000/checkout/{linkId}
```

Replace `{linkId}` with the actual link ID from your dashboard.

## Smart Contract (Optional)

To deploy the smart contract:

1. Install Hardhat globally (if not already):
```bash
npm install -g hardhat
```

2. Compile the contract:
```bash
npx hardhat compile
```

3. Deploy to a local network:
```bash
npx hardhat node
```

In another terminal:
```bash
npx hardhat run scripts/deploy.js --network localhost
```

## Troubleshooting

### Backend won't start
- Check if port 3001 is already in use
- Make sure all dependencies are installed: `cd backend && npm install`

### Frontend won't start
- Check if port 3000 is already in use
- Make sure all dependencies are installed: `cd frontend && npm install`

### Database errors
- The SQLite database is created automatically on first run
- Delete `backend/database.sqlite` to reset the database

## Next Steps

- Customize the styling in the CSS files
- Add authentication for production use
- Deploy the smart contract to a testnet or mainnet
- Configure environment variables for production
- Set up HTTPS for secure payments

