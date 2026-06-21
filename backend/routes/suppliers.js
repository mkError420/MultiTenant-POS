const express = require('express');
const db = require('../config/db');
const { authenticate, authorize, enforceTenant } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);
router.use(enforceTenant);

/**
 * @route   GET /api/suppliers
 * @desc    Fetch all suppliers for the active tenant
 */
router.get('/', async (req, res) => {
  const shopId = req.shopId;
  try {
    const [suppliers] = await db.query(
      'SELECT * FROM suppliers WHERE shop_id = ? ORDER BY name ASC',
      [shopId]
    );
    res.json(suppliers);
  } catch (error) {
    console.error('Fetch suppliers error:', error);
    res.status(500).json({ error: 'Server error retrieving suppliers.' });
  }
});

/**
 * @route   POST /api/suppliers
 * @desc    Create a new supplier
 */
router.post('/', authorize(['shop_admin']), async (req, res) => {
  const shopId = req.shopId;
  const { name, contact_name, email, phone } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Supplier name is required.' });
  }

  try {
    const [result] = await db.query(
      'INSERT INTO suppliers (shop_id, name, contact_name, email, phone) VALUES (?, ?, ?, ?, ?)',
      [shopId, name, contact_name || null, email || null, phone || null]
    );
    res.status(201).json({ message: 'Supplier created successfully.', id: result.insertId });
  } catch (error) {
    console.error('Create supplier error:', error);
    res.status(500).json({ error: 'Server error creating supplier.' });
  }
});

/**
 * @route   GET /api/suppliers/purchase-orders
 * @desc    Get all purchase orders for active shop
 */
