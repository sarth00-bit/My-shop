// =========================================
// billing.js — uses config.js for API URL
// NODE_API comes from config.js
// =========================================

document.addEventListener('DOMContentLoaded', async () => {

    // ── STATE ─────────────────────────────────────────────────────────────────
    let allProducts     = [];
    let cart            = [];
    let currentCategory = 'All';
    let searchQuery     = '';

    let payState = {
        method:     'Cash',
        upiStatus:  null,
        cardStatus: null,
        grandTotal: 0,
        subtotal:   0,
        totalGST:   0,
        discount:        0,
        amountReceived:  0,
        changeAmount:    0
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

    const paymentOverlay  = document.getElementById('paymentOverlay');
    const payOverlayClose = document.getElementById('payOverlayClose');

    // ── 1. LOAD PRODUCTS ─────────────────────────────────────────────────────
    async function loadProductsFromAPI() {
        try {
            const res = await apiFetch(`${NODE_API}/products`);
            if (!res.ok) throw new Error(`Server error ${res.status}`);
            allProducts = await res.json();
            renderProductGrid();
        } catch (err) {
            console.error('Failed to load products:', err);
            if (productGrid) {
                productGrid.innerHTML = `
                    <div class="col-12 text-center text-danger py-4">
                        <i class="bi bi-exclamation-triangle display-5 d-block mb-2"></i>
                        Could not load products.<br>
                        <small class="text-muted">Make sure your Node.js server is running and ngrok is active.</small>
                    </div>`;
            }
        }
    }

    // ── 2. PRODUCT GRID ───────────────────────────────────────────────────────
    function renderProductGrid() {
        if (!productGrid) return;
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

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value.toLowerCase().trim();
            renderProductGrid();
        });
    }

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

    // Reset the current bill completely. This is used by both Clear Cart and
    // Start New Bill so no items/payment/customer data can leak into the next bill.
    function resetCurrentBill() {
        cart = [];

        const custName = document.getElementById('custName');
        const custPhone = document.getElementById('custPhone');
        if (custName) custName.value = '';
        if (custPhone) custPhone.value = '';

        if (discountInput) discountInput.value = '0';

        payState.method = 'Cash';
        payState.upiStatus = null;
        payState.cardStatus = null;
        payState.grandTotal = 0;
        payState.subtotal = 0;
        payState.totalGST = 0;
        payState.discount = 0;
        payState.amountReceived = 0;
        payState.changeAmount = 0;

        const cash = document.getElementById('cashTendered');
        if (cash) cash.value = '';
        const change = document.getElementById('cashChange');
        if (change) change.textContent = formatINR(0);

        renderCart();
    }

    if (btnClearCart) {
        btnClearCart.addEventListener('click', () => {
            if (!cart.length) {
                // Re-render even when the state is already empty.
                resetCurrentBill();
                return;
            }
            if (confirm('Clear the cart?')) {
                resetCurrentBill();
            }
        });
    }

    function renderCart() {
        if (!cartTableBody) return;
        cartTableBody.innerHTML = '';
        if (!cart.length) {
            cartTableBody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">Cart is empty. Click <strong>+</strong> on any product to add it.</td></tr>`;
            updateSummary(0, 0, 0);
            return;
        }

        let subtotal = 0, totalGST = 0;
        cart.forEach(item => {
            const lineTotal = item.price * item.qty;
            const lineGST   = lineTotal * (item.gstRate / 100);
            subtotal  += lineTotal;
            totalGST  += lineGST;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <div class="fw-semibold">${item.name}</div>
                    <small class="text-muted">${item.sku} · GST ${item.gstRate}%</small>
                </td>
                <td>₹${item.price.toFixed(2)}</td>
                <td>
                    <div class="d-flex align-items-center gap-2">
                        <button class="btn btn-sm btn-outline-secondary px-2 py-0" onclick="updateQty(${item.id}, -1)">−</button>
                        <span class="fw-bold">${item.qty}</span>
                        <button class="btn btn-sm btn-outline-secondary px-2 py-0" onclick="updateQty(${item.id}, +1)">+</button>
                    </div>
                </td>
                <td class="fw-bold">₹${lineTotal.toFixed(2)}</td>
                <td>
                    <button class="btn btn-sm btn-outline-danger" onclick="removeFromCart(${item.id})">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>`;
            cartTableBody.appendChild(tr);
        });

        const discount = parseFloat(discountInput ? discountInput.value : 0) || 0;
        updateSummary(subtotal, totalGST, discount);
    }

    function updateSummary(subtotal, totalGST, discount) {
        const grandTotal = Math.max(0, subtotal + totalGST - discount);
        if (summarySubtotal)   summarySubtotal.textContent   = `₹${subtotal.toFixed(2)}`;
        if (summaryGST)        summaryGST.textContent        = `₹${totalGST.toFixed(2)}`;
        if (summaryGrandTotal) summaryGrandTotal.textContent = `₹${grandTotal.toFixed(2)}`;
        payState.subtotal   = subtotal;
        payState.totalGST   = totalGST;
        payState.discount   = discount;
        payState.grandTotal = grandTotal;
    }

    if (discountInput) {
        discountInput.addEventListener('input', () => renderCart());
    }

    // ── 5. PAYMENT OVERLAY ────────────────────────────────────────────────────
    if (btnCompletePayment) {
        btnCompletePayment.addEventListener('click', () => {
            if (!cart.length) { alert('Cart is empty!'); return; }
            openPayOverlay();
        });
    }

    function openPayOverlay() {
        if (!paymentOverlay) return;
        resetOverlayScreens();
        // Update total display in overlay
        const overlayTotal = document.getElementById('payAmountDisplay');
        const cardAmountHint = document.getElementById('cardAmountHint');
        if (overlayTotal) overlayTotal.textContent = formatINR(payState.grandTotal);
        if (cardAmountHint) cardAmountHint.textContent = payState.grandTotal.toFixed(2);
        updateCashPaymentState();
        paymentOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closePayOverlay() {
        if (!paymentOverlay) return;
        paymentOverlay.classList.remove('active');
        document.body.style.overflow = '';
        resetOverlayScreens();
    }

    function resetOverlayScreens() {
        ['paySuccessScreen','payFailedScreen'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.remove('active');
        });
        ['panelCash','panelUPI','panelCard'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = '';
        });
        // Reset to Cash tab and clear payment inputs/state
        showPayTab('Cash');
        payState.upiStatus  = null;
        payState.cardStatus = null;
        payState.amountReceived = 0;
        payState.changeAmount = 0;
        const cash = document.getElementById('cashTendered');
        if (cash) cash.value = '';
        const change = document.getElementById('cashChange');
        if (change) change.textContent = formatINR(0);
        updateCashPaymentState();
    }

    if (payOverlayClose) {
        payOverlayClose.addEventListener('click', closePayOverlay);
    }

    // Tab switching
    window.showPayTab = function(method) {
        payState.method = method;
        ['Cash','UPI','Card'].forEach(m => {
            const tab   = document.getElementById(`tab${m}`);
            const panel = document.getElementById(`panel${m}`);
            if (tab)   tab.classList.toggle('active', m === method);
            if (panel) panel.style.display = m === method ? '' : 'none';
        });
    };

    // UPI status radio buttons
    document.querySelectorAll('input[name="upiStatus"]').forEach(radio => {
        radio.addEventListener('change', (e) => { payState.upiStatus = e.target.value; });
    });

    // Card status radio buttons
    document.querySelectorAll('input[name="cardStatus"]').forEach(radio => {
        radio.addEventListener('change', (e) => { payState.cardStatus = e.target.value; });
    });

    // ── 6. LOAD PERSISTED UPI SETTINGS FROM BACKEND ─────────────────────────
    async function loadUPIDetails() {
        const upiIdEl = document.getElementById('upiIdDisplay');
        const upiNameEl = document.getElementById('upiBusinessDisplay');
        const qrContainer = document.getElementById('upiQrDisplay');
        if (upiIdEl) upiIdEl.textContent = '';
        if (upiNameEl) upiNameEl.textContent = '';
        if (qrContainer) {
            qrContainer.innerHTML = '<div class="text-muted small">Loading QR code…</div>';
        }
        try {
            const res = await apiFetch(`${NODE_API}/settings`);
            if (!res.ok) throw new Error(`Settings server error ${res.status}`);
            const settings = await res.json();
            const upiId = settings.upi_id || settings.upiId || '';
            const businessName = settings.business_name || settings.upiName || '';
            const qrImage = settings.upi_qr_image || settings.qrImage || settings.upiQrImage || '';

            if (upiIdEl) upiIdEl.textContent = upiId || 'UPI ID not configured';
            if (upiNameEl) upiNameEl.textContent = businessName;
            if (qrContainer) {
                qrContainer.innerHTML = '';
                if (qrImage) {
                    const img = document.createElement('img');
                    img.alt = 'UPI QR Code';
                    img.style.cssText = 'max-width:180px;max-height:180px;border-radius:10px;';
                    img.src = new URL(qrImage, NODE_API).href;
                    qrContainer.appendChild(img);
                } else {
                    qrContainer.innerHTML = '<div class="text-muted small">No QR code configured in Settings.</div>';
                }
            }
        } catch (err) {
            console.error('Failed to load UPI settings:', err);
            if (qrContainer) qrContainer.innerHTML = '<div class="text-danger small">Unable to load UPI settings.</div>';
            if (upiIdEl) upiIdEl.textContent = 'UPI settings unavailable';
        }
    }
    await loadUPIDetails();

    // ── 7. PAYMENT CONFIRMATION + VALIDATION ─────────────────────────────────
    const btnConfirmCash = document.getElementById('btnConfirmCash');
    const btnConfirmUPI  = document.getElementById('btnConfirmUPI');
    const btnConfirmCard = document.getElementById('btnConfirmCard');

    function updateCashPaymentState() {
        const receivedEl = document.getElementById('cashTendered');
        const changeEl = document.getElementById('cashChange');
        const messageEl = document.getElementById('cashPaymentMessage');
        const received = Math.max(0, parseFloat(receivedEl?.value || '0') || 0);
        const total = Number(payState.grandTotal.toFixed(2));
        const change = Number((received - total).toFixed(2));
        payState.amountReceived = received;
        payState.changeAmount = change >= 0 ? change : 0;

        if (changeEl) changeEl.textContent = formatINR(Math.max(0, change));
        if (messageEl) {
            if (received < total) {
                messageEl.textContent = received > 0
                    ? `Insufficient cash received. Remaining amount: ${formatINR(total - received)}`
                    : 'Enter the amount received from the customer.';
                messageEl.className = 'small text-danger mt-2';
            } else {
                messageEl.textContent = received === total
                    ? 'Exact amount received.'
                    : `Change to return: ${formatINR(change)}`;
                messageEl.className = 'small text-success mt-2';
            }
        }
        if (btnConfirmCash) btnConfirmCash.disabled = received < total;
    }

    function setPaymentStatus(type, status) {
        payState[type === 'upi' ? 'upiStatus' : 'cardStatus'] = status;
        const prefix = type === 'upi' ? 'upiStatus' : 'cardStatus';
        document.querySelectorAll(`#panel${type === 'upi' ? 'UPI' : 'Card'} .status-btn`).forEach(btn => btn.classList.remove('active'));
        const target = document.getElementById(`${prefix}${status}`);
        if (target) target.classList.add('active');
    }

    window.setUpiStatus = status => setPaymentStatus('upi', status);
    window.setCardStatus = status => setPaymentStatus('card', status);
    window.calcChange = updateCashPaymentState;
    window.switchPayTab = method => window.showPayTab(method);
    window.resetPayOverlay = () => resetOverlayScreens();

    document.getElementById('cashTendered')?.addEventListener('input', updateCashPaymentState);

    if (btnConfirmCash) {
        btnConfirmCash.addEventListener('click', async () => {
            updateCashPaymentState();
            if (payState.amountReceived < payState.grandTotal) {
                showOverlayAlert('Insufficient cash received.');
                return;
            }
            await finalizePayment({
                method: 'CASH',
                status: 'Paid',
                txnRef: null,
                amountReceived: payState.amountReceived,
                changeAmount: payState.changeAmount
            });
        });
    }

    if (btnConfirmUPI) {
        btnConfirmUPI.addEventListener('click', async () => {
            const ref = (document.getElementById('upiRefInput') || {}).value?.trim() || '';
            if (payState.upiStatus !== 'Paid') {
                showOverlayAlert(payState.upiStatus === 'Pending'
                    ? 'UPI payment is still pending.'
                    : payState.upiStatus === 'Failed'
                        ? 'UPI payment failed.'
                        : 'Please select Paid and manually confirm the UPI payment.');
                return;
            }
            await finalizePayment({ method: 'UPI', status: 'Paid', txnRef: ref || null });
        });
    }

    if (btnConfirmCard) {
        btnConfirmCard.addEventListener('click', async () => {
            const ref = (document.getElementById('cardRefInput') || {}).value?.trim() || '';
            if (payState.cardStatus !== 'Paid') {
                showOverlayAlert(payState.cardStatus === 'Failed'
                    ? 'Card payment failed.'
                    : 'Please select Paid and manually confirm the card payment.');
                return;
            }
            await finalizePayment({ method: 'CARD', status: 'Paid', txnRef: ref || null });
        });
    }

    // ── 8. FINALIZE PAYMENT ───────────────────────────────────────────────────
    let checkoutInProgress = false;

    async function finalizePayment({ method, status, txnRef, amountReceived = null, changeAmount = null }) {
        if (checkoutInProgress) return;
        checkoutInProgress = true;
        const custName  = (document.getElementById('custName') || {}).value?.trim() || 'Walk-in Customer';
        let subtotal = 0, totalGST = 0, totalCost = 0;
        cart.forEach(item => {
            subtotal  += item.price * item.qty;
            totalGST  += item.price * item.qty * (item.gstRate / 100);
            totalCost += item.price * item.qty * 0.70;
        });
        const discount   = payState.discount;
        const grandTotal = Math.max(0, subtotal + totalGST - discount);

        const payload = {
            customer_name:  custName,
            payment_method: method,
            payment_status: status,
            txn_reference:  txnRef  || null,
            amount_received: method === 'CASH' ? parseFloat(Number(amountReceived ?? 0).toFixed(2)) : null,
            change_amount:   method === 'CASH' ? parseFloat(Number(changeAmount ?? 0).toFixed(2)) : null,
            total_amount:   parseFloat(grandTotal.toFixed(2)),
            cost_amount:    parseFloat(totalCost.toFixed(2)),
            cgst_amount:    parseFloat((totalGST / 2).toFixed(2)),
            sgst_amount:    parseFloat((totalGST / 2).toFixed(2)),
            discount:       parseFloat(discount.toFixed(2)),
            items: cart.map(i => ({ id: i.id, quantity: i.qty, selling_price: i.price }))
        };

        [btnConfirmCash, btnConfirmUPI, btnConfirmCard].forEach(b => {
            if (b) { b.disabled = true; b.textContent = 'Saving…'; }
        });

        try {
            const res = await apiFetch(`${NODE_API}/checkout`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify(payload)
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || `Server error ${res.status}`);
            }

            const data = await res.json();

            // Clear the completed bill BEFORE showing the success screen.
            // This guarantees the underlying billing page is already ready for
            // the next customer.
            resetCurrentBill();
            checkoutInProgress = false;

            showSuccessScreen(data.saleId, method, txnRef, grandTotal, custName);
            closePaymentOverlay();
            await loadProductsFromAPI();

        } catch (err) {
            console.error('Checkout failed:', err);
            checkoutInProgress = false;
            showOverlayAlert(`Payment could not be completed. ${err.message}`);
            if (btnConfirmCash) { btnConfirmCash.disabled = false; btnConfirmCash.innerHTML = '<i class="bi bi-check-circle-fill"></i> Confirm Cash Payment'; }
            if (btnConfirmUPI)  { btnConfirmUPI.disabled  = false; btnConfirmUPI.innerHTML  = '<i class="bi bi-qr-code"></i> Confirm UPI Payment'; }
            if (btnConfirmCard) { btnConfirmCard.disabled = false; btnConfirmCard.innerHTML = '<i class="bi bi-credit-card-2-front-fill"></i> Confirm Card Payment'; }
        }
    }

    // ── 9. SUCCESS / FAILED SCREENS ───────────────────────────────────────────
    function showSuccessScreen(saleId, method, txnRef, amount, custName) {
        ['panelCash','panelUPI','panelCard'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });
        const details = document.getElementById('paySuccessDetails');
        if (details) {
            details.innerHTML = `
                <div class="ref-row"><span class="ref-label">Invoice #</span><span class="ref-value">#INV-${saleId}</span></div>
                <div class="ref-row"><span class="ref-label">Customer</span><span class="ref-value">${custName}</span></div>
                <div class="ref-row"><span class="ref-label">Amount</span><span class="ref-value">₹${amount.toFixed(2)}</span></div>
                <div class="ref-row"><span class="ref-label">Method</span><span class="ref-value">${method}</span></div>
                ${txnRef ? `<div class="ref-row"><span class="ref-label">Txn Ref</span><span class="ref-value" style="font-family:monospace">${txnRef}</span></div>` : ''}
                <div class="ref-row"><span class="ref-label">Status</span><span class="ref-value" style="color:#16a34a">✅ Paid</span></div>`;
        }
        const screen = document.getElementById('paySuccessScreen');
        if (screen) screen.classList.add('active');
    }

    function showFailedScreen() {
        ['panelCash','panelUPI','panelCard'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });
        const screen = document.getElementById('payFailedScreen');
        if (screen) screen.classList.add('active');
    }

    const btnNewBill = document.getElementById('btnNewBill');
    if (btnNewBill) {
        btnNewBill.addEventListener('click', () => {
            // Always perform a full reset here. Do not rely only on the
            // checkout-success handler because this button is the user's
            // explicit boundary between two bills.
            checkoutInProgress = false;
            resetCurrentBill();
            closePayOverlay();
        });
    }

    function showOverlayAlert(msg) {
        let toast = document.getElementById('overlayToast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'overlayToast';
            toast.style.cssText = `
                position:fixed; bottom:24px; left:50%; transform:translateX(-50%);
                background:#1e293b; color:#fff; padding:12px 22px; border-radius:12px;
                font-size:13px; font-weight:600; z-index:1100; box-shadow:0 8px 24px rgba(0,0,0,.3);
                max-width:360px; text-align:center; line-height:1.5;`;
            document.body.appendChild(toast);
        }
        toast.textContent = msg;
        toast.style.display = 'block';
        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => { toast.style.display = 'none'; }, 3500);
    }

    function formatINR(value) {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(Number(value) || 0);
    }

    // ── INITIAL LOAD ──────────────────────────────────────────────────────────
    await loadProductsFromAPI();
});
