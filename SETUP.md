# Setup Instructions

## Quick Setup

### Step 1: Install Dependencies

**Option A: Install all at once (from root)**
```bash
npm run install-all
```

**Option B: Install separately**
```bash
# Backend
cd backend
npm install

# Frontend  
cd ../frontend
npm install

# Root (for dev scripts)
cd ..
npm install
```

### Step 2: Configure Backend

Create `backend/.env` file:
```bash
cd backend
copy .env.example .env
```

Edit `backend/.env` and add:
```
PI_API_KEY=your_pi_api_key_here
PI_API_BASE=https://api.minepi.com/v2
PORT=3001
```

**To get your Pi API Key:**
1. Open Pi Browser
2. Go to `pi://develop.pi`
3. Register/create your app
4. Copy Server API Key from app settings

### Step 3: Start Development

**Option A: Run both servers together**
```bash
npm run dev
```

**Option B: Run in separate terminals**

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

### Step 4: Access Application

- Frontend: http://localhost:3000
- Backend API: http://localhost:3001

## Troubleshooting

### npm run dev not working?

1. **Install concurrently globally:**
```bash
npm install -g concurrently
```

Or install locally:
```bash
npm install concurrently --save-dev
```

2. **Make sure all dependencies installed:**
```bash
npm run install-all
```

3. **Check ports are available:**
- Port 3000 (frontend)
- Port 3001 (backend)

If ports are in use, change them:
- Frontend: Edit `frontend/vite.config.js` → `server.port`
- Backend: Edit `backend/.env` → `PORT=3002`

4. **Run servers separately:**
If `npm run dev` still doesn't work, run in separate terminals (Option B above).

### Backend not starting?

1. Check `.env` file exists in `backend/` folder
2. Verify `dotenv` is installed: `cd backend && npm list dotenv`
3. Check Node.js version: `node --version` (should be 16+)

### Frontend not starting?

1. Check `node_modules` exists in `frontend/` folder
2. Try deleting and reinstalling:
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
```

3. Clear Vite cache:
```bash
cd frontend
rm -rf node_modules/.vite
```

### Pi SDK not loading?

1. Open in Pi Browser for full functionality
2. For testing without Pi Browser, app will work but payments won't process
3. Check browser console for errors

## Windows Specific

If you're on Windows and having issues:

1. Use PowerShell or Command Prompt (not Git Bash for npm commands)
2. For `npm run install-all`, you might need to run separately:
```powershell
cd backend; npm install
cd ../frontend; npm install
cd ..
```

3. If paths have spaces, use quotes:
```powershell
cd "C:\Users\Your Name\Downloads\payment-gateway"
```

## Next Steps

After setup:
1. Read [PI_INTEGRATION.md](./PI_INTEGRATION.md) for Pi Network setup
2. Read [README.md](./README.md) for full documentation
3. Test the application!

