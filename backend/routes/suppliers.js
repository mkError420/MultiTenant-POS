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
