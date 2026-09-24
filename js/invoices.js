// =========================================
// invoices.js — reads API URL from config.js
// =========================================
const NODE_API = window.APP_CONFIG.NODE_API;

document.addEventListener('DOMContentLoaded', async () => {

    // ── DOM ELEMENTS ──────────────────────────────────────────────────────────
    const invoicesTableBody   = document.getElementById('invoicesTableBody');
    const searchInput         = document.getElementById('searchInvoiceInput');
    const filterPaymentMethod = document.getElementById('filterPaymentMethod');

    const modalInvoiceNo      = document.getElementById('modalInvoiceNo');
    const modalInvoiceDate    = document.getElementById('modalInvoiceDate');
    const modalCustName       = document.getElementById('modalCustName');
    const modalCustPhone      = document.getElementById('modalCustPhone');
    const modalPaymentMethod  = document.getElementById('modalPaymentMethod');
    const modalInvoiceItems   = document.getElementById('modalInvoiceItems');
    const modalSubtotal       = document.getElementById('modalSubtotal');
    const modalGST            = document.getElementById('modalGST');
    const modalDiscount       = document.getElementById('modalDiscount');
    const modalGrandTotal     = document.getElementById('modalGrandTotal');
    const btnPrintInvoice     = document.getElementById('btnPrintInvoice');

    let allInvoices = [];
    let bsModal     = null;

    // ── HELPERS ───────────────────────────────────────────────────────────────
    function fmt(val) {
        const n = parseFloat(val);
        return isNaN(n) ? '0.00' : n.toFixed(2);
    }

    function formatDateTime(isoStr) {
        if (!isoStr) return '—';
        const dt = new Date(isoStr);
        return isNaN(dt) ? isoStr : dt.toLocaleString('en-IN', {
            day: 'numeric', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    }

    // ── 1. LOAD ALL INVOICES ──────────────────────────────────────────────────
    async function loadInvoices() {
        showTableLoading();
        try {
            const res = await apiFetch(`${NODE_API}/sales`);
            if (!res.ok) throw new Error(`Server error ${res.status}`);
            allInvoices = await res.json();
            applyFiltersAndRender();
        } catch (err) {
            console.error('Failed to load invoices:', err);
            showTableError(err.message);
        }
    }

    // ── 2. FILTER + RENDER TABLE ──────────────────────────────────────────────
    function applyFiltersAndRender() {
        const query        = (searchInput?.value || '').toLowerCase().trim();
        const methodFilter = (filterPaymentMethod?.value || '').toLowerCase();

        const filtered = allInvoices.filter(inv => {
            const matchesSearch =
                String(inv.id).includes(query) ||
                (inv.customer_name || '').toLowerCase().includes(query);
            const matchesMethod =
                !methodFilter ||
                (inv.payment_method || '').toLowerCase() === methodFilter;
            return matchesSearch && matchesMethod;
        });

        renderInvoices(filtered);
    }

    function renderInvoices(list) {
        if (!invoicesTableBody) return;

        if (!list.length) {
            invoicesTableBody.innerHTML = `
                <tr><td colspan="7" class="text-center text-muted py-4">
                    <i class="bi bi-file-earmark-text display-6 d-block mb-2"></i>
                    No invoices found.
                </td></tr>`;
            return;
        }

        invoicesTableBody.innerHTML = list.map(inv => `
            <tr>
                <td class="fw-bold text-primary">#INV-${inv.id}</td>
                <td>${formatDateTime(inv.sale_date)}</td>
                <td class="fw-semibold">${inv.customer_name || 'Walk-in Customer'}</td>
                <td class="text-muted">—</td>
                <td><span class="badge bg-info text-dark">${inv.payment_method || 'Cash'}</span></td>
                <td class="fw-bold">₹${fmt(inv.total_amount)}</td>
                <td class="text-end">
                    <button class="btn btn-sm btn-outline-primary" onclick="viewInvoiceModal(${inv.id})">
                        <i class="bi bi-eye me-1"></i>View
                    </button>
                </td>
            </tr>`).join('');
    }

    // ── 3. FILTER LISTENERS ───────────────────────────────────────────────────
    searchInput?.addEventListener('input', applyFiltersAndRender);
    filterPaymentMethod?.addEventListener('change', applyFiltersAndRender);

    // ── 4. VIEW INVOICE MODAL ─────────────────────────────────────────────────
    window.viewInvoiceModal = async function (saleId) {
        setModalLoading(saleId);
        const modalEl = document.getElementById('invoiceDetailModal');
        if (!modalEl) return;
        bsModal = bsModal || new bootstrap.Modal(modalEl);
        bsModal.show();

        try {
            const res = await apiFetch(`${NODE_API}/sales/${saleId}`);
            if (!res.ok) throw new Error(`Could not load invoice #${saleId}`);
            const inv = await res.json();
            populateModal(inv);
        } catch (err) {
            console.error('Invoice detail fetch failed:', err);
            setModalError(err.message);
        }
    };

    function setModalLoading(saleId) {
        if (modalInvoiceNo)     modalInvoiceNo.textContent     = `#INV-${saleId}`;
        if (modalInvoiceDate)   modalInvoiceDate.textContent   = 'Loading…';
        if (modalCustName)      modalCustName.textContent      = '—';
        if (modalCustPhone)     modalCustPhone.textContent     = '—';
        if (modalPaymentMethod) modalPaymentMethod.textContent = '—';
        if (modalInvoiceItems)  modalInvoiceItems.innerHTML    = '<tr><td colspan="6" class="text-center text-muted py-3">Loading items…</td></tr>';
        if (modalSubtotal)      modalSubtotal.textContent      = '₹—';
        if (modalGST)           modalGST.textContent           = '₹—';
        if (modalDiscount)      modalDiscount.textContent      = '₹—';
        if (modalGrandTotal)    modalGrandTotal.textContent    = '₹—';
    }

    function setModalError(msg) {
        if (modalInvoiceItems) {
            modalInvoiceItems.innerHTML = `<tr><td colspan="6" class="text-center text-danger py-3">${msg}</td></tr>`;
        }
    }

    function populateModal(inv) {
        if (modalInvoiceNo)     modalInvoiceNo.textContent     = `#INV-${inv.id}`;
        if (modalInvoiceDate)   modalInvoiceDate.textContent   = formatDateTime(inv.sale_date);
        if (modalCustName)      modalCustName.textContent      = inv.customer_name || 'Walk-in Customer';
        if (modalCustPhone)     modalCustPhone.textContent     = '—';
        if (modalPaymentMethod) modalPaymentMethod.textContent = inv.payment_method || 'Cash';

        const items = inv.items || [];
        if (modalInvoiceItems) {
            if (!items.length) {
                modalInvoiceItems.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No items found</td></tr>';
            } else {
                modalInvoiceItems.innerHTML = items.map(item => {
                    const gstPct   = parseFloat(item.cgst_rate || 0) + parseFloat(item.sgst_rate || 0);
                    const lineBase = parseFloat(item.unit_price) * parseInt(item.quantity);
                    return `
                        <tr>
                            <td>${item.product_name || 'Item'}</td>
                            <td class="text-center">${item.quantity}</td>
                            <td class="text-end">₹${fmt(item.unit_price)}</td>
                            <td class="text-center">${gstPct}%</td>
                            <td class="text-end">—</td>
                            <td class="text-end fw-bold">₹${fmt(lineBase)}</td>
                        </tr>`;
                }).join('');
            }
        }

        const cgst     = parseFloat(inv.cgst_amount || 0);
        const sgst     = parseFloat(inv.sgst_amount || 0);
        const totalGst = cgst + sgst;

        if (modalSubtotal)   modalSubtotal.textContent   = `₹${fmt(inv.subtotal)}`;
        if (modalGST)        modalGST.textContent        = `₹${fmt(totalGst)}`;
        if (modalDiscount)   modalDiscount.textContent   = `₹${fmt(inv.discount)}`;
        if (modalGrandTotal) modalGrandTotal.textContent = `₹${fmt(inv.total_amount)}`;
    }

    // ── 5. PRINT ──────────────────────────────────────────────────────────────
    if (btnPrintInvoice) {
        btnPrintInvoice.addEventListener('click', () => window.print());
    }

    // ── LOADING / ERROR STATES ────────────────────────────────────────────────
    function showTableLoading() {
        if (invoicesTableBody) {
            invoicesTableBody.innerHTML = `
                <tr><td colspan="7" class="text-center text-muted py-4">
                    <div class="spinner-border spinner-border-sm me-2" role="status"></div>
                    Loading invoices from database…
                </td></tr>`;
        }
    }

    function showTableError(msg) {
        if (invoicesTableBody) {
            invoicesTableBody.innerHTML = `
                <tr><td colspan="7" class="text-center text-danger py-4">
                    <i class="bi bi-exclamation-triangle display-6 d-block mb-2"></i>
                    Could not load invoices: ${msg}<br>
                    <small class="text-muted">Make sure the Node.js server is running and ngrok URL is up to date in <code>js/config.js</code>.</small>
                </td></tr>`;
        }
    }

    // ── INITIAL LOAD ──────────────────────────────────────────────────────────
    await loadInvoices();
});
