// Wait for the DOM to fully load
document.addEventListener('DOMContentLoaded', () => {
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebarMenu = document.getElementById('sidebarMenu');

    if (sidebarToggle && sidebarMenu) {
        sidebarToggle.addEventListener('click', () => {
            // How do we toggle the 'collapsed' class on sidebarMenu here?
            sidebarMenu.classList.toggle('collapsed');
        });
    }
});

document.addEventListener('DOMContentLoaded', () => {
    // Get current filename from URL (defaults to Dashboard.html if root)
    const currentPage = window.location.pathname.split('/').pop() || 'Dashboard.html';

    // Select all sidebar links
    const sidebarLinks = document.querySelectorAll('#sidebarMenu .nav-link');

    sidebarLinks.forEach(link => {
        const href = link.getAttribute('href');

        // Toggle 'active' class based on URL match
        if (href === currentPage) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
});

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

function previewShopLogo(event) {
    const file = event.target.files[0];
    const preview = document.getElementById('logoPreview');
    const placeholder = document.getElementById('logoPlaceholderText');

    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.src = e.target.result;
            preview.style.display = 'block';
            if (placeholder) placeholder.style.display = 'none';
        }
        reader.readAsDataURL(file);
    } else {
        preview.src = '';
        preview.style.display = 'none';
        if (placeholder) placeholder.style.display = 'block';
    }
}

const loggedInUser = sessionStorage.getItem("loggedInUser");

if (!loggedInUser) {
    window.location.href = "login.html";
}