router.get('/purchase-orders', async (req, res) => {
  const shopId = req.shopId;
  const { supplier_id, status } = req.query;
  try {
    let sql = `
      SELECT po.*, s.name AS supplier_name 
      FROM purchase_orders po
      JOIN suppliers s ON po.supplier_id = s.id
      WHERE po.shop_id = ?
    `;
    const params = [shopId];

    if (supplier_id) {
      sql += ' AND po.supplier_id = ?';
      params.push(supplier_id);
    }
    if (status) {
      sql += ' AND po.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY po.created_at DESC';

    const [orders] = await db.query(sql, params);
    res.json(orders);
  } catch (error) {
    console.error('Fetch POs error:', error);
    res.status(500).json({ error: 'Server error fetching purchase orders.' });
  }
});

/**
 * @route   GET /api/suppliers/cost-price-logs
 * @desc    Get all cost price logs for active shop
 */
router.get('/cost-price-logs', async (req, res) => {
  const shopId = req.shopId;
  try {
    const [logs] = await db.query(
      `SELECT cpl.*, p.name AS product_name, p.sku AS product_sku, s.name AS supplier_name
       FROM cost_price_logs cpl
       JOIN products p ON cpl.product_id = p.id
       LEFT JOIN suppliers s ON cpl.supplier_id = s.id
       WHERE cpl.shop_id = ?
       ORDER BY cpl.created_at DESC`,
      [shopId]
    );
    res.json(logs);
  } catch (error) {
    console.error('Fetch cost logs error:', error);
    res.status(500).json({ error: 'Server error fetching cost price logs.' });
  }
});

/**
 * @route   POST /api/suppliers/purchase-orders
 * @desc    Create a new purchase order
 */
router.post('/purchase-orders', authorize(['shop_admin']), async (req, res) => {
  const shopId = req.shopId;
  const { supplier_id, status, notes, items } = req.body;

  if (!supplier_id || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Supplier ID and order items are required.' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    let totalAmount = 0;
    for (const item of items) {
      totalAmount += (item.quantity_ordered || 0) * (parseFloat(item.cost_price) || 0);
    }

    const [poResult] = await conn.query(
      `INSERT INTO purchase_orders (shop_id, supplier_id, status, total_amount, notes) 
       VALUES (?, ?, ?, ?, ?)`,
      [shopId, supplier_id, status || 'draft', totalAmount, notes || null]
    );
    const poId = poResult.insertId;

    for (const item of items) {
      let productId = item.product_id;
      if (item.is_new) {
        const [existing] = await conn.query(
          'SELECT id FROM products WHERE shop_id = ? AND sku = ?',
          [shopId, item.sku]
        );
        if (existing.length > 0) {
          productId = existing[0].id;
        } else {
          const [pResult] = await conn.query(
            `INSERT INTO products (shop_id, name, sku, price, cost_price, stock_quantity, low_stock_threshold) 
             VALUES (?, ?, ?, ?, ?, 0, 10)`,
            [shopId, item.name, item.sku, item.selling_price || item.cost_price, item.cost_price]
          );
          productId = pResult.insertId;
        }
      }

      await conn.query(
        `INSERT INTO purchase_order_items (shop_id, purchase_order_id, product_id, quantity_ordered, cost_price, selling_price) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [shopId, poId, productId, item.quantity_ordered, item.cost_price, item.selling_price || 0.00]
      );
    }

    await conn.commit();
    res.status(201).json({ message: 'Purchase Order created successfully.', id: poId });
  } catch (error) {
    await conn.rollback();
    console.error('Create PO error:', error);
    res.status(500).json({ error: 'Server error creating Purchase Order.' });
  } finally {
    conn.release();
  }
});

/**
 * @route   GET /api/suppliers/purchase-orders/:id
 * @desc    Get detailed purchase order by ID
 */
router.get('/purchase-orders/:id', async (req, res) => {
  const shopId = req.shopId;
  const poId = req.params.id;
  try {
    const [pos] = await db.query(
      `SELECT po.*, s.name AS supplier_name, s.email AS supplier_email, s.phone AS supplier_phone
       FROM purchase_orders po
       JOIN suppliers s ON po.supplier_id = s.id
       WHERE po.id = ? AND po.shop_id = ?`,
      [poId, shopId]
    );

    if (pos.length === 0) {
      return res.status(404).json({ error: 'Purchase Order not found.' });
    }

    const [items] = await db.query(
      `SELECT poi.*, p.name AS product_name, p.sku AS product_sku
       FROM purchase_order_items poi
       JOIN products p ON poi.product_id = p.id
       WHERE poi.purchase_order_id = ? AND poi.shop_id = ?`,
      [poId, shopId]
    );

    const po = pos[0];
    po.items = items;
    res.json(po);
  } catch (error) {
    console.error('Fetch PO details error:', error);
    res.status(500).json({ error: 'Server error fetching purchase order details.' });
  }
});

/**
 * @route   PUT /api/suppliers/purchase-orders/:id
 * @desc    Update a draft purchase order
 */
router.put('/purchase-orders/:id', authorize(['shop_admin']), async (req, res) => {
  const shopId = req.shopId;
  const poId = req.params.id;
  const { notes, items, status } = req.body;

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [existing] = await conn.query(
      'SELECT status FROM purchase_orders WHERE id = ? AND shop_id = ?',
      [poId, shopId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Purchase Order not found.' });
    }

    if (existing[0].status !== 'draft') {
      return res.status(400).json({ error: 'Only draft Purchase Orders can be modified.' });
    }

    let totalAmount = 0;
    if (items && Array.isArray(items)) {
      for (const item of items) {
        totalAmount += (item.quantity_ordered || 0) * (parseFloat(item.cost_price) || 0);
      }
      
      await conn.query('DELETE FROM purchase_order_items WHERE purchase_order_id = ? AND shop_id = ?', [poId, shopId]);

      for (const item of items) {
        let productId = item.product_id;
        if (item.is_new) {
          const [existing] = await conn.query(
            'SELECT id FROM products WHERE shop_id = ? AND sku = ?',
            [shopId, item.sku]
          );
          if (existing.length > 0) {
            productId = existing[0].id;
          } else {
            const [pResult] = await conn.query(
              `INSERT INTO products (shop_id, name, sku, price, cost_price, stock_quantity, low_stock_threshold) 
               VALUES (?, ?, ?, ?, ?, 0, 10)`,
              [shopId, item.name, item.sku, item.selling_price || item.cost_price, item.cost_price]
            );
            productId = pResult.insertId;
          }
        }

        await conn.query(
          `INSERT INTO purchase_order_items (shop_id, purchase_order_id, product_id, quantity_ordered, cost_price, selling_price) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [shopId, poId, productId, item.quantity_ordered, item.cost_price, item.selling_price || 0.00]
        );
      }
    }

    await conn.query(
      `UPDATE purchase_orders 
       SET notes = COALESCE(?, notes), 
           status = COALESCE(?, status), 
           total_amount = CASE WHEN ? > 0 THEN ? ELSE total_amount END
       WHERE id = ? AND shop_id = ?`,
      [notes || null, status || null, totalAmount, totalAmount, poId, shopId]
    );

    await conn.commit();
    res.json({ message: 'Purchase Order updated successfully.' });
  } catch (error) {
    await conn.rollback();
    console.error('Update PO error:', error);
    res.status(500).json({ error: 'Server error updating Purchase Order.' });
  } finally {
    conn.release();
  }
});

