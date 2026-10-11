// =========================================
// INVOICES.JS — fixed historical invoice view
// Reads invoice/sale data from MySQL through
// the Node.js API configured in config.js. No LocalStorage used.
// =========================================

// NODE_API and apiFetch are provided by config.js.
const API = window.NODE_API;
const request = window.apiFetch || window.fetch.bind(window);

if (!API) {
    console.error('NODE_API is not available. Load config.js before invoices.js.');
}

document.addEventListener('DOMContentLoaded', async () => {

    // =========================================
    // DOM ELEMENTS
    // =========================================
    const invoicesTableBody   = document.getElementById('invoicesTableBody');
    const searchInput         = document.getElementById('searchInvoiceInput');
    const filterPaymentMethod = document.getElementById('filterPaymentMethod');

    // Modal elements already present in invoices.html
    const modalInvoiceNo      = document.getElementById('modalInvoiceNo');
    const modalInvoiceDate    = document.getElementById('modalInvoiceDate');
    const modalCustName       = document.getElementById('modalCustName');
    const modalCustPhone      = document.getElementById('modalCustPhone');
    const modalPaymentMethod  = document.getElementById('modalPaymentMethod');
    const modalInvoiceItems   = document.getElementById('modalInvoiceItems');
    const modalSubtotal       = document.getElementById('modalSubtotal');
    const modalCGST           = document.getElementById('modalCGST');
    const modalSGST           = document.getElementById('modalSGST');
    const modalGST            = document.getElementById('modalGST');
    const modalDiscount       = document.getElementById('modalDiscount');
    const modalAmountReceived = document.getElementById('modalAmountReceived');
    const modalChangeAmount   = document.getElementById('modalChangeAmount');
    const modalGrandTotal     = document.getElementById('modalGrandTotal');
    const btnPrintInvoice     = document.getElementById('btnPrintInvoice');

    let allInvoices = [];
    let bsModal = null;

    // =========================================
    // HELPERS
    // =========================================
    function num(value, fallback = 0) {
        const n = Number.parseFloat(value);
        return Number.isFinite(n) ? n : fallback;
    }

    function fmt(value) {
        return num(value).toFixed(2);
    }

    function formatDateTime(value) {
        if (!value) return '—';

        const dt = new Date(value);
        return Number.isNaN(dt.getTime())
            ? String(value)
            : dt.toLocaleString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
    }

    // Values inserted into innerHTML are escaped so product/customer text
    // cannot accidentally become HTML.
    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function paymentBadgeClass(method) {
        const value = String(method || '').toLowerCase();
        if (value === 'cash') return 'bg-success';
        if (value === 'upi') return 'bg-primary';
        if (value === 'card') return 'bg-warning text-dark';
        return 'bg-info text-dark';
    }

    // =========================================
    // 1. LOAD ALL INVOICES FROM MYSQL
    // =========================================
    async function loadInvoices() {
        showTableLoading();

        try {
            const res = await request(`${API}/sales`);
            const data = await res.json().catch(() => null);

            if (!res.ok) {
                throw new Error(data?.error || `Server error ${res.status}`);
            }

            if (!Array.isArray(data)) {
                throw new Error('Invalid invoice data received from server.');
            }

            allInvoices = data;
            applyFiltersAndRender();
        } catch (err) {
            console.error('Failed to load invoices:', err);
            showTableError(err.message || 'Unable to load invoices.');
        }
    }

    // =========================================
    // 2. FILTER + RENDER INVOICE HISTORY
    // =========================================
    function applyFiltersAndRender() {
        const query = (searchInput?.value || '').toLowerCase().trim();
        const methodFilter = (filterPaymentMethod?.value || '').toLowerCase().trim();

        const filtered = allInvoices.filter(inv => {
            const searchable = [
                inv.id,
                inv.invoice_number,
                inv.customer_name,
                inv.customer_phone,
                inv.phone
            ]
                .filter(value => value !== null && value !== undefined)
                .join(' ')
                .toLowerCase();

            const matchesSearch = !query || searchable.includes(query);
            const matchesMethod =
                !methodFilter ||
                String(inv.payment_method || '').toLowerCase() === methodFilter;

            return matchesSearch && matchesMethod;
        });

        renderInvoices(filtered);
    }

    function renderInvoices(list) {
        if (!invoicesTableBody) return;

        if (!list.length) {
            invoicesTableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center text-muted py-4">
                        <i class="bi bi-file-earmark-text display-6 d-block mb-2"></i>
                        No invoices found.
                    </td>
                </tr>`;
            return;
        }

        invoicesTableBody.innerHTML = list.map(inv => {
            const invoiceLabel = inv.invoice_number
                ? escapeHtml(inv.invoice_number)
                : `#INV-${escapeHtml(inv.id)}`;

            const method = escapeHtml(inv.payment_method || 'Cash');
            const badge = paymentBadgeClass(inv.payment_method);
            const customer = escapeHtml(inv.customer_name || 'Walk-in Customer');

            return `
                <tr>
                    <td class="fw-bold text-primary">${invoiceLabel}</td>
                    <td>${formatDateTime(inv.sale_date)}</td>
                    <td class="fw-semibold">${customer}</td>
                    <td class="text-muted">—</td>
                    <td>
                        <span class="badge ${badge}">${method}</span>
                    </td>
                    <td class="fw-bold">₹${fmt(inv.total_amount)}</td>
                    <td class="text-end">
                        <button
                            class="btn btn-sm btn-outline-primary"
                            type="button"
                            onclick="viewInvoiceModal(${Number(inv.id)})">
                            <i class="bi bi-eye me-1"></i>View
                        </button>
                    </td>
                </tr>`;
        }).join('');
    }

    // Search + payment filter
    searchInput?.addEventListener('input', applyFiltersAndRender);
    filterPaymentMethod?.addEventListener('change', applyFiltersAndRender);

    // =========================================
    // 3. VIEW ONE INVOICE
    // =========================================
    window.viewInvoiceModal = async function (saleId) {
        const numericSaleId = Number(saleId);
        if (!Number.isInteger(numericSaleId) || numericSaleId <= 0) return;

        setModalLoading(numericSaleId);

        const modalEl = document.getElementById('invoiceDetailModal');
        if (!modalEl) {
            console.error('invoiceDetailModal was not found.');
            return;
        }

        if (typeof bootstrap === 'undefined') {
            console.error('Bootstrap is not loaded.');
            return;
        }

        bsModal = bsModal || new bootstrap.Modal(modalEl);
        bsModal.show();

        try {
            const res = await request(`${API}/sales/${numericSaleId}`);
            const data = await res.json().catch(() => null);

            if (!res.ok) {
                throw new Error(data?.error || `Could not load invoice #${numericSaleId}`);
            }

            populateModal(data);
        } catch (err) {
            console.error('Invoice detail fetch failed:', err);
            setModalError(err.message || 'Could not load invoice.');
        }
    };

    function setModalLoading(saleId) {
        if (modalInvoiceNo) modalInvoiceNo.textContent = `#INV-${saleId}`;
        if (modalInvoiceDate) modalInvoiceDate.textContent = 'Loading…';
        if (modalCustName) modalCustName.textContent = '—';
        if (modalCustPhone) modalCustPhone.textContent = '—';
        if (modalPaymentMethod) modalPaymentMethod.textContent = '—';

        if (modalInvoiceItems) {
            modalInvoiceItems.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center text-muted py-3">
                        Loading items…
                    </td>
                </tr>`;
        }

        if (modalSubtotal) modalSubtotal.textContent = '₹—';
        if (modalCGST) modalCGST.textContent = '₹—';
        if (modalSGST) modalSGST.textContent = '₹—';
        if (modalGST) modalGST.textContent = '₹—';
        if (modalDiscount) modalDiscount.textContent = '₹—';
        if (modalAmountReceived) modalAmountReceived.textContent = '—';
        if (modalChangeAmount) modalChangeAmount.textContent = '—';
        if (modalGrandTotal) modalGrandTotal.textContent = '₹—';
    }

    function setModalError(message) {
        const safeMessage = escapeHtml(message || 'Unable to load invoice.');

        if (modalInvoiceItems) {
            modalInvoiceItems.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center text-danger py-3">
                        <i class="bi bi-exclamation-triangle me-1"></i>
                        ${safeMessage}
                    </td>
                </tr>`;
        }
    }

    // =========================================
    // 4. POPULATE INVOICE FROM STORED SNAPSHOT
    // =========================================
    function populateModal(inv) {
        if (modalInvoiceNo) {
            modalInvoiceNo.textContent = inv.invoice_number
                ? String(inv.invoice_number)
                : `#INV-${inv.id}`;
        }

        if (modalInvoiceDate) {
            modalInvoiceDate.textContent = formatDateTime(inv.sale_date);
        }

        if (modalCustName) {
            modalCustName.textContent = inv.customer_name || 'Walk-in Customer';
        }

        if (modalCustPhone) {
            // Customer phone is not currently stored by the sales schema.
            modalCustPhone.textContent = '—';
        }

        if (modalPaymentMethod) {
            modalPaymentMethod.textContent = inv.payment_method || 'Cash';
        }

        const items = Array.isArray(inv.items) ? inv.items : [];

        if (modalInvoiceItems) {
            if (!items.length) {
                modalInvoiceItems.innerHTML = `
                    <tr>
                        <td colspan="6" class="text-center text-muted">
                            No items found.
                        </td>
                    </tr>`;
            } else {
                modalInvoiceItems.innerHTML = items.map(item => {
                    const quantity = num(item.quantity, 0);
                    const unitPrice = num(item.unit_price, 0);

                    const cgstRate = num(item.cgst_rate, 0);
                    const sgstRate = num(item.sgst_rate, 0);
                    const gstPct = num(
                        item.gst_rate,
                        cgstRate + sgstRate
                    );

                    const storedDiscount = num(item.discount, 0);
                    const storedLineTotal = num(item.line_total, NaN);
                    const storedTax = num(item.tax_amount, NaN);
                    const storedTaxable = num(item.line_subtotal, NaN);

                    // New invoices store the final customer-facing line total
                    // (GST included, after line-level discount) and the
                    // GST/taxable snapshot. Never recalculate historical
                    // invoices from today's Product data.
                    const lineTotal = Number.isFinite(storedLineTotal)
                        ? storedLineTotal
                        : Math.max(0, unitPrice * quantity - storedDiscount);

                    let lineTax = Number.isFinite(storedTax) ? storedTax : 0;
                    let lineTaxable = Number.isFinite(storedTaxable) ? storedTaxable : NaN;

                    if (!Number.isFinite(lineTax) && gstPct > 0) {
                        lineTax = lineTotal * gstPct / (100 + gstPct);
                    }

                    if (!Number.isFinite(lineTaxable)) {
                        lineTaxable = lineTotal - lineTax;
                    }

                    return `
                        <tr>
                            <td>${escapeHtml(item.product_name || 'Item')}</td>
                            <td class="text-center">${fmt(quantity)}</td>
                            <td class="text-end">₹${fmt(unitPrice)}</td>
                            <td class="text-center">${fmt(gstPct)}%</td>
                            <td class="text-end">₹${fmt(storedDiscount)}</td>
                            <td class="text-end fw-bold">₹${fmt(lineTotal)}</td>
                        </tr>`;
                }).join('');
            }
        }

        // Always use the stored sale-header totals.
        // New invoices store subtotal_amount as the GST-exclusive taxable
        // sales value after discount, while total_amount is the final
        // GST-inclusive amount paid by the customer.
        const cgst = num(inv.cgst_amount, 0);
        const sgst = num(inv.sgst_amount, 0);
        const totalGst = num(inv.tax_amount, cgst + sgst);
        const taxableAmount = num(
            inv.subtotal_amount,
            num(inv.subtotal, 0)
        );
        const discount = num(inv.discount, 0);
        const grandTotal = num(inv.total_amount, 0);

        if (modalSubtotal) modalSubtotal.textContent = `₹${fmt(taxableAmount)}`;
        if (modalCGST) modalCGST.textContent = `₹${fmt(cgst)}`;
        if (modalSGST) modalSGST.textContent = `₹${fmt(sgst)}`;
        if (modalGST) modalGST.textContent = `₹${fmt(totalGst)}`;
        if (modalDiscount) modalDiscount.textContent = `₹${fmt(discount)}`;
        if (modalAmountReceived) {
            const received = inv.amount_received;
            modalAmountReceived.textContent =
                received === null || received === undefined
                    ? '—'
                    : `₹${fmt(received)}`;
        }
        if (modalChangeAmount) {
            const change = inv.change_amount;
            modalChangeAmount.textContent =
                change === null || change === undefined
                    ? '—'
                    : `₹${fmt(change)}`;
        }
        if (modalGrandTotal) modalGrandTotal.textContent = `₹${fmt(grandTotal)}`;
    }

    // =========================================
    // 5. PRINT BUTTON
    // =========================================
    if (btnPrintInvoice) {
        btnPrintInvoice.addEventListener('click', () => window.print());
    }

    // =========================================
    // TABLE LOADING / ERROR STATES
    // =========================================
    function showTableLoading() {
        if (!invoicesTableBody) return;

        invoicesTableBody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center text-muted py-4">
                    <div class="spinner-border spinner-border-sm me-2" role="status"></div>
                    Loading invoices from database…
                </td>
            </tr>`;
    }

    function showTableError(message) {
        if (!invoicesTableBody) return;

        invoicesTableBody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center text-danger py-4">
                    <i class="bi bi-exclamation-triangle display-6 d-block mb-2"></i>
                    Could not load invoices: ${escapeHtml(message)}<br>
                    <small class="text-muted">
                        Make sure Node.js server is running on port 5000.
                    </small>
                </td>
            </tr>`;
    }

    // =========================================
    // INITIAL LOAD
    // =========================================
    await loadInvoices();
});
