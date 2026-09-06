document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const filterForm = document.getElementById('filterForm');
    const filterPresetDate = document.getElementById('filterPresetDate');
    const filterStartDate = document.getElementById('filterStartDate');
    const filterEndDate = document.getElementById('filterEndDate');
    const filterCategory = document.getElementById('filterCategory');
    const filterPayment = document.getElementById('filterPayment');
    const filterCustomer = document.getElementById('filterCustomer');
    const btnResetFilter = document.getElementById('btnResetFilter');

    const btnPrint = document.getElementById('btnPrint');
    const btnExportCSV = document.getElementById('btnExportCSV');
    const btnExportPDF = document.getElementById('btnExportPDF');

    // KPI Cards
    const kpiRevenue = document.getElementById('kpiRevenue');
    const kpiCost = document.getElementById('kpiCost');
    const kpiDiscount = document.getElementById('kpiDiscount');
    const kpiProfit = document.getElementById('kpiProfit');
    const kpiSalesCount = document.getElementById('kpiSalesCount');
    const kpiMargin = document.getElementById('kpiMargin');

    // Table Bodies
    const salesReportTableBody = document.getElementById('salesReportTableBody');
    const productReportTableBody = document.getElementById('productReportTableBody');
    const customerReportTableBody = document.getElementById('customerReportTableBody');
    const inventoryReportTableBody = document.getElementById('inventoryReportTableBody');

    // Inventory KPI Elements
    const invTotalItems = document.getElementById('invTotalItems');
    const invStockValue = document.getElementById('invStockValue');
    const invAlertCount = document.getElementById('invAlertCount');

    // Helper for numeric parsing
    function parseNum(val) {
        if (typeof val === 'string') {
            val = val.replace(/[^0-9.-]+/g, ''); // strip currency symbols
        }
        const num = parseFloat(val);
        return isNaN(num) ? 0 : num;
    }

    // Normalized Invoice Data Fetcher
    function getInvoices() {
        const raw = JSON.parse(localStorage.getItem('invoices')) || JSON.parse(localStorage.getItem('sales')) || [];
        return raw.map(inv => {
            const rawAmount = inv.grandTotal ?? inv.total ?? inv.amount ?? 0;
            const rawDiscount = inv.discount ?? 0;

            // Normalize Date
            let rawDate = inv.dateTime || inv.date || inv.timestamp || new Date().toISOString();
            let dateFormatted = rawDate;
            try {
                const parsedDate = new Date(rawDate);
                if (!isNaN(parsedDate.getTime())) {
                    dateFormatted = parsedDate.toISOString().split('T')[0];
                }
            } catch (e) {
                dateFormatted = String(rawDate);
            }

            return {
                id: inv.invoiceNo || inv.id || inv.invoiceId || 'INV-000',
                date: dateFormatted,
                customerName: inv.customerName || inv.customer || 'Walk-in Customer',
                customerPhone: inv.customerContact || inv.customerPhone || inv.phone || 'N/A',
                paymentMethod: inv.paymentMethod || inv.payment || 'Cash',
                discount: parseNum(rawDiscount),
                grandTotal: parseNum(rawAmount),
                items: inv.items || inv.cart || []
            };
        });
    }

    // Normalized Product Data Fetcher
    function getProducts() {
        const raw = JSON.parse(localStorage.getItem('products')) || JSON.parse(localStorage.getItem('inventory')) || [];
        return raw.map(p => {
            const sell = parseNum(p.sellPrice ?? p.price ?? p.sellingPrice ?? 0);
            const buy = parseNum(p.buyPrice ?? p.costPrice ?? p.buyingPrice ?? (sell * 0.7));

            return {
                id: p.id || p.sku || p.code || 'PROD-000',
                sku: p.sku || p.code || p.id || 'N/A',
                name: p.name || p.productName || 'Unnamed Item',
                category: p.category || p.type || 'General',
                price: sell,
                costPrice: buy,
                stock: parseInt(p.stock ?? p.stockQty ?? p.quantity ?? 0, 10)
            };
        });
    }

    // Populate Category Dropdown
    function populateCategories() {
        const products = getProducts();
        const categories = [...new Set(products.map(p => p.category))].filter(Boolean);
        filterCategory.innerHTML = '<option value="all">All Categories</option>';
        categories.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat;
            opt.textContent = cat;
            filterCategory.appendChild(opt);
        });
    }

    // Preset Date Handler
    filterPresetDate.addEventListener('change', (e) => {
        const val = e.target.value;
        const today = new Date();

        if (val === 'today') {
            const dateStr = today.toISOString().split('T')[0];
            filterStartDate.value = dateStr;
            filterEndDate.value = dateStr;
        } else if (val === 'this_week') {
            const firstDay = new Date(today.setDate(today.getDate() - today.getDay()));
            filterStartDate.value = firstDay.toISOString().split('T')[0];
            filterEndDate.value = new Date().toISOString().split('T')[0];
        } else if (val === 'this_month') {
            const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
            filterStartDate.value = firstDay.toISOString().split('T')[0];
            filterEndDate.value = new Date().toISOString().split('T')[0];
        } else {
            filterStartDate.value = '';
            filterEndDate.value = '';
        }
    });

    // Invoice Filter Logic
    function filterInvoices(invoices) {
        const startDate = filterStartDate.value ? new Date(filterStartDate.value) : null;
        const endDate = filterEndDate.value ? new Date(filterEndDate.value + 'T23:59:59') : null;
        const selectedCat = filterCategory.value;
        const selectedPay = filterPayment.value;
        const custQuery = filterCustomer.value.toLowerCase().trim();

        return invoices.filter(inv => {
            const invDate = new Date(inv.date);
            
            if (startDate && !isNaN(invDate.getTime()) && invDate < startDate) return false;
            if (endDate && !isNaN(invDate.getTime()) && invDate > endDate) return false;

            if (selectedPay !== 'all' && inv.paymentMethod.toLowerCase() !== selectedPay.toLowerCase()) return false;

            if (custQuery) {
                const matchName = inv.customerName.toLowerCase().includes(custQuery);
                const matchPhone = inv.customerPhone.toLowerCase().includes(custQuery);
                if (!matchName && !matchPhone) return false;
            }

            if (selectedCat !== 'all') {
                const hasCat = inv.items.some(i => (i.category || i.type || 'General') === selectedCat);
                if (!hasCat) return false;
            }

            return true;
        });
    }

    // Render Data to DOM
    function renderReports() {
        const allInvoices = getInvoices();
        const allProducts = getProducts();
        const filteredInvoices = filterInvoices(allInvoices);

        // Product Cost Map
        const prodCostMap = {};
        allProducts.forEach(p => { prodCostMap[p.name] = p.costPrice; });

        let totalRevenue = 0;
        let totalDiscount = 0;
        let totalEstimatedCost = 0;

        filteredInvoices.forEach(inv => {
            totalRevenue += inv.grandTotal;
            totalDiscount += inv.discount;

            inv.items.forEach(item => {
                const qty = parseInt(item.qty || item.quantity || 1, 10);
                const unitCost = prodCostMap[item.name] || (parseNum(item.buyPrice || item.price) * 0.7);
                totalEstimatedCost += unitCost * qty;
            });
        });

        const totalProfit = totalRevenue - totalEstimatedCost;
        const profitMargin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : '0';

        // Update KPI Cards
        kpiRevenue.textContent = `₹${totalRevenue.toFixed(2)}`;
        kpiCost.textContent = `₹${totalEstimatedCost.toFixed(2)}`;
        kpiDiscount.textContent = `₹${totalDiscount.toFixed(2)}`;
        kpiProfit.textContent = `₹${totalProfit.toFixed(2)}`;
        kpiSalesCount.textContent = `${filteredInvoices.length} Invoices Found`;
        kpiMargin.textContent = `${profitMargin}% Margin`;

        // 1. Sales Report Table
        salesReportTableBody.innerHTML = filteredInvoices.length === 0 ? 
            '<tr><td colspan="7" class="text-center text-muted py-4">No matching sales records found in localStorage.</td></tr>' :
            filteredInvoices.map(inv => {
                let invCost = 0;
                inv.items.forEach(i => {
                    const cost = prodCostMap[i.name] || (parseNum(i.buyPrice || i.price) * 0.7);
                    invCost += cost * parseInt(i.qty || i.quantity || 1, 10);
                });
                const profit = inv.grandTotal - invCost;

                return `
                    <tr>
                        <td class="fw-bold text-primary">${inv.id}</td>
                        <td>${inv.date}</td>
                        <td>
                            <div class="fw-semibold">${inv.customerName}</div>
                            <small class="text-muted">${inv.customerPhone}</small>
                        </td>
                        <td><span class="badge bg-light text-dark border">${inv.paymentMethod}</span></td>
                        <td>${inv.items.length} items</td>
                        <td class="fw-bold">₹${inv.grandTotal.toFixed(2)}</td>
                        <td class="fw-bold text-success">₹${profit.toFixed(2)}</td>
                    </tr>`;
            }).join('');

        // 2. Product Performance Table
        const productStats = {};
        allProducts.forEach(p => {
            productStats[p.name] = { sku: p.sku, category: p.category, qtySold: 0, revenue: 0, stock: p.stock };
        });

        filteredInvoices.forEach(inv => {
            inv.items.forEach(item => {
                const name = item.name || item.productName || 'Unknown Product';
                const qty = parseInt(item.qty || item.quantity || 1, 10);
                const price = parseNum(item.price || item.sellPrice);

                if (!productStats[name]) {
                    productStats[name] = { sku: item.sku || 'N/A', category: item.category || 'General', qtySold: 0, revenue: 0, stock: 0 };
                }
                productStats[name].qtySold += qty;
                productStats[name].revenue += price * qty;
            });
        });

        const productList = Object.keys(productStats).map(name => ({ name, ...productStats[name] }));
        productList.sort((a, b) => b.qtySold - a.qtySold);

        productReportTableBody.innerHTML = productList.length === 0 ?
            '<tr><td colspan="6" class="text-center text-muted py-4">No product sales found.</td></tr>' :
            productList.map(p => {
                let badge = '<span class="badge bg-success">In Stock</span>';
                if (p.stock === 0) badge = '<span class="badge bg-danger">Out of Stock</span>';
                else if (p.stock <= 10) badge = '<span class="badge bg-warning text-dark">Low Stock</span>';
                else if (p.qtySold === 0) badge = '<span class="badge bg-secondary">Slow Moving</span>';

                return `
                    <tr>
                        <td>
                            <div class="fw-bold">${p.name}</div>
                            <small class="text-muted">${p.sku}</small>
                        </td>
                        <td><span class="badge bg-light text-dark border">${p.category}</span></td>
                        <td class="fw-bold">${p.qtySold}</td>
                        <td class="fw-bold text-primary">₹${p.revenue.toFixed(2)}</td>
                        <td>${p.stock}</td>
                        <td>${badge}</td>
                    </tr>`;
            }).join('');

        // 3. Customer Insights Table
        const customerStats = {};
        filteredInvoices.forEach(inv => {
            const key = `${inv.customerName}_${inv.customerPhone}`;
            if (!customerStats[key]) {
                customerStats[key] = { name: inv.customerName, phone: inv.customerPhone, orders: 0, totalSpent: 0, lastDate: inv.date };
            }
            customerStats[key].orders += 1;
            customerStats[key].totalSpent += inv.grandTotal;
            customerStats[key].lastDate = inv.date;
        });

        const customerList = Object.values(customerStats);
        customerList.sort((a, b) => b.totalSpent - a.totalSpent);

        customerReportTableBody.innerHTML = customerList.length === 0 ?
            '<tr><td colspan="5" class="text-center text-muted py-4">No customer records found.</td></tr>' :
            customerList.map(c => `
                <tr>
                    <td class="fw-bold">${c.name}</td>
                    <td>${c.phone}</td>
                    <td><span class="badge bg-info text-dark">${c.orders} orders</span></td>
                    <td class="fw-bold text-success">₹${c.totalSpent.toFixed(2)}</td>
                    <td><small class="text-muted">${c.lastDate}</small></td>
                </tr>
            `).join('');

        // 4. Inventory Valuation Table
        let totalValuation = 0;
        let alertCount = 0;

        inventoryReportTableBody.innerHTML = allProducts.length === 0 ?
            '<tr><td colspan="8" class="text-center text-muted py-4">No inventory data found.</td></tr>' :
            allProducts.map(p => {
                const itemValuation = p.costPrice * p.stock;
                totalValuation += itemValuation;

                let statusBadge = '<span class="badge bg-success">In Stock</span>';
                if (p.stock === 0) {
                    statusBadge = '<span class="badge bg-danger">Out of Stock</span>';
                    alertCount++;
                } else if (p.stock <= 10) {
                    statusBadge = '<span class="badge bg-warning text-dark">Low Stock</span>';
                    alertCount++;
                }

                return `
                    <tr>
                        <td class="fw-bold">${p.sku}</td>
                        <td>${p.name}</td>
                        <td><span class="badge bg-light text-dark border">${p.category}</span></td>
                        <td>₹${p.costPrice.toFixed(2)}</td>
                        <td>₹${p.price.toFixed(2)}</td>
                        <td class="fw-bold">${p.stock}</td>
                        <td class="fw-bold text-primary">₹${itemValuation.toFixed(2)}</td>
                        <td>${statusBadge}</td>
                    </tr>`;
            }).join('');

        invTotalItems.textContent = allProducts.length;
        invStockValue.textContent = `₹${totalValuation.toFixed(2)}`;
        invAlertCount.textContent = `${alertCount} Items`;
    }

    // Event Listeners
    filterForm.addEventListener('submit', (e) => {
        e.preventDefault();
        renderReports();
    });

    btnResetFilter.addEventListener('click', () => {
        filterForm.reset();
        filterStartDate.value = '';
        filterEndDate.value = '';
        renderReports();
    });

    btnPrint.addEventListener('click', () => {
        window.print();
    });

    btnExportCSV.addEventListener('click', () => {
        const invoices = filterInvoices(getInvoices());
        if (invoices.length === 0) {
            alert('No data available to export.');
            return;
        }

        const headers = ['Invoice ID', 'Date', 'Customer Name', 'Phone', 'Payment Method', 'Grand Total (INR)', 'Discount (INR)'];
        const rows = invoices.map(i => [
            i.id,
            i.date,
            `"${i.customerName.replace(/"/g, '""')}"`,
            `"${i.customerPhone.replace(/"/g, '""')}"`,
            i.paymentMethod,
            i.grandTotal.toFixed(2),
            i.discount.toFixed(2)
        ].join(','));

        const csvContent = [headers.join(','), ...rows].join('\n');
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `SalesReport_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    btnExportPDF.addEventListener('click', () => {
        alert('Use "Print Report" -> "Save as PDF" to render/export as PDF.');
    });

    // Initial Load
    populateCategories();
    renderReports();
});