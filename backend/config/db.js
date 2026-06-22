const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

// Create connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'multitenant_pos',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

// Test connection on startup and run migrations
(async () => {
  try {
    const connection = await pool.getConnection();
    console.log('Successfully connected to the Multi-Tenant POS Database.');
    
    // Check if allowed_sections column exists on users table
    const [columns] = await connection.query("SHOW COLUMNS FROM `users` LIKE 'allowed_sections'");
    if (columns.length === 0) {
      await connection.query("ALTER TABLE `users` ADD COLUMN `allowed_sections` JSON NULL");
      console.log("Migration: Added 'allowed_sections' column to 'users' table.");
    }

    // Check if unit column exists on products table
    const [prodColumns] = await connection.query("SHOW COLUMNS FROM `products` LIKE 'unit'");
    if (prodColumns.length === 0) {
      await connection.query("ALTER TABLE `products` ADD COLUMN `unit` VARCHAR(20) NOT NULL DEFAULT 'piece'");
      console.log("Migration: Added 'unit' column to 'products' table.");
    }

    // Check if due_balance column exists on suppliers table
    const [suppColumns] = await connection.query("SHOW COLUMNS FROM `suppliers` LIKE 'due_balance'");
    if (suppColumns.length === 0) {
      await connection.query("ALTER TABLE `suppliers` ADD COLUMN `due_balance` DECIMAL(10,2) NOT NULL DEFAULT 0.00");
      console.log("Migration: Added 'due_balance' column to 'suppliers' table.");
    }

    // Check if payment_basis column exists on purchase_orders table
    const [poBasisCol] = await connection.query("SHOW COLUMNS FROM `purchase_orders` LIKE 'payment_basis'");
    if (poBasisCol.length === 0) {
      await connection.query("ALTER TABLE `purchase_orders` ADD COLUMN `payment_basis` ENUM('cash', 'credit') NOT NULL DEFAULT 'cash'");
      console.log("Migration: Added 'payment_basis' column to 'purchase_orders' table.");
    }

    // Check if paid_amount column exists on purchase_orders table
    const [poPaidCol] = await connection.query("SHOW COLUMNS FROM `purchase_orders` LIKE 'paid_amount'");
    if (poPaidCol.length === 0) {
      await connection.query("ALTER TABLE `purchase_orders` ADD COLUMN `paid_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00");
      console.log("Migration: Added 'paid_amount' column to 'purchase_orders' table.");
    }

    // Check if due_amount column exists on purchase_orders table
    const [poDueCol] = await connection.query("SHOW COLUMNS FROM `purchase_orders` LIKE 'due_amount'");
    if (poDueCol.length === 0) {
      await connection.query("ALTER TABLE `purchase_orders` ADD COLUMN `due_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00");
      console.log("Migration: Added 'due_amount' column to 'purchase_orders' table.");
    }
    
    connection.release();
  } catch (error) {
    console.error('Database connection or migration failed:', error.message);
  }
})();

module.exports = pool;
