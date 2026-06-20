const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { authenticate, authorize, enforceTenant } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);
router.use(enforceTenant);

/**
 * @route   GET /api/users/staff
 * @desc    Get all staff members of the active tenant
 */
router.get('/staff', authorize(['shop_admin']), async (req, res) => {
  const shopId = req.shopId;
  try {
    const [staff] = await db.query(
      'SELECT id, name, email, role, status, created_at FROM users WHERE shop_id = ? AND role != "super_admin" ORDER BY name ASC',
      [shopId]
    );
    res.json(staff);
  } catch (error) {
    console.error('Fetch staff error:', error);
    res.status(500).json({ error: 'Server error retrieving staff logs.' });
  }
});

/**
 * @route   POST /api/users/staff
 * @desc    Create a new staff user
 */
router.post('/staff', authorize(['shop_admin']), async (req, res) => {
  const shopId = req.shopId;
  const { name, email, password, role } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'Please enter all fields.' });
  }

  if (role === 'super_admin') {
    return res.status(400).json({ error: 'Cannot create super admin user.' });
  }

  try {
    // Check if email already exists globally
    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Email already exists.' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const [result] = await db.query(
      'INSERT INTO users (shop_id, name, email, password_hash, role, status) VALUES (?, ?, ?, ?, ?, "active")',
      [shopId, name, email, passwordHash, role]
    );

    res.status(201).json({ message: 'Staff user created successfully.', id: result.insertId });
  } catch (error) {
    console.error('Create staff user error:', error);
    res.status(500).json({ error: 'Server error creating staff user.' });
  }
});

/**
 * @route   PUT /api/users/staff/:id
 * @desc    Update a staff user's role or status
 */
router.put('/staff/:id', authorize(['shop_admin']), async (req, res) => {
  const shopId = req.shopId;
  const staffId = req.params.id;
  const { name, role, status, password } = req.body;

  try {
    // Verify target user belongs to same shop
    const [existing] = await db.query(
      'SELECT id, password_hash FROM users WHERE id = ? AND shop_id = ?',
      [staffId, shopId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'User not found or access denied.' });
    }

    const updateFields = [];
    const params = [];

    if (name !== undefined) { updateFields.push('name = ?'); params.push(name); }
    if (role !== undefined) { 
      if (role === 'super_admin') return res.status(400).json({ error: 'Role modification restricted.' });
      updateFields.push('role = ?'); 
      params.push(role); 
    }
    if (status !== undefined) { updateFields.push('status = ?'); params.push(status); }
    
    if (password) {
      const salt = await bcrypt.genSalt(10);
      const newHash = await bcrypt.hash(password, salt);
      updateFields.push('password_hash = ?');
      params.push(newHash);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No update fields provided.' });
    }

    params.push(staffId, shopId);

    await db.query(
      `UPDATE users SET ${updateFields.join(', ')} WHERE id = ? AND shop_id = ?`,
      params
    );

    res.json({ message: 'Staff user updated successfully.' });
  } catch (error) {
    console.error('Update staff user error:', error);
    res.status(500).json({ error: 'Server error updating staff user.' });
  }
});

/**
 * @route   DELETE /api/users/staff/:id
 * @desc    Delete a staff user
 */
router.delete('/staff/:id', authorize(['shop_admin']), async (req, res) => {
  const shopId = req.shopId;
  const staffId = req.params.id;

  try {
    const [existing] = await db.query(
      'SELECT id FROM users WHERE id = ? AND shop_id = ?',
      [staffId, shopId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'User not found or access denied.' });
    }

    await db.query('DELETE FROM users WHERE id = ? AND shop_id = ?', [staffId, shopId]);
    res.json({ message: 'Staff user deleted successfully.' });
  } catch (error) {
    console.error('Delete staff user error:', error);
    // If referenced in sales
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(400).json({ error: 'Cannot delete user. Staff has recorded sales. Deactivate their status instead.' });
    }
    res.status(500).json({ error: 'Server error deleting staff user.' });
  }
});

module.exports = router;
