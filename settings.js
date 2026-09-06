document.addEventListener('DOMContentLoaded', () => {
    const settingsForm = document.getElementById('settingsForm');
    const logoInput = document.getElementById('shopLogoInput');
    const logoPreview = document.getElementById('logoPreview');
    const sidebar = document.getElementById('sidebar');
    const btnToggleSidebar = document.getElementById('btnToggleSidebar');
    const sidebarCollapseToggle = document.getElementById('sidebarCollapseToggle');

    let base64Logo = '';

    // Load Settings
    function loadSettings() {
        const saved = JSON.parse(localStorage.getItem('appSettings')) || {};

        document.getElementById('shopName').value = saved.shopName || '';
        document.getElementById('shopAddress').value = saved.shopAddress || '';
        document.getElementById('shopPhone').value = saved.shopPhone || '';
        document.getElementById('shopEmail').value = saved.shopEmail || '';
        document.getElementById('shopGst').value = saved.shopGst || '';
        document.getElementById('invoicePrefix').value = saved.invoicePrefix || 'INV-';
        document.getElementById('currencySymbol').value = saved.currencySymbol || '₹';
        document.getElementById('defaultTax').value = saved.defaultTax || 0;
        document.getElementById('invoiceFooter').value = saved.invoiceFooter || '';
        document.getElementById('userName').value = saved.userName || 'Admin';

        if (saved.logo) {
            base64Logo = saved.logo;
            logoPreview.src = saved.logo;
        }

        const isCollapsed = saved.collapseSidebar || localStorage.getItem('sidebarCollapsed') === 'true';
        if (sidebarCollapseToggle) sidebarCollapseToggle.checked = isCollapsed;
        
        if (isCollapsed && sidebar) {
            sidebar.classList.add('collapsed');
        }
    }

    // Toggle Sidebar Event
    if (btnToggleSidebar) {
        btnToggleSidebar.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            const isNowCollapsed = sidebar.classList.contains('collapsed');
            localStorage.setItem('sidebarCollapsed', isNowCollapsed);
            if (sidebarCollapseToggle) sidebarCollapseToggle.checked = isNowCollapsed;
        });
    }

    // Convert Logo to Base64
    if (logoInput) {
        logoInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function (evt) {
                    base64Logo = evt.target.result;
                    logoPreview.src = base64Logo;
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // Save Settings
    if (settingsForm) {
        settingsForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const settings = {
                shopName: document.getElementById('shopName').value.trim(),
                shopAddress: document.getElementById('shopAddress').value.trim(),
                shopPhone: document.getElementById('shopPhone').value.trim(),
                shopEmail: document.getElementById('shopEmail').value.trim(),
                shopGst: document.getElementById('shopGst').value.trim(),
                logo: base64Logo,
                invoicePrefix: document.getElementById('invoicePrefix').value.trim() || 'INV-',
                currencySymbol: document.getElementById('currencySymbol').value,
                defaultTax: parseFloat(document.getElementById('defaultTax').value) || 0,
                invoiceFooter: document.getElementById('invoiceFooter').value.trim(),
                userName: document.getElementById('userName').value.trim() || 'Admin',
                collapseSidebar: sidebarCollapseToggle ? sidebarCollapseToggle.checked : false
            };

            localStorage.setItem('appSettings', JSON.stringify(settings));
            localStorage.setItem('sidebarCollapsed', settings.collapseSidebar);

            alert('Settings saved successfully!');
        });
    }

    loadSettings();
});

// Toggle Dark Mode Function
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

// Check saved theme on page load
document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        toggleDarkMode(true);
        const switchEl = document.getElementById('darkModeToggle');
        if (switchEl) switchEl.checked = true;
    }
});