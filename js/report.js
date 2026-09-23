// =========================================
// REPORT.JS — connected to Node.js + Flask
// No LocalStorage used anywhere
// =========================================

const NODE_API   = 'https://enable-empathic-murmuring.ngrok-free.dev/api';
const PYTHON_API = 'https://enable-empathic-murmuring.ngrok-free.dev/python-api';

document.addEventListener('DOMContentLoaded', async () => {

    // ── DOM REFS ────────────────────────────────────────────────────────────
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

    // KPI
    const kpiRevenue    = document.getElementById('kpiRevenue');
    const kpiCost       = document.getElementById('kpiCost');
    const kpiDiscount   = document.getElementById('kpiDiscount');
    const kpiProfit     = document.getElementById('kpiProfit');
    const kpiSalesCount = document.getElementById('kpiSalesCount');
    const kpiMargin     = document.getElementById('kpiMargin');

    // Table bodies
    const salesTbody     = document.getElementById('salesReportTableBody');
    const productTbody   = document.getElementById('productReportTableBody');
    const customerTbody  = document.getElementById('customerReportTableBody');
    const inventoryTbody = document.getElementById('inventoryReportTableBody');

    // Inventory KPIs
    const invTotalItems  = document.getElementById('invTotalItems');
    const invStockValue  = document.getElementById('invStockValue');
    const invAlertCount  = document.getElementById('invAlertCount');

    // ── STATE ───────────────────────────────────────────────────────────────
    let allSales    = [];   // from GET /api/sales
    let allProducts = [];   // from GET /api/products
    let perfData    = [];   // from GET /api/analytics/product-performance

    // ── HELPERS ─────────────────────────────────────────────────────────────
    function fmt(val) {
        const n = parseFloat(val);
        return isNaN(n) ? '0.00' : n.toFixed(2);
    }

    function fmtDate(isoStr) {
        if (!isoStr) return '—';
        const dt = new Date(isoStr);
        return isNaN(dt) ? isoStr : dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    }

    function setKPI(el, val) { if (el) el.textContent = val; }

    // ── 1. LOAD DATA FROM APIs ───────────────────────────────────────────────
    async function loadAllData() {
        showLoading();
        try {
            const [salesRes, productsRes, perfRes] = await Promise.all([
                fetch(`${NODE_API}/sales`),
                fetch(`${NODE_API}/products`),
                fetch(`${PYTHON_API}/analytics/product-performance`)
            ]);

            if (!salesRes.ok)    throw new Error(`Sales API error (${salesRes.status})`);
            if (!productsRes.ok) throw new Error(`Products API error (${productsRes.status})`);

            allSales    = await salesRes.json();
            allProducts = await productsRes.json();
            perfData    = perfRes.ok ? await perfRes.json() : [];

            populateCategoryFilter();
            renderReports();
        } catch (err) {
            console.error('Report load failed:', err);
            showError(err.message);
        }
    }

    // ── 2. POPULATE CATEGORY DROPDOWN FROM REAL PRODUCTS ────────────────────
    function populateCategoryFilter() {
        const cats = [...new Set(allProducts.map(p => p.category).filter(Boolean))];
        filterCategory.innerHTML = '<option value="all">All Categories</option>';
        cats.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat; opt.textContent = cat;
            filterCategory.appendChild(opt);
        });
    }

    // ── 3. FILTER SALES ──────────────────────────────────────────────────────
    function filterSales() {
        const start     = filterStartDate.value  ? new Date(filterStartDate.value + 'T00:00:00') : null;
        const end       = filterEndDate.value    ? new Date(filterEndDate.value   + 'T23:59:59') : null;
        const payMethod = filterPayment.value;
        const custQuery = (filterCustomer.value || '').toLowerCase().trim();

        return allSales.filter(s => {
            const dt = new Date(s.sale_date);
            if (start && dt < start) return false;
            if (end   && dt > end)   return false;
            if (payMethod !== 'all' && (s.payment_method || '').toLowerCase() !== payMethod.toLowerCase()) return false;
            if (custQuery && !(s.customer_name || '').toLowerCase().includes(custQuery)) return false;
            return true;
        });
    }

    // ── 4. RENDER ALL TABS ───────────────────────────────────────────────────
    function renderReports() {
        const filtered = filterSales();
        renderKPIs(filtered);
        renderSalesTab(filtered);
        renderProductTab();
        renderCustomerTab(filtered);
        renderInventoryTab();
    }

    // ── 4a. KPI CARDS ────────────────────────────────────────────────────────
    function renderKPIs(filtered) {
        let revenue = 0, cost = 0, discount = 0;

        filtered.forEach(s => {
            revenue  += parseFloat(s.total_amount || 0);
            discount += parseFloat(s.discount     || 0);
            // cost_amount from DB; fallback = 70% of revenue
            cost     += parseFloat(s.cost_amount  || 0) || (parseFloat(s.total_amount || 0) * 0.70);
        });

        const profit = revenue - cost;
        const margin = revenue > 0 ? ((profit / revenue) * 100) : 0;

        setKPI(kpiRevenue,    `₹${fmt(revenue)}`);
        setKPI(kpiCost,       `₹${fmt(cost)}`);
        setKPI(kpiDiscount,   `₹${fmt(discount)}`);
        setKPI(kpiProfit,     `₹${fmt(profit)}`);
        setKPI(kpiSalesCount, filtered.length);
        setKPI(kpiMargin,     `${margin.toFixed(1)}%`);
    }

    // ── 4b. SALES REPORT TABLE ───────────────────────────────────────────────
    function renderSalesTab(filtered) {
        if (!salesTbody) return;
        if (!filtered.length) {
            salesTbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">No sales found for this filter.</td></tr>';
            return;
        }

        salesTbody.innerHTML = filtered.map(s => {
            const revenue  = parseFloat(s.total_amount || 0);
            const cost     = parseFloat(s.cost_amount  || 0) || (revenue * 0.70);
            const profit   = revenue - cost;
            const itemsCnt = parseInt(s.items_count   || 0);

            return `
                <tr>
                    <td class="fw-bold text-primary">#INV-${s.id}</td>
                    <td>${fmtDate(s.sale_date)}</td>
                    <td>
                        <div class="fw-semibold">${s.customer_name || 'Walk-in'}</div>
                    </td>
                    <td><span class="badge bg-light text-dark border">${s.payment_method || 'Cash'}</span></td>
                    <td>${itemsCnt} item${itemsCnt !== 1 ? 's' : ''}</td>
                    <td class="fw-bold">₹${fmt(revenue)}</td>
                    <td class="fw-bold text-success">₹${fmt(profit)}</td>
                </tr>`;
        }).join('');
    }

    // ── 4c. PRODUCT PERFORMANCE TABLE (from Flask) ───────────────────────────
    function renderProductTab() {
        if (!productTbody) return;
        if (!perfData.length) {
            productTbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">No product data found.</td></tr>';
            return;
        }

        productTbody.innerHTML = perfData.map(p => {
            let badge = '<span class="badge bg-success">In Stock</span>';
            if (p.status === 'Out of Stock')  badge = '<span class="badge bg-danger">Out of Stock</span>';
            else if (p.status === 'Low Stock') badge = '<span class="badge bg-warning text-dark">Low Stock</span>';
            else if (p.status === 'Slow Moving') badge = '<span class="badge bg-secondary">Slow Moving</span>';

            return `
                <tr>
                    <td>
                        <div class="fw-bold">${p.name}</div>
                        <small class="text-muted">${p.sku || '—'}</small>
                    </td>
                    <td><span class="badge bg-light text-dark border">${p.category}</span></td>
                    <td class="fw-bold">${p.qty_sold}</td>
                    <td class="fw-bold text-primary">₹${fmt(p.revenue)}</td>
                    <td>${p.stock}</td>
                    <td>${badge}</td>
                </tr>`;
        }).join('');
    }

    // ── 4d. CUSTOMER INSIGHTS TABLE (derived from filtered sales) ────────────
    function renderCustomerTab(filtered) {
        if (!customerTbody) return;

        // Group by customer_name
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

    // ── 4e. INVENTORY VALUATION TABLE (from products) ────────────────────────
    function renderInventoryTab() {
        if (!inventoryTbody) return;

        let totalValue = 0, alertCount = 0;

        if (!allProducts.length) {
            inventoryTbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4">No inventory data found.</td></tr>';
        } else {
            inventoryTbody.innerHTML = allProducts.map(p => {
                const stock    = parseInt(p.stock_quantity || 0, 10);
                // mrp used as cost proxy; if mrp=0 estimate 70% of selling_price
                const costPrice  = parseFloat(p.mrp || 0) || (parseFloat(p.selling_price || 0) * 0.70);
                const sellPrice  = parseFloat(p.selling_price || 0);
                const itemValue  = costPrice * stock;
                totalValue      += itemValue;

                let badge = '<span class="badge bg-success">In Stock</span>';
                if (stock === 0)   { badge = '<span class="badge bg-danger">Out of Stock</span>'; alertCount++; }
                else if (stock < 10) { badge = '<span class="badge bg-warning text-dark">Low Stock</span>'; alertCount++; }

                return `
                    <tr>
                        <td class="fw-bold">${p.brand || '—'}</td>
                        <td>${p.name}</td>
                        <td><span class="badge bg-light text-dark border">${p.category || 'General'}</span></td>
                        <td>₹${fmt(costPrice)}</td>
                        <td>₹${fmt(sellPrice)}</td>
                        <td class="fw-bold">${stock}</td>
                        <td class="fw-bold text-primary">₹${fmt(itemValue)}</td>
                        <td>${badge}</td>
                    </tr>`;
            }).join('');
        }

        if (invTotalItems) invTotalItems.textContent = allProducts.length;
        if (invStockValue)  invStockValue.textContent  = `₹${fmt(totalValue)}`;
        if (invAlertCount)  invAlertCount.textContent  = `${alertCount} Items`;
    }

    // ── 5. FILTER CONTROLS ───────────────────────────────────────────────────
    filterPresetDate.addEventListener('change', (e) => {
        const val   = e.target.value;
        const today = new Date();

        filterStartDate.value = '';
        filterEndDate.value   = '';

        if (val === 'today') {
            const d = today.toISOString().split('T')[0];
            filterStartDate.value = d; filterEndDate.value = d;
        } else if (val === 'this_week') {
            const sun = new Date(today); sun.setDate(today.getDate() - today.getDay());
            filterStartDate.value = sun.toISOString().split('T')[0];
            filterEndDate.value   = today.toISOString().split('T')[0];
        } else if (val === 'this_month') {
            const first = new Date(today.getFullYear(), today.getMonth(), 1);
            filterStartDate.value = first.toISOString().split('T')[0];
            filterEndDate.value   = today.toISOString().split('T')[0];
        }
    });

    filterForm.addEventListener('submit', (e) => { e.preventDefault(); renderReports(); });

    btnResetFilter.addEventListener('click', () => {
        filterForm.reset();
        filterStartDate.value = '';
        filterEndDate.value   = '';
        renderReports();
    });

    // ── 6. EXPORT CSV ────────────────────────────────────────────────────────
    btnExportCSV.addEventListener('click', () => {
        const filtered = filterSales();
        if (!filtered.length) { alert('No data to export.'); return; }

        const headers = ['Invoice ID','Date','Customer','Payment Method','Items','Revenue (₹)','Discount (₹)','Est. Profit (₹)'];
        const rows    = filtered.map(s => {
            const rev    = parseFloat(s.total_amount || 0);
            const cost   = parseFloat(s.cost_amount  || 0) || rev * 0.70;
            return [
                `#INV-${s.id}`,
                fmtDate(s.sale_date),
                `"${(s.customer_name || 'Walk-in').replace(/"/g,'""')}"`,
                s.payment_method || 'Cash',
                s.items_count || 0,
                fmt(rev),
                fmt(s.discount || 0),
                fmt(rev - cost)
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

    // ── 7. PRINT ─────────────────────────────────────────────────────────────
    btnPrint.addEventListener('click', () => window.print());

    btnExportPDF.addEventListener('click', () => {
        alert('Click "Print Report" → "Save as PDF" in your browser\'s print dialog.');
    });

    // ── LOADING / ERROR STATES ───────────────────────────────────────────────
    function showLoading() {
        const msg = '<tr><td colspan="8" class="text-center text-muted py-4"><div class="spinner-border spinner-border-sm me-2"></div>Loading from database…</td></tr>';
        [salesTbody, productTbody, customerTbody, inventoryTbody].forEach(t => { if (t) t.innerHTML = msg; });
    }

    function showError(msg) {
        const html = `<tr><td colspan="8" class="text-center text-danger py-4">
            <i class="bi bi-exclamation-triangle display-6 d-block mb-2"></i>
            Could not load report data: ${msg}<br>
            <small class="text-muted">Make sure both servers are running.</small>
        </td></tr>`;
        [salesTbody, productTbody, customerTbody, inventoryTbody].forEach(t => { if (t) t.innerHTML = html; });
    }

    // ── INITIAL LOAD ─────────────────────────────────────────────────────────
    await loadAllData();
});