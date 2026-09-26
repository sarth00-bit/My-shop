// =========================================
// config.js — update only these URLs when ngrok changes
// =========================================
const NODE_API = 'https://enable-empathic-murmuring.ngrok-free.dev/api';
const PYTHON_API = 'https://enable-empathic-murmuring.ngrok-free.dev/python-api';

// Keep compatibility with pages that call apiFetch before app.js is changed.
window.apiFetch = window.apiFetch || function(url, options = {}) {
    const headers = new Headers(options.headers || {});
    headers.set('ngrok-skip-browser-warning', 'true');
    if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
    }
    return fetch(url, { ...options, headers });
};
