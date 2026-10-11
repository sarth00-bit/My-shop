// =========================================
// report.js — uses config.js for API URL
// NODE_API and PYTHON_API come from config.js
// =========================================

document.addEventListener('DOMContentLoaded', async () => {

    const filterForm       = document.getElementById('filterForm');
    const filterPresetDate = document.getElementById('filterPresetDate');
    const filterStartDate  = document.getElementById('filterStartDate');
    const filterEndDate    = document.getElementById('filterEndDate');
    const filterCategory   = document.getElementById('filterCategory');
    const filterPayment    = document.getElementById('filterPayment');
    const filterCustomer   = document.getElementById('filterCustomer');
    const btnResetFilter   = document.getElementById('btnResetFilter');
    const btnPrint         = document.getElementById('btnPrint');
    const btnExportCSV     = document.getElementById('btnExportCSV');
    const btnExportPDF     = document.getElementById('btnExportPDF');

    const kpiRevenue    = document.getElementById('kpiRevenue');
    const kpiCost       = document.getElementById('kpiCost');
    const kpiDiscount   = document.getElementById('kpiDiscount');
    const kpiProfit     = document.getElementById('kpiProfit');
    const kpiSalesCount = document.getElementById('kpiSalesCount');
    const kpiMargin     = document.getElementById('kpiMargin');

    const salesTbody     = document.getElementById('salesReportTableBody');
    const productTbody   = document.getElementById('productReportTableBody');
    const customerTbody  = document.getElementById('customerReportTableBody');
    const inventoryTbody = document.getElementById('inventoryReportTableBody');

    const invTotalItems  = document.getElementById('invTotalItems');
    const invStockValue  = document.getElementById('invStockValue');
    const invAlertCount  = document.getElementById('invAlertCount');

    let allSales    = [];
    let allProducts = [];
    let perfData    = [];

    function fmt(val) {
        const n = parseFloat(val);
        return isNaN(n) ? '0.00' : n.toFixed(2);
    }

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, ch => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[ch]);
    }

    function fmtDate(isoStr) {
        if (!isoStr) return '—';
        const dt = new Date(isoStr);
        return isNaN(dt) ? isoStr : dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    }

    function setKPI(el, val) { if (el) el.textContent = val; }

    // ── 1. LOAD DATA ──────────────────────────────────────────────────────────
    async function loadAllData() {
        showLoading();
        try {
            const [salesRes, productsRes, perfRes] = await Promise.all([
                apiFetch(`${NODE_API}/sales`),
                apiFetch(`${NODE_API}/products`),
                apiFetch(`${PYTHON_API}/analytics/product-performance`)
            ]);

            if (!salesRes.ok)    throw new Error(`Sales API error (${salesRes.status})`);
            if (!productsRes.ok) throw new Error(`Products API error (${productsRes.status})`);

            // Read Node responses normally. The Flask analytics endpoint can
            // return Python NaN/Infinity values, which are NOT valid JSON for
            // the browser's Response.json(). Parse that response safely so a
            // bad analytics row cannot break the entire Reports page.
            allSales    = await salesRes.json();
            allProducts = await productsRes.json();
            perfData    = perfRes.ok ? await readAnalyticsJson(perfRes) : [];

            populateCategoryFilter();
            renderReports();
        } catch (err) {
            console.error('Report load failed:', err);
            showError(err.message);
        }
    }

    async function readAnalyticsJson(response) {
        try {
            const text = await response.text();
            if (!text || !text.trim()) return [];

            // Python's JSON encoder may emit NaN/Infinity. Convert those
            // non-standard numeric tokens to JSON null before parsing.
            const safeText = text
                .replace(/\bNaN\b/g, 'null')
                .replace(/\bInfinity\b/g, 'null')
                .replace(/\b-Infinity\b/g, 'null');

            const parsed = JSON.parse(safeText);
            return Array.isArray(parsed) ? parsed : [];
        } catch (err) {
            console.warn('Product analytics data could not be parsed. Reports will continue without it:', err);
            return [];
        }
    }

    // ── 2. CATEGORY DROPDOWN ──────────────────────────────────────────────────
    function populateCategoryFilter() {
        if (!filterCategory) return;

        const categories = ['Electronic', 'General', 'Accessories', 'Apparel'];
        filterCategory.innerHTML = '<option value="all">All Categories</option>';

        categories.forEach(category => {
            const opt = document.createElement('option');
            opt.value = category;
            opt.textContent = category;
            filterCategory.appendChild(opt);
        });
    }

    // ── 3. FILTER SALES ───────────────────────────────────────────────────────
    function filterSales() {
        const start     = filterStartDate?.value ? new Date(filterStartDate.value + 'T00:00:00') : null;
        const end       = filterEndDate?.value   ? new Date(filterEndDate.value   + 'T23:59:59') : null;
        const payMethod = filterPayment?.value   || 'all';
        const category  = filterCategory?.value  || 'all';
        const custQuery = (filterCustomer?.value || '').toLowerCase().trim();

        return allSales.filter(s => {
            const dt = new Date(s.sale_date);
            if (start && dt < start) return false;
            if (end   && dt > end)   return false;
            if (payMethod !== 'all' && (s.payment_method || '').toLowerCase() !== payMethod.toLowerCase()) return false;
            if (custQuery && !(s.customer_name || '').toLowerCase().includes(custQuery)) return false;

            // Category filtering is handled from stored sale items when available.
            // For the sales summary, if no item/category snapshot is available,
            // keep the sale rather than inventing a category.
            if (category !== 'all' && Array.isArray(s.items) && s.items.length) {
                const hasCategory = s.items.some(item =>
                    String(item.category || '').toLowerCase() === category.toLowerCase()
                );
                if (!hasCategory) return false;
            }

            return true;
        });
    }

    // ── 4. RENDER ALL TABS ────────────────────────────────────────────────────
    function renderReports() {
        const filtered = filterSales();
        renderKPIs(filtered);
        renderSalesTab(filtered);
        renderProductTab();
        renderCustomerTab(filtered);
        renderInventoryTab();
    }

    function renderKPIs(filtered) {
        let revenue = 0, cost = 0, discount = 0, taxableSales = 0, gst = 0;

        filtered.forEach(s => {
            // total_amount = final GST-inclusive amount paid by customer.
            revenue  += Number(s.total_amount || 0);

            // subtotal_amount = GST-exclusive taxable sales value after discount.
            taxableSales += Number(s.subtotal_amount ?? s.subtotal ?? 0);

            gst += Number(s.tax_amount || 0);
            discount += Number(s.discount || 0);

            // cost_amount = actual purchase cost, not an estimate.
            cost += Number(s.cost_amount || 0);
        });

        const profit = filtered.reduce((sum, s) => {
            const storedProfit = Number(s.profit_amount);
            if (Number.isFinite(storedProfit)) return sum + storedProfit;

            // New invoices should always contain profit_amount.
            // This fallback uses taxable sales - purchase cost, never GST-inclusive
            // revenue - purchase cost.
            return sum +
                Number(s.subtotal_amount ?? s.subtotal ?? 0) -
                Number(s.cost_amount || 0);
        }, 0);

        // Margin is profit over GST-exclusive taxable sales.
        const margin = taxableSales > 0 ? ((profit / taxableSales) * 100) : 0;

        setKPI(kpiRevenue,    `₹${fmt(revenue)}`);
        setKPI(kpiCost,       `₹${fmt(cost)}`);
        setKPI(kpiDiscount,   `₹${fmt(discount)}`);
        setKPI(kpiProfit,     `₹${fmt(profit)}`);
        setKPI(kpiSalesCount, filtered.length);
        setKPI(kpiMargin,     `${margin.toFixed(1)}%`);
    }

    function renderSalesTab(filtered) {
        if (!salesTbody) return;
        if (!filtered.length) {
            salesTbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">No sales found for this filter.</td></tr>';
            return;
        }
        salesTbody.innerHTML = filtered.map(s => {
            const revenue  = parseFloat(s.total_amount || 0);
            const cost     = Number.isFinite(parseFloat(s.cost_amount)) ? parseFloat(s.cost_amount) : 0;
            const storedProfit = parseFloat(s.profit_amount);
            const profit   = Number.isFinite(storedProfit) ? storedProfit : (revenue - cost);
            const itemsCnt = parseInt(s.items_count   || 0);
            return `
                <tr>
                    <td class="fw-bold text-primary">#INV-${s.id}</td>
                    <td>${fmtDate(s.sale_date)}</td>
                    <td><div class="fw-semibold">${s.customer_name || 'Walk-in'}</div></td>
                    <td><span class="badge bg-light text-dark border">${s.payment_method || 'Cash'}</span></td>
                    <td>${itemsCnt} item${itemsCnt !== 1 ? 's' : ''}</td>
                    <td class="fw-bold">₹${fmt(revenue)}</td>
                    <td class="fw-bold text-success">₹${fmt(profit)}</td>
                </tr>`;
        }).join('');
    }

    function renderProductTab() {
        if (!productTbody) return;

        const map = {};

        allProducts.forEach(p => {
            map[p.id] = {
                id: p.id,
                name: p.name || 'Unnamed Product',
                sku: p.sku || `SKU-${p.id}`,
                category: p.category || 'General',
                purchasePrice: Number(p.purchase_price || 0),
                sellingPrice: Number(p.selling_price || 0),
                stock: Math.max(0, parseInt(p.stock_quantity || 0, 10) || 0),
                minStock: Math.max(0, parseInt(p.min_stock || 0, 10) || 0),
                qty_sold: 0,
                revenue: 0
            };
        });

        // Product analytics is optional. Reports remains fully usable if the
        // Flask analytics endpoint is unavailable or contains invalid values.
        perfData.forEach(p => {
            if (!map[p.product_id]) return;

            const qty = Number(p.qty_sold);
            const revenue = Number(p.revenue);

            map[p.product_id].qty_sold = Number.isFinite(qty) ? qty : 0;
            map[p.product_id].revenue = Number.isFinite(revenue) ? revenue : 0;
        });

        const list = Object.values(map).sort((a, b) => b.revenue - a.revenue);

        if (!list.length) {
            productTbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4">No product data found.</td></tr>';
            return;
        }

        productTbody.innerHTML = list.map(p => {
            let badge = '<span class="badge bg-success">In Stock</span>';
            if (p.stock === 0) {
                badge = '<span class="badge bg-danger">Out of Stock</span>';
            } else if (p.stock <= p.minStock) {
                badge = '<span class="badge bg-warning text-dark">Low Stock</span>';
            }

            const stockCost = p.purchasePrice * p.stock;

            return `
                <tr>
                    <td>
                        <div class="fw-semibold">${p.name}</div>
                        <small class="text-muted">${p.sku}</small>
                    </td>
                    <td><span class="badge bg-light text-dark border">${p.category}</span></td>
                    <td class="fw-bold">${p.qty_sold}</td>
                    <td class="fw-bold text-primary">₹${fmt(p.revenue)}</td>
                    <td>₹${fmt(p.purchasePrice)}</td>
                    <td>₹${fmt(stockCost)}</td>
                    <td>${p.stock}</td>
                    <td>${badge}</td>
                </tr>`;
        }).join('');
    }

    function renderCustomerTab(filtered) {
        if (!customerTbody) return;
        const map = {};
        filtered.forEach(s => {
            const key = s.customer_name || 'Walk-in Customer';
            if (!map[key]) map[key] = { name: key, orders: 0, totalSpent: 0, lastDate: s.sale_date };
            map[key].orders++;
            map[key].totalSpent += parseFloat(s.total_amount || 0);
            if (new Date(s.sale_date) > new Date(map[key].lastDate)) map[key].lastDate = s.sale_date;
        });
        const list = Object.values(map).sort((a, b) => b.totalSpent - a.totalSpent);
        if (!list.length) {
            customerTbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">No customer records found.</td></tr>';
            return;
        }
        customerTbody.innerHTML = list.map(c => `
            <tr>
                <td class="fw-bold">${c.name}</td>
                <td class="text-muted">—</td>
                <td><span class="badge bg-info text-dark">${c.orders} order${c.orders !== 1 ? 's' : ''}</span></td>
                <td class="fw-bold text-success">₹${fmt(c.totalSpent)}</td>
                <td><small class="text-muted">${fmtDate(c.lastDate)}</small></td>
            </tr>`).join('');
    }

    function renderInventoryTab() {
        if (!inventoryTbody) return;

        let totalUnits = 0;
        let stockCostValue = 0;
        let alerts = 0;

        if (!allProducts.length) {
            inventoryTbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4">No inventory data found.</td></tr>';
            setKPI(invTotalItems, '0');
            setKPI(invStockValue, '₹0.00');
            setKPI(invAlertCount, '0');
            return;
        }

        // Match the HTML headers exactly: SKU, Product Name, Category, Cost Price,
        // Selling Price (Incl. GST), Stock Qty, Stock Value (Cost), Stock Status.
        inventoryTbody.innerHTML = allProducts.map(p => {
            const stock = Math.max(0, parseInt(p.stock_quantity || 0, 10) || 0);
            const purchasePrice = Number(p.purchase_price || 0);
            const sellingPrice = Number(p.selling_price || 0);
            const minStock = Math.max(0, parseInt(p.min_stock || 0, 10) || 0);
            const stockValue = purchasePrice * stock;

            totalUnits += stock;
            stockCostValue += stockValue;

            let status = '<span class="badge bg-success">In Stock</span>';
            if (stock === 0) {
                status = '<span class="badge bg-danger">Out of Stock</span>';
                alerts++;
            } else if (stock <= minStock) {
                status = '<span class="badge bg-warning text-dark">Low Stock</span>';
                alerts++;
            }

            return `
                <tr>
                    <td>${escapeHtml(p.sku || `SKU-${p.id}`)}</td>
                    <td>${escapeHtml(p.name || 'Unnamed Product')}</td>
                    <td>${escapeHtml(p.category || 'General')}</td>
                    <td>₹${fmt(purchasePrice)}</td>
                    <td>₹${fmt(sellingPrice)}</td>
                    <td>${stock}</td>
                    <td class="fw-bold">₹${fmt(stockValue)}</td>
                    <td>${status}</td>
                </tr>`;
        }).join('');

        setKPI(invTotalItems, String(totalUnits));
        setKPI(invStockValue, `₹${fmt(stockCostValue)}`);
        setKPI(invAlertCount, String(alerts));
    }

    // ── 5. FILTER CONTROLS ────────────────────────────────────────────────────
    if (filterPresetDate) {
        filterPresetDate.addEventListener('change', (e) => {
            const val   = e.target.value;
            const today = new Date();
            if (filterStartDate) filterStartDate.value = '';
            if (filterEndDate)   filterEndDate.value   = '';
            if (val === 'today') {
                const d = today.toISOString().split('T')[0];
                if (filterStartDate) filterStartDate.value = d;
                if (filterEndDate)   filterEndDate.value   = d;
            } else if (val === 'this_week') {
                const sun = new Date(today); sun.setDate(today.getDate() - today.getDay());
                if (filterStartDate) filterStartDate.value = sun.toISOString().split('T')[0];
                if (filterEndDate)   filterEndDate.value   = today.toISOString().split('T')[0];
            } else if (val === 'this_month') {
                const first = new Date(today.getFullYear(), today.getMonth(), 1);
                if (filterStartDate) filterStartDate.value = first.toISOString().split('T')[0];
                if (filterEndDate)   filterEndDate.value   = today.toISOString().split('T')[0];
            }
        });
    }

    if (filterForm) filterForm.addEventListener('submit', (e) => { e.preventDefault(); renderReports(); });

    if (btnResetFilter) {
        btnResetFilter.addEventListener('click', () => {
            if (filterForm)      filterForm.reset();
            if (filterStartDate) filterStartDate.value = '';
            if (filterEndDate)   filterEndDate.value   = '';
            renderReports();
        });
    }

    // ── 6. EXPORT CSV ─────────────────────────────────────────────────────────
    if (btnExportCSV) {
        btnExportCSV.addEventListener('click', () => {
            const filtered = filterSales();
            if (!filtered.length) { alert('No data to export.'); return; }
            const headers = ['Invoice ID','Date','Customer','Payment Method','Items','Revenue (₹)','Discount (₹)','Est. Profit (₹)'];
            const rows    = filtered.map(s => {
                const rev  = parseFloat(s.total_amount || 0);
                const cost = Number.isFinite(parseFloat(s.cost_amount)) ? parseFloat(s.cost_amount) : 0;
                const storedProfit = parseFloat(s.profit_amount);
                const profit = Number.isFinite(storedProfit) ? storedProfit : (Number(s.subtotal_amount ?? s.subtotal ?? 0) - cost);
                return [
                    `#INV-${s.id}`,
                    fmtDate(s.sale_date),
                    `"${(s.customer_name || 'Walk-in').replace(/"/g,'""')}"`,
                    s.payment_method || 'Cash',
                    s.items_count || 0,
                    fmt(rev),
                    fmt(s.discount || 0),
                    fmt(profit)
                ].join(',');
            });
            const csv  = [headers.join(','), ...rows].join('\n');
            const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
            const url  = URL.createObjectURL(blob);
            const a    = document.createElement('a');
            a.href     = url;
            a.download = `SalesReport_${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        });
    }

    if (btnPrint)     btnPrint.addEventListener('click', () => window.print());
    if (btnExportPDF) btnExportPDF.addEventListener('click', () => {
        alert('Click "Print Report" → "Save as PDF" in your browser\'s print dialog.');
    });

    function showLoading() {
        const msg = '<tr><td colspan="8" class="text-center text-muted py-4"><div class="spinner-border spinner-border-sm me-2"></div>Loading from database…</td></tr>';
        [salesTbody, productTbody, customerTbody, inventoryTbody].forEach(t => { if (t) t.innerHTML = msg; });
    }

    function showError(msg) {
        const html = `<tr><td colspan="8" class="text-center text-danger py-4">
            <i class="bi bi-exclamation-triangle display-6 d-block mb-2"></i>
            Could not load report data: ${msg}<br>
            <small class="text-muted">Make sure both servers are running and ngrok is active.</small>
        </td></tr>`;
        [salesTbody, productTbody, customerTbody, inventoryTbody].forEach(t => { if (t) t.innerHTML = html; });
    }

    await loadAllData();
});
