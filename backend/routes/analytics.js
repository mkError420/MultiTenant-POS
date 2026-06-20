const express = require('express');
const db = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

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
