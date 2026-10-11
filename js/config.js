// =========================================
// config.js — update ONLY NGROK_BASE when ngrok restarts.
//
// HOW TO UPDATE:
//   1. Run:   ngrok http 5000
//   2. Copy the https URL shown (e.g. https://xxxx.ngrok-free.app)
//   3. Replace the value of NGROK_BASE below.
//   4. Save — all pages reload from cache immediately.
//
// WHY file:// CAUSES CORS ERRORS:
//   When you open Dashboard.html directly from disk (file:///C:/...)
//   the browser sends  Origin: null  on every fetch request.
//   ngrok intercepts OPTIONS preflight requests and returns its own
//   browser-warning HTML page (without CORS headers), so Chrome
//   blocks the request before Node.js ever sees it.
//
// HOW THIS IS FIXED:
//   • server.js now writes Access-Control-Allow-Origin: * for null
//     origins AND answers OPTIONS directly before ngrok can intercept.
//   • apiFetch() below adds  ngrok-skip-browser-warning: true  on
//     EVERY request (including GET), which tells ngrok to skip the
//     interstitial page and pass the request through to Node.js.
//   • GET requests do NOT set Content-Type so they stay "simple"
//     requests that don't need a preflight at all.
// =========================================

const NGROK_BASE = 'https://enable-empathic-murmuring.ngrok-free.dev';

// Node.js API  (port 5000, proxied through ngrok)
const NODE_API   = NGROK_BASE + '/api';

// Flask analytics  (port 5001, proxied through Node.js as /python-api/*)
const PYTHON_API = NGROK_BASE + '/python-api';

// Expose on window so every script (including IIFE-wrapped settings.js) can read them
window.NODE_API   = NODE_API;
window.PYTHON_API = PYTHON_API;

// ── apiFetch — always includes ngrok bypass header ───────────────────────
//    GET requests: no Content-Type header  → "simple request" → no preflight
//    POST/PUT requests with a body: Content-Type is set → preflight fires,
//    but server.js now answers it directly before ngrok can intercept.
window.apiFetch = function (url, options) {
    options = options || {};

    const headers = new Headers(options.headers || {});

    // This header tells ngrok to skip its browser-warning interstitial page
    headers.set('ngrok-skip-browser-warning', 'true');

    const method = (options.method || 'GET').toUpperCase();
    const hasBody = options.body !== undefined && options.body !== null;

    // Only set Content-Type on requests that actually have a body
    // (GET/DELETE/HEAD etc. must NOT set it — that would trigger a preflight
    //  which ngrok might intercept before Node.js can respond)
    if (hasBody && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
    }

    return fetch(url, Object.assign({}, options, { headers: headers }));
};
