const express = require('express');
const db = require('../config/db');
const { authenticate, authorize, enforceTenant } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);
router.use(enforceTenant);

/**
 * @route   GET /api/customers
 * @desc    Fetch all customers for the active tenant (shop_id)
 */
router.get('/', async (req, res) => {
  const shopId = req.shopId;
  try {
    const [customers] = await db.query(
      'SELECT id, name, phone, email FROM customers WHERE shop_id = ? ORDER BY name ASC',
      [shopId]
    );
    res.json(customers);
  } catch (error) {
    console.error('Fetch customers error:', error);
    res.status(500).json({ error: 'Server error retrieving customer directory.' });
  }
});

/**
 * @route   POST /api/customers
 * @desc    Add a new customer profile
 */
router.post('/', authorize(['shop_admin', 'shop_staff']), async (req, res) => {
  const shopId = req.shopId;
  const { name, email, phone } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Customer name is required.' });
  }

  try {
    const [result] = await db.query(
      'INSERT INTO customers (shop_id, name, email, phone) VALUES (?, ?, ?, ?)',
      [shopId, name, email || null, phone || null]
    );
    res.status(201).json({ message: 'Customer profile created.', id: result.insertId });
  } catch (error) {
    console.error('Create customer error:', error);
    res.status(500).json({ error: 'Server error creating customer profile.' });
  }
});

/**
 * @route   PUT /api/customers/:id
 * @desc    Update a customer profile
 */
router.put('/:id', authorize(['shop_admin', 'shop_staff']), async (req, res) => {
  const shopId = req.shopId;
  const customerId = req.params.id;
  const { name, email, phone } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Customer name is required.' });
  }

  try {
    const [existing] = await db.query(
      'SELECT id FROM customers WHERE id = ? AND shop_id = ?',
      [customerId, shopId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Customer not found or access denied.' });
    }

    await db.query(
      'UPDATE customers SET name = ?, email = ?, phone = ? WHERE id = ? AND shop_id = ?',
      [name, email || null, phone || null, customerId, shopId]
    );

    res.json({ message: 'Customer updated successfully.' });
  } catch (error) {
    console.error('Update customer error:', error);
    res.status(500).json({ error: 'Server error updating customer profile.' });
  }
});

/**
 * @route   DELETE /api/customers/:id
 * @desc    Delete a customer profile
 */
router.delete('/:id', authorize(['shop_admin']), async (req, res) => {
  const shopId = req.shopId;
  const customerId = req.params.id;

  try {
    const [existing] = await db.query(
      'SELECT id FROM customers WHERE id = ? AND shop_id = ?',
      [customerId, shopId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Customer not found or access denied.' });
    }

    await db.query('DELETE FROM customers WHERE id = ? AND shop_id = ?', [customerId, shopId]);
    res.json({ message: 'Customer profile deleted successfully.' });
  } catch (error) {
    console.error('Delete customer error:', error);
    // Safety check if customer is linked to sales
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(400).json({ error: 'Cannot delete customer. Buyer is referenced in active transaction records.' });
    }
    res.status(500).json({ error: 'Server error deleting customer.' });
  }
});

module.exports = router;
