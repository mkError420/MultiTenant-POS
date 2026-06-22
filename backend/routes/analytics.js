const express = require('express');
const db = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

/**
 * @route   GET /api/analytics/revenue
 * @desc    Fetch revenue breakdown: sales revenue, product buying costs, other costs, net profits
 * @access  Private (shop_admin)
 */
router.get('/revenue', authorize(['super_admin', 'shop_admin']), async (req, res) => {
  const shopId = req.shopId;
  const hasShop = shopId !== null && shopId !== undefined;
  const { start_date, end_date } = req.query;

  try {
    // 1. Calculate Sales Revenue
    let salesQuery = 'SELECT SUM(final_amount) AS total_sales, COUNT(id) AS sales_count FROM sales WHERE ' + (hasShop ? 'shop_id = ?' : '1=1');
    const salesParams = hasShop ? [shopId] : [];
    if (start_date && end_date) {
      salesQuery += ' AND created_at BETWEEN ? AND ?';
      salesParams.push(`${start_date} 00:00:00`, `${end_date} 23:59:59`);
    }
    const [salesRows] = await db.query(salesQuery, salesParams);
    const totalSales = parseFloat(salesRows[0].total_sales || 0);
    const salesCount = parseInt(salesRows[0].sales_count || 0);

    // 2. Calculate Cost of Goods Sold (COGS) based on actual sales items and cost price of products
    let cogsQuery = `
      SELECT SUM(si.quantity * p.cost_price) AS cogs 
      FROM sale_items si 
      JOIN products p ON si.product_id = p.id
      JOIN sales s ON si.sale_id = s.id
      WHERE ` + (hasShop ? 'si.shop_id = ?' : '1=1');
    const cogsParams = hasShop ? [shopId] : [];
    if (start_date && end_date) {
      cogsQuery += ' AND s.created_at BETWEEN ? AND ?';
      cogsParams.push(`${start_date} 00:00:00`, `${end_date} 23:59:59`);
    }
    const [cogsRows] = await db.query(cogsQuery, cogsParams);
    const totalCOGS = parseFloat(cogsRows[0].cogs || 0);

    // 3. Calculate Product Purchasing Costs (Received POs)
    let poQuery = "SELECT SUM(total_amount) AS total_purchased FROM purchase_orders WHERE " + (hasShop ? "shop_id = ?" : "1=1") + " AND status = 'received'";
    const poParams = hasShop ? [shopId] : [];
    if (start_date && end_date) {
      poQuery += ' AND received_date BETWEEN ? AND ?';
      poParams.push(`${start_date} 00:00:00`, `${end_date} 23:59:59`);
    }
    const [poRows] = await db.query(poQuery, poParams);
    const totalPurchasing = parseFloat(poRows[0].total_purchased || 0);

    // 4. Calculate Other Costs
    let otherQuery = 'SELECT SUM(amount) AS total_other_costs FROM other_costs WHERE ' + (hasShop ? 'shop_id = ?' : '1=1');
    const otherParams = hasShop ? [shopId] : [];
    if (start_date && end_date) {
      otherQuery += ' AND cost_date BETWEEN ? AND ?';
      otherParams.push(start_date, end_date);
    }
    const [otherRows] = await db.query(otherQuery, otherParams);
    const totalOther = parseFloat(otherRows[0].total_other_costs || 0);

    // 5. Calculate Wastage Loss (Cost of Damage/Wastage)
    let wastageQuery = 'SELECT SUM(cost_loss) AS total_wastage FROM wastages WHERE ' + (hasShop ? 'shop_id = ?' : '1=1');
    const wastageParams = hasShop ? [shopId] : [];
    if (start_date && end_date) {
      wastageQuery += ' AND adjusted_at BETWEEN ? AND ?';
      wastageParams.push(start_date, end_date);
    }
    const [wastageRows] = await db.query(wastageQuery, wastageParams);
    const totalWastage = parseFloat(wastageRows[0].total_wastage || 0);

    // Calculate Net Profits
    const netProfitCOGS = totalSales - totalCOGS - totalOther - totalWastage;
    const netProfitCashflow = totalSales - totalPurchasing - totalOther - totalWastage;

    // Calculate 7-Day Trend for Trading Profitability (COGS Basis) and Cashflow
    const trendMap = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      trendMap[dateStr] = { date: dateStr, sales_revenue: 0, cost_of_goods_sold: 0, other_costs: 0, wastage_loss: 0, inventory_purchasing_cost: 0, net_profit_cogs: 0, net_profit_cashflow: 0 };
    }

    // Query daily sales
    let trendSalesQuery = 'SELECT DATE_FORMAT(created_at, "%Y-%m-%d") AS date, SUM(final_amount) AS revenue FROM sales WHERE ' + (hasShop ? 'shop_id = ?' : '1=1') + ' AND created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY) GROUP BY DATE(created_at)';
    const [trendSalesRows] = await db.query(trendSalesQuery, salesParams.slice(0, hasShop ? 1 : 0));
    trendSalesRows.forEach(row => {
      if (trendMap[row.date]) trendMap[row.date].sales_revenue = parseFloat(row.revenue || 0);
    });

    // Query daily COGS
    let trendCogsQuery = `
      SELECT DATE_FORMAT(s.created_at, "%Y-%m-%d") AS date, SUM(si.quantity * p.cost_price) AS cogs 
      FROM sale_items si 
      JOIN products p ON si.product_id = p.id
      JOIN sales s ON si.sale_id = s.id
      WHERE ` + (hasShop ? 'si.shop_id = ?' : '1=1') + ` AND s.created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
      GROUP BY DATE(s.created_at)`;
    const [trendCogsRows] = await db.query(trendCogsQuery, cogsParams.slice(0, hasShop ? 1 : 0));
    trendCogsRows.forEach(row => {
      if (trendMap[row.date]) trendMap[row.date].cost_of_goods_sold = parseFloat(row.cogs || 0);
    });

    // Query daily Other Costs
    let trendOtherQuery = 'SELECT DATE_FORMAT(cost_date, "%Y-%m-%d") AS date, SUM(amount) AS other FROM other_costs WHERE ' + (hasShop ? 'shop_id = ?' : '1=1') + ' AND cost_date >= DATE_SUB(CURDATE(), INTERVAL 6 DAY) GROUP BY DATE(cost_date)';
    const [trendOtherRows] = await db.query(trendOtherQuery, otherParams.slice(0, hasShop ? 1 : 0));
    trendOtherRows.forEach(row => {
      if (trendMap[row.date]) trendMap[row.date].other_costs = parseFloat(row.other || 0);
    });

    // Query daily Wastages
    let trendWastageQuery = 'SELECT DATE_FORMAT(adjusted_at, "%Y-%m-%d") AS date, SUM(cost_loss) AS wastage FROM wastages WHERE ' + (hasShop ? 'shop_id = ?' : '1=1') + ' AND adjusted_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY) GROUP BY DATE(adjusted_at)';
    const [trendWastageRows] = await db.query(trendWastageQuery, wastageParams.slice(0, hasShop ? 1 : 0));
    trendWastageRows.forEach(row => {
      if (trendMap[row.date]) trendMap[row.date].wastage_loss = parseFloat(row.wastage || 0);
    });

    // Query daily PO purchasing
    let trendPoQuery = 'SELECT DATE_FORMAT(received_date, "%Y-%m-%d") AS date, SUM(total_amount) AS total FROM purchase_orders WHERE ' + (hasShop ? 'shop_id = ?' : '1=1') + ' AND status = \'received\' AND received_date >= DATE_SUB(CURDATE(), INTERVAL 6 DAY) GROUP BY DATE(received_date)';
    const [trendPoRows] = await db.query(trendPoQuery, poParams.slice(0, hasShop ? 1 : 0));
    trendPoRows.forEach(row => {
      if (trendMap[row.date]) trendMap[row.date].inventory_purchasing_cost = parseFloat(row.total || 0);
    });

    // Calculate daily Net Profit (Trading & Cashflow)
    Object.keys(trendMap).forEach(dateStr => {
      const d = trendMap[dateStr];
      d.net_profit_cogs = d.sales_revenue - d.cost_of_goods_sold - d.other_costs - d.wastage_loss;
      d.net_profit_cashflow = d.sales_revenue - d.inventory_purchasing_cost - d.other_costs - d.wastage_loss;
    });

    const trend = Object.values(trendMap);

    res.json({
      sales_revenue: totalSales,
      sales_count: salesCount,
      cost_of_goods_sold: totalCOGS,
      inventory_purchasing_cost: totalPurchasing,
      other_costs: totalOther,
      wastage_loss: totalWastage,
      net_profit_cogs: netProfitCOGS,
      net_profit_cashflow: netProfitCashflow,
      trend: trend
    });
  } catch (error) {
    console.error('Revenue breakdown error:', error);
    res.status(500).json({ error: 'Server error generating revenue analytics.' });
  }
});

