const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');

const notFoundHandler = require('./middleware/notFoundHandler');
const { globalErrorHandler } = require('./middleware/errorHandler');

const userRoutes = require('./routes/userRoutes');
const clothesRoutes = require('./routes/clothesRoutes');
const categoriesRoutes = require('./routes/categoriesRoutes');
const referencesRoutes = require('./routes/referencesRoutes');
const merchandiseRoutes = require('./routes/merchandiseRoutes');

const app = express();

app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:4200',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ── API root ──────────────────────────────────────────────────────────────────
app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to Urban Nest API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      users: '/api/users',
      clothes: '/api/clothes',
      categories: '/api/categories',
      references: '/api/references',
      merchandise: '/api/merchandise',
    },
  });
});

app.use('/api/users', userRoutes);
app.use('/api/clothes', clothesRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/references', referencesRoutes);
app.use('/api/merchandise', merchandiseRoutes);

app.use(notFoundHandler);
app.use(globalErrorHandler);

module.exports = app;
