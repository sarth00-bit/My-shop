// =========================================
// config.js — SINGLE FILE TO UPDATE
// When your ngrok URL changes, update only
// the two lines below and redeploy.
// =========================================

const NODE_API   = 'https://enable-empathic-murmuring.ngrok-free.dev/api';
const PYTHON_API = 'https://enable-empathic-murmuring.ngrok-free.dev/python-api';

// Shared fetch wrapper — adds the ngrok header that
// prevents the "You are visiting ngrok" browser warning
// and also bypasses the CORS preflight issue ngrok adds.
async function apiFetch(url, options = {}) {
    const headers = {
        'ngrok-skip-browser-warning': 'true',
        ...(options.headers || {})
    };
    return fetch(url, { ...options, headers });
}
