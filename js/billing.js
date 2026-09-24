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
        discount:   0
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

    if (btnClearCart) {
        btnClearCart.addEventListener('click', () => {
            if (!cart.length) return;
            if (confirm('Clear the cart?')) { cart = []; renderCart(); }
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
        const overlayTotal = document.getElementById('overlayGrandTotal');
        if (overlayTotal) overlayTotal.textContent = `₹${payState.grandTotal.toFixed(2)}`;
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
        // Reset to Cash tab
        showPayTab('Cash');
        payState.upiStatus  = null;
        payState.cardStatus = null;
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

    // ── 6. UPI QR FROM SETTINGS ──────────────────────────────────────────────
    (function loadUPIDetails() {
        const settings = JSON.parse(localStorage.getItem('appSettings')) || {};
        const upiIdEl    = document.getElementById('displayUpiId');
        const upiNameEl  = document.getElementById('displayUpiName');
        const upiQrEl    = document.getElementById('displayUpiQr');
        if (upiIdEl   && settings.upiId)      upiIdEl.textContent = settings.upiId;
        if (upiNameEl && settings.upiName)    upiNameEl.textContent = settings.upiName;
        if (upiQrEl   && settings.upiQrImage) {
            upiQrEl.src           = settings.upiQrImage;
            upiQrEl.style.display = 'block';
        }
    })();

    // ── 7. PAYMENT CONFIRM BUTTONS ────────────────────────────────────────────
    const btnConfirmCash = document.getElementById('btnConfirmCash');
    const btnConfirmUPI  = document.getElementById('btnConfirmUPI');
    const btnConfirmCard = document.getElementById('btnConfirmCard');

    if (btnConfirmCash) {
        btnConfirmCash.addEventListener('click', async () => {
            await finalizePayment({ method: 'Cash', status: 'Paid', txnRef: null });
        });
    }

    if (btnConfirmUPI) {
        btnConfirmUPI.addEventListener('click', async () => {
            const ref    = (document.getElementById('upiRefInput') || {}).value?.trim() || '';
            const status = payState.upiStatus;
            if (!status) { showOverlayAlert('Please select a payment status.'); return; }
            if (!ref && status === 'Paid') { showOverlayAlert('Please enter the UPI Transaction ID.'); return; }
            if (status === 'Failed')  { showFailedScreen(); return; }
            if (status === 'Pending') { showOverlayAlert('⏳ Payment is still Pending. Please wait for confirmation.'); return; }
            await finalizePayment({ method: 'UPI', status: 'Paid', txnRef: ref });
        });
    }

    if (btnConfirmCard) {
        btnConfirmCard.addEventListener('click', async () => {
            const ref      = (document.getElementById('cardRefInput')   || {}).value?.trim() || '';
            const status   = payState.cardStatus;
            const cardType = (document.getElementById('cardTypeSelect') || {}).value || 'Card';
            if (!status) { showOverlayAlert('Please select a payment status.'); return; }
            if (!ref && status === 'Paid') { showOverlayAlert('Please enter the Card Transaction ID.'); return; }
            if (status === 'Failed') { showFailedScreen(); return; }
            await finalizePayment({ method: cardType, status: 'Paid', txnRef: ref });
        });
    }

    // ── 8. FINALIZE PAYMENT ───────────────────────────────────────────────────
    async function finalizePayment({ method, status, txnRef }) {
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
            showSuccessScreen(data.saleId, method, txnRef, grandTotal, custName);

            cart = [];
            if (document.getElementById('custName'))  document.getElementById('custName').value  = '';
            if (document.getElementById('custPhone')) document.getElementById('custPhone').value = '';
            if (discountInput) discountInput.value = '0';
            renderCart();
            await loadProductsFromAPI();

        } catch (err) {
            console.error('Checkout failed:', err);
            showOverlayAlert(`❌ Server error: ${err.message}\n\nMake sure Node.js server is running and ngrok is active.`);
        } finally {
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
        btnNewBill.addEventListener('click', () => closePayOverlay());
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

    // ── INITIAL LOAD ──────────────────────────────────────────────────────────
    await loadProductsFromAPI();
});
