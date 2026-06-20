const express = require('express');
const db = require('../config/db');
const { authenticate, authorize, enforceTenant } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);
router.use(enforceTenant);

/**
 * @route   POST /api/sales
 * @desc    Process a POS checkout transaction
 * @access  Private (shop_admin, shop_staff)
 */
router.post('/', authorize(['shop_admin', 'shop_staff']), async (req, res) => {
  const shopId = req.shopId;
  const userId = req.user.id;
  const { customer_id, items, discount = 0, tax = 0, payment_method } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Checkout cart is empty.' });
  }

  if (!payment_method) {
    return res.status(400).json({ error: 'Please specify payment method.' });
  }

  const connection = await db.getConnection();

  try {
    // 1. Begin Database Transaction
    await connection.beginTransaction();

    let calculatedTotal = 0;
    const validatedItems = [];
    const stockAlerts = [];

    // 2. Validate products, prices, and stock levels
    for (const item of items) {
      const { product_id, quantity } = item;

      if (!product_id || !quantity || quantity <= 0) {
        throw new Error(`Invalid item details for product ID ${product_id}.`);
      }

      // SELECT FOR UPDATE to lock the product row and prevent race conditions on stock quantity
      const [productRows] = await connection.query(
        'SELECT id, name, price, stock_quantity, low_stock_threshold FROM products WHERE id = ? AND shop_id = ? FOR UPDATE',
        [product_id, shopId]
      );

      if (productRows.length === 0) {
        throw new Error(`Product with ID ${product_id} not found in this shop.`);
      }

      const product = productRows[0];

      // Check stock availability
      if (product.stock_quantity < quantity) {
        throw new Error(`Insufficient stock for product "${product.name}". Available: ${product.stock_quantity}, requested: ${quantity}.`);
      }

      const unitPrice = parseFloat(product.price);
      const subtotal = unitPrice * quantity;
      calculatedTotal += subtotal;

      // Track items to insert later
      validatedItems.push({
        product_id,
        quantity,
        unit_price: unitPrice,
        subtotal
      });

      // Deduct stock quantity
      const newStock = product.stock_quantity - quantity;
      await connection.query(
        'UPDATE products SET stock_quantity = ? WHERE id = ? AND shop_id = ?',
        [newStock, product_id, shopId]
      );

      // Check if stock dropped below threshold
      if (newStock <= product.low_stock_threshold) {
        stockAlerts.push({
          product_id,
          name: product.name,
          remaining_stock: newStock,
          threshold: product.low_stock_threshold
        });
      }
    }

    // 3. Compute financial amounts
    const finalAmount = (calculatedTotal - parseFloat(discount)) + parseFloat(tax);

    // 4. Save transaction metadata in sales table
    const [salesResult] = await connection.query(
      `INSERT INTO sales (shop_id, customer_id, user_id, total_amount, discount, tax, final_amount, payment_method) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [shopId, customer_id || null, userId, calculatedTotal, discount, tax, finalAmount, payment_method]
    );

    const saleId = salesResult.insertId;

    // 5. Save line items in sale_items table
    const saleItemInsertQueries = validatedItems.map(item => {
      return connection.query(
        `INSERT INTO sale_items (shop_id, sale_id, product_id, quantity, unit_price, subtotal) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [shopId, saleId, item.product_id, item.quantity, item.unit_price, item.subtotal]
      );
    });

    await Promise.all(saleItemInsertQueries);

    // 6. Commit Database Transaction
    await connection.commit();

    res.status(201).json({
      message: 'Transaction completed successfully.',
      sale_id: saleId,
      final_amount: finalAmount,
      stock_alerts: stockAlerts // Returns products that hit low stock warnings
    });

  } catch (error) {
    // Rollback changes on error
    await connection.rollback();
    console.error('POS Checkout Transaction failed:', error.message);
    res.status(400).json({ error: error.message || 'Transaction failed.' });
  } finally {
    connection.release();
  }
});

/**
 * @route   GET /api/sales
 * @desc    Retrieve all sale transactions for the shop (tenant isolated)
 */
router.get('/', async (req, res) => {
  const shopId = req.shopId;
  const { start_date, end_date } = req.query;

  try {
    let sql = `
      SELECT s.*, u.name as staff_name, c.name as customer_name 
      FROM sales s
      LEFT JOIN users u ON s.user_id = u.id
      LEFT JOIN customers c ON s.customer_id = c.id
      WHERE s.shop_id = ?
    `;
    const params = [shopId];

    if (start_date && end_date) {
      sql += ' AND s.created_at BETWEEN ? AND ?';
      params.push(`${start_date} 00:00:00`, `${end_date} 23:59:59`);
    }

    sql += ' ORDER BY s.created_at DESC';

    const [sales] = await db.query(sql, params);
    res.json(sales);
  } catch (error) {
    console.error('Fetch sales error:', error);
    res.status(500).json({ error: 'Server error retrieving sales data.' });
  }
});

/**
 * @route   GET /api/sales/:id
 * @desc    Retrieve details for a specific sale transaction (tenant isolated)
 */
router.get('/:id', async (req, res) => {
  const saleId = req.params.id;
  const shopId = req.shopId;

  try {
    // Retrieve sale header
    const [sales] = await db.query(
      `SELECT s.*, u.name as staff_name, c.name as customer_name 
       FROM sales s
       LEFT JOIN users u ON s.user_id = u.id
       LEFT JOIN customers c ON s.customer_id = c.id
       WHERE s.id = ? AND s.shop_id = ?`,
      [saleId, shopId]
    );

    if (sales.length === 0) {
      return res.status(404).json({ error: 'Sale record not found or access denied.' });
    }

    // Retrieve sale items
    const [items] = await db.query(
      `SELECT si.*, p.name as product_name, p.sku as product_sku 
       FROM sale_items si
       JOIN products p ON si.product_id = p.id
       WHERE si.sale_id = ? AND si.shop_id = ?`,
      [saleId, shopId]
    );

    res.json({
      ...sales[0],
      items
    });
  } catch (error) {
    console.error('Fetch sale details error:', error);
    res.status(500).json({ error: 'Server error retrieving sale details.' });
  }
});

module.exports = router;
