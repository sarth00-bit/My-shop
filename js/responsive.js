// =============================================================
// responsive.js — MyShop Manager
//
// Load order on every page (after app.js, before settings.js):
//   app.js → config.js → responsive.js → (page script)
//
// What this file does
//   1. Sidebar toggle (hamburger) — one unified handler:
//        • mobile / tablet  (< 992px): slide-in overlay + backdrop
//        • desktop          (>= 992px): hide / show the sidebar
//   2. Keeps the toggle button's icon + ARIA state in sync.
//   3. Applies the saved "Collapsed Sidebar" setting (Settings →
//      Appearance) on every page, on desktop only.
//   4. Restores the desktop sidebar state when the window is
//      resized from mobile back to desktop.
//   5. Closes the mobile sidebar on: backdrop tap, Esc, nav-link
//      tap, or a Bootstrap modal opening.
//   6. Settings pages: scrolls the active tab into view on phones.
//
// Body-scroll locking while the mobile sidebar is open is done in
// responsive.css (body.sidebar-open) — NOT here — so it can never
// clash with Bootstrap's own modal scroll lock.
// =============================================================

(function () {
    'use strict';

    // Guard against the script being included twice on a page.
    if (window.__myshopResponsiveLoaded) return;
    window.__myshopResponsiveLoaded = true;

    // ── configuration ────────────────────────────────────────
    // Must match the mobile breakpoint used in responsive.css.
    var MOBILE_QUERY = '(max-width: 991.98px)';
    var TOGGLE_IDS   = ['sidebarToggle', 'btnToggleSidebar'];
    var SETTINGS_KEY = 'appSettings';           // same key app.js / settings.js use

    var mq = window.matchMedia(MOBILE_QUERY);
    var desktopCollapsed = false;               // remembered desktop state

    // ── helpers ──────────────────────────────────────────────
    function isMobile() {
        return mq.matches;
    }

    function hasClass(name) {
        return document.body.classList.contains(name);
    }

    function getSidebar() {
        return (
            document.getElementById('sidebarMenu') ||
            document.getElementById('sidebar') ||
            document.querySelector('.sidebar')
        );
    }

    function getToggles() {
        return TOGGLE_IDS
            .map(function (id) { return document.getElementById(id); })
            .filter(Boolean);
    }

    function readSavedCollapsed() {
        try {
            var saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
            return !!saved && (saved.collapsedSidebar === true || saved.collapsedSidebar === 'true');
        } catch (err) {
            return false;
        }
    }

    function openSidebar() {
        document.body.classList.add('sidebar-open');
        document.body.classList.remove('sidebar-collapsed');
    }

    function closeSidebar() {
        document.body.classList.remove('sidebar-open');
    }

    // Icon + ARIA state of the hamburger button(s).
    function syncToggleState() {
        var expanded = isMobile() ? hasClass('sidebar-open') : !hasClass('sidebar-collapsed');

        getToggles().forEach(function (btn) {
            btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
            btn.setAttribute('aria-label', expanded ? 'Hide navigation sidebar' : 'Show navigation sidebar');

            var sidebar = getSidebar();
            if (sidebar && sidebar.id) btn.setAttribute('aria-controls', sidebar.id);

            // Show a close (X) icon only while the mobile overlay is open.
            var icon = btn.querySelector('i');
            if (icon) {
                var showClose = isMobile() && hasClass('sidebar-open');
                icon.classList.toggle('bi-x-lg', showClose);
                icon.classList.toggle('bi-list', !showClose);
            }
        });
    }

    // Settings pages: put the active tab in view on small screens.
    function centerActiveSettingsTab() {
        var tabs = document.querySelector('.settings-tabs');
        if (!tabs || tabs.scrollWidth <= tabs.clientWidth) return;

        var active = tabs.querySelector('.settings-tab.active');
        if (!active) return;

        var offset = active.getBoundingClientRect().left - tabs.getBoundingClientRect().left + tabs.scrollLeft;
        tabs.scrollLeft = Math.max(0, offset - (tabs.clientWidth - active.offsetWidth) / 2);
    }

    // ── run after DOM is ready ───────────────────────────────
    document.addEventListener('DOMContentLoaded', function () {

        // 1. Unified toggle handler.
        //    Clone each button to strip the listener app.js attached, then
        //    attach one listener that routes by screen size.
        TOGGLE_IDS.forEach(function (id) {
            var btn = document.getElementById(id);
            if (!btn) return;

            var clone = btn.cloneNode(true);
            btn.parentNode.replaceChild(clone, btn);

            clone.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();

                if (isMobile()) {
                    if (hasClass('sidebar-open')) closeSidebar();
                    else openSidebar();
                } else {
                    document.body.classList.toggle('sidebar-collapsed', !hasClass('sidebar-collapsed'));
                    document.body.classList.remove('sidebar-open');
                }
            });
        });

        // 2. Initial state.
        //    Desktop: honour the saved "Collapsed Sidebar" preference.
        //    Mobile : always start with the overlay closed.
        desktopCollapsed = readSavedCollapsed();

        if (isMobile()) {
            closeSidebar();
            document.body.classList.remove('sidebar-collapsed');
        } else {
            closeSidebar();
            document.body.classList.toggle('sidebar-collapsed', desktopCollapsed);
        }

        // 3. Tap on the backdrop (anywhere outside the sidebar) closes it.
        document.addEventListener('click', function (e) {
            if (!isMobile() || !hasClass('sidebar-open')) return;

            var sidebar = getSidebar();
            if (!sidebar) return;

            var insideSidebar = sidebar.contains(e.target);
            var insideToggle  = getToggles().some(function (b) { return b.contains(e.target); });

            if (!insideSidebar && !insideToggle) closeSidebar();
        });

        // 4. Tapping a nav link closes the overlay (the page is about to change).
        var sidebar = getSidebar();
        if (sidebar) {
            sidebar.querySelectorAll('.nav-link').forEach(function (link) {
                link.addEventListener('click', function () {
                    if (isMobile()) closeSidebar();
                });
            });
        }

        // 5. Escape key.
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && isMobile()) closeSidebar();
        });

        // 6. A Bootstrap modal opening closes the overlay.
        document.addEventListener('show.bs.modal', function () {
            if (isMobile()) closeSidebar();
        });

        // 7. Crossing the breakpoint (resize / rotate).
        function onModeChange() {
            if (isMobile()) {
                // Keep the remembered desktop state, clear it for the overlay.
                document.body.classList.remove('sidebar-collapsed');
                closeSidebar();
            } else {
                closeSidebar();
                document.body.classList.toggle('sidebar-collapsed', desktopCollapsed);
            }
            syncToggleState();
            centerActiveSettingsTab();
        }

        if (mq.addEventListener) mq.addEventListener('change', onModeChange);
        else if (mq.addListener) mq.addListener(onModeChange);       // older Safari

        // 8. Watch the body class so the icon/ARIA stay correct even when
        //    another script (e.g. settings.js) changes the sidebar state,
        //    and so the desktop state is always remembered.
        new MutationObserver(function () {
            if (!isMobile()) desktopCollapsed = hasClass('sidebar-collapsed');
            syncToggleState();
        }).observe(document.body, { attributes: true, attributeFilter: ['class'] });

        syncToggleState();

        // 9. Settings pages: active tab in view (fonts/icons can change widths,
        //    so run again once everything has loaded).
        centerActiveSettingsTab();
        window.addEventListener('load', centerActiveSettingsTab);
        window.addEventListener('orientationchange', function () {
            setTimeout(centerActiveSettingsTab, 200);
        });
    });

})();
