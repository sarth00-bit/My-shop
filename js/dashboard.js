// =========================================
// dashboard.js — uses config.js for API URL
// NODE_API and PYTHON_API come from config.js
// =========================================

const REFRESH_INTERVAL_MS = 15000;
let refreshTimer = null;

document.addEventListener('DOMContentLoaded', () => {
    loadDashboard();
    startAutoRefresh();

    const btnAddStock = document.getElementById('btnAddStockDashboard');
    if (btnAddStock) {
        btnAddStock.addEventListener('click', () => {
            window.location.href = 'product.html?openModal=true';
        });
    }

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            loadDashboard();
            restartAutoRefresh();
        }
    });
});

function startAutoRefresh() {
    refreshTimer = setInterval(loadDashboard, REFRESH_INTERVAL_MS);
    updateRefreshBadge();
}
function restartAutoRefresh() {
    if (refreshTimer) clearInterval(refreshTimer);
    startAutoRefresh();
}
function updateRefreshBadge() {
    const badge = document.getElementById('dashboardRefreshBadge');
    const ts    = document.getElementById('dashboardLastUpdated');
    if (badge) badge.classList.remove('d-none');
    if (ts)    ts.textContent = `Last updated: ${new Date().toLocaleTimeString('en-IN', {
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    })}`;
}

// =========================================
// MAIN LOAD — Node.js and Flask load
// independently. Flask failure never blocks
// products or sales from appearing.
// =========================================
async function loadDashboard() {
    clearBanners();

    // 1. Products from Node.js (required)
    let products = [];
    try {
        const res = await apiFetch(`${NODE_API}/products`);
        if (!res.ok) throw new Error(`Node.js error (${res.status})`);
        products = await res.json();
        renderNewStockList(products);
    } catch (err) {
        console.error('Products load error:', err);
        showErrorBanner(`Could not load products: ${err.message}`);
        return;
    }

    // 2. Recent sales from Node.js (non-blocking)
    let salesData = [];
    try {
        const res = await apiFetch(`${NODE_API}/sales`);
        if (res.ok) {
            salesData = await res.json();
            renderRecentTransactions(salesData.slice(0, 10));
            buildFallbackKPIs(salesData, products);
        }
    } catch (err) {
        console.warn('Sales load error (non-fatal):', err);
    }

    // 3. Flask analytics (non-blocking — soft warning if down)
    try {
        const res = await apiFetch(`${PYTHON_API}/analytics/dashboard`);
        if (!res.ok) throw new Error(`Flask ${res.status}`);
        const analytics = await res.json();

        updateKPICards(analytics);
        renderRecentTransactions(analytics.recent_sales || salesData.slice(0, 10));
        renderSalesOverviewChart(analytics.last_7_days     || []);
        renderCategoryPieChart(analytics.sales_by_category || {});
    } catch (err) {
        console.warn('Flask offline (non-fatal):', err);
        showWarningBanner('Analytics server (Flask) is offline — start it to see full KPIs and charts. Products and sales are still loading from Node.js.');
        renderSalesOverviewChart([]);
        renderCategoryPieChart({});
    }

    updateRefreshBadge();
}

// Derive KPIs from Node.js sales when Flask is offline
function buildFallbackKPIs(sales, products) {
    const today      = new Date().toLocaleDateString('en-CA');
    const monthStart = today.slice(0, 7);
    let todaySales = 0, todayBills = 0, monthlySales = 0;
    sales.forEach(s => {
        const d = (s.sale_date || '').slice(0, 10);
        if (d === today)              { todaySales += parseFloat(s.total_amount || 0); todayBills++; }
        if (d.startsWith(monthStart))   monthlySales += parseFloat(s.total_amount || 0);
    });
    const totalStock = products.reduce((n, p) => n + parseInt(p.stock_quantity || 0), 0);
    const lowStock   = products.filter(p => parseInt(p.stock_quantity || 0) < 10).length;
    updateKPICards({
        today_sales: todaySales, today_profit: todaySales * 0.30,
        monthly_sales: monthlySales, today_bills: todayBills,
        total_stock_quantity: totalStock, low_stock_count: lowStock
    });
}

function updateKPICards(data) {
    setText('todaySales',    `₹${toFixed2(data.today_sales)}`);
    setText('todayProfit',   `₹${toFixed2(data.today_profit)}`);
    setText('monthlySales',  `₹${toFixed2(data.monthly_sales)}`);
    setText('todayBills',     data.today_bills            ?? 0);
    setText('stockQuantity', `${data.total_stock_quantity ?? 0} Pcs`);
    setText('lowStockItems',  data.low_stock_count         ?? 0);
}

