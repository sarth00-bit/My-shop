document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Default Products if LocalStorage is empty
    if (!localStorage.getItem('products')) {
        const initialProducts = [
            { id: 'PROD-001', sku: 'SKU-1001', name: 'Wireless Mouse', category: 'Electronics', price: 499, gstRate: 18, stock: 25 },
            { id: 'PROD-002', sku: 'SKU-1002', name: 'Mechanical Keyboard', category: 'Electronics', price: 1999, gstRate: 18, stock: 12 },
            { id: 'PROD-003', sku: 'SKU-1003', name: 'USB-C Cable 1m', category: 'Accessories', price: 299, gstRate: 12, stock: 50 },
            { id: 'PROD-004', sku: 'SKU-1004', name: 'Cotton T-Shirt', category: 'Apparel', price: 599, gstRate: 5, stock: 5 }
        ];
        localStorage.setItem('products', JSON.stringify(initialProducts));
    }

    // 2. DOM Elements
    const productsTableBody = document.getElementById('productsTableBody');
    const searchInput = document.querySelector('input[placeholder*="Search"]') || document.getElementById('productSearchInput');
    const categoryFilter = document.getElementById('categoryFilter');
    const productForm = document.getElementById('productForm');
    const productModalEl = document.getElementById('productModal');

    // Form Field Elements
    const productIdInput = document.getElementById('productId');
    const productSkuInput = document.getElementById('productSku');
    const productNameInput = document.getElementById('productName');
    const productCategoryInput = document.getElementById('productCategory');
    const productPriceInput = document.getElementById('productPrice');
    const productGstInput = document.getElementById('productGst');
    const productStockInput = document.getElementById('productStock');
    const modalTitle = document.getElementById('productModalTitle');

    let allProducts = [];

    // Helper: Normalize item keys to maintain compatibility across all pages
    function normalizeProduct(p) {
        return {
            id: p.id || p.sku || `PROD-${Date.now()}`,
            sku: p.sku || p.id || 'N/A',
            name: p.name || 'Unnamed Product',
            category: p.category || 'General',
            price: parseFloat(p.sellingPrice || p.price || p.sellPrice || 0),
            gstRate: parseFloat(p.gstRate || p.gst || 0),
            stock: parseInt(p.stock || 0, 10)
        };
    }

    // 3. Load & Render Products
    function loadProducts() {
        const rawProducts = JSON.parse(localStorage.getItem('products')) || [];
        allProducts = rawProducts.map(normalizeProduct);
        filterAndRender();
    }

    function filterAndRender() {
        if (!productsTableBody) return;

        const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
        const selectedCat = categoryFilter ? categoryFilter.value : 'All';

        const filtered = allProducts.filter(p => {
            const matchesSearch = p.name.toLowerCase().includes(query) ||
                                  p.sku.toLowerCase().includes(query) ||
                                  p.id.toLowerCase().includes(query);
            const matchesCat = (selectedCat === 'All' || !selectedCat) || (p.category === selectedCat);
            return matchesSearch && matchesCat;
        });

        productsTableBody.innerHTML = '';

        if (filtered.length === 0) {
            productsTableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center text-muted py-4">
                        <i class="bi bi-box-seam display-6 d-block mb-2"></i>
                        No products found.
                    </td>
                </tr>`;
            return;
        }

        filtered.forEach(p => {
            // Stock Status Badge
            let stockBadge = '<span class="badge bg-success">In Stock</span>';
            if (p.stock === 0) {
                stockBadge = '<span class="badge bg-danger">Out of Stock</span>';
            } else if (p.stock <= 10) {
                stockBadge = '<span class="badge bg-warning text-dark">Low Stock</span>';
            }

            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="fw-bold">${p.sku}</td>
                <td>${p.name}</td>
                <td><span class="badge bg-light text-dark border">${p.category}</span></td>
                <td class="fw-bold text-primary">₹${p.price.toFixed(2)}</td>
                <td>${p.gstRate}%</td>
                <td>
                    <span class="fw-semibold me-2">${p.stock}</span>
                    ${stockBadge}
                </td>
                <td class="text-end">
                    <button class="btn btn-sm btn-outline-primary me-1" onclick="openEditModal('${p.id}')">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteProduct('${p.id}')">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            `;
            productsTableBody.appendChild(row);
        });
    }

    // 4. Real-Time Search & Category Filter Listeners
    if (searchInput) {
        searchInput.addEventListener('input', filterAndRender);
    }
    if (categoryFilter) {
        categoryFilter.addEventListener('change', filterAndRender);
    }

    // 5. Add / Edit Product Submit Handler
    if (productForm) {
        productForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const editingId = productIdInput.value;
            const productData = {
                id: editingId || `PROD-${Date.now().toString().slice(-6)}`,
                sku: productSkuInput.value.trim(),
                name: productNameInput.value.trim(),
                category: productCategoryInput.value,
                price: parseFloat(productPriceInput.value) || 0,
                sellingPrice: parseFloat(productPriceInput.value) || 0,
                gstRate: parseFloat(productGstInput.value) || 0,
                stock: parseInt(productStockInput.value, 10) || 0
            };

            let productsArr = JSON.parse(localStorage.getItem('products')) || [];

            if (editingId) {
                // Update existing product
                productsArr = productsArr.map(p => {
                    const normP = normalizeProduct(p);
                    return normP.id === editingId ? productData : p;
                });
            } else {
                // Add new product
                productsArr.unshift(productData);
            }

            localStorage.setItem('products', JSON.stringify(productsArr));
            loadProducts();

            // Hide Modal
            if (productModalEl) {
                const modal = bootstrap.Modal.getInstance(productModalEl) || new bootstrap.Modal(productModalEl);
                modal.hide();
            }

            productForm.reset();
            productIdInput.value = '';
            alert(editingId ? 'Product updated successfully!' : 'New product added successfully!');
        });
    }

    // 6. Open Modal for Editing
    window.openEditModal = function(productId) {
        const p = allProducts.find(prod => prod.id === productId);
        if (!p) return;

        productIdInput.value = p.id;
        productSkuInput.value = p.sku;
        productNameInput.value = p.name;
        productCategoryInput.value = p.category;
        productPriceInput.value = p.price;
        productGstInput.value = p.gstRate;
        productStockInput.value = p.stock;

        if (modalTitle) modalTitle.textContent = 'Edit Product';

        if (productModalEl) {
            const modal = new bootstrap.Modal(productModalEl);
            modal.show();
        }
    };

    // Reset Form when opening Modal for a NEW product
    const btnAddProduct = document.querySelector('[data-bs-target="#productModal"]');
    if (btnAddProduct) {
        btnAddProduct.addEventListener('click', () => {
            productForm.reset();
            productIdInput.value = '';
            if (modalTitle) modalTitle.textContent = 'Add New Product';
        });
    }

    // 7. Delete Product Handler
    window.deleteProduct = function(productId) {
        const prod = allProducts.find(p => p.id === productId);
        if (!prod) return;

        if (confirm(`Are you sure you want to delete "${prod.name}" (${prod.sku})?`)) {
            let productsArr = JSON.parse(localStorage.getItem('products')) || [];
            productsArr = productsArr.filter(p => {
                const normP = normalizeProduct(p);
                return normP.id !== productId;
            });

            localStorage.setItem('products', JSON.stringify(productsArr));
            loadProducts();
        }
    };

    // Initial Load
    loadProducts();
});

// Inside js/product.js (at the end of DOMContentLoaded listener)
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('openModal') === 'true') {
    const addProductModal = document.getElementById('btnAddStockDashboard'); // Replace with your modal ID
    if (addProductModal && typeof bootstrap !== 'undefined') {
        const modalInstance = new bootstrap.Modal(addProductModal);
        modalInstance.show();
    }
}