/**
 * @route   GET /api/analytics
 * @desc    Fetch analytics dashboard data.
 *          Super Admin: Global overview (total shops, global revenue, active users).
 *          Shop Admin/Staff: Tenant dashboard metrics (revenue, sales count, low stock warnings).
 * @access  Private
 */
router.get('/', async (req, res) => {
  const { role, shop_id } = req.user;

  try {
    if (role === 'super_admin') {
      // 1. Super Admin Global Analytics
      const [shopStats] = await db.query(
        'SELECT COUNT(*) as total_shops, SUM(CASE WHEN status = "active" THEN 1 ELSE 0 END) as active_shops FROM shops'
      );
      
      const [userStats] = await db.query(
        'SELECT COUNT(*) as total_users FROM users WHERE role != "super_admin"'
      );

      const [salesStats] = await db.query(
        'SELECT COUNT(*) as total_sales, SUM(final_amount) as global_revenue FROM sales'
      );

      // Fetch sales trend grouped by shop name
      const [tenantSales] = await db.query(`
        SELECT sh.name as shop_name, COUNT(s.id) as sales_count, SUM(s.final_amount) as shop_revenue
        FROM shops sh
        LEFT JOIN sales s ON sh.id = s.shop_id
        GROUP BY sh.id
        ORDER BY shop_revenue DESC
      `);

      return res.json({
        dashboard_type: 'super_admin',
        metrics: {
          total_shops: shopStats[0].total_shops,
          active_shops: shopStats[0].active_shops,
          total_users: userStats[0].total_users,
          total_sales: salesStats[0].total_sales,
          global_revenue: parseFloat(salesStats[0].global_revenue || 0).toFixed(2)
        },
        tenant_breakdown: tenantSales
      });

    } else {
      // 2. Tenant Specific (Shop Admin & Staff) Analytics
      const shopId = req.shopId; // Locked by authenticate middleware

      const [salesStats] = await db.query(
        'SELECT COUNT(*) as sales_count, SUM(final_amount) as revenue FROM sales WHERE shop_id = ?',
        [shopId]
      );

      const [productStats] = await db.query(`
        SELECT COUNT(*) as total_products,
               SUM(CASE WHEN stock_quantity <= low_stock_threshold THEN 1 ELSE 0 END) as low_stock_count
        FROM products 
        WHERE shop_id = ?
      `, [shopId]);

      const [customerStats] = await db.query(
        'SELECT COUNT(*) as total_customers FROM customers WHERE shop_id = ?',
        [shopId]
      );

      // Get recent transaction feed
      const [recentSales] = await db.query(`
        SELECT s.id, s.final_amount, s.payment_method, s.created_at, u.name as staff_name 
        FROM sales s
        JOIN users u ON s.user_id = u.id
        WHERE s.shop_id = ? 
        ORDER BY s.created_at DESC 
        LIMIT 5
      `, [shopId]);

      // Get 7-day sales trend
      const [trendRows] = await db.query(`
        SELECT DATE_FORMAT(created_at, '%Y-%m-%d') as sale_date,
               SUM(final_amount) as daily_revenue,
               COUNT(id) as daily_sales
        FROM sales
        WHERE shop_id = ? AND created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
        GROUP BY DATE(created_at)
        ORDER BY sale_date ASC
      `, [shopId]);

      // Populate last 7 days to guarantee 7 points even if some days have 0 sales
      const trendMap = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        trendMap[dateStr] = { date: dateStr, revenue: 0, sales_count: 0 };
      }

      trendRows.forEach(row => {
        if (trendMap[row.sale_date]) {
          trendMap[row.sale_date].revenue = parseFloat(row.daily_revenue || 0);
          trendMap[row.sale_date].sales_count = parseInt(row.daily_sales || 0);
        }
      });

      const salesTrend = Object.values(trendMap);

      return res.json({
        dashboard_type: 'tenant',
        metrics: {
          total_sales: salesStats[0].sales_count,
          revenue: parseFloat(salesStats[0].revenue || 0).toFixed(2),
          total_products: productStats[0].total_products,
          low_stock_alerts: productStats[0].low_stock_count || 0,
          total_customers: customerStats[0].total_customers
        },
        recent_sales: recentSales,
        sales_trend: salesTrend
      });
    }
  } catch (error) {
    console.error('Analytics fetch error:', error);
    res.status(500).json({ error: 'Server error generating dashboard analytics.' });
  }
});