/**
 * @route   PUT /api/suppliers/purchase-orders/:id/status
 * @desc    Transition status of purchase order (Receive stocks / Cancel)
 */
router.put('/purchase-orders/:id/status', authorize(['shop_admin']), async (req, res) => {
  const shopId = req.shopId;
  const poId = req.params.id;
  const { status, items, notes } = req.body;

  if (!status) {
    return res.status(400).json({ error: 'Status is required.' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [pos] = await conn.query(
      'SELECT * FROM purchase_orders WHERE id = ? AND shop_id = ?',
      [poId, shopId]
    );

    if (pos.length === 0) {
      return res.status(404).json({ error: 'Purchase Order not found.' });
    }

    const po = pos[0];

    if (po.status === 'received') {
      return res.status(400).json({ error: 'Purchase Order has already been received.' });
    }
    if (po.status === 'cancelled') {
      return res.status(400).json({ error: 'Purchase Order has already been cancelled.' });
    }

    if (status === 'cancelled') {
      await conn.query(
        'UPDATE purchase_orders SET status = ?, notes = COALESCE(?, notes) WHERE id = ? AND shop_id = ?',
        ['cancelled', notes || null, poId, shopId]
      );
      await conn.commit();
      return res.json({ message: 'Purchase Order cancelled.' });
    }

    if (status === 'ordered') {
      await conn.query(
        'UPDATE purchase_orders SET status = ?, notes = COALESCE(?, notes) WHERE id = ? AND shop_id = ?',
        ['ordered', notes || null, poId, shopId]
      );
      await conn.commit();
      return res.json({ message: 'Purchase Order status set to Ordered.' });
    }

    if (status === 'received') {
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Received items are required to mark PO as received.' });
      }

      await conn.query(
        `UPDATE purchase_orders 
         SET status = 'received', received_date = CURRENT_TIMESTAMP, notes = COALESCE(?, notes)
         WHERE id = ? AND shop_id = ?`,
        [notes || null, poId, shopId]
      );

      for (const item of items) {
        const { product_id, quantity_received, cost_price, selling_price } = item;

        await conn.query(
          `UPDATE purchase_order_items 
           SET quantity_received = ?, cost_price = ?, selling_price = ?
           WHERE purchase_order_id = ? AND product_id = ? AND shop_id = ?`,
          [quantity_received, cost_price, selling_price || 0.00, poId, product_id, shopId]
        );

        const [prodRows] = await conn.query(
          'SELECT cost_price FROM products WHERE id = ? AND shop_id = ?',
          [product_id, shopId]
        );

        if (prodRows.length > 0) {
          const product = prodRows[0];
          const oldCost = parseFloat(product.cost_price);
          const newCost = parseFloat(cost_price);

          await conn.query(
            `INSERT INTO cost_price_logs (shop_id, product_id, supplier_id, old_cost_price, new_cost_price, change_reason)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [shopId, product_id, po.supplier_id, oldCost, newCost, `PO Received #${poId}`]
          );

          await conn.query(
            `UPDATE products 
             SET stock_quantity = stock_quantity + ?, cost_price = ?, price = ? 
             WHERE id = ? AND shop_id = ?`,
            [quantity_received, newCost, selling_price || newCost, product_id, shopId]
          );
        }
      }

      await conn.commit();
      return res.json({ message: 'Purchase Order items successfully received, inventory and cost prices updated!' });
    }

    return res.status(400).json({ error: 'Invalid status transition requested.' });
  } catch (error) {
    await conn.rollback();
    console.error('Receive PO error:', error);
    res.status(500).json({ error: 'Server error processing PO receiving.' });
  } finally {
    conn.release();
  }
});

/**
 * @route   DELETE /api/suppliers/purchase-orders/:id
 * @desc    Delete a purchase order
 */
router.delete('/purchase-orders/:id', authorize(['shop_admin']), async (req, res) => {
  const shopId = req.shopId;
  const poId = req.params.id;

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [existing] = await conn.query(
      'SELECT status FROM purchase_orders WHERE id = ? AND shop_id = ?',
      [poId, shopId]
    );

    if (existing.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Purchase Order not found.' });
    }

    const poStatus = existing[0].status;

    // If PO is received, revert product stock counts
    if (poStatus === 'received') {
      const [items] = await conn.query(
        'SELECT product_id, quantity_received FROM purchase_order_items WHERE purchase_order_id = ? AND shop_id = ?',
        [poId, shopId]
      );

      for (const item of items) {
        if (item.quantity_received > 0) {
          await conn.query(
            'UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ? AND shop_id = ?',
            [item.quantity_received, item.product_id, shopId]
          );
        }
      }
    }

    await conn.query('DELETE FROM purchase_orders WHERE id = ? AND shop_id = ?', [poId, shopId]);
    await conn.commit();
    res.json({ message: 'Purchase Order deleted successfully.' });
  } catch (error) {
    await conn.rollback();
    console.error('Delete PO error:', error);
    res.status(500).json({ error: 'Server error deleting Purchase Order.' });
  } finally {
    conn.release();
  }
});

