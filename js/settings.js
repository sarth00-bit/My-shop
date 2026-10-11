/* ============================================================
   settings.js  — MyShop Manager
   Shared across ALL settings-*.html pages.

   Storage keys (now MATCHING app.js so every page sees changes):
     appSettings  — all settings (same key app.js reads)
     theme        — 'dark' | 'light'  (same key app.js reads)
     myshopSettingsPrivateAccessV1 — private-section sessions
   ============================================================ */
(() => {
  "use strict";

  /* ── Storage keys — MUST match app.js ─────────────────── */
  const STORE  = "appSettings";          // same key app.js uses
  const THEME  = "theme";                // same key app.js uses
  const ACCESS = "myshopSettingsPrivateAccessV1";

  /* ── API URLs from config.js (window.*) ─────────────────── */
  const NODE_API   = String(window.NODE_API   || "").replace(/\/+$/, "");
  const PYTHON_API = String(window.PYTHON_API || "").replace(/\/+$/, "");

  const $ = (id) => document.getElementById(id);
  const page = location.pathname.toLowerCase().split("/").pop();

  /* ── Defaults (must include every field app.js might read) ─ */
  const defaults = {
    /* shop */
    shopName: "", userName: "Admin", adminName: "Administrator",
    businessType: "Retail Shop",
    shopAddress: "", shopCity: "", shopState: "Maharashtra",
    shopPin: "", shopPhone: "", shopEmail: "", shopGst: "",
    logo: "",          /* app.js reads: saved.logo || saved.shopLogo */
    shopLogo: "",

    /* invoice */
    invoicePrefix: "INV-", invoiceStartingNumber: 1,
    currencySymbol: "₹", paperSize: "A4",
    invoiceFooter: "Thank you for shopping with us!",
    showLogoOnInvoice: true, showGstinOnInvoice: true,
    showCustomerOnInvoice: true, showPaymentOnInvoice: true,
    showReceivedOnInvoice: true, showChangeOnInvoice: true,
    showUpiRefOnInvoice: true, showCardRefOnInvoice: true,

    /* tax */
    gstEnabled: true, defaultTax: 18,
    /* Default GST is split equally into CGST + SGST.
       Product-specific GST overrides these defaults. */
    defaultCgst: 9, defaultSgst: 9,
    /* Kept for backward compatibility with older saved settings/server data. */
    taxMode: "inclusive", roundingMode: "2-decimal",

    /* inventory */
    lowStockThreshold: 5, lowStockAlerts: true,
    outOfStockWarning: true, autoDeductStock: true,
    restoreOnCancellation: true, allowNegativeStock: false,

    /* security */
    adminUsername: "admin", sessionTimeout: "30",
    rememberMe: false, confirmDangerousActions: true,

    /* appearance — dark stored here AND in 'theme' key */
    darkMode: false, collapsedSidebar: false,
    interfaceDensity: "comfortable",

    /* payment */
    cashEnabled: true, upiEnabled: true, cardEnabled: true,
    upiId: "", upiName: "", upiQrImage: ""
  };

  let pendingPrivateCategory = null;
  let accessModal  = null;
  let accessTimer  = null;

  /* ── read / write ─────────────────────────────────────── */
  function readSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE) || "{}");
      return { ...defaults, ...saved };
    } catch { return { ...defaults }; }
  }

  function saveSettings(data) {
    const merged = { ...defaults, ...data };
    localStorage.setItem(STORE, JSON.stringify(merged));
    /* Keep theme key in sync so app.js dark-mode init works */
    localStorage.setItem(THEME, merged.darkMode ? "dark" : "light");
    /* Fire storage event so other open tabs update immediately */
    window.dispatchEvent(new StorageEvent("storage", { key: STORE }));
  }

  function value(id) {
    const el = $(id);
    if (!el) return undefined;
    return el.type === "checkbox" ? el.checked : el.value;
  }

  function setValue(id, val) {
    const el = $(id);
    if (!el || val === undefined || val === null) return;
    if (el.type === "checkbox") el.checked = Boolean(val);
    else el.value = val;
  }

  function collect(ids) {
    const s = readSettings();
    ids.forEach((id) => { const v = value(id); if (v !== undefined) s[id] = v; });
    return s;
  }

  /* ── toast ────────────────────────────────────────────── */
  function toast(message, type = "success") {
    const t = $("settingsToast");
    if (!t) return;
    t.textContent = message;
    t.className   = `settings-toast show ${type}`;
    clearTimeout(window.__toastTimer);
    window.__toastTimer = setTimeout(() => t.classList.remove("show"), 3200);
  }

  /* ── appearance ───────────────────────────────────────── */
  function applyAppearance() {
    const s    = readSettings();
    const dark = Boolean(s.darkMode);

    document.body.classList.toggle("dark-mode",      dark);
    document.body.classList.toggle("dark-settings",  dark);
    document.documentElement.setAttribute("data-bs-theme", dark ? "dark" : "light");

    document.body.classList.toggle("sidebar-collapsed", Boolean(s.collapsedSidebar));
    document.body.classList.toggle("settings-compact",  s.interfaceDensity === "compact");

    const sidebar = $("sidebarMenu");
    if (sidebar) sidebar.classList.toggle("collapsed", Boolean(s.collapsedSidebar));

    setValue("darkMode",          s.darkMode);
    setValue("collapsedSidebar",  s.collapsedSidebar);
    setValue("interfaceDensity",  s.interfaceDensity);

    /* Update the header profile visible on EVERY page via app.js */
    if (typeof window.refreshHeaderShopProfile === "function") {
      window.refreshHeaderShopProfile();
    } else {
      updateHeaderProfile();
    }
  }

  /* Fallback header updater for settings pages
     (app.js already has refreshHeaderShopProfile but settings pages
      use the SAME IDs: headerAdminName, headerShopLogo, headerShopLogoFallback) */
  function updateHeaderProfile() {
    const s    = readSettings();
    const name = String(s.userName || s.adminName || "Admin").trim() || "Admin";
    const logo = String(s.logo || s.shopLogo || "").trim();

    const nameEl     = $("headerAdminName");
    const logoEl     = $("headerShopLogo");
    const fallbackEl = $("headerShopLogoFallback");

    if (nameEl) { nameEl.textContent = name; nameEl.title = name; }

    if (logoEl) {
      if (logo) {
        logoEl.src           = logo;
        logoEl.style.display = "block";
        if (fallbackEl) fallbackEl.style.display = "none";
        logoEl.onerror = () => {
          logoEl.style.display = "none";
          if (fallbackEl) fallbackEl.style.display = "block";
        };
      } else {
        logoEl.removeAttribute("src");
        logoEl.style.display = "none";
        if (fallbackEl) fallbackEl.style.display = "block";
      }
    }
  }

  /* ── API helper ────────────────────────────────────────── */
  function apiUrl(path, base = NODE_API) {
    if (!base) return path;
    return `${base}${path.startsWith("/") ? path : "/" + path}`;
  }

  async function api(url, options = {}) {
    const headers = new Headers(options.headers || {});
    headers.set("ngrok-skip-browser-warning", "true");
    if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    const res  = await fetch(url, { ...options, headers });
    const text = await res.text();
    let data   = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
    if (!res.ok) throw new Error(data.error || data.message || `Request failed (${res.status})`);
    return data;
  }

  /* ── private section ────────────────────────────────────── */
  function accessData() {
    try { return JSON.parse(localStorage.getItem(ACCESS) || "{}"); }
    catch { return {}; }
  }

  function isUnlocked(category) {
    const d = accessData();
    return Boolean(d.sessions?.[category] && d.sessions[category] > Date.now());
  }

  async function sha256(text) {
    if (!window.crypto?.subtle) return btoa(unescape(encodeURIComponent(text)));
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
  }

  function openPrivate(category) {
    pendingPrivateCategory = category;
    const title    = $("privateModalTitle");
    const text     = $("privateModalText");
    const firstUse = $("firstUseNote");
    const pwd      = $("privateAccessPassword");
    const err      = $("privateAccessError");
    const modal    = $("privateAccessModal");
    if (!pwd || !modal) return;

    const exists = Boolean(accessData().hashes?.[category]);
    if (title)    title.textContent = category === "payment" ? "Unlock Payment & UPI" : "Unlock Admin & Security";
    if (text)     text.textContent  = category === "payment"
      ? "UPI and payment information is private."
      : "Administrator and security information is private.";
    if (firstUse) firstUse.classList.toggle("d-none", exists);
    pwd.value = "";
    if (err) { err.textContent = ""; err.classList.add("d-none"); }

    if (window.bootstrap?.Modal) {
      accessModal ??= new bootstrap.Modal(modal);
      accessModal.show();
    }
    setTimeout(() => pwd.focus(), 200);
  }

  async function unlock(category, password) {
    if (!password || password.length < 8) throw new Error("Password must be at least 8 characters.");
    const d  = accessData();
    d.hashes   ??= {};
    d.sessions  ??= {};
    const hash = await sha256(password);
    if (d.hashes[category] && d.hashes[category] !== hash) throw new Error("Incorrect access password.");
    if (!d.hashes[category]) d.hashes[category] = hash;
    const timeout = Math.max(1, Number(readSettings().sessionTimeout || 15));
    d.sessions[category] = Date.now() + timeout * 60 * 1000;
    localStorage.setItem(ACCESS, JSON.stringify(d));
    armAccessTimer();
  }

  function armAccessTimer() {
    clearTimeout(accessTimer);
    const mins = Math.max(1, Number(readSettings().sessionTimeout || 15));
    accessTimer = setTimeout(() => {
      const d = accessData(); d.sessions = {};
      localStorage.setItem(ACCESS, JSON.stringify(d));
      protectCurrentPrivatePage();
    }, mins * 60 * 1000);
  }

  function protectCurrentPrivatePage() {
    if (page === "settings-payment.html")  protectPrivatePageByCategory("payment");
    if (page === "settings-security.html") protectPrivatePageByCategory("security");
  }

  function protectPrivatePageByCategory(category) {
    const locked  = $(`${category}Locked`);
    const content = $(`${category}Content`);
    if (!locked || !content) return;
    const unlocked = isUnlocked(category);
    locked.classList.toggle("d-none",  unlocked);
    content.classList.toggle("d-none", !unlocked);
    if (unlocked && category === "payment") loadPayment();
  }

  /* ── image helpers ─────────────────────────────────────── */
  function previewImage(file, imgId, emptyId) {
    if (!file) return;
    const img   = $(imgId);
    const empty = $(emptyId);
    if (!img || !empty) return;
    if (!["image/png","image/jpeg","image/webp"].includes(file.type) || file.size > 5*1024*1024) {
      toast("Image must be PNG/JPG/WEBP ≤ 5 MB.", "error"); return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      img.src = e.target.result;
      img.style.display   = "block";
      empty.style.display = "none";
    };
    reader.readAsDataURL(file);
  }

  function setImage(src, imgId, emptyId) {
    const img   = $(imgId);
    const empty = $(emptyId);
    if (!img || !empty) return;
    if (src) {
      img.src = src; img.style.display = "block"; empty.style.display = "none";
    } else {
      img.removeAttribute("src"); img.style.display = "none"; empty.style.display = "block";
    }
  }

  async function fileToData(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload  = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  /* ── SHOP page ─────────────────────────────────────────── */
  function loadShop() {
    const s = readSettings();
    ["shopName","userName","businessType","shopAddress","shopCity",
     "shopState","shopPin","shopPhone","shopEmail","shopGst"
    ].forEach(id => setValue(id, s[id]));
    setImage(s.logo || s.shopLogo, "logoPreview", "logoEmpty");
  }

  async function saveShop() {
    const s    = collect(["shopName","userName","businessType","shopAddress","shopCity",
                           "shopState","shopPin","shopPhone","shopEmail","shopGst"]);
    const file = $("shopLogoInput")?.files?.[0];
    if (file) {
      if (!["image/png","image/jpeg","image/webp"].includes(file.type) || file.size > 5*1024*1024) {
        toast("Logo must be PNG/JPG/WEBP ≤ 5 MB.", "error"); return;
      }
      const dataUrl = await fileToData(file);
      s.logo    = dataUrl;
      s.shopLogo = dataUrl;   /* keep shopLogo alias in sync */
    }
    /* Keep adminName alias in sync so security page and app.js see same value */
    s.adminName = s.userName;
    saveSettings(s);
    applyAppearance();
    if (NODE_API) saveAllToServer().catch(() => {});
    toast("Shop Information saved.");
  }

  /* ── PAYMENT page ──────────────────────────────────────── */
  async function loadPayment() {
    try {
      if (!NODE_API) return;
      const data = await api(apiUrl("/settings"));
      setValue("upiId",   data.upi_id       || "");
      setValue("upiName", data.business_name || "");
      setQr(data.upi_qr_image || "");
      const status = $("qrStatus");
      if (status) status.textContent = data.upi_qr_image ? "QR saved on server" : "No QR saved";
    } catch (err) {
      console.warn("loadPayment:", err.message);
      toast("Could not load UPI from server.", "error");
    }
  }

  function setQr(path) {
    if (!path) { setImage("", "upiQrPreview", "qrEmpty"); return; }
    const base = NODE_API.replace(/\/api\/?$/, "");
    const src  = /^https?:|^data:/i.test(path) ? path : `${base}${path}`;
    setImage(src, "upiQrPreview", "qrEmpty");
  }

  async function uploadQr() {
    const file = $("upiQrInput")?.files?.[0];
    if (!file) return null;
    if (!["image/png","image/jpeg","image/webp"].includes(file.type) || file.size > 5*1024*1024)
      throw new Error("QR image must be PNG/JPG/WEBP ≤ 5 MB.");
    if (!NODE_API) return null;
    const fd = new FormData();
    fd.append("qr", file);
    const data = await api(apiUrl("/settings/upi-qr"), { method: "POST", body: fd });
    return data.qrImage || data.qr_image || null;
  }

  async function savePayment() {
    if (!isUnlocked("payment")) { openPrivate("payment"); return; }
    try {
      const upi = String(value("upiId") || "").trim();
      if (upi && !/^[^\s@]+@[^\s@]+$/.test(upi)) throw new Error("Enter a valid UPI ID.");
      const s  = collect(["cashEnabled","upiEnabled","cardEnabled","upiId","upiName"]);
      const qr = await uploadQr();
      if (qr) { s.upiQrImage = qr; setQr(qr); }
      saveSettings(s);
      if (NODE_API) {
        const payload = { upi_id: upi, business_name: String(value("upiName") || "").trim() };
        if (qr) payload.upi_qr_image = qr;
        await api(apiUrl("/settings"), { method: "PUT", body: JSON.stringify(payload) });
      }
      toast("Payment & UPI saved.");
    } catch (err) { toast(err.message, "error"); }
  }

  /* ── SECURITY page ─────────────────────────────────────── */
  async function saveSecurity() {
    if (!isUnlocked("security")) { openPrivate("security"); return; }
    const newPwd     = String(value("newAdminPassword")     || "");
    const confirmPwd = String(value("confirmAdminPassword") || "");
    if (newPwd || confirmPwd) {
      if (newPwd.length < 8 || newPwd !== confirmPwd) {
        toast("Passwords must match and be ≥ 8 characters.", "error"); return;
      }
      localStorage.setItem("myshopAdminPasswordHash", await sha256(newPwd));
    }
    const s = collect(["adminName","adminUsername","sessionTimeout","rememberMe","confirmDangerousActions"]);
    /* keep userName in sync so app.js header shows correct name */
    s.userName = s.adminName;
    saveSettings(s);
    ["currentAdminPassword","newAdminPassword","confirmAdminPassword"].forEach(id => {
      const el = $(id); if (el) el.value = "";
    });
    applyAppearance();
    toast("Admin & Security saved.");
  }

  /* ── TAX page ───────────────────────────────────────────── */
  function updateDefaultGstSplit() {
    const totalEl = $("defaultTax");
    const cgstEl  = $("defaultCgst");
    const sgstEl  = $("defaultSgst");
    if (!totalEl || !cgstEl || !sgstEl) return;

    const total = Math.max(0, Number(totalEl.value || 0));
    const half = total / 2;

    const formatted = `${half.toFixed(2)}%`;
    cgstEl.textContent = formatted;
    sgstEl.textContent = formatted;
  }

  function bindTaxPage() {
    const totalEl = $("defaultTax");
    if (!totalEl) return;

    totalEl.addEventListener("input", updateDefaultGstSplit);
    totalEl.addEventListener("change", updateDefaultGstSplit);

    updateDefaultGstSplit();
  }

  async function saveTax() {
    const total = Math.max(0, Number(value("defaultTax") || 0));
    const half = Number((total / 2).toFixed(2));

    const s = collect([
      "defaultTax",
      "roundingMode",
      "gstEnabled"
    ]);

    /* Keep the default split synchronized with the total GST. */
    s.defaultTax = total;
    s.defaultCgst = half;
    s.defaultSgst = half;

    /* Inclusive is the project's current GST model.
       Keep this value for older server/settings compatibility. */
    s.taxMode = "inclusive";

    saveSettings(s);

    if (NODE_API) {
      try {
        await api(apiUrl("/settings/tax"), {
          method: "PUT",
          body: JSON.stringify({
            tax_settings: {
              gstEnabled: Boolean(s.gstEnabled),
              defaultTax: total,
              defaultCgst: half,
              defaultSgst: half,
              taxMode: "inclusive",
              roundingMode: "2-decimal"
            }
          })
        });
      } catch (err) {
        console.warn("saveTax server sync:", err.message);
        toast("Tax saved locally, but server sync failed.", "error");
        return;
      }
    }

    updateDefaultGstSplit();
    toast("Tax & Billing saved.");
  }

  /* ── generic save ──────────────────────────────────────── */
  function saveSimple(ids, message, apply = false) {
    const s = collect(ids);
    saveSettings(s);
    if (apply) applyAppearance();
    if (NODE_API) saveAllToServer().catch(() => {});
    toast(message);
  }

  /* ── load all fields on page load ─────────────────────── */
  function loadAllFields() {
    const s = readSettings();

    /* Migrate older tax settings to the current inclusive GST model. */
    if (s.defaultCgst === undefined || s.defaultSgst === undefined) {
      const half = Number(s.defaultTax || 0) / 2;
      s.defaultCgst = Number(half.toFixed(2));
      s.defaultSgst = Number(half.toFixed(2));
    }
    if (s.taxMode !== "inclusive") {
      s.taxMode = "inclusive";
    }
    if (s.roundingMode !== "2-decimal") {
      s.roundingMode = "2-decimal";
    }

    saveSettings(s);
    Object.keys(s).forEach(id => setValue(id, s[id]));

    if (page === "settings.html" || page === "settings-shop.html" || page === "") loadShop();

    applyAppearance();
    updateDefaultGstSplit();
  }

  /* ── server sync ────────────────────────────────────────── */
  async function saveAllToServer() {
    if (!NODE_API) return;
    const s = readSettings();
    await api(apiUrl("/settings/all"), {
      method: "PUT",
      body: JSON.stringify({
        shop_info: {
          shopName: s.shopName, ownerName: s.userName, businessType: s.businessType,
          shopAddress: s.shopAddress, shopCity: s.shopCity, shopState: s.shopState,
          shopPin: s.shopPin, shopPhone: s.shopPhone, shopEmail: s.shopEmail,
          shopGst: s.shopGst, logo: s.logo || ""
        },
        invoice_settings: {
          invoicePrefix: s.invoicePrefix, invoiceStartingNumber: s.invoiceStartingNumber,
          currencySymbol: s.currencySymbol, paperSize: s.paperSize, invoiceFooter: s.invoiceFooter,
          showLogoOnInvoice: s.showLogoOnInvoice, showGstinOnInvoice: s.showGstinOnInvoice,
          showCustomerOnInvoice: s.showCustomerOnInvoice, showPaymentOnInvoice: s.showPaymentOnInvoice,
          showReceivedOnInvoice: s.showReceivedOnInvoice, showChangeOnInvoice: s.showChangeOnInvoice,
          showUpiRefOnInvoice: s.showUpiRefOnInvoice, showCardRefOnInvoice: s.showCardRefOnInvoice
        },
        tax_settings: {
          gstEnabled: s.gstEnabled,
          defaultTax: s.defaultTax,
          defaultCgst: s.defaultCgst,
          defaultSgst: s.defaultSgst,
          /* Backward-compatible server value; current model is inclusive. */
          taxMode: "inclusive",
          roundingMode: "2-decimal"
        },
        inventory_settings: {
          lowStockThreshold: s.lowStockThreshold, lowStockAlerts: s.lowStockAlerts,
          outOfStockWarning: s.outOfStockWarning, allowNegativeStock: s.allowNegativeStock,
          autoDeductStock: s.autoDeductStock, restoreOnCancellation: s.restoreOnCancellation
        },
        appearance_settings: {
          darkMode: s.darkMode, collapsedSidebar: s.collapsedSidebar,
          interfaceDensity: s.interfaceDensity
        },
        admin_settings: {
          adminName: s.adminName, adminUsername: s.adminUsername, sessionTimeout: s.sessionTimeout
        }
      })
    });
  }

  async function loadAllFromServer() {
    if (!NODE_API) return;
    try {
      const data = await api(apiUrl("/settings/all"));
      const s    = readSettings();
      const parse = v => {
        if (!v) return {};
        if (typeof v === "object") return v;
        try { return JSON.parse(v); } catch { return {}; }
      };
      Object.assign(s,
        parse(data.shop_info_json),
        parse(data.invoice_settings_json),
        parse(data.tax_settings_json),
        parse(data.inventory_settings_json),
        parse(data.appearance_settings_json),
        parse(data.admin_settings_json)
      );
      saveSettings(s);
      loadAllFields();
    } catch (err) { console.warn("loadAllFromServer:", err.message); }
  }

  /* ── health check ───────────────────────────────────────── */
  function markHealth(id, ok, text) {
    const el = $(id); if (!el) return;
    el.classList.toggle("ok",    ok);
    el.classList.toggle("error", !ok);
    const b = el.querySelector("b"); if (b) b.textContent = text;
  }

  async function testConnections() {
    markHealth("nodeHealth",  false, "Checking…");
    markHealth("mysqlHealth", false, "Checking…");
    markHealth("flaskHealth", false, "Checking…");

    if (NODE_API) {
      try {
        const data = await api(apiUrl("/health"));
        markHealth("nodeHealth",  true, "Connected");
        markHealth("mysqlHealth", true, data.database || "Connected");
      } catch {
        markHealth("nodeHealth",  false, "Unavailable");
        markHealth("mysqlHealth", false, "Unavailable");
      }
    } else {
      markHealth("nodeHealth",  false, "Not configured");
      markHealth("mysqlHealth", false, "Not configured");
    }

    if (PYTHON_API) {
      try {
        await api(`${PYTHON_API}/health`);
        markHealth("flaskHealth", true, "Connected");
      } catch {
        try {
          const r = await fetch(`${PYTHON_API}/analytics/dashboard`,
            { headers: { "ngrok-skip-browser-warning": "true" } });
          markHealth("flaskHealth", r.ok, r.ok ? "Connected" : "Unavailable");
        } catch { markHealth("flaskHealth", false, "Unavailable"); }
      }
    } else { markHealth("flaskHealth", false, "Not configured"); }

    const s   = readSettings();
    const cfg = Boolean(s.upiId || s.upiQrImage);
    const upi = $("upiHealth");
    if (upi) {
      upi.classList.toggle("ok",    cfg);
      upi.classList.toggle("error", !cfg);
      const b = upi.querySelector("b"); if (b) b.textContent = cfg ? "Configured" : "Not configured";
    }
  }

  /* ── api status pill ────────────────────────────────────── */
  async function updateApiStatus() {
    /* Settings pages no longer have a separate api-status pill;
       connection info is visible in Data & System tab only. */
    if (!NODE_API) return;
    try {
      await fetch(apiUrl("/health"), { headers: { "ngrok-skip-browser-warning": "true" } });
    } catch { /* silent */ }
  }

  /* ── data export / reset ────────────────────────────────── */
  function downloadJson(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /* ── sidebar toggle (settings pages use #btnToggleSidebar) ─ */
  function bindSidebar() {
    const btn = $("btnToggleSidebar");
    if (!btn) return;
    /* Replace any old listeners */
    const fresh = btn.cloneNode(true);
    btn.parentNode.replaceChild(fresh, btn);

    fresh.addEventListener("click", () => {
      const collapsed = !document.body.classList.contains("sidebar-collapsed");
      const s = readSettings();
      s.collapsedSidebar = collapsed;
      saveSettings(s);
      applyAppearance();
    });
  }

  /* ── live appearance bindings ────────────────────────────── */
  function bindThemeLiveUpdate() {
    $("darkMode")?.addEventListener("change", () => {
      const s = readSettings(); s.darkMode = $("darkMode").checked;
      saveSettings(s); applyAppearance();
    });
    $("collapsedSidebar")?.addEventListener("change", () => {
      const s = readSettings(); s.collapsedSidebar = $("collapsedSidebar").checked;
      saveSettings(s); applyAppearance();
    });
    $("interfaceDensity")?.addEventListener("change", () => {
      const s = readSettings(); s.interfaceDensity = $("interfaceDensity").value;
      saveSettings(s); applyAppearance();
    });
  }

  /* ── private modal ──────────────────────────────────────── */
  function bindPrivateModal() {
    $("unlockPaymentBtn")?.addEventListener("click",  () => openPrivate("payment"));
    $("unlockSecurityBtn")?.addEventListener("click", () => openPrivate("security"));

    $("privateAccessForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const err = $("privateAccessError");
      try {
        await unlock(pendingPrivateCategory, $("privateAccessPassword")?.value || "");
        if (accessModal) accessModal.hide();
        toast("Authorization successful.");
        protectCurrentPrivatePage();
      } catch (ex) {
        if (err) { err.textContent = ex.message; err.classList.remove("d-none"); }
      }
    });

    $("togglePrivatePassword")?.addEventListener("click", () => {
      const inp  = $("privateAccessPassword"); if (!inp) return;
      const icon = document.querySelector("#togglePrivatePassword i");
      inp.type   = inp.type === "password" ? "text" : "password";
      if (icon) icon.className = inp.type === "password" ? "bi bi-eye" : "bi bi-eye-slash";
    });
  }

  function bindPrivateTabs() {
    document.querySelectorAll(
      '.settings-tab[data-category="payment"], .settings-tab[data-category="security"]'
    ).forEach(link => {
      link.addEventListener("click", (e) => {
        if (!isUnlocked(link.dataset.category)) {
          e.preventDefault(); openPrivate(link.dataset.category);
        }
      });
    });
  }

  /* ── page save buttons ────────────────────────────────────── */
  function bindPageButtons() {
    $("saveShopBtn")?.addEventListener("click", saveShop);
    $("shopLogoInput")?.addEventListener("change",
      (e) => previewImage(e.target.files?.[0], "logoPreview", "logoEmpty"));

    $("savePaymentBtn")?.addEventListener("click", savePayment);
    $("upiQrInput")?.addEventListener("change",
      (e) => previewImage(e.target.files?.[0], "upiQrPreview", "qrEmpty"));

    $("saveInvoiceBtn")?.addEventListener("click", () => saveSimple([
      "invoicePrefix","invoiceStartingNumber","currencySymbol","paperSize","invoiceFooter",
      "showLogoOnInvoice","showGstinOnInvoice","showCustomerOnInvoice","showPaymentOnInvoice",
      "showReceivedOnInvoice","showChangeOnInvoice","showUpiRefOnInvoice","showCardRefOnInvoice"
    ], "Invoice & Receipt saved."));

    $("saveTaxBtn")?.addEventListener("click", saveTax);
    bindTaxPage();

    $("saveInventoryBtn")?.addEventListener("click", () => saveSimple([
      "lowStockThreshold","lowStockAlerts","outOfStockWarning","autoDeductStock",
      "restoreOnCancellation","allowNegativeStock"
    ], "Inventory settings saved."));

    $("saveSecurityBtn")?.addEventListener("click", saveSecurity);

    $("saveAppearanceBtn")?.addEventListener("click", () => saveSimple([
      "darkMode","collapsedSidebar","interfaceDensity"
    ], "Appearance saved.", true));

    $("testConnectionsBtn")?.addEventListener("click", testConnections);

    $("exportSettingsBtn")?.addEventListener("click", () =>
      downloadJson(`myshop-settings-${Date.now()}.json`, readSettings()));

    $("exportLocalBtn")?.addEventListener("click", () =>
      downloadJson(`myshop-local-data-${Date.now()}.json`, {
        settings: readSettings(),
        privateAccessConfigured: Boolean(Object.keys(accessData().hashes || {}).length)
      }));

    $("resetSettingsBtn")?.addEventListener("click", () => {
      if (confirm("Reset browser-side settings to defaults?")) {
        saveSettings({ ...defaults }); location.reload();
      }
    });

    $("factoryResetBtn")?.addEventListener("click", () => {
      if (confirm("Factory reset? MySQL data will NOT be deleted.")) {
        localStorage.removeItem(STORE);
        localStorage.removeItem(THEME);
        localStorage.removeItem(ACCESS);
        localStorage.removeItem("myshopAdminPasswordHash");
        location.reload();
      }
    });
  }

  /* ── INIT ────────────────────────────────────────────────── */
  async function init() {
    loadAllFields();
    bindSidebar();
    bindThemeLiveUpdate();
    bindPrivateModal();
    bindPrivateTabs();
    bindPageButtons();
    protectCurrentPrivatePage();
    armAccessTimer();
    updateApiStatus();
    if ($("nodeHealth")) testConnections();
    if (NODE_API) loadAllFromServer();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