/**
 * @desc    Fetch balance sheet data: assets (cash, inventory, receivables), liabilities, and equity
 * @access  Private (super_admin, shop_admin)
 */
router.get('/balance-sheet', authorize(['super_admin', 'shop_admin']), async (req, res) => {
  const isSuperAdmin = req.user.role === 'super_admin';
  let targetShopId = req.shopId;
  if (isSuperAdmin && req.query.shop_id) {
    targetShopId = parseInt(req.query.shop_id);
  }
  const hasShop = targetShopId !== null && targetShopId !== undefined;
  const queryParams = hasShop ? [targetShopId] : [];
  const { end_date } = req.query;

  try {
    // 1. ASSETS
    
    // 1a. Cash & Cash Equivalents (Sales paid - POs received - Other Costs)
    let salesPaidQuery = 'SELECT SUM(paid_amount) AS total_paid FROM sales WHERE ' + (hasShop ? 'shop_id = ?' : '1=1');
    const salesPaidParams = [...queryParams];
    if (end_date) {
      salesPaidQuery += ' AND created_at <= ?';
      salesPaidParams.push(`${end_date} 23:59:59`);
    }
    const [salesPaidRows] = await db.query(salesPaidQuery, salesPaidParams);
    const totalSalesPaid = parseFloat(salesPaidRows[0].total_paid || 0);

    let poQuery = "SELECT SUM(total_amount) AS total_purchased FROM purchase_orders WHERE status = 'received' AND " + (hasShop ? 'shop_id = ?' : '1=1');
    const poParams = [...queryParams];
    if (end_date) {
      poQuery += ' AND received_date <= ?';
      poParams.push(`${end_date} 23:59:59`);
    }
    const [poRows] = await db.query(poQuery, poParams);
    const totalPurchased = parseFloat(poRows[0].total_purchased || 0);

    let otherQuery = 'SELECT SUM(amount) AS total_other FROM other_costs WHERE ' + (hasShop ? 'shop_id = ?' : '1=1');
    const otherParams = [...queryParams];
    if (end_date) {
      otherQuery += ' AND cost_date <= ?';
      otherParams.push(end_date);
    }
    const [otherRows] = await db.query(otherQuery, otherParams);
    const totalOther = parseFloat(otherRows[0].total_other || 0);

    const cashOnHand = totalSalesPaid - totalPurchased - totalOther;

    // 1b. Inventory Asset Value (Current Stock * cost_price)
    // Reconstruct historical inventory value up to end_date:
    // Current Inventory Value - POs received after end_date + COGS after end_date + Wastage after end_date
    const liveInventoryValQuery = 'SELECT SUM(stock_quantity * cost_price) AS total_inventory FROM products WHERE ' + (hasShop ? 'shop_id = ?' : '1=1');
    const [liveInventoryRows] = await db.query(liveInventoryValQuery, queryParams);
    const liveInventoryValue = parseFloat(liveInventoryRows[0].total_inventory || 0);

    let totalInventoryValue = liveInventoryValue;
    if (end_date) {
      // POs received after end_date
      let poAfterQuery = `
        SELECT SUM(poi.quantity_received * poi.cost_price) AS val 
        FROM purchase_order_items poi 
        JOIN purchase_orders po ON poi.purchase_order_id = po.id 
        WHERE po.status = 'received' AND po.received_date > ? AND ` + (hasShop ? 'po.shop_id = ?' : '1=1');
      const [poAfterRows] = await db.query(poAfterQuery, [`${end_date} 23:59:59`, ...queryParams]);
      const poAfterVal = parseFloat(poAfterRows[0].val || 0);

      // COGS sold after end_date
      let cogsAfterQuery = `
        SELECT SUM(si.quantity * p.cost_price) AS val 
        FROM sale_items si 
        JOIN products p ON si.product_id = p.id 
        JOIN sales s ON si.sale_id = s.id 
        WHERE s.created_at > ? AND ` + (hasShop ? 's.shop_id = ?' : '1=1');
      const [cogsAfterRows] = await db.query(cogsAfterQuery, [`${end_date} 23:59:59`, ...queryParams]);
      const cogsAfterVal = parseFloat(cogsAfterRows[0].val || 0);

      // Wastage after end_date
      let wastageAfterQuery = 'SELECT SUM(cost_loss) AS val FROM wastages WHERE adjusted_at > ? AND ' + (hasShop ? 'shop_id = ?' : '1=1');
      const [wastageAfterRows] = await db.query(wastageAfterQuery, [end_date, ...queryParams]);
      const wastageAfterVal = parseFloat(wastageAfterRows[0].val || 0);

      totalInventoryValue = liveInventoryValue - poAfterVal + cogsAfterVal + wastageAfterVal;
    }

    // 1c. Accounts Receivable (Customer Dues up to end_date)
    let receivableQuery = 'SELECT SUM(due_amount) AS total_receivable FROM sales WHERE ' + (hasShop ? 'shop_id = ?' : '1=1');
    const receivableParams = [...queryParams];
    if (end_date) {
      receivableQuery += ' AND created_at <= ?';
      receivableParams.push(`${end_date} 23:59:59`);
    }
    const [receivableRows] = await db.query(receivableQuery, receivableParams);
    const totalReceivable = parseFloat(receivableRows[0].total_receivable || 0);

    const totalAssets = cashOnHand + totalInventoryValue + totalReceivable;

    // 2. LIABILITIES
    const accountsPayable = 0.0;
    const totalLiabilities = accountsPayable;

    // 3. OWNER'S EQUITY
    
    // 3a. Retained Earnings components (Sales total - COGS total - Other costs total - Wastage total)
    let salesTotalQuery = 'SELECT SUM(final_amount) AS total_sales FROM sales WHERE ' + (hasShop ? 'shop_id = ?' : '1=1');
    const salesTotalParams = [...queryParams];
    if (end_date) {
      salesTotalQuery += ' AND created_at <= ?';
      salesTotalParams.push(`${end_date} 23:59:59`);
    }
    const [salesTotalRows] = await db.query(salesTotalQuery, salesTotalParams);
    const totalSales = parseFloat(salesTotalRows[0].total_sales || 0);

    let cogsQuery = `
      SELECT SUM(si.quantity * p.cost_price) AS total_cogs 
      FROM sale_items si 
      JOIN products p ON si.product_id = p.id
      JOIN sales s ON si.sale_id = s.id
      WHERE ` + (hasShop ? 'si.shop_id = ?' : '1=1');
    const cogsParams = [...queryParams];
    if (end_date) {
      cogsQuery += ' AND s.created_at <= ?';
      cogsParams.push(`${end_date} 23:59:59`);
    }
    const [cogsRows] = await db.query(cogsQuery, cogsParams);
    const totalCOGS = parseFloat(cogsRows[0].total_cogs || 0);

    let wastageQuery = 'SELECT SUM(cost_loss) AS total_wastage FROM wastages WHERE ' + (hasShop ? 'shop_id = ?' : '1=1');
    const wastageParams = [...queryParams];
    if (end_date) {
      wastageQuery += ' AND adjusted_at <= ?';
      wastageParams.push(end_date);
    }
    const [wastageRows] = await db.query(wastageQuery, wastageParams);
    const totalWastage = parseFloat(wastageRows[0].total_wastage || 0);

    const retainedEarnings = totalSales - totalCOGS - totalOther - totalWastage;

    // 3b. Owner's Capital (balancing figure: Assets - Liabilities - Retained Earnings)
    const ownersCapital = totalAssets - totalLiabilities - retainedEarnings;
    const totalEquity = ownersCapital + retainedEarnings;
    
    const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;

    res.json({
      asOfDate: end_date || new Date().toISOString().split('T')[0],
      assets: {
        cash_on_hand: cashOnHand,
        inventory_value: totalInventoryValue,
        accounts_receivable: totalReceivable,
        total_assets: totalAssets
      },
      liabilities: {
        accounts_payable: accountsPayable,
        total_liabilities: totalLiabilities
      },
      equity: {
        retained_earnings: retainedEarnings,
        owners_capital: ownersCapital,
        total_equity: totalEquity
      },
      total_liabilities_and_equity: totalLiabilitiesAndEquity
    });
  } catch (error) {
    console.error('Balance sheet analytics error:', error);
    res.status(500).json({ error: 'Server error generating balance sheet.' });
  }
});

module.exports = router;

