document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Sample Products if LocalStorage is completely empty
    if (!localStorage.getItem('products')) {
        const initialProducts = [
            { id: 'PROD-001', sku: 'PROD-001', name: 'Wireless Mouse', category: 'Electronics', price: 499, sellingPrice: 499, gstRate: 18, stock: 25 },
            { id: 'PROD-002', sku: 'PROD-002', name: 'Mechanical Keyboard', category: 'Electronics', price: 1999, sellingPrice: 1999, gstRate: 18, stock: 12 },
            { id: 'PROD-003', sku: 'PROD-003', name: 'USB-C Cable 1m', category: 'Accessories', price: 299, sellingPrice: 299, gstRate: 12, stock: 50 },
            { id: 'PROD-004', sku: 'PROD-004', name: 'Cotton T-Shirt', category: 'Apparel', price: 599, sellingPrice: 599, gstRate: 5, stock: 30 }
        ];
        localStorage.setItem('products', JSON.stringify(initialProducts));
    }

    // Helper: Safely extract product properties regardless of key naming
    function normalizeProduct(p) {
        return {
            id: p.id || p.sku || 'PROD-UNKNOWN',
            sku: p.sku || p.id || 'N/A',
            name: p.name || 'Unnamed Product',
            category: p.category || 'General',
            price: parseFloat(p.sellingPrice || p.price || p.sellPrice || 0),
            gstRate: parseFloat(p.gstRate || p.gst || 0),
            stock: parseInt(p.stock || 0, 10)
        };
    }

    // 2. DOM Elements & State
    let cart = [];
    let currentCategory = 'All';
    let searchQuery = '';

    const productGrid = document.getElementById('productGrid');
    const searchInput = document.getElementById('billingProductSearch');
    const categoryPills = document.querySelectorAll('.category-pill');
    const cartTableBody = document.getElementById('cartTableBody');
    const btnClearCart = document.getElementById('btnClearCart');

    const summarySubtotal = document.getElementById('summarySubtotal');
    const summaryGST = document.getElementById('summaryGST');
    const discountInput = document.getElementById('discountInput');
    const summaryGrandTotal = document.getElementById('summaryGrandTotal');
    const btnCompletePayment = document.getElementById('btnCompletePayment');

    // 3. Render Product Cards Grid
    function renderProductGrid() {
        const rawProducts = JSON.parse(localStorage.getItem('products')) || [];
        const products = rawProducts.map(normalizeProduct);

        productGrid.innerHTML = '';

        // Real-time search filter matching Name, SKU, ID, or Category
        const filtered = products.filter(product => {
            const matchesCategory = (currentCategory === 'All') || (product.category.toLowerCase() === currentCategory.toLowerCase());
            const matchesSearch = product.name.toLowerCase().includes(searchQuery) ||
                                  product.sku.toLowerCase().includes(searchQuery) ||
                                  product.id.toLowerCase().includes(searchQuery);
            return matchesCategory && matchesSearch;
        });

        if (filtered.length === 0) {
            productGrid.innerHTML = `
                <div class="col-12 text-center text-muted py-4">
                    <i class="bi bi-box-seam display-5 d-block mb-2"></i>
                    No products found matching your search.
                </div>`;
            return;
        }

        filtered.forEach(product => {
            const col = document.createElement('div');
            col.className = 'col-sm-6 col-md-4 col-xl-3';

            col.innerHTML = `
                <div class="card pos-product-card h-100 p-3 d-flex flex-column justify-content-between shadow-sm">
                    <div class="pos-icon-box text-center mb-2">
                        <i class="bi bi-box-seam text-secondary fs-1"></i>
                    </div>
                    <div>
                        <h6 class="fw-bold mb-1 text-truncate" title="${product.name}">${product.name}</h6>
                        <small class="text-muted d-block mb-2">${product.sku}</small>
                        <div class="d-flex align-items-center justify-content-between mt-2">
                            <span class="fw-bold text-primary fs-6">₹${product.price.toFixed(2)}</span>
                            <button class="btn btn-outline-success btn-sm rounded-circle" onclick="addToCartById('${product.id}')" title="Add to Cart">
                                <i class="bi bi-plus-lg fs-5"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
            productGrid.appendChild(col);
        });
    }

    // 4. Category Filters
    categoryPills.forEach(pill => {
        pill.addEventListener('click', (e) => {
            categoryPills.forEach(p => p.classList.remove('active', 'btn-primary'));
            categoryPills.forEach(p => p.classList.add('btn-outline-secondary'));

            e.target.classList.remove('btn-outline-secondary');
            e.target.classList.add('active', 'btn-primary');

            currentCategory = e.target.getAttribute('data-category');
            renderProductGrid();
        });
    });

    // 5. Real-Time Search Handler
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase().trim();
        renderProductGrid();
    });

    // 6. Add to Cart Handler
    window.addToCartById = function(productId) {
        const rawProducts = JSON.parse(localStorage.getItem('products')) || [];
        const products = rawProducts.map(normalizeProduct);
        const product = products.find(p => p.id === productId || p.sku === productId);

        if (!product) return;

        const existingItem = cart.find(item => item.id === product.id);
        if (existingItem) {
            if (existingItem.qty < product.stock) {
                existingItem.qty += 1;
            } else {
                alert(`Stock limit reached! Max available: ${product.stock}`);
            }
        } else {
            cart.push({
                id: product.id,
                sku: product.sku,
                name: product.name,
                price: product.price,
                gstRate: product.gstRate,
                qty: 1,
                maxStock: product.stock
            });
        }
        renderCart();
    };

    window.updateQty = function(id, change) {
        const item = cart.find(i => i.id === id);
        if (item) {
            const newQty = item.qty + change;
            if (newQty > item.maxStock) {
                alert(`Cannot exceed available stock (${item.maxStock})`);
                return;
            }
            if (newQty <= 0) {
                removeFromCart(id);
            } else {
                item.qty = newQty;
                renderCart();
            }
        }
    };

    window.removeFromCart = function(id) {
        cart = cart.filter(i => i.id !== id);
        renderCart();
    };

    btnClearCart.addEventListener('click', () => {
        if (cart.length === 0) return;
        if (confirm('Are you sure you want to clear the cart?')) {
            cart = [];
            renderCart();
        }
    });

    // 7. Render Cart Items & Totals
    function renderCart() {
        cartTableBody.innerHTML = '';

        if (cart.length === 0) {
            cartTableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center text-muted py-4">
                        Cart is empty. Click <strong>+</strong> on any product below to add it.
                    </td>
                </tr>`;
            calculateSummary(0, 0);
            return;
        }

        let subtotal = 0;
        let totalGST = 0;

        cart.forEach(item => {
            const lineSubtotal = item.price * item.qty;
            const lineGST = lineSubtotal * (item.gstRate / 100);

            subtotal += lineSubtotal;
            totalGST += lineGST;

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>
                    <div class="fw-bold">${item.name}</div>
                    <small class="text-muted">${item.sku}</small>
                </td>
                <td>₹${item.price.toFixed(2)}</td>
                <td>
                    <div class="input-group input-group-sm" style="width: 90px;">
                        <button class="btn btn-outline-secondary" onclick="updateQty('${item.id}', -1)">-</button>
                        <input type="text" class="form-control text-center px-1" value="${item.qty}" readonly>
                        <button class="btn btn-outline-secondary" onclick="updateQty('${item.id}', 1)">+</button>
                    </div>
                </td>
                <td class="fw-bold">₹${(lineSubtotal + lineGST).toFixed(2)}</td>
                <td class="text-end">
                    <button class="btn btn-sm btn-outline-danger border-0" onclick="removeFromCart('${item.id}')">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            `;
            cartTableBody.appendChild(row);
        });

        calculateSummary(subtotal, totalGST);
    }

    function calculateSummary(subtotal, totalGST) {
        const discount = parseFloat(discountInput.value) || 0;
        const grandTotal = Math.max(0, subtotal + totalGST - discount);

        summarySubtotal.textContent = `₹${subtotal.toFixed(2)}`;
        summaryGST.textContent = `₹${totalGST.toFixed(2)}`;
        summaryGrandTotal.textContent = `₹${grandTotal.toFixed(2)}`;
    }

    discountInput.addEventListener('input', () => {
        let subtotal = 0;
        let totalGST = 0;
        cart.forEach(item => {
            const lineSubtotal = item.price * item.qty;
            subtotal += lineSubtotal;
            totalGST += item.price * item.qty * (item.gstRate / 100);
        });
        calculateSummary(subtotal, totalGST);
    });

    // 8. Payment Execution
    btnCompletePayment.addEventListener('click', () => {
        if (cart.length === 0) {
            alert('Please add at least one item to the cart.');
            return;
        }

        const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked').value;
        const discount = parseFloat(discountInput.value) || 0;
        const custName = document.getElementById('custName').value.trim() || 'Walk-in Customer';
        const custPhone = document.getElementById('custPhone').value.trim() || 'N/A';

        let subtotal = 0;
        let totalGST = 0;
        cart.forEach(i => {
            const lineTotal = i.price * i.qty;
            subtotal += lineTotal;
            totalGST += lineTotal * (i.gstRate / 100);
        });
        const grandTotal = Math.max(0, subtotal + totalGST - discount);

        const invoices = JSON.parse(localStorage.getItem('invoices')) || [];
        const newInvoice = {
            id: `INV-${1001 + invoices.length}`,
            date: new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
            customerName: custName,
            customerPhone: custPhone,
            items: cart,
            subtotal: subtotal.toFixed(2),
            gst: totalGST.toFixed(2),
            discount: discount.toFixed(2),
            grandTotal: grandTotal.toFixed(2),
            paymentMethod: paymentMethod
        };

        // Deduct stock from localStorage
        let rawProducts = JSON.parse(localStorage.getItem('products')) || [];
        cart.forEach(cartItem => {
            const prod = rawProducts.find(p => (p.id && p.id === cartItem.id) || (p.sku && p.sku === cartItem.sku));
            if (prod) {
                prod.stock = Math.max(0, (prod.stock || 0) - cartItem.qty);
            }
        });

        invoices.unshift(newInvoice);
        localStorage.setItem('invoices', JSON.stringify(invoices));
        localStorage.setItem('products', JSON.stringify(rawProducts));

        alert(`Payment Successful! Invoice #${newInvoice.id} generated.`);

        cart = [];
        document.getElementById('custName').value = '';
        document.getElementById('custPhone').value = '';
        discountInput.value = '0';
        renderCart();
        renderProductGrid();
    });

    // Initial Load
    renderProductGrid();
});