const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS with support for headers/credentials
app.use(cors());

// Body parser
app.use(express.json());

// Import database to trigger pool initialization
require('./config/db');

// Import Routes
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const saleRoutes = require('./routes/sales');
const analyticsRoutes = require('./routes/analytics');
const customerRoutes = require('./routes/customers');
const supplierRoutes = require('./routes/suppliers');
const userRoutes = require('./routes/users');
const shopRoutes = require('./routes/shops');
const heldBillRoutes = require('./routes/held-bills');
const otherCostRoutes = require('./routes/other-costs');
const wastageRoutes = require('./routes/wastage');

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/users', userRoutes);
app.use('/api/shops', shopRoutes);
app.use('/api/held-bills', heldBillRoutes);
app.use('/api/other-costs', otherCostRoutes);
app.use('/api/wastages', wastageRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err.stack);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running in production-ready mode on port ${PORT}`);
});
