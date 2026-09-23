// =========================================
// BILLING.JS — Node.js + MySQL + Payment UI
// =========================================
const NODE_API = 'https://enable-empathic-murmuring.ngrok-free.dev/api';

document.addEventListener('DOMContentLoaded', async () => {

    // ── STATE ─────────────────────────────────────────────────────────────────
    let allProducts     = [];
    let cart            = [];
    let currentCategory = 'All';
    let searchQuery     = '';

    // Payment overlay state
    let payState = {
        method:       'Cash',
        upiStatus:    null,   // 'Paid' | 'Pending' | 'Failed'
        cardStatus:   null,   // 'Paid' | 'Failed'
        grandTotal:   0,
        subtotal:     0,
        totalGST:     0,
        discount:     0
    };

    // ── DOM ───────────────────────────────────────────────────────────────────
    const productGrid        = document.getElementById('productGrid');
    const searchInput        = document.getElementById('billingProductSearch');
    const categoryPills      = document.querySelectorAll('.category-pill');
    const cartTableBody      = document.getElementById('cartTableBody');
    const btnClearCart       = document.getElementById('btnClearCart');
    const summarySubtotal    = document.getElementById('summarySubtotal');
    const summaryGST         = document.getElementById('summaryGST');
    const discountInput      = document.getElementById('discountInput');
    const summaryGrandTotal  = document.getElementById('summaryGrandTotal');
    const btnCompletePayment = document.getElementById('btnCompletePayment');

    // Overlay
    const paymentOverlay     = document.getElementById('paymentOverlay');
    const payOverlayClose    = document.getElementById('payOverlayClose');

    // ── 1. LOAD PRODUCTS FROM API ─────────────────────────────────────────────
    async function loadProductsFromAPI() {
        try {
            const res = await fetch(`${NODE_API}/products`);
            if (!res.ok) throw new Error(`Server error ${res.status}`);
            allProducts = await res.json();
            renderProductGrid();
        } catch (err) {
            console.error('Failed to load products:', err);
            productGrid.innerHTML = `
                <div class="col-12 text-center text-danger py-4">
                    <i class="bi bi-exclamation-triangle display-5 d-block mb-2"></i>
                    Could not load products. Make sure Node.js server is running.
                </div>`;
        }
    }

    // ── 2. PRODUCT GRID ───────────────────────────────────────────────────────
    function renderProductGrid() {
        productGrid.innerHTML = '';
        const products = allProducts.map(p => ({
            id:       p.id,
            sku:      p.brand || `SKU-${p.id}`,
            name:     p.name,
            category: p.category || 'General',
            price:    parseFloat(p.selling_price || 0),
            gstRate:  parseFloat(p.cgst_rate || 0) + parseFloat(p.sgst_rate || 0),
            stock:    parseInt(p.stock_quantity || 0, 10)
        }));

        const filtered = products.filter(p => {
            const matchesCat    = currentCategory === 'All' || p.category.toLowerCase() === currentCategory.toLowerCase();
            const matchesSearch = p.name.toLowerCase().includes(searchQuery) ||
                                  String(p.id).includes(searchQuery) ||
                                  (p.sku || '').toLowerCase().includes(searchQuery);
            return matchesCat && matchesSearch;
        });

        if (!filtered.length) {
            productGrid.innerHTML = `<div class="col-12 text-center text-muted py-4"><i class="bi bi-box-seam display-5 d-block mb-2"></i>No products found.</div>`;
            return;
        }

        filtered.forEach(product => {
            const outOfStock = product.stock === 0;
            const col = document.createElement('div');
            col.className = 'col-sm-6 col-md-4 col-xl-3';
            col.innerHTML = `
                <div class="card pos-product-card h-100 p-3 d-flex flex-column justify-content-between shadow-sm ${outOfStock ? 'opacity-50' : ''}">
                    <div class="pos-icon-box text-center mb-2"><i class="bi bi-box-seam text-secondary fs-1"></i></div>
                    <div>
                        <h6 class="fw-bold mb-1 text-truncate" title="${product.name}">${product.name}</h6>
                        <small class="text-muted d-block">${product.category}</small>
                        <small class="text-muted d-block mb-2">Stock: ${product.stock} pcs</small>
                        <div class="d-flex align-items-center justify-content-between mt-2">
                            <span class="fw-bold text-primary fs-6">₹${product.price.toFixed(2)}</span>
                            <button class="btn btn-outline-success btn-sm rounded-circle"
                                onclick="addToCartById(${product.id})" title="Add to Cart"
                                ${outOfStock ? 'disabled' : ''}>
                                <i class="bi bi-plus-lg fs-5"></i>
                            </button>
                        </div>
                    </div>
                </div>`;
            productGrid.appendChild(col);
        });
    }

    // ── 3. CATEGORY + SEARCH ──────────────────────────────────────────────────
    categoryPills.forEach(pill => {
        pill.addEventListener('click', (e) => {
            categoryPills.forEach(p => { p.classList.remove('active','btn-primary'); p.classList.add('btn-outline-secondary'); });
            e.target.classList.remove('btn-outline-secondary');
            e.target.classList.add('active','btn-primary');
            currentCategory = e.target.getAttribute('data-category');
            renderProductGrid();
        });
    });

    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase().trim();
        renderProductGrid();
    });

    // ── 4. CART ───────────────────────────────────────────────────────────────
    window.addToCartById = function(productId) {
        const dbProduct = allProducts.find(p => p.id === productId);
        if (!dbProduct) return;
        const product = {
            id:       dbProduct.id,
            sku:      dbProduct.brand || `SKU-${dbProduct.id}`,
            name:     dbProduct.name,
            price:    parseFloat(dbProduct.selling_price || 0),
            gstRate:  parseFloat(dbProduct.cgst_rate || 0) + parseFloat(dbProduct.sgst_rate || 0),
            stock:    parseInt(dbProduct.stock_quantity || 0, 10)
        };
        const existing = cart.find(i => i.id === product.id);
        if (existing) {
            if (existing.qty < product.stock) existing.qty++;
            else alert(`Stock limit reached! Only ${product.stock} available.`);
        } else {
            cart.push({ ...product, qty: 1, maxStock: product.stock });
        }
        renderCart();
    };

    window.updateQty = function(id, change) {
        const item = cart.find(i => i.id === id);
        if (!item) return;
        const newQty = item.qty + change;
        if (newQty > item.maxStock) { alert(`Cannot exceed stock (${item.maxStock})`); return; }
        if (newQty <= 0) removeFromCart(id); else { item.qty = newQty; renderCart(); }
    };

    window.removeFromCart = function(id) {
        cart = cart.filter(i => i.id !== id);
        renderCart();
    };

    btnClearCart.addEventListener('click', () => {
        if (!cart.length) return;
        if (confirm('Clear the cart?')) { cart = []; renderCart(); }
    });

    function renderCart() {
        cartTableBody.innerHTML = '';
        if (!cart.length) {
            cartTableBody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">Cart is empty. Click <strong>+</strong> on any product to add it.</td></tr>`;
            calculateSummary(0, 0);
            return;
        }
        let subtotal = 0, totalGST = 0;
        cart.forEach(item => {
            const lineSub = item.price * item.qty;
            const lineGST = lineSub * (item.gstRate / 100);
            subtotal  += lineSub;
            totalGST  += lineGST;
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><div class="fw-bold">${item.name}</div><small class="text-muted">${item.sku}</small></td>
                <td>₹${item.price.toFixed(2)}</td>
                <td>
                    <div class="input-group input-group-sm" style="width:90px">
                        <button class="btn btn-outline-secondary" onclick="updateQty(${item.id},-1)">-</button>
                        <input type="text" class="form-control text-center px-1" value="${item.qty}" readonly>
                        <button class="btn btn-outline-secondary" onclick="updateQty(${item.id},1)">+</button>
                    </div>
                </td>
                <td class="fw-bold">₹${(lineSub + lineGST).toFixed(2)}</td>
                <td class="text-end">
                    <button class="btn btn-sm btn-outline-danger border-0" onclick="removeFromCart(${item.id})">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>`;
            cartTableBody.appendChild(row);
        });
        calculateSummary(subtotal, totalGST);
    }

    function calculateSummary(subtotal, totalGST) {
        const discount   = parseFloat(discountInput.value) || 0;
        const grandTotal = Math.max(0, subtotal + totalGST - discount);
        summarySubtotal.textContent   = `₹${subtotal.toFixed(2)}`;
        summaryGST.textContent        = `₹${totalGST.toFixed(2)}`;
        summaryGrandTotal.textContent = `₹${grandTotal.toFixed(2)}`;
        // Keep payState in sync so overlay always shows fresh totals
        payState.subtotal   = subtotal;
        payState.totalGST   = totalGST;
        payState.discount   = discount;
        payState.grandTotal = grandTotal;
    }

    discountInput.addEventListener('input', () => {
        let subtotal = 0, totalGST = 0;
        cart.forEach(i => {
            subtotal += i.price * i.qty;
            totalGST += i.price * i.qty * (i.gstRate / 100);
        });
        calculateSummary(subtotal, totalGST);
    });

    // ── 5. OPEN PAYMENT OVERLAY ───────────────────────────────────────────────
    btnCompletePayment.addEventListener('click', () => {
        if (!cart.length) { alert('Please add at least one item to the cart.'); return; }

        const selectedMethod = document.querySelector('input[name="paymentMethod"]:checked').value;
        const custName       = document.getElementById('custName').value.trim() || 'Walk-in Customer';

        // Sync totals
        let subtotal = 0, totalGST = 0;
        cart.forEach(i => {
            subtotal += i.price * i.qty;
            totalGST += i.price * i.qty * (i.gstRate / 100);
        });
        const discount   = parseFloat(discountInput.value) || 0;
        const grandTotal = Math.max(0, subtotal + totalGST - discount);

        payState = { method: selectedMethod, upiStatus: null, cardStatus: null,
                     grandTotal, subtotal, totalGST, discount };

        openPayOverlay(selectedMethod, grandTotal, custName);
    });

    // ── 6. PAYMENT OVERLAY LOGIC (global functions called from HTML) ──────────

    // Open overlay and set initial tab
    window.openPayOverlay = function(method, amount, custName) {
        document.getElementById('payAmountDisplay').textContent  = `₹${amount.toFixed(2)}`;
        document.getElementById('payCustomerDisplay').textContent = custName;
        document.getElementById('cardAmountHint').textContent     = amount.toFixed(2);

        // Load UPI settings from LocalStorage (set in Settings page)
        loadUPIDisplay();

        // Reset inputs
        const cashTendered = document.getElementById('cashTendered');
        if (cashTendered) { cashTendered.value = ''; }
        document.getElementById('cashChange').textContent = '₹0.00';
        document.getElementById('upiRefInput').value  = '';
        document.getElementById('cardRefInput').value = '';
        document.getElementById('cardTypeSelect').value = 'Debit Card';
        payState.upiStatus = null;
        payState.cardStatus = null;
        clearStatusBtns();
        resetScreens();

        // Switch to selected method tab
        switchPayTab(method);

        paymentOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    };

    payOverlayClose.addEventListener('click', closePayOverlay);
    paymentOverlay.addEventListener('click', (e) => {
        if (e.target === paymentOverlay) closePayOverlay();
    });

    function closePayOverlay() {
        paymentOverlay.classList.remove('active');
        document.body.style.overflow = '';
    }

    // Tab switching
    window.switchPayTab = function(method) {
        payState.method = method;

        // Tab button styles
        ['Cash','UPI','Card'].forEach(m => {
            const btn = document.getElementById(`tab${m}`);
            btn.className = 'pay-tab-btn';
            if (m === method) btn.classList.add(`active-${m.toLowerCase()}`);
        });

        // Show/hide panels
        document.getElementById('panelCash').style.display = method === 'Cash' ? 'block' : 'none';
        document.getElementById('panelUPI').style.display  = method === 'UPI'  ? 'block' : 'none';
        document.getElementById('panelCard').style.display = method === 'Card' ? 'block' : 'none';

        // Sync radio on billing page
        const radio = document.querySelector(`input[name="paymentMethod"][value="${method}"]`);
        if (radio) radio.checked = true;
    };

    // Cash change calculator
    window.calcChange = function() {
        const tendered = parseFloat(document.getElementById('cashTendered').value) || 0;
        const change   = Math.max(0, tendered - payState.grandTotal);
        document.getElementById('cashChange').textContent = `₹${change.toFixed(2)}`;
    };

    // UPI status
    window.setUpiStatus = function(status) {
        payState.upiStatus = status;
        document.getElementById('upiStatusPaid').className    = 'status-btn' + (status === 'Paid'    ? ' active-paid'    : '');
        document.getElementById('upiStatusPending').className = 'status-btn' + (status === 'Pending' ? ' active-pending' : '');
        document.getElementById('upiStatusFailed').className  = 'status-btn' + (status === 'Failed'  ? ' active-failed'  : '');
    };

    // Card status
    window.setCardStatus = function(status) {
        payState.cardStatus = status;
        document.getElementById('cardStatusPaid').className   = 'status-btn' + (status === 'Paid'   ? ' active-paid'   : '');
        document.getElementById('cardStatusFailed').className = 'status-btn' + (status === 'Failed' ? ' active-failed' : '');
    };

    function clearStatusBtns() {
        ['upiStatusPaid','upiStatusPending','upiStatusFailed',
         'cardStatusPaid','cardStatusFailed'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.className = 'status-btn';
        });
    }

    function resetScreens() {
        document.getElementById('paySuccessScreen').classList.remove('active');
        document.getElementById('payFailedScreen').classList.remove('active');
        ['panelCash','panelUPI','panelCard'].forEach(id => {
            document.getElementById(id).style.display = 'none';
        });
    }

    window.resetPayOverlay = function() {
        resetScreens();
        clearStatusBtns();
        document.getElementById('upiRefInput').value  = '';
        document.getElementById('cardRefInput').value = '';
        payState.upiStatus  = null;
        payState.cardStatus = null;
        switchPayTab(payState.method);
    };

    // Load UPI info from Settings LocalStorage
    function loadUPIDisplay() {
        const settings   = JSON.parse(localStorage.getItem('appSettings')) || {};
        const upiId      = settings.upiId       || '';
        const upiName    = settings.upiName      || settings.shopName || 'Shop Name';
        const upiQrImage = settings.upiQrImage   || '';

        const qrBox = document.getElementById('upiQrDisplay');
        if (upiQrImage) {
            qrBox.innerHTML = `<img src="${upiQrImage}" alt="UPI QR Code">`;
        } else {
            qrBox.innerHTML = `
                <div class="upi-qr-placeholder">
                    <i class="bi bi-qr-code"></i>
                    <small style="font-size:11px;margin-top:6px;font-weight:600;">No QR Set</small>
                </div>
                <div style="font-size:12px;color:#7c3aed;margin-top:4px;">
                    Add UPI QR in <a href="settings.html" style="color:#7c3aed;font-weight:700;">Settings → UPI</a>
                </div>`;
        }

        document.getElementById('upiIdDisplay').textContent      = upiId      ? `UPI ID: ${upiId}` : 'UPI ID not set';
        document.getElementById('upiBusinessDisplay').textContent = upiName    ? upiName            : '';
    }

    // ── 7. CONFIRM PAYMENT HANDLERS ───────────────────────────────────────────

    // CASH confirm
    document.getElementById('btnConfirmCash').addEventListener('click', async () => {
        await finalizePayment({
            method: 'Cash', status: 'Paid', txnRef: null
        });
    });

    // UPI confirm
    document.getElementById('btnConfirmUPI').addEventListener('click', async () => {
        const ref    = document.getElementById('upiRefInput').value.trim();
        const status = payState.upiStatus;

        if (!status)       { showOverlayAlert('Please select a payment status.'); return; }
        if (!ref && status === 'Paid') { showOverlayAlert('Please enter the UPI Transaction ID.'); return; }

        if (status === 'Failed') {
            showFailedScreen(); return;
        }
        if (status === 'Pending') {
            showOverlayAlert('⏳ Payment is still Pending. Please wait for confirmation before proceeding.'); return;
        }

        // Paid
        await finalizePayment({ method: 'UPI', status: 'Paid', txnRef: ref });
    });

    // Card confirm
    document.getElementById('btnConfirmCard').addEventListener('click', async () => {
        const ref      = document.getElementById('cardRefInput').value.trim();
        const status   = payState.cardStatus;
        const cardType = document.getElementById('cardTypeSelect').value;

        if (!status)       { showOverlayAlert('Please select a payment status.'); return; }
        if (!ref && status === 'Paid') { showOverlayAlert('Please enter the Card Transaction ID.'); return; }

        if (status === 'Failed') {
            showFailedScreen(); return;
        }

        // Paid
        await finalizePayment({ method: cardType, status: 'Paid', txnRef: ref });
    });

    // ── 8. FINALIZE PAYMENT → POST TO NODE.JS ─────────────────────────────────
    async function finalizePayment({ method, status, txnRef }) {
        const custName  = document.getElementById('custName').value.trim()  || 'Walk-in Customer';
        let subtotal = 0, totalGST = 0, totalCost = 0;
        cart.forEach(item => {
            subtotal  += item.price * item.qty;
            totalGST  += item.price * item.qty * (item.gstRate / 100);
            totalCost += item.price * item.qty * 0.70;
        });
        const discount   = payState.discount;
        const grandTotal = Math.max(0, subtotal + totalGST - discount);

        // Payload — includes txn_reference and payment_status for MySQL
        // (Add txn_reference + payment_status columns to `sales` table in DB)
        const payload = {
            customer_name:    custName,
            payment_method:   method,
            payment_status:   status,
            txn_reference:    txnRef  || null,
            total_amount:     parseFloat(grandTotal.toFixed(2)),
            cost_amount:      parseFloat(totalCost.toFixed(2)),
            cgst_amount:      parseFloat((totalGST / 2).toFixed(2)),
            sgst_amount:      parseFloat((totalGST / 2).toFixed(2)),
            discount:         parseFloat(discount.toFixed(2)),
            items: cart.map(i => ({ id: i.id, quantity: i.qty, selling_price: i.price }))
        };

        // Disable confirm buttons during API call
        ['btnConfirmCash','btnConfirmUPI','btnConfirmCard'].forEach(id => {
            const b = document.getElementById(id);
            if (b) { b.disabled = true; b.textContent = 'Saving…'; }
        });

        try {
            const res = await fetch(`${NODE_API}/checkout`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify(payload)
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || `Server error ${res.status}`);
            }

            const data = await res.json();
            showSuccessScreen(data.saleId, method, txnRef, grandTotal, custName);

            // Reset billing page state
            cart = [];
            document.getElementById('custName').value  = '';
            document.getElementById('custPhone').value = '';
            discountInput.value = '0';
            renderCart();
            await loadProductsFromAPI();

        } catch (err) {
            console.error('Checkout failed:', err);
            showOverlayAlert(`❌ Server error: ${err.message}\n\nMake sure Node.js server is running.`);
        } finally {
            ['btnConfirmCash','btnConfirmUPI','btnConfirmCard'].forEach(id => {
                const b = document.getElementById(id);
                if (b) b.disabled = false;
            });
            // Restore button labels
            document.getElementById('btnConfirmCash').innerHTML = '<i class="bi bi-check-circle-fill"></i> Confirm Cash Payment';
            document.getElementById('btnConfirmUPI').innerHTML  = '<i class="bi bi-qr-code"></i> Confirm UPI Payment';
            document.getElementById('btnConfirmCard').innerHTML = '<i class="bi bi-credit-card-2-front-fill"></i> Confirm Card Payment';
        }
    }

    // ── 9. SUCCESS / FAILED SCREENS ───────────────────────────────────────────
    function showSuccessScreen(saleId, method, txnRef, amount, custName) {
        ['panelCash','panelUPI','panelCard'].forEach(id => {
            document.getElementById(id).style.display = 'none';
        });

        document.getElementById('paySuccessDetails').innerHTML = `
            <div class="ref-row"><span class="ref-label">Invoice #</span><span class="ref-value">#INV-${saleId}</span></div>
            <div class="ref-row"><span class="ref-label">Customer</span><span class="ref-value">${custName}</span></div>
            <div class="ref-row"><span class="ref-label">Amount</span><span class="ref-value">₹${amount.toFixed(2)}</span></div>
            <div class="ref-row"><span class="ref-label">Method</span><span class="ref-value">${method}</span></div>
            ${txnRef ? `<div class="ref-row"><span class="ref-label">Txn Ref</span><span class="ref-value" style="font-family:monospace">${txnRef}</span></div>` : ''}
            <div class="ref-row"><span class="ref-label">Status</span><span class="ref-value" style="color:#16a34a">✅ Paid</span></div>
        `;
        document.getElementById('paySuccessScreen').classList.add('active');
    }

    function showFailedScreen() {
        ['panelCash','panelUPI','panelCard'].forEach(id => {
            document.getElementById(id).style.display = 'none';
        });
        document.getElementById('payFailedScreen').classList.add('active');
    }

    document.getElementById('btnNewBill').addEventListener('click', () => {
        closePayOverlay();
    });

    function showOverlayAlert(msg) {
        // Non-blocking in-overlay toast instead of window.alert()
        let toast = document.getElementById('overlayToast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'overlayToast';
            toast.style.cssText = `
                position:fixed; bottom:24px; left:50%; transform:translateX(-50%);
                background:#1e293b; color:#fff; padding:12px 22px; border-radius:12px;
                font-size:13px; font-weight:600; z-index:1100; box-shadow:0 8px 24px rgba(0,0,0,.3);
                max-width:360px; text-align:center; line-height:1.5;
                animation: slideUp .2s ease;
            `;
            document.body.appendChild(toast);
        }
        toast.textContent = msg;
        toast.style.display = 'block';
        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => { toast.style.display = 'none'; }, 3500);
    }

    // ── INITIAL LOAD ──────────────────────────────────────────────────────────
    await loadProductsFromAPI();
});