// =========================================
// SETTINGS.JS
// Settings stay in LocalStorage — they are
// UI/config preferences (shop name, logo,
// dark mode, invoice prefix) not transactional
// data. No MySQL connection needed here.
//
// BUG FIXED: old code referenced
// 'sidebarCollapseToggle' which doesn't exist
// in Settings.html — the correct id is
// 'darkModeToggle'. Removed the broken
// sidebarCollapseToggle references entirely.
// =========================================

document.addEventListener('DOMContentLoaded', () => {
    const settingsForm = document.getElementById('settingsForm');
    const logoInput    = document.getElementById('shopLogoInput');
    const logoPreview  = document.getElementById('logoPreview');
    const logoPlaceholder = document.getElementById('logoPlaceholderText');

    let base64Logo = '';

    // ── LOAD SAVED SETTINGS ──────────────────────────────────────────────────
    function loadSettings() {
        const saved = JSON.parse(localStorage.getItem('appSettings')) || {};

        setValue('shopName',       saved.shopName       || '');
        setValue('shopAddress',    saved.shopAddress     || '');
        setValue('shopPhone',      saved.shopPhone       || '');
        setValue('shopEmail',      saved.shopEmail       || '');
        setValue('shopGst',        saved.shopGst         || '');
        setValue('invoicePrefix',  saved.invoicePrefix   || 'INV-');
        setValue('currencySymbol', saved.currencySymbol  || '₹');
        setValue('defaultTax',     saved.defaultTax      || 0);
        setValue('invoiceFooter',  saved.invoiceFooter   || '');
        setValue('userName',       saved.userName        || 'Admin');

        if (saved.logo) {
            base64Logo = saved.logo;
            if (logoPreview) {
                logoPreview.src              = saved.logo;
                logoPreview.style.display    = 'block';
            }
            if (logoPlaceholder) logoPlaceholder.style.display = 'none';
        }

        // Restore dark mode state
        const darkModeToggle = document.getElementById('darkModeToggle');
        if (darkModeToggle) {
            const isDark = localStorage.getItem('theme') === 'dark';
            darkModeToggle.checked = isDark;
            applyTheme(isDark);
        }
    }

    function setValue(id, val) {
        const el = document.getElementById(id);
        if (el) el.value = val;
    }

    // ── LOGO PREVIEW ─────────────────────────────────────────────────────────
    if (logoInput) {
        logoInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (evt) => {
                base64Logo = evt.target.result;
                if (logoPreview) {
                    logoPreview.src           = base64Logo;
                    logoPreview.style.display = 'block';
                }
                if (logoPlaceholder) logoPlaceholder.style.display = 'none';
            };
            reader.readAsDataURL(file);
        });
    }

    // ── SAVE SETTINGS ────────────────────────────────────────────────────────
    if (settingsForm) {
        settingsForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const darkModeToggle = document.getElementById('darkModeToggle');
            const isDark         = darkModeToggle ? darkModeToggle.checked : false;

            const settings = {
                shopName:       getVal('shopName'),
                shopAddress:    getVal('shopAddress'),
                shopPhone:      getVal('shopPhone'),
                shopEmail:      getVal('shopEmail'),
                shopGst:        getVal('shopGst'),
                logo:           base64Logo,
                invoicePrefix:  getVal('invoicePrefix')  || 'INV-',
                currencySymbol: getVal('currencySymbol') || '₹',
                defaultTax:     parseFloat(getVal('defaultTax')) || 0,
                invoiceFooter:  getVal('invoiceFooter'),
                userName:       getVal('userName')       || 'Admin',
            };

            localStorage.setItem('appSettings', JSON.stringify(settings));
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
            applyTheme(isDark);

            // Show success toast / alert
            const btn = settingsForm.querySelector('[type="submit"]');
            if (btn) {
                const original       = btn.innerHTML;
                btn.innerHTML        = '<i class="bi bi-check-lg me-2"></i>Saved!';
                btn.classList.replace('btn-primary', 'btn-success');
                setTimeout(() => {
                    btn.innerHTML = original;
                    btn.classList.replace('btn-success', 'btn-primary');
                }, 2000);
            }
        });
    }

    function getVal(id) {
        const el = document.getElementById(id);
        return el ? el.value.trim() : '';
    }

    // ── INITIAL LOAD ─────────────────────────────────────────────────────────
    loadSettings();
});

// ── DARK MODE ────────────────────────────────────────────────────────────────
// Called from inline onchange="toggleDarkMode(this.checked)" in Settings.html
function toggleDarkMode(isDark) {
    applyTheme(isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

function applyTheme(isDark) {
    if (isDark) {
        document.body.classList.add('dark-mode');
        document.documentElement.setAttribute('data-bs-theme', 'dark');
    } else {
        document.body.classList.remove('dark-mode');
        document.documentElement.setAttribute('data-bs-theme', 'light');
    }
}

// Apply saved theme immediately on any page that loads settings.js
(function () {
    if (localStorage.getItem('theme') === 'dark') applyTheme(true);
})();

// ── LOGO PREVIEW (called from inline onchange in Settings.html) ──────────────
function previewShopLogo(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const preview     = document.getElementById('logoPreview');
        const placeholder = document.getElementById('logoPlaceholderText');
        if (preview) {
            preview.src           = e.target.result;
            preview.style.display = 'block';
        }
        if (placeholder) placeholder.style.display = 'none';
    };
    reader.readAsDataURL(file);
}

// ── UPI SETTINGS (called from Settings.html) ─────────────────────────────────
// Saves upiId, upiName, upiQrImage to LocalStorage
// These are read by billing.js when the UPI panel opens

document.addEventListener('DOMContentLoaded', () => {
    // Load saved UPI settings into Settings form
    const settings = JSON.parse(localStorage.getItem('appSettings')) || {};

    const upiIdEl    = document.getElementById('upiId');
    const upiNameEl  = document.getElementById('upiName');
    const upiQrEl    = document.getElementById('upiQrInput');
    const upiPreview = document.getElementById('upiQrPreview');

    if (upiIdEl   && settings.upiId)      upiIdEl.value   = settings.upiId;
    if (upiNameEl && settings.upiName)    upiNameEl.value = settings.upiName;
    if (upiPreview && settings.upiQrImage) {
        upiPreview.src           = settings.upiQrImage;
        upiPreview.style.display = 'block';
    }

    // QR image preview
    if (upiQrEl) {
        upiQrEl.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                const saved = JSON.parse(localStorage.getItem('appSettings')) || {};
                saved.upiQrImage = ev.target.result;
                localStorage.setItem('appSettings', JSON.stringify(saved));
                if (upiPreview) {
                    upiPreview.src           = ev.target.result;
                    upiPreview.style.display = 'block';
                }
            };
            reader.readAsDataURL(file);
        });
    }
});

// Called by the Save Settings form submit — merges UPI fields into appSettings
function saveUPISettings() {
    const upiId   = (document.getElementById('upiId')   || {}).value || '';
    const upiName = (document.getElementById('upiName') || {}).value || '';
    const saved   = JSON.parse(localStorage.getItem('appSettings')) || {};
    saved.upiId   = upiId.trim();
    saved.upiName = upiName.trim();
    localStorage.setItem('appSettings', JSON.stringify(saved));
}