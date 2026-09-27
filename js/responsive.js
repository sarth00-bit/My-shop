// =============================================================
// responsive.js — MyShop Manager
// 1. Mobile sidebar overlay (open / close / backdrop)
// 2. Restores desktop collapse on resize
// Load AFTER app.js in every HTML page that has a sidebar:
//   <script src="./js/responsive.js"></script>
// =============================================================

(function () {
    'use strict';

    const MOBILE_BP = 992; // px — Bootstrap "lg" breakpoint

    // ── helpers ──────────────────────────────────────────────
    function isMobile() {
        return window.innerWidth < MOBILE_BP;
    }

    function openSidebar() {
        document.body.classList.add('sidebar-open');
        document.body.classList.remove('sidebar-collapsed');
    }

    function closeSidebar() {
        document.body.classList.remove('sidebar-open');
    }

    // ── run after DOM is ready ────────────────────────────────
    document.addEventListener('DOMContentLoaded', function () {

        // 1. Find all toggle buttons (hamburger in navbar + settings page btn)
        //    We replace them with clones to strip any listener added by app.js,
        //    then attach our unified listener that routes by screen size.
        var buttonIds = ['sidebarToggle', 'btnToggleSidebar'];

        buttonIds.forEach(function (id) {
            var btn = document.getElementById(id);
            if (!btn) return;

            // Clone removes old event listeners
            var clone = btn.cloneNode(true);
            btn.parentNode.replaceChild(clone, btn);

            clone.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();

                if (isMobile()) {
                    // Mobile: toggle overlay
                    if (document.body.classList.contains('sidebar-open')) {
                        closeSidebar();
                    } else {
                        openSidebar();
                    }
                } else {
                    // Desktop: original collapse / expand behaviour
                    var collapsed = document.body.classList.contains('sidebar-collapsed');
                    document.body.classList.toggle('sidebar-collapsed', !collapsed);
                    document.body.classList.remove('sidebar-open');
                }
            });
        });

        // 2. Close sidebar when tapping the backdrop
        //    The backdrop is the body::before pseudo-element; we detect a click
        //    that lands outside the sidebar element itself.
        document.addEventListener('click', function (e) {
            if (!isMobile() || !document.body.classList.contains('sidebar-open')) return;

            var sidebar = (
                document.getElementById('sidebarMenu') ||
                document.getElementById('sidebar') ||
                document.querySelector('.sidebar')
            );

            var toggleBtns = buttonIds
                .map(function (id) { return document.getElementById(id); })
                .filter(Boolean);

            if (!sidebar) return;

            var insideSidebar = sidebar.contains(e.target);
            var insideToggle  = toggleBtns.some(function (b) { return b.contains(e.target); });

            if (!insideSidebar && !insideToggle) {
                closeSidebar();
            }
        });

        // 3. Close sidebar when a nav link inside is tapped (navigate away)
        var sidebar = (
            document.getElementById('sidebarMenu') ||
            document.getElementById('sidebar') ||
            document.querySelector('.sidebar')
        );

        if (sidebar) {
            sidebar.querySelectorAll('.nav-link').forEach(function (link) {
                link.addEventListener('click', function () {
                    if (isMobile()) closeSidebar();
                });
            });
        }

        // 4. Close sidebar on Escape key
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && isMobile()) closeSidebar();
        });

        // 5. On resize: clean up mobile state when going to desktop
        window.addEventListener('resize', debounce(function () {
            if (!isMobile()) {
                closeSidebar();
            }
        }, 150));

        // 6. On mobile page load, ensure sidebar is closed & body scroll is free
        if (isMobile()) {
            closeSidebar();
            document.body.classList.remove('sidebar-collapsed');
        }

        // 7. Lock body scroll while mobile sidebar is open
        var observer = new MutationObserver(function () {
            if (isMobile()) {
                document.body.style.overflow =
                    document.body.classList.contains('sidebar-open') ? 'hidden' : '';
            } else {
                document.body.style.overflow = '';
            }
        });

        observer.observe(document.body, {
            attributes: true,
            attributeFilter: ['class']
        });
    });

    // ── simple debounce ───────────────────────────────────────
    function debounce(fn, ms) {
        var t;
        return function () {
            clearTimeout(t);
            t = setTimeout(fn, ms);
        };
    }

})();
