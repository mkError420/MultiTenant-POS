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
    
    connection.release();
  } catch (error) {
    console.error('Database connection or migration failed:', error.message);
  }
})();

module.exports = pool;
