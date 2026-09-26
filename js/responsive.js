// =============================================================
// responsive.js — MyShop Manager
// Adds mobile sidebar overlay behaviour (screens ≤ 991 px).
// Load AFTER app.js in every HTML page that has a sidebar:
//   <script src="./js/responsive.js"></script>
// =============================================================

(function () {
    'use strict';

    const MOBILE_BREAKPOINT = 992; // px — matches Bootstrap's lg breakpoint

    // ── helpers ──────────────────────────────────────────────
    function isMobile() {
        return window.innerWidth < MOBILE_BREAKPOINT;
    }

    function openSidebar() {
        document.body.classList.add('sidebar-open');
        document.body.classList.remove('sidebar-collapsed');
    }

    function closeSidebar() {
        document.body.classList.remove('sidebar-open');
    }

    function toggleSidebar() {
        if (document.body.classList.contains('sidebar-open')) {
            closeSidebar();
        } else {
            openSidebar();
        }
    }

    // ── bootstrap once the DOM is ready ──────────────────────
    document.addEventListener('DOMContentLoaded', function () {

        // 1. Intercept the existing sidebar toggle buttons.
        //    app.js handles desktop collapse; we take over on mobile.
        const toggleButtons = [
            document.getElementById('sidebarToggle'),
            document.getElementById('btnToggleSidebar')
        ].filter(Boolean);

        toggleButtons.forEach(function (btn) {
            // Clone the button to strip app.js's desktop listener,
            // then re-attach a new listener that routes by screen size.
            const clone = btn.cloneNode(true);
            btn.parentNode.replaceChild(clone, btn);

            clone.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();

                if (isMobile()) {
                    toggleSidebar();
                } else {
                    // On desktop, replicate app.js collapse logic
                    const hidden = document.body.classList.contains('sidebar-collapsed');
                    document.body.classList.toggle('sidebar-collapsed', !hidden);
                    if (hidden) {
                        document.body.classList.remove('sidebar-open');
                    }
                }
            });
        });

        // 2. Close sidebar when the backdrop (::before pseudo-element area) is tapped.
        //    Since ::before isn't directly tappable, we listen on <body> and check
        //    whether the click landed outside the sidebar.
        document.body.addEventListener('click', function (e) {
            if (!isMobile()) return;
            if (!document.body.classList.contains('sidebar-open')) return;

            const sidebar =
                document.getElementById('sidebarMenu') ||
                document.getElementById('sidebar') ||
                document.querySelector('.sidebar');

            const toggleBtn =
                document.getElementById('sidebarToggle') ||
                document.getElementById('btnToggleSidebar');

            if (!sidebar) return;

            const clickedInsideSidebar = sidebar.contains(e.target);
            const clickedToggleBtn     = toggleBtn && toggleBtn.contains(e.target);

            if (!clickedInsideSidebar && !clickedToggleBtn) {
                closeSidebar();
            }
        });

        // 3. Close sidebar when a nav link inside it is tapped on mobile
        //    (so the page navigates and the sidebar doesn't stay open).
        const sidebar =
            document.getElementById('sidebarMenu') ||
            document.getElementById('sidebar') ||
            document.querySelector('.sidebar');

        if (sidebar) {
            sidebar.querySelectorAll('.nav-link').forEach(function (link) {
                link.addEventListener('click', function () {
                    if (isMobile()) {
                        closeSidebar();
                    }
                });
            });
        }

        // 4. On window resize from mobile → desktop, clean up mobile state.
        window.addEventListener('resize', debounce(function () {
            if (!isMobile()) {
                document.body.classList.remove('sidebar-open');
            }
        }, 150));

        // 5. On mobile, start with sidebar closed (desktop starts open via app.js).
        if (isMobile()) {
            closeSidebar();
            document.body.classList.remove('sidebar-collapsed');
        }

        // 6. Prevent body scroll when mobile sidebar is open.
        const observer = new MutationObserver(function () {
            if (isMobile()) {
                document.body.style.overflow =
                    document.body.classList.contains('sidebar-open')
                        ? 'hidden'
                        : '';
            } else {
                document.body.style.overflow = '';
            }
        });

        observer.observe(document.body, {
            attributes: true,
            attributeFilter: ['class']
        });
    });

    // ── debounce utility ─────────────────────────────────────
    function debounce(fn, delay) {
        let timer;
        return function () {
            clearTimeout(timer);
            timer = setTimeout(fn, delay);
        };
    }

})();