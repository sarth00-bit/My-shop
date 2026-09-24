// =========================================
// Product.js — reads API URL from config.js
// =========================================
const NODE_API = window.APP_CONFIG.NODE_API;

document.addEventListener('DOMContentLoaded', async () => {

    // ── DOM ELEMENTS ──────────────────────────────────────────────────────────
    const productsTableBody    = document.getElementById('productsTableBody');
    const searchInput          = document.querySelector('input[placeholder*="Search"]') || document.getElementById('productSearchInput');
    const categoryFilter       = document.getElementById('categoryFilter');
    const productForm          = document.getElementById('productForm');
    const productModalEl       = document.getElementById('productModal');

    const productIdInput       = document.getElementById('productId');
    const productSkuInput      = document.getElementById('productSku');
    const productNameInput     = document.getElementById('productName');
    const productCategoryInput = document.getElementById('productCategory');
    const productMrpInput      = document.getElementById('productMrp') || document.getElementById('productPrice');
    const productPriceInput    = document.getElementById('productPrice');
    const productGstInput      = document.getElementById('productGst');
    const productStockInput    = document.getElementById('productStock');
    const modalTitle           = document.getElementById('productModalTitle');

    let allProducts = [];

    // ── 1. LOAD PRODUCTS ──────────────────────────────────────────────────────
    async function loadProducts() {
        try {
            const res = await apiFetch(`${NODE_API}/products`);
            if (!res.ok) throw new Error(`Server error ${res.status}`);
            allProducts = await res.json();
            filterAndRender();
        } catch (err) {
            console.error('Failed to load products:', err);
            if (productsTableBody) {
                productsTableBody.innerHTML = `
                    <tr><td colspan="7" class="text-center text-danger py-4">
                        <i class="bi bi-exclamation-triangle display-6 d-block mb-2"></i>
                        Could not load products. Make sure Node.js server is running and ngrok URL is up to date in <code>js/config.js</code>.
                    </td></tr>`;
            }
        }
    }

    // ── 2. FILTER & RENDER TABLE ──────────────────────────────────────────────
    function filterAndRender() {
        if (!productsTableBody) return;

        const query       = searchInput ? searchInput.value.toLowerCase().trim() : '';
        const selectedCat = categoryFilter ? categoryFilter.value : '';

        const filtered = allProducts.filter(p => {
            const name     = (p.name     || '').toLowerCase();
            const brand    = (p.brand    || '').toLowerCase();
            const category = (p.category || '').toLowerCase();
            const matchesSearch = name.includes(query) || brand.includes(query) || String(p.id).includes(query);
            const matchesCat    = !selectedCat || selectedCat === 'All' || category === selectedCat.toLowerCase();
            return matchesSearch && matchesCat;
        });

        productsTableBody.innerHTML = '';

        if (filtered.length === 0) {
            productsTableBody.innerHTML = `
                <tr><td colspan="7" class="text-center text-muted py-4">
                    <i class="bi bi-box-seam display-6 d-block mb-2"></i>No products found.
                </td></tr>`;
            return;
        }

        filtered.forEach(p => {
            const stock = parseInt(p.stock_quantity || 0, 10);
            let stockBadge = '<span class="badge bg-success">In Stock</span>';
            if (stock === 0)       stockBadge = '<span class="badge bg-danger">Out of Stock</span>';
            else if (stock < 10)   stockBadge = '<span class="badge bg-warning text-dark">Low Stock</span>';

            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="fw-bold">${p.brand || '—'}</td>
                <td>${p.name}</td>
                <td><span class="badge bg-light text-dark border">${p.category || 'General'}</span></td>
                <td class="fw-bold text-primary">₹${parseFloat(p.selling_price || 0).toFixed(2)}</td>
                <td>${parseFloat(p.cgst_rate || 0) + parseFloat(p.sgst_rate || 0)}%</td>
                <td><span class="fw-semibold me-2">${stock}</span>${stockBadge}</td>
                <td class="text-end">
                    <button class="btn btn-sm btn-outline-primary me-1" onclick="openEditModal(${p.id})">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteProduct(${p.id})">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>`;
            productsTableBody.appendChild(row);
        });
    }

    // ── 3. SEARCH & FILTER LISTENERS ─────────────────────────────────────────
    if (searchInput)    searchInput.addEventListener('input', filterAndRender);
    if (categoryFilter) categoryFilter.addEventListener('change', filterAndRender);

    // ── 4. ADD / EDIT PRODUCT ─────────────────────────────────────────────────
    if (productForm) {
        productForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const editingId = productIdInput ? productIdInput.value : '';
            const cgstRate  = parseFloat(productGstInput ? productGstInput.value : 0) / 2;
            const sgstRate  = cgstRate;

            const productData = {
                name:           productNameInput.value.trim(),
                category:       productCategoryInput.value,
                brand:          productSkuInput ? productSkuInput.value.trim() : '',
                mrp:            parseFloat(productMrpInput ? productMrpInput.value : 0) || 0,
                selling_price:  parseFloat(productPriceInput.value) || 0,
                stock_quantity: parseInt(productStockInput.value, 10) || 0,
                cgst_rate:      cgstRate,
                sgst_rate:      sgstRate
            };

            try {
                const url    = editingId ? `${NODE_API}/products/${editingId}` : `${NODE_API}/products`;
                const method = editingId ? 'PUT' : 'POST';

                const res = await apiFetch(url, {
                    method,
                    body: JSON.stringify(productData)
                });

                if (!res.ok) {
                    const errData = await res.json();
                    throw new Error(errData.error || `Server error ${res.status}`);
                }

                if (productModalEl) {
                    const modal = bootstrap.Modal.getInstance(productModalEl) || new bootstrap.Modal(productModalEl);
                    modal.hide();
                }
                productForm.reset();
                if (productIdInput) productIdInput.value = '';

                await loadProducts();
                alert(editingId ? '✅ Product updated!' : '✅ New product added to database!');

            } catch (err) {
                console.error('Save product failed:', err);
                alert(`❌ Failed to save product: ${err.message}`);
            }
        });
    }

    // ── 5. OPEN EDIT MODAL ────────────────────────────────────────────────────
    window.openEditModal = function (productId) {
        const p = allProducts.find(prod => prod.id === productId);
        if (!p) return;

        if (productIdInput)       productIdInput.value       = p.id;
        if (productSkuInput)      productSkuInput.value      = p.brand || '';
        if (productNameInput)     productNameInput.value     = p.name  || '';
        if (productCategoryInput) productCategoryInput.value = p.category || 'General';
        if (productMrpInput)      productMrpInput.value      = p.mrp  || p.selling_price || 0;
        if (productPriceInput)    productPriceInput.value    = p.selling_price || 0;
        if (productGstInput)      productGstInput.value      = (parseFloat(p.cgst_rate || 0) + parseFloat(p.sgst_rate || 0));
        if (productStockInput)    productStockInput.value    = p.stock_quantity || 0;
        if (modalTitle)           modalTitle.textContent     = 'Edit Product';

        if (productModalEl) new bootstrap.Modal(productModalEl).show();
    };

    // Reset form when opening add-new modal
    const btnAddProduct = document.querySelector('[data-bs-target="#productModal"]');
    if (btnAddProduct) {
        btnAddProduct.addEventListener('click', () => {
            if (productForm)    productForm.reset();
            if (productIdInput) productIdInput.value = '';
            if (modalTitle)     modalTitle.textContent = 'Add New Product';
        });
    }

    // ── 6. DELETE PRODUCT ─────────────────────────────────────────────────────
    window.deleteProduct = async function (productId) {
        const prod = allProducts.find(p => p.id === productId);
        if (!prod) return;
        if (!confirm(`Delete "${prod.name}"? This cannot be undone.`)) return;

        try {
            const res = await apiFetch(`${NODE_API}/products/${productId}`, { method: 'DELETE' });
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || `Server error ${res.status}`);
            }
            await loadProducts();
        } catch (err) {
            console.error('Delete failed:', err);
            alert(`❌ Failed to delete: ${err.message}`);
        }
    };

    // ── 7. OPEN ADD MODAL FROM DASHBOARD LINK ────────────────────────────────
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('openModal') === 'true' && productModalEl) {
        setTimeout(() => new bootstrap.Modal(productModalEl).show(), 300);
    }

    // ── INITIAL LOAD ──────────────────────────────────────────────────────────
    await loadProducts();
});
