document.addEventListener('DOMContentLoaded', () => {
    const invoicesTableBody = document.getElementById('invoicesTableBody');
    const searchInput = document.querySelector('input[placeholder*="Search"]');

    let allInvoices = [];

    // 1. Helper to safely format numbers (prevents .toFixed on strings crash)
    function formatAmount(val) {
        const num = parseFloat(val);
        return isNaN(num) ? '0.00' : num.toFixed(2);
    }

    // 2. Normalize Invoice Object keys (supports old and new Billing formats)
    function normalizeInvoice(inv) {
        return {
            id: inv.id || inv.invoiceNo || 'INV-0000',
            date: inv.date || inv.dateTime || 'N/A',
            customerName: inv.customerName || 'Walk-in Customer',
            customerPhone: inv.customerPhone || inv.customerContact || 'N/A',
            items: inv.items || [],
            subtotal: formatAmount(inv.subtotal),
            gst: formatAmount(inv.gst || inv.totalGST),
            discount: formatAmount(inv.discount),
            grandTotal: formatAmount(inv.grandTotal),
            paymentMethod: inv.paymentMethod || 'Cash'
        };
    }

    // 3. Load Invoices from LocalStorage
    function loadInvoices() {
        const rawInvoices = JSON.parse(localStorage.getItem('invoices')) || [];
        allInvoices = rawInvoices.map(normalizeInvoice);
        renderInvoices(allInvoices);
    }

    // 4. Render Invoice Table Rows
    function renderInvoices(invoicesToRender) {
        if (!invoicesTableBody) return;

        invoicesTableBody.innerHTML = '';

        if (invoicesToRender.length === 0) {
            invoicesTableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center text-muted py-4">
                        <i class="bi bi-file-earmark-text display-6 d-block mb-2"></i>
                        No invoices found.
                    </td>
                </tr>`;
            return;
        }

        invoicesToRender.forEach(inv => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="fw-bold text-primary">${inv.id}</td>
                <td>${inv.date}</td>
                <td>
                    <div class="fw-semibold">${inv.customerName}</div>
                    <small class="text-muted">${inv.customerPhone}</small>
                </td>
                <td><span class="badge bg-info text-dark">${inv.paymentMethod}</span></td>
                <td class="fw-bold">₹${inv.grandTotal}</td>
                <td class="text-end">
                    <button class="btn btn-sm btn-outline-primary" onclick="viewInvoiceModal('${inv.id}')">
                        <i class="bi bi-eye me-1"></i>View
                    </button>
                </td>
            `;
            invoicesTableBody.appendChild(row);
        });
    }

    // 5. Real-Time Search Handler
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            const filtered = allInvoices.filter(inv => 
                inv.id.toLowerCase().includes(query) ||
                inv.customerName.toLowerCase().includes(query) ||
                inv.customerPhone.toLowerCase().includes(query)
            );
            renderInvoices(filtered);
        });
    }

    // 6. View Invoice Detail Modal
    window.viewInvoiceModal = function(invoiceId) {
        const inv = allInvoices.find(i => i.id === invoiceId);
        if (!inv) return;

        let modalEl = document.getElementById('invoiceDetailModal');

        if (!modalEl) {
            modalEl = document.createElement('div');
            modalEl.id = 'invoiceDetailModal';
            modalEl.className = 'modal fade';
            modalEl.tabIndex = -1;
            document.body.appendChild(modalEl);
        }

        const itemsHtml = inv.items.map(item => `
            <tr>
                <td>${item.name || 'Item'}</td>
                <td class="text-center">${item.qty || 1}</td>
                <td class="text-end">₹${formatAmount(item.price || item.sellingPrice)}</td>
                <td class="text-end">₹${formatAmount((item.price || item.sellingPrice) * (item.qty || 1))}</td>
            </tr>
        `).join('');

        modalEl.innerHTML = `
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header bg-primary text-white">
                        <h5 class="modal-title fw-bold">Invoice #${inv.id}</h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body p-4">
                        <div class="text-center mb-3">
                            <h4 class="fw-bold mb-0">MyShop Manager</h4>
                            <small class="text-muted">Date: ${inv.date}</small>
                        </div>
                        <hr>
                        <div class="mb-3 small">
                            <strong>Customer:</strong> ${inv.customerName}<br>
                            <strong>Phone:</strong> ${inv.customerPhone}<br>
                            <strong>Payment Method:</strong> ${inv.paymentMethod}
                        </div>
                        <table class="table table-sm align-middle">
                            <thead class="table-light">
                                <tr>
                                    <th>Item</th>
                                    <th class="text-center">Qty</th>
                                    <th class="text-end">Price</th>
                                    <th class="text-end">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${itemsHtml || '<tr><td colspan="4" class="text-center text-muted">No items</td></tr>'}
                            </tbody>
                        </table>
                        <div class="border-top pt-2">
                            <div class="d-flex justify-content-between small mb-1">
                                <span>Subtotal:</span>
                                <span>₹${inv.subtotal}</span>
                            </div>
                            <div class="d-flex justify-content-between small mb-1">
                                <span>GST:</span>
                                <span>₹${inv.gst}</span>
                            </div>
                            <div class="d-flex justify-content-between small mb-1">
                                <span>Discount:</span>
                                <span>-₹${inv.discount}</span>
                            </div>
                            <div class="d-flex justify-content-between fw-bold fs-5 text-success mt-2">
                                <span>Grand Total:</span>
                                <span>₹${inv.grandTotal}</span>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        <button type="button" class="btn btn-primary" onclick="window.print()"><i class="bi bi-printer me-1"></i>Print</button>
                    </div>
                </div>
            </div>
        `;

        const bsModal = new bootstrap.Modal(modalEl);
        bsModal.show();
    };

    // Initial Load
    loadInvoices();
});