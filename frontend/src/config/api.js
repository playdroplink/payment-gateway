// Dynamic API configuration
const getApiBase = () => {
  // Check for environment variable first (for build-time configuration)
  // This allows users to set VITE_API_BASE in .env file for production/deployment
  if (import.meta.env.VITE_API_BASE) {
    return import.meta.env.VITE_API_BASE;
  }
  
  // For localhost development, use relative path to leverage Vite proxy
  // Vite proxy is configured in vite.config.js to forward /api to http://localhost:3001
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return '/api';
  }
  
  // For Pi Network sandbox or production domains
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  
  // Check if we're on a Pi domain (sandbox.minepi.com, etc.)
  if (hostname.includes('minepi.com') || hostname.includes('pinet.com')) {
    // For Pi domains, we need to know the backend URL
    // Option 1: Set VITE_API_BASE in .env file pointing to your backend
    // Option 2: If backend is deployed and accessible, use full URL
    // For now, try relative path (requires backend to be on same domain/proxied)
    return '/api';
  }
  
  // For other production domains, use same origin
  // This assumes backend is proxied or on same domain
  return '/api';
};

export const API_BASE = getApiBase();

// Log API base for debugging (helpful for troubleshooting)
if (import.meta.env.DEV) {
  console.log('API Base URL:', API_BASE);
  console.log('Current origin:', window.location.origin);
  console.log('To set custom API URL, add VITE_API_BASE to .env file');
}

