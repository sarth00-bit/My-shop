// ============================================================
// Product.js — complete Product Management
// Uses NODE_API and apiFetch from config.js.
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
    const $ = id => document.getElementById(id);
    const table = $('productsTableBody');
    const form = $('productForm');
    const modalEl = $('productModal');
    const viewModalEl = $('viewModal');
    const stockModalEl = $('stockModal');
    const deleteModalEl = $('deleteConfirmModal');

    let products = [];
    let deleteId = null;

    const money = v => `₹${(Number(v) || 0).toFixed(2)}`;
    const num = v => Number(v) || 0;
    const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

    function apiUrl(path) { return `${NODE_API}${path}`; }

    async function readJson(res) {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `Server error ${res.status}`);
        return data;
    }

    async function loadProducts() {
        try {
            const res = await apiFetch(apiUrl('/products'));
            products = await readJson(res);
            populateFilters();
            render();
            updateStats();
        } catch (err) {
            console.error(err);
            table.innerHTML = `<tr><td colspan="9" class="text-center text-danger py-5">
                <i class="bi bi-exclamation-triangle display-6 d-block mb-2"></i>
                Could not load products: ${esc(err.message)}
            </td></tr>`;
        }
    }

    function populateFilters() {
        const categories = ['Electronic', 'General', 'Accessories', 'Apparel'];
        $('filterCategory').innerHTML = '<option value="">All Categories</option>' +
            categories.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
    }

    function getFiltered() {
        const q = $('searchProductInput').value.trim().toLowerCase();
        const cat = $('filterCategory').value.toLowerCase();
        const stockFilter = $('filterStock').value;
        const sort = $('sortProducts').value;

        let list = products.filter(p => {
            const stock = parseInt(p.stock_quantity || 0, 10);
            const min = parseInt(p.min_stock || 0, 10);
            const text = [p.name, p.sku, p.barcode, p.category].join(' ').toLowerCase();
            if (q && !text.includes(q)) return false;
            if (cat && String(p.category || '').toLowerCase() !== cat) return false;
            if (stockFilter === 'out' && stock !== 0) return false;
            if (stockFilter === 'low' && !(stock > 0 && stock <= min)) return false;
            if (stockFilter === 'in' && stock <= min) return false;
            return true;
        });

        list.sort((a,b) => {
            if (sort === 'nameAsc') return String(a.name||'').localeCompare(String(b.name||''));
            if (sort === 'priceAsc') return num(a.selling_price) - num(b.selling_price);
            if (sort === 'priceDesc') return num(b.selling_price) - num(a.selling_price);
            if (sort === 'stockAsc') return num(a.stock_quantity) - num(b.stock_quantity);
            return num(b.id) - num(a.id);
        });
        return list;
    }

    function stockState(p) {
        const stock = parseInt(p.stock_quantity || 0, 10);
        const min = parseInt(p.min_stock || 0, 10);
        if (stock === 0) return ['Out of Stock', 'bg-danger'];
        if (stock <= min) return ['Low Stock', 'bg-warning text-dark'];
        return ['In Stock', 'bg-success'];
    }

    function render() {
        const list = getFiltered();
        if (!list.length) {
            table.innerHTML = '<tr><td colspan="9" class="text-center text-muted py-5"><i class="bi bi-box-seam display-6 d-block mb-2"></i>No products found.</td></tr>';
            return;
        }
        table.innerHTML = list.map(p => {
            const [label, cls] = stockState(p);
            const gst = num(p.cgst_rate) + num(p.sgst_rate);
            return `<tr>
                <td><strong>${esc(p.sku || `P-${p.id}`)}</strong><br><small class="text-muted">${esc(p.barcode || 'No barcode')}</small></td>
                <td><strong>${esc(p.name)}</strong></td>
                <td>${esc(p.category || 'General')}</td>
                <td>${money(p.purchase_price)}</td>
                <td class="fw-bold text-primary">${money(p.selling_price)}</td>
                <td>${gst.toFixed(2)}%</td>
                <td><strong>${parseInt(p.stock_quantity || 0,10)}</strong> <span class="badge stock-badge ${cls}">${label}</span></td>
                <td>${parseInt(p.min_stock || 0,10)}</td>
                <td class="text-end">
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary" onclick="viewProduct(${p.id})" title="View"><i class="bi bi-eye"></i></button>
                        <button class="btn btn-outline-warning" onclick="adjustStock(${p.id})" title="Adjust stock"><i class="bi bi-boxes"></i></button>
                        <button class="btn btn-outline-secondary" onclick="editProduct(${p.id})" title="Edit"><i class="bi bi-pencil"></i></button>
                        <button class="btn btn-outline-danger" onclick="confirmDelete(${p.id})" title="Delete"><i class="bi bi-trash"></i></button>
                    </div>
                </td>
            </tr>`;
        }).join('');
    }

    function updateStats() {
        const units = products.reduce((s,p) => s + parseInt(p.stock_quantity || 0,10), 0);
        // Total Stock Cost Value = Σ (Purchase Price × Current Stock Quantity)
        const value = products.reduce((total, p) => {
            const purchasePrice = num(p.purchase_price);
            const stockQty = Math.max(0, parseInt(p.stock_quantity || 0, 10) || 0);
            return total + (purchasePrice * stockQty);
        }, 0);
        const alerts = products.filter(p => parseInt(p.stock_quantity||0,10) <= parseInt(p.min_stock||0,10)).length;
        $('statProducts').textContent = products.length;
        $('statUnits').textContent = units;
        $('statStockValue').textContent = money(value);
        $('statAlerts').textContent = alerts;
    }

    function resetForm() {
        form.reset();
        $('productId').value = '';
        $('productCategory').value = '';
        $('productGst').value = '18';
        $('productCgst').value = '9';
        $('productSgst').value = '9';
        $('productMinStock').value = '10';
        $('productModalTitle').textContent = 'Add Product';
        updatePreview();
    }

    function setForm(p) {
        $('productId').value = p.id;
        $('productSku').value = p.sku || '';
        $('productBarcode').value = p.barcode || '';
        $('productName').value = p.name || '';
        $('productCategory').value = p.category || 'General';
        $('productMrp').value = p.mrp ?? '';
        $('productPurchasePrice').value = p.purchase_price ?? '';
        $('productPrice').value = p.selling_price ?? '';
        $('productCgst').value = p.cgst_rate ?? 0;
        $('productSgst').value = p.sgst_rate ?? 0;
        $('productGst').value = (num(p.cgst_rate)+num(p.sgst_rate)).toFixed(2);
        $('productStock').value = p.stock_quantity ?? 0;
        $('productMinStock').value = p.min_stock ?? 10;
        $('productModalTitle').textContent = 'Edit Product';
        updatePreview();
    }

    // Selling Price is GST-inclusive. Purchase Price is GST-exclusive.
    // GST is extracted from the customer price; it is not added on top.
    // Profit = GST-exclusive selling value - purchase base cost.
    function calculateProductEconomics(purchasePrice, sellingPrice, gstRate) {
        const buy = Math.max(0, num(purchasePrice));
        const sell = Math.max(0, num(sellingPrice));
        const gst = Math.max(0, num(gstRate));
        const gstIncluded = gst > 0 ? (sell * gst / (100 + gst)) : 0;
        const taxableSale = Math.max(0, sell - gstIncluded);
        const profit = taxableSale - buy;
        const margin = taxableSale > 0 ? (profit / taxableSale) * 100 : 0;
        return { buy, sell, gst, gstIncluded, taxableSale, profit, margin };
    }

    function updatePreview() {
        const buy = num($('productPurchasePrice').value);
        const sell = num($('productPrice').value);
        const gst = num($('productGst').value);
        const calc = calculateProductEconomics(buy, sell, gst);
        const profitCard = $('previewProfitCard');

        $('previewSellingPrice').textContent = money(calc.sell);
        $('previewGstAmount').textContent = money(calc.gstIncluded);
        $('previewTaxable').textContent = money(calc.taxableSale);
        $('previewPurchaseCost').textContent = money(calc.buy);
        $('previewProfit').textContent = money(calc.profit);
        $('previewMargin').textContent = `${calc.margin.toFixed(1)}%`;
        $('previewGstSplit').textContent = `CGST ${num($('productCgst').value).toFixed(2)}% + SGST ${num($('productSgst').value).toFixed(2)}% = Total GST ${gst.toFixed(2)}%`;

        if (profitCard) {
            profitCard.classList.toggle('preview-profit', calc.profit >= 0);
            profitCard.classList.toggle('preview-loss', calc.profit < 0);
        }
    }

    // GST synchronization:
    // Total GST = CGST + SGST.
    // Editing Total GST splits it equally.
    // Editing either CGST or SGST recalculates Total GST automatically.
    let gstSyncLock = false;

    $('productGst').addEventListener('input', () => {
        if (gstSyncLock) return;
        gstSyncLock = true;
        const total = num($('productGst').value);
        const half = total / 2;
        $('productCgst').value = half.toFixed(2);
        $('productSgst').value = half.toFixed(2);
        gstSyncLock = false;
        updatePreview();
    });

    $('productCgst').addEventListener('input', () => {
        if (gstSyncLock) return;
        gstSyncLock = true;
        const cgst = num($('productCgst').value);
        const sgst = num($('productSgst').value);
        $('productGst').value = (cgst + sgst).toFixed(2);
        gstSyncLock = false;
        updatePreview();
    });

    $('productSgst').addEventListener('input', () => {
        if (gstSyncLock) return;
        gstSyncLock = true;
        const cgst = num($('productCgst').value);
        const sgst = num($('productSgst').value);
        $('productGst').value = (cgst + sgst).toFixed(2);
        gstSyncLock = false;
        updatePreview();
    });

    ['productMrp','productPurchasePrice','productPrice'].forEach(id => $(id).addEventListener('input', updatePreview));

    $('btnAddNewProduct').addEventListener('click', () => {
        resetForm();
        bootstrap.Modal.getOrCreateInstance(modalEl).show();
    });

    form.addEventListener('submit', async e => {
        e.preventDefault();
        const id = $('productId').value;
        const cgst = num($('productCgst').value);
        const sgst = num($('productSgst').value);
        const data = {
            sku: $('productSku').value.trim(),
            barcode: $('productBarcode').value.trim() || null,
            name: $('productName').value.trim(),
            category: $('productCategory').value || 'General',
            mrp: num($('productMrp').value),
            purchase_price: num($('productPurchasePrice').value),
            selling_price: num($('productPrice').value),
            cgst_rate: cgst,
            sgst_rate: sgst,
            gst_rate: cgst + sgst,
            stock_quantity: Math.max(0, parseInt($('productStock').value,10) || 0),
            min_stock: Math.max(0, parseInt($('productMinStock').value,10) || 0)
        };

        if (!data.name || !data.sku) return alert('SKU and Product Name are required.');
        if (!['Electronic','General','Accessories','Apparel'].includes(data.category)) {
            return alert('Please select a valid category.');
        }
        if (data.purchase_price < 0 || data.selling_price < 0 || data.mrp < 0) return alert('Prices cannot be negative.');
        if (data.mrp > 0 && data.selling_price > data.mrp) {
            return alert('Selling Price cannot be higher than MRP. Both prices include GST.');
        }

        const economics = calculateProductEconomics(data.purchase_price, data.selling_price, data.gst_rate);
        if (economics.profit < 0) {
            if (!confirm(`This product creates a loss of ${money(Math.abs(economics.profit))} per unit after GST extraction. Continue?`)) return;
        }

        try {
            const url = id ? apiUrl(`/products/${id}`) : apiUrl('/products');
            const res = await apiFetch(url, {method:id?'PUT':'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data)});
            await readJson(res);
            bootstrap.Modal.getOrCreateInstance(modalEl).hide();
            await loadProducts();
            alert(id ? 'Product updated successfully.' : 'Product added successfully.');
        } catch (err) { alert(`Failed to save product: ${err.message}`); }
    });

    window.editProduct = id => {
        const p = products.find(x => Number(x.id) === Number(id));
        if (!p) return;
        setForm(p);
        bootstrap.Modal.getOrCreateInstance(modalEl).show();
    };

    window.viewProduct = id => {
        const p = products.find(x => Number(x.id) === Number(id));
        if (!p) return;
        const gst = num(p.cgst_rate)+num(p.sgst_rate);
        const economics = calculateProductEconomics(p.purchase_price, p.selling_price, gst);
        const [state, cls] = stockState(p);
        $('viewProductBody').innerHTML = [
            ['SKU', p.sku], ['Barcode', p.barcode || '—'], ['Name', p.name],
            ['Category', p.category || 'General'], ['MRP (Incl. GST)', money(p.mrp)],
            ['Purchase Price (Excl. GST)', money(p.purchase_price)], ['Selling Price (Incl. GST)', money(p.selling_price)],
            ['GST Included in Selling Price', money(economics.gstIncluded)],
            ['Taxable Selling Value', money(economics.taxableSale)],
            ['Profit / Unit', money(economics.profit)], ['Margin on Taxable Sale', `${economics.margin.toFixed(2)}%`],
            ['GST', `${gst.toFixed(2)}% (CGST ${num(p.cgst_rate).toFixed(2)}% + SGST ${num(p.sgst_rate).toFixed(2)}%)`],
            ['Current Stock', `${parseInt(p.stock_quantity||0,10)} pcs`], ['Minimum Stock', `${parseInt(p.min_stock||0,10)} pcs`],
            ['Status', `<span class="badge ${cls}">${state}</span>`]
        ].map(([k,v]) => `<div class="col-md-6"><div class="border rounded p-3 h-100"><small class="text-muted">${esc(k)}</small><div class="fw-semibold mt-1">${v && String(v).includes('<span') ? v : esc(v)}</div></div></div>`).join('');
        bootstrap.Modal.getOrCreateInstance(viewModalEl).show();
    };

    window.adjustStock = id => {
        const p = products.find(x => Number(x.id) === Number(id));
        if (!p) return;
        $('stockProductId').value = p.id;
        $('stockProductName').textContent = p.name;
        $('stockCurrent').textContent = parseInt(p.stock_quantity||0,10);
        $('stockAdjustment').value = '';
        bootstrap.Modal.getOrCreateInstance(stockModalEl).show();
    };

    $('stockForm').addEventListener('submit', async e => {
        e.preventDefault();
        const id = $('stockProductId').value;
        const delta = parseInt($('stockAdjustment').value,10);
        if (!Number.isInteger(delta) || delta === 0) return alert('Enter a non-zero whole number.');
        try {
            const res = await apiFetch(apiUrl(`/products/${id}/stock`), {method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({adjustment:delta})});
            await readJson(res);
            bootstrap.Modal.getOrCreateInstance(stockModalEl).hide();
            await loadProducts();
        } catch (err) { alert(`Stock update failed: ${err.message}`); }
    });

    window.confirmDelete = id => {
        const p = products.find(x => Number(x.id) === Number(id));
        if (!p) return;
        deleteId = id;
        $('deleteMessage').textContent = `Delete "${p.name}"? This cannot be undone.`;
        bootstrap.Modal.getOrCreateInstance(deleteModalEl).show();
    };

    $('btnConfirmDelete').addEventListener('click', async () => {
        if (!deleteId) return;
        try {
            const res = await apiFetch(apiUrl(`/products/${deleteId}`), {method:'DELETE'});
            await readJson(res);
            bootstrap.Modal.getOrCreateInstance(deleteModalEl).hide();
            deleteId = null;
            await loadProducts();
        } catch (err) { alert(`Delete failed: ${err.message}`); }
    });

    ['searchProductInput','filterCategory','filterStock','sortProducts'].forEach(id => $(id).addEventListener('input', render));

    $('btnExportProducts').addEventListener('click', () => {
        const headers = ['SKU','Barcode','Name','Category','MRP (Incl. GST)','Purchase Price (Excl. GST)','Selling Price (Incl. GST)','CGST','SGST','Stock','Min Stock'];
        const rows = products.map(p => [p.sku,p.barcode,p.name,p.category,p.mrp,p.purchase_price,p.selling_price,p.cgst_rate,p.sgst_rate,p.stock_quantity,p.min_stock]
            .map(v => `"${String(v ?? '').replace(/"/g,'""')}"`).join(','));
        const blob = new Blob(['\uFEFF'+headers.join(',')+'\n'+rows.join('\n')], {type:'text/csv;charset=utf-8'});
        const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`Products_${new Date().toISOString().slice(0,10)}.csv`; a.click();
        URL.revokeObjectURL(a.href);
    });

    // CSV import expects the same column names as Export CSV.
    $('productImportFile').addEventListener('change', async e => {
        const file = e.target.files[0]; if (!file) return;
        const text = await file.text();
        const lines = text.split(/\r?\n/).filter(Boolean);
        if (lines.length < 2) return alert('CSV has no product rows.');
        const headers = lines[0].split(',').map(x => x.replace(/^"|"$/g,'').trim().toLowerCase());
        const idx = name => headers.indexOf(name.toLowerCase());
        const purchaseHeader = idx('purchase price (excl. gst)') >= 0 ? 'purchase price (excl. gst)' : 'purchase price';
        const sellingHeader = idx('selling price (incl. gst)') >= 0 ? 'selling price (incl. gst)' : 'selling price';
        const required = ['sku','name',purchaseHeader,sellingHeader];
        if (required.some(h => idx(h) < 0)) return alert('CSV must contain SKU, Name, Purchase Price and Selling Price columns.');
        let imported=0, failed=0;
        for (const line of lines.slice(1)) {
            const cols = parseCSVLine(line);
            const data = {
                sku: cols[idx('sku')] || '', barcode: cols[idx('barcode')] || null, name: cols[idx('name')] || '',
                category: ['Electronic','General','Accessories','Apparel'].includes(cols[idx('category')])
                    ? cols[idx('category')] : 'General',
                mrp:num(cols[idx('mrp (incl. gst)')] ?? cols[idx('mrp')]),
                purchase_price:num(cols[idx(purchaseHeader)]), selling_price:num(cols[idx(sellingHeader)]),
                cgst_rate:num(cols[idx('cgst')]), sgst_rate:num(cols[idx('sgst')]),
                gst_rate:num(cols[idx('cgst')])+num(cols[idx('sgst')]),
                stock_quantity:Math.max(0,parseInt(cols[idx('stock')]||0,10)||0),
                min_stock:Math.max(0,parseInt(cols[idx('min stock')]||0,10)||0)
            };
            if (!data.sku || !data.name) { failed++; continue; }
            try {
                const res=await apiFetch(apiUrl('/products'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
                if(res.ok) imported++; else failed++;
            } catch { failed++; }
        }
        e.target.value='';
        await loadProducts();
        alert(`Import finished. Added: ${imported}. Failed: ${failed}.`);
    });

    function parseCSVLine(line) {
        const out=[]; let cur='', quoted=false;
        for(let i=0;i<line.length;i++){ const c=line[i];
            if(c==='"' && line[i+1]==='"'){cur+='"';i++;continue;}
            if(c==='"'){quoted=!quoted;continue;}
            if(c===','&&!quoted){out.push(cur);cur='';} else cur+=c;
        }
        out.push(cur); return out;
    }

    await loadProducts();
});