/**
 * @route   DELETE /api/suppliers/purchase-orders/:id/items/:product_id
 * @desc    Delete a product item from a purchase order
 */
router.delete('/purchase-orders/:id/items/:product_id', authorize(['shop_admin']), async (req, res) => {
  const shopId = req.shopId;
  const poId = req.params.id;
  const productId = req.params.product_id;

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [pos] = await conn.query(
      'SELECT status FROM purchase_orders WHERE id = ? AND shop_id = ?',
      [poId, shopId]
    );

    if (pos.length === 0) {
      return res.status(404).json({ error: 'Purchase Order not found.' });
    }

    const status = pos[0].status;
    if (status === 'received' || status === 'cancelled') {
      return res.status(400).json({ error: `Cannot delete items from a ${status} Purchase Order.` });
    }

    const [items] = await conn.query(
      'SELECT id FROM purchase_order_items WHERE purchase_order_id = ? AND product_id = ? AND shop_id = ?',
      [poId, productId, shopId]
    );

    if (items.length === 0) {
      return res.status(404).json({ error: 'Product not found in this Purchase Order.' });
    }

    const [countRows] = await conn.query(
      'SELECT COUNT(*) AS cnt FROM purchase_order_items WHERE purchase_order_id = ? AND shop_id = ?',
      [poId, shopId]
    );

    if (countRows[0].cnt <= 1) {
      return res.status(400).json({ error: 'Cannot delete the last product from a Purchase Order. Delete the Purchase Order instead.' });
    }

    await conn.query(
      'DELETE FROM purchase_order_items WHERE purchase_order_id = ? AND product_id = ? AND shop_id = ?',
      [poId, productId, shopId]
    );

    const [totalRows] = await conn.query(
      'SELECT SUM(quantity_ordered * cost_price) AS total FROM purchase_order_items WHERE purchase_order_id = ? AND shop_id = ?',
      [poId, shopId]
    );
    const newTotal = totalRows[0].total || 0.00;

    await conn.query(
      'UPDATE purchase_orders SET total_amount = ? WHERE id = ? AND shop_id = ?',
      [newTotal, poId, shopId]
    );

    await conn.commit();
    res.json({ message: 'Product successfully removed from Purchase Order.', newTotal });
  } catch (error) {
    await conn.rollback();
    console.error('Delete PO item error:', error);
    res.status(500).json({ error: 'Server error deleting product from Purchase Order.' });
  } finally {
    conn.release();
  }
});