function renderRecentTransactions(sales) {
    const tbody = document.getElementById('recentTransactionsBody');
    if (!tbody) return;
    if (!sales || !sales.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-3">No transactions yet.</td></tr>';
        return;
    }
    tbody.innerHTML = sales.map(sale => {
        const dt      = new Date(sale.sale_date);
        const dateStr = isNaN(dt) ? '—' : dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        return `
            <tr>
                <td class="fw-semibold">#INV-${sale.id}</td>
                <td>${sale.customer_name || 'Walk-in'}</td>
                <td>${dateStr}</td>
                <td class="fw-bold">₹${toFixed2(sale.total_amount)}</td>
                <td><span class="badge bg-success-subtle text-success border border-success-subtle">Paid</span></td>
                <td class="text-end">
                    <a href="invoices.html?id=${sale.id}" class="btn btn-sm btn-light border" title="View Invoice">
                        <i class="bi bi-eye"></i>
                    </a>
                </td>
            </tr>`;
    }).join('');
}

function renderNewStockList(products) {
    const container = document.getElementById('newStockList');
    if (!container) return;
    if (!products || !products.length) {
        container.innerHTML = '<li class="list-group-item text-center text-muted py-3">No products available.</li>';
        return;
    }
    const recent = [...products].sort((a, b) => b.id - a.id).slice(0, 4);
    container.innerHTML = recent.map(p => `
        <li class="list-group-item d-flex justify-content-between align-items-center py-2 px-3">
            <div class="d-flex align-items-center gap-2">
                <i class="bi bi-box-seam text-secondary"></i>
                <span class="fw-semibold text-dark">${p.name || 'Unnamed'}</span>
                <small class="text-muted">(${p.category || 'General'})</small>
            </div>
            <span class="badge bg-success-subtle text-success border border-success-subtle px-2 py-1 rounded-pill fw-bold">
                ${p.stock_quantity ?? 0} Pcs
            </span>
        </li>
    `).join('');
}

function renderSalesOverviewChart(last7Days) {
    const canvas = document.getElementById('salesOverviewChart');
    if (!canvas) return;
    const existing = Chart.getChart(canvas);
    if (existing) existing.destroy();
    const hasData = last7Days && last7Days.length;
    new Chart(canvas, {
        type: 'line',
        data: {
            labels:   hasData ? last7Days.map(d => formatDateLabel(d.date)) : ['No data'],
            datasets: [{
                label: 'Sales (₹)', data: hasData ? last7Days.map(d => d.total || 0) : [0],
                borderColor: '#0d6efd', backgroundColor: 'rgba(13,110,253,0.1)',
                fill: true, tension: 0.3, pointRadius: 4
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });
}

function renderCategoryPieChart(categoryTotals) {
    const canvas = document.getElementById('salesCategoryChart');
    if (!canvas) return;
    const existing = Chart.getChart(canvas);
    if (existing) existing.destroy();
    const labels     = Object.keys(categoryTotals);
    const dataPoints = Object.values(categoryTotals);
    new Chart(canvas, {
        type: 'pie',
        data: {
            labels:   labels.length ? labels : ['No Data'],
            datasets: [{ data: dataPoints.length ? dataPoints : [1],
                backgroundColor: ['#0d6efd','#198754','#ffc107','#0dcaf0','#6f42c1','#fd7e14'],
                borderWidth: 2, borderColor: '#ffffff' }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend:  { position: 'bottom', labels: { boxWidth: 12, padding: 12 } },
                tooltip: { callbacks: { label: ctx => `${ctx.label}: ₹${Number(ctx.parsed).toFixed(2)}` } }
            }
        }
    });
}

// Helpers
function setText(id, value) { const el = document.getElementById(id); if (el) el.textContent = value; }
function toFixed2(val)      { return Number(val || 0).toFixed(2); }
function formatDateLabel(d) { return new Date(d + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }); }

function clearBanners() {
    document.getElementById('dashboard-error-banner')?.remove();
    document.getElementById('dashboard-warning-banner')?.remove();
}
function showErrorBanner(msg) {
    const main = document.querySelector('main');
    if (!main) return;
    const b = document.createElement('div');
    b.id = 'dashboard-error-banner'; b.className = 'alert alert-danger mx-3 mt-3';
    b.innerHTML = `<i class="bi bi-exclamation-triangle me-2"></i><strong>Error:</strong> ${msg}`;
    main.prepend(b);
}
function showWarningBanner(msg) {
    const main = document.querySelector('main');
    if (!main) return;
    const b = document.createElement('div');
    b.id = 'dashboard-warning-banner'; b.className = 'alert alert-warning mx-3 mt-3';
    b.innerHTML = `<i class="bi bi-exclamation-circle me-2"></i>${msg}`;
    main.prepend(b);
}
