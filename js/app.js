// =========================================
// app.js — Shared utilities loaded on every page
// =========================================

// Sidebar toggle
document.addEventListener('DOMContentLoaded', () => {
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebarMenu   = document.getElementById('sidebarMenu');

    if (sidebarToggle && sidebarMenu) {
        sidebarToggle.addEventListener('click', () => {
            sidebarMenu.classList.toggle('collapsed');
        });
    }
});

// Active sidebar link highlight
document.addEventListener('DOMContentLoaded', () => {
    const currentPage = window.location.pathname.split('/').pop() || 'Dashboard.html';
    const sidebarLinks = document.querySelectorAll('#sidebarMenu .nav-link');
    sidebarLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href === currentPage) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
});

// Dark mode
function toggleDarkMode(isDark) {
    if (isDark) {
        document.body.classList.add('dark-mode');
        document.documentElement.setAttribute('data-bs-theme', 'dark');
        localStorage.setItem('theme', 'dark');
    } else {
        document.body.classList.remove('dark-mode');
        document.documentElement.setAttribute('data-bs-theme', 'light');
        localStorage.setItem('theme', 'light');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        toggleDarkMode(true);
        const switchEl = document.getElementById('darkModeToggle');
        if (switchEl) switchEl.checked = true;
    }
});

// Logo preview
function previewShopLogo(event) {
    const file        = event.target.files[0];
    const preview     = document.getElementById('logoPreview');
    const placeholder = document.getElementById('logoPlaceholderText');

    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            preview.src           = e.target.result;
            preview.style.display = 'block';
            if (placeholder) placeholder.style.display = 'none';
        };
        reader.readAsDataURL(file);
    } else {
        preview.src           = '';
        preview.style.display = 'none';
        if (placeholder) placeholder.style.display = 'block';
    }
}

// ─────────────────────────────────────────────
// AUTH GUARD
// ─────────────────────────────────────────────
const loggedInUser = sessionStorage.getItem('loggedInUser');
if (!loggedInUser) {
    window.location.href = 'login.html';
}

// ─────────────────────────────────────────────
// GLOBAL FETCH HELPER
// Automatically adds the ngrok-skip-browser-warning
// header so the ngrok interstitial page is never
// shown when your frontend calls the API.
// ─────────────────────────────────────────────
window.apiFetch = function (url, options = {}) {
    options.headers = Object.assign({
        'ngrok-skip-browser-warning': 'true',
        'Content-Type': 'application/json'
    }, options.headers || {});
    return fetch(url, options);
};
