// ============================================================
// app.js — shared utilities
// Includes:
// 1. Sidebar toggle
// 2. Dark mode
// 3. Persistent shop logo + admin name in top header
// 4. Global API helper
// 5. Existing login guard
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    // ------------------------------------------------------------
    // SIDEBAR TOGGLE
    // ------------------------------------------------------------
    const sidebarToggle = document.getElementById('sidebarToggle');
    const settingsToggle = document.getElementById('btnToggleSidebar');
    const sidebarMenu = document.getElementById('sidebarMenu');

    const toggles = [sidebarToggle, settingsToggle].filter(Boolean);

    function setSidebarHidden(hidden) {
        document.body.classList.toggle('sidebar-collapsed', hidden);

        if (sidebarMenu) {
            sidebarMenu.classList.toggle('collapsed', hidden);
        }

        toggles.forEach(button => {
            button.setAttribute('aria-expanded', hidden ? 'false' : 'true');
            button.setAttribute(
                'aria-label',
                hidden ? 'Show navigation sidebar' : 'Hide navigation sidebar'
            );

            const icon = button.querySelector('i');
            if (icon) {
                icon.classList.toggle('bi-list', !hidden);
                icon.classList.toggle('bi-x-lg', hidden);
            }
        });
    }

    toggles.forEach(button => {
        button.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();

            const hidden =
                document.body.classList.contains('sidebar-collapsed');

            setSidebarHidden(!hidden);
        });
    });

    // Sidebar starts visible on every page.
    setSidebarHidden(false);

    // ------------------------------------------------------------
    // ACTIVE SIDEBAR LINK
    // ------------------------------------------------------------
    const currentPage =
        window.location.pathname.split('/').pop().toLowerCase();

    document.querySelectorAll('#sidebarMenu .nav-link').forEach(link => {
        const href = (link.getAttribute('href') || '')
            .split('/')
            .pop()
            .toLowerCase();

        link.classList.toggle('active', href === currentPage);
    });

    // ------------------------------------------------------------
    // LOAD HEADER SHOP LOGO + ADMIN NAME
    // ------------------------------------------------------------
    refreshHeaderShopProfile();
});

// ============================================================
// HEADER PROFILE
// ============================================================

function refreshHeaderShopProfile() {
    const adminNameEl = document.getElementById('headerAdminName');
    const logoEl = document.getElementById('headerShopLogo');
    const fallbackEl = document.getElementById('headerShopLogoFallback');

    if (!adminNameEl || !logoEl) return;

    let saved = {};

    try {
        saved = JSON.parse(localStorage.getItem('appSettings') || '{}');
    } catch (error) {
        console.error('Unable to read appSettings:', error);
    }

    const adminName =
        String(saved.userName || saved.adminName || 'Admin').trim() ||
        'Admin';

    const logo =
        String(saved.logo || saved.shopLogo || '').trim();

    adminNameEl.textContent = adminName;
    adminNameEl.title = adminName;

    if (logo) {
        logoEl.src = logo;
        logoEl.style.display = 'block';

        if (fallbackEl) {
            fallbackEl.style.display = 'none';
        }

        logoEl.onerror = () => {
            logoEl.style.display = 'none';

            if (fallbackEl) {
                fallbackEl.style.display = 'block';
            }
        };
    } else {
        logoEl.removeAttribute('src');
        logoEl.style.display = 'none';

        if (fallbackEl) {
            fallbackEl.style.display = 'block';
        }
    }
}

// Allow settings.js to refresh the header immediately after Save.
window.refreshHeaderShopProfile = refreshHeaderShopProfile;

// Also refresh if another tab changes appSettings.
window.addEventListener('storage', event => {
    if (event.key === 'appSettings') {
        refreshHeaderShopProfile();
    }
});

// ============================================================
// DARK MODE
// ============================================================

function toggleDarkMode(isDark) {
    document.body.classList.toggle('dark-mode', !!isDark);
    document.documentElement.setAttribute(
        'data-bs-theme',
        isDark ? 'dark' : 'light'
    );

    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme');
    const isDark = savedTheme === 'dark';

    document.body.classList.toggle('dark-mode', isDark);
    document.documentElement.setAttribute(
        'data-bs-theme',
        isDark ? 'dark' : 'light'
    );

    const switchEl = document.getElementById('darkModeToggle');
    if (switchEl) {
        switchEl.checked = isDark;
    }
});

// ============================================================
// GLOBAL API FETCH HELPER
// ============================================================

window.apiFetch = function (url, options = {}) {
    const headers = new Headers(options.headers || {});

    if (!headers.has('ngrok-skip-browser-warning')) {
        headers.set('ngrok-skip-browser-warning', 'true');
    }

    // Do NOT force JSON headers when uploading FormData.
    if (
        options.body &&
        !(options.body instanceof FormData) &&
        !headers.has('Content-Type')
    ) {
        headers.set('Content-Type', 'application/json');
    }

    return fetch(url, {
        ...options,
        headers
    });
};

// ============================================================
// AUTH GUARD
// ============================================================

const loggedInUser = sessionStorage.getItem('loggedInUser');

if (!loggedInUser) {
    if (!/login\.html$/i.test(window.location.pathname)) {
        // Keep existing login flow.
        // Remove this block only if your project intentionally allows
        // unauthenticated access to every page.
        window.location.href = 'login.html';
    }
}
