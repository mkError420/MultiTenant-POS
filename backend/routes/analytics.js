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

    res.json({
      sales_revenue: totalSales,
      sales_count: salesCount,
      cost_of_goods_sold: totalCOGS,
      inventory_purchasing_cost: totalPurchasing,
      other_costs: totalOther,
      wastage_loss: totalWastage,
      net_profit_cogs: netProfitCOGS,
      net_profit_cashflow: netProfitCashflow
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

      return res.json({
        dashboard_type: 'tenant',
        metrics: {
          total_sales: salesStats[0].sales_count,
          revenue: parseFloat(salesStats[0].revenue || 0).toFixed(2),
          total_products: productStats[0].total_products,
          low_stock_alerts: productStats[0].low_stock_count || 0,
          total_customers: customerStats[0].total_customers
        },
        recent_sales: recentSales
      });
    }
  } catch (error) {
    console.error('Analytics fetch error:', error);
    res.status(500).json({ error: 'Server error generating dashboard analytics.' });
  }
});

module.exports = router;
