const express = require('express');
const db = require('../config/db');
const { authenticate, enforceTenant } = require('../middleware/auth');

const router = express.Router();

// Enforce auth & tenant isolation for all held bills endpoints
router.use(authenticate);
router.use(enforceTenant);

/**
 * @route   GET /api/held-bills
 * @desc    Get all held bills for the active shop
 * @access  Private (shop_admin, shop_staff)
 */
router.get('/', async (req, res) => {
  const shopId = req.shopId;

  try {
    const [heldBills] = await db.query(
      `SELECT hb.*, u.name as staff_name 
       FROM held_bills hb
       JOIN users u ON hb.user_id = u.id
       WHERE hb.shop_id = ?
       ORDER BY hb.created_at DESC`,
      [shopId]
    );

    res.json(heldBills);
  } catch (error) {
    console.error('Fetch held bills error:', error);
    res.status(500).json({ error: 'Server error retrieving held bills.' });
  }
});

/**
 * @route   POST /api/held-bills
 * @desc    Hold a bill / suspended cart
 * @access  Private (shop_admin, shop_staff)
 */
router.post('/', async (req, res) => {
  const shopId = req.shopId;
  const userId = req.user.id;
  const {
    customer_id,
    customer_name,
    customer_phone,
    customer_address,
    discount_percent = 0,
    notes,
    items
  } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Cannot hold an empty cart.' });
  }

  try {
    const [result] = await db.query(
      `INSERT INTO held_bills 
       (shop_id, user_id, customer_id, customer_name, customer_phone, customer_address, discount_percent, notes, items) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        shopId,
        userId,
        customer_id || null,
        customer_name || null,
        customer_phone || null,
        customer_address || null,
        parseFloat(discount_percent),
        notes || null,
        JSON.stringify(items)
      ]
    );

    res.status(201).json({
      message: 'Bill held successfully.',
      heldBillId: result.insertId
    });
  } catch (error) {
    console.error('Create held bill error:', error);
    res.status(500).json({ error: 'Server error saving held bill.' });
  }
});

/**
 * @route   PUT /api/held-bills/:id
 * @desc    Update a held bill (status, notes)
 * @access  Private (shop_admin, shop_staff)
 */
router.put('/:id', async (req, res) => {
  const heldBillId = req.params.id;
  const shopId = req.shopId;
  const { status, notes } = req.body;

  try {
    // 1. Verify existence and ownership
    const [existing] = await db.query(
      'SELECT id, status, customer_id, due_amount FROM held_bills WHERE id = ? AND shop_id = ?',
      [heldBillId, shopId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Held bill not found or access denied.' });
    }

    const bill = existing[0];
    const oldStatus = bill.status;
    const customerId = bill.customer_id;
    const dueAmount = parseFloat(bill.due_amount || 0);

    // Handle customer due_balance updates based on status transitions
    if (status !== undefined && status !== oldStatus && dueAmount > 0 && customerId) {
      if (oldStatus === 'held' && (status === 'completed' || status === 'cancelled')) {
        // Unpaid -> Paid/Written off: Decrement customer's due balance
        await db.query(
          'UPDATE customers SET due_balance = due_balance - ? WHERE id = ? AND shop_id = ?',
          [dueAmount, customerId, shopId]
        );
      } else if ((oldStatus === 'completed' || oldStatus === 'cancelled') && status === 'held') {
        // Paid/Written off -> Unpaid: Re-increment customer's due balance
        await db.query(
          'UPDATE customers SET due_balance = due_balance + ? WHERE id = ? AND shop_id = ?',
          [dueAmount, customerId, shopId]
        );
      }
    }

    // 2. Validate parameters
    const updateFields = [];
    const params = [];

    if (status !== undefined) {
      const validStatuses = ['held', 'completed', 'cancelled'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status value. Must be held, completed, or cancelled.' });
      }
      updateFields.push('status = ?');
      params.push(status);
    }

    if (notes !== undefined) {
      updateFields.push('notes = ?');
      params.push(notes);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No update parameters provided.' });
    }

    params.push(heldBillId, shopId);

    // 3. Update in DB
    await db.query(
      `UPDATE held_bills SET ${updateFields.join(', ')} WHERE id = ? AND shop_id = ?`,
      params
    );

    res.json({ message: 'Held bill updated successfully.' });
  } catch (error) {
    console.error('Update held bill error:', error);
    res.status(500).json({ error: 'Server error updating held bill.' });
  }
});

/**
 * @route   DELETE /api/held-bills/:id
 * @desc    Delete a held bill
 * @access  Private (shop_admin, shop_staff)
 */
router.delete('/:id', async (req, res) => {
  const heldBillId = req.params.id;
  const shopId = req.shopId;

  try {
    const [result] = await db.query(
      'DELETE FROM held_bills WHERE id = ? AND shop_id = ?',
      [heldBillId, shopId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Held bill not found or access denied.' });
    }

    res.json({ message: 'Held bill deleted successfully.' });
  } catch (error) {
    console.error('Delete held bill error:', error);
    res.status(500).json({ error: 'Server error deleting held bill.' });
  }
});

module.exports = router;