/**
 * @route   GET /api/suppliers/:id/profile
 * @desc    Get detailed stats, POs list and cost logs for a specific supplier profile
 */
router.get('/:id/profile', async (req, res) => {
  const shopId = req.shopId;
  const supplierId = req.params.id;

  try {
    const [suppliers] = await db.query(
      'SELECT * FROM suppliers WHERE id = ? AND shop_id = ?',
      [supplierId, shopId]
    );

    if (suppliers.length === 0) {
      return res.status(404).json({ error: 'Supplier not found.' });
    }

    const supplier = suppliers[0];

    const [spentRows] = await db.query(
      `SELECT SUM(total_amount) AS total_spent 
       FROM purchase_orders 
       WHERE supplier_id = ? AND shop_id = ? AND status = 'received'`,
      [supplierId, shopId]
    );
    const totalSpent = spentRows[0].total_spent || 0.00;

    const [poStatsRows] = await db.query(
      `SELECT status, COUNT(*) AS count 
       FROM purchase_orders 
       WHERE supplier_id = ? AND shop_id = ?
       GROUP BY status`,
      [supplierId, shopId]
    );
    const poStats = { draft: 0, ordered: 0, received: 0, cancelled: 0 };
    poStatsRows.forEach(row => {
      poStats[row.status] = row.count;
    });

    const [pos] = await db.query(
      `SELECT * FROM purchase_orders 
       WHERE supplier_id = ? AND shop_id = ?
       ORDER BY created_at DESC`,
      [supplierId, shopId]
    );

    const [costLogs] = await db.query(
      `SELECT cpl.*, p.name AS product_name, p.sku AS product_sku
       FROM cost_price_logs cpl
       JOIN products p ON cpl.product_id = p.id
       WHERE cpl.supplier_id = ? AND cpl.shop_id = ?
       ORDER BY cpl.created_at DESC`,
      [supplierId, shopId]
    );

    res.json({
      supplier,
      stats: {
        totalSpent,
        poStats
      },
      purchaseOrders: pos,
      costLogs
    });

  } catch (error) {
    console.error('Fetch supplier profile stats error:', error);
    res.status(500).json({ error: 'Server error retrieving supplier profile details.' });
  }
});

/**
 * @route   PUT /api/suppliers/:id
 * @desc    Update a supplier
 */
router.put('/:id', authorize(['shop_admin']), async (req, res) => {
  const shopId = req.shopId;
  const supplierId = req.params.id;
  const { name, contact_name, email, phone } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Supplier name is required.' });
  }

  try {
    const [existing] = await db.query(
      'SELECT id FROM suppliers WHERE id = ? AND shop_id = ?',
      [supplierId, shopId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Supplier not found or access denied.' });
    }

    await db.query(
      'UPDATE suppliers SET name = ?, contact_name = ?, email = ?, phone = ? WHERE id = ? AND shop_id = ?',
      [name, contact_name || null, email || null, phone || null, supplierId, shopId]
    );

    res.json({ message: 'Supplier updated successfully.' });
  } catch (error) {
    console.error('Update supplier error:', error);
    res.status(500).json({ error: 'Server error updating supplier.' });
  }
});

/**
 * @route   DELETE /api/suppliers/:id
 * @desc    Delete a supplier
 */
router.delete('/:id', authorize(['shop_admin']), async (req, res) => {
  const shopId = req.shopId;
  const supplierId = req.params.id;

  try {
    const [existing] = await db.query(
      'SELECT id FROM suppliers WHERE id = ? AND shop_id = ?',
      [supplierId, shopId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Supplier not found or access denied.' });
    }

    await db.query('DELETE FROM suppliers WHERE id = ? AND shop_id = ?', [supplierId, shopId]);
    res.json({ message: 'Supplier deleted successfully.' });
  } catch (error) {
    console.error('Delete supplier error:', error);
    res.status(500).json({ error: 'Server error deleting supplier.' });
  }
});

module.exports = router;
