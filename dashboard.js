// =========================================
// API ENDPOINTS
// =========================================
const NODE_API   = 'http://localhost:5000/api';
const PYTHON_API = 'http://localhost:5001/api';

// =========================================
// ENTRY POINT — single DOMContentLoaded
// =========================================
document.addEventListener('DOMContentLoaded', () => {
    loadDashboard();

    const btnAddStock = document.getElementById('btnAddStockDashboard');
    if (btnAddStock) {
        btnAddStock.addEventListener('click', () => {
            window.location.href = 'product.html?openModal=true';
        });
    }
});

// =========================================
// LOAD ALL DATA FROM SERVERS
// =========================================
async function loadDashboard() {
    clearErrorBanner();
    try {
        const [productsRes, analyticsRes] = await Promise.all([
            fetch(`${NODE_API}/products`),
            fetch(`${PYTHON_API}/analytics/dashboard`)
        ]);

        if (!productsRes.ok)  throw new Error(`Node.js server error (${productsRes.status})`);
        if (!analyticsRes.ok) throw new Error(`Flask server error (${analyticsRes.status})`);

        const products  = await productsRes.json();
        const analytics = await analyticsRes.json();

        updateKPICards(analytics);
        renderRecentTransactions(analytics.recent_sales    || []);
        renderNewStockList(products);
        renderSalesOverviewChart(analytics.last_7_days     || []);
        renderCategoryPieChart(analytics.sales_by_category || {});

    } catch (err) {
        console.error('Dashboard loading error:', err);
        showErrorBanner(err.message);
    }
}

// =========================================
// KPI CARDS  (IDs match Dashboard.html)
// =========================================
function updateKPICards(data) {
    setText('todaySales',    `₹${toFixed2(data.today_sales)}`);
    setText('todayProfit',   `₹${toFixed2(data.today_profit)}`);
    setText('monthlySales',  `₹${toFixed2(data.monthly_sales)}`);
    setText('todayBills',     data.today_bills            ?? 0);
    setText('stockQuantity', `${data.total_stock_quantity ?? 0} Pcs`);
    setText('lowStockItems',  data.low_stock_count         ?? 0);
}

// =========================================
// RECENT TRANSACTIONS TABLE
// =========================================
function renderRecentTransactions(sales) {
    const tbody = document.getElementById('recentTransactionsBody');
    if (!tbody) return;

    if (!sales.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-3">No transactions yet.</td></tr>';
        return;
    }

    tbody.innerHTML = sales.map(sale => {
        const dateStr = new Date(sale.sale_date || sale.created_at).toLocaleDateString('en-IN', {
            day: 'numeric', month: 'short', year: 'numeric'
        });
        return `
            <tr>
                <td class="fw-semibold">#INV-${sale.id}</td>
                <td>${sale.customer_name || 'Walk-in'}</td>
                <td>${dateStr}</td>
                <td class="fw-bold">₹${toFixed2(sale.total_amount)}</td>
                <td><span class="badge bg-success-subtle text-success border border-success-subtle">Paid</span></td>
                <td class="text-end">
                    <a href="invoices.html?id=${sale.id}" class="btn btn-sm btn-light border">
                        <i class="bi bi-eye"></i>
                    </a>
                </td>
            </tr>`;
    }).join('');
}

// =========================================
// NEW STOCK LIST
// =========================================
function renderNewStockList(products) {
    const container = document.getElementById('newStockList');
    if (!container) return;

    if (!products.length) {
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

// =========================================
// CHART 1 — SALES OVERVIEW (LINE)
// FIX: Chart.getChart() destroys ANY existing
// instance on the canvas (including zombies from
// old LocalStorage code / page reloads) before
// creating a new one — not just JS variable tracking
// =========================================
function renderSalesOverviewChart(last7Days) {
    const canvas = document.getElementById('salesOverviewChart');
    if (!canvas) return;

    const existing = Chart.getChart(canvas);
    if (existing) existing.destroy();

    new Chart(canvas, {
        type: 'line',
        data: {
            labels:   last7Days.map(d => formatDateLabel(d.date)),
            datasets: [{
                label:           'Sales (₹)',
                data:            last7Days.map(d => d.total || 0),
                borderColor:     '#0d6efd',
                backgroundColor: 'rgba(13, 110, 253, 0.1)',
                fill:            true,
                tension:         0.3,
                pointRadius:     4
            }]
        },
        options: {
            responsive:          true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales:  { y: { beginAtZero: true } }
        }
    });
}

// =========================================
// CHART 2 — SALES BY CATEGORY (PIE)
// Same Chart.getChart() fix applied here too
// =========================================
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
            labels:   labels.length     ? labels     : ['No Data'],
            datasets: [{
                data:            dataPoints.length ? dataPoints : [1],
                backgroundColor: ['#0d6efd', '#198754', '#ffc107', '#0dcaf0', '#6f42c1', '#fd7e14'],
                borderWidth:     2,
                borderColor:     '#ffffff'
            }]
        },
        options: {
            responsive:          true,
            maintainAspectRatio: false,
            plugins: {
                legend:  { position: 'bottom', labels: { boxWidth: 12, padding: 12 } },
                tooltip: {
                    callbacks: {
                        label: ctx => `${ctx.label}: ₹${Number(ctx.parsed).toFixed(2)}`
                    }
                }
            }
        }
    });
}

// =========================================
// HELPERS
// =========================================
function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function toFixed2(val) {
    return Number(val || 0).toFixed(2);
}

function formatDateLabel(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function clearErrorBanner() {
    const old = document.getElementById('dashboard-error-banner');
    if (old) old.remove();
}

function showErrorBanner(msg) {
    clearErrorBanner();
    const main = document.querySelector('main');
    if (!main) return;
    const banner       = document.createElement('div');
    banner.id          = 'dashboard-error-banner';
    banner.className   = 'alert alert-danger mx-3 mt-3';
    banner.innerHTML   = `<i class="bi bi-exclamation-triangle me-2"></i><strong>Server Error:</strong> ${msg}. Make sure both servers are running.`;
    main.prepend(banner);
}