const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');

const notFoundHandler = require('./middleware/notFoundHandler');
const { globalErrorHandler } = require('./middleware/errorHandler');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const clothesRoutes = require('./routes/clothesRoutes');
const categoriesRoutes = require('./routes/categoriesRoutes');
const referencesRoutes = require('./routes/referencesRoutes');
const merchandiseRoutes = require('./routes/merchandiseRoutes');
const salesRoutes = require('./routes/salesRoutes');
const expensesRoutes = require('./routes/expensesRoutes');
const novaPoshtaRoutes = require('./routes/novaPoshtaRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const cartsRoutes = require('./routes/cartsRoutes');
const seoRoutes = require('./routes/seoRoutes');

// ── Cloudinary config guard ────────────────────────────────────────────────────
if (
  !process.env.CLOUDINARY_CLOUD_NAME ||
  !process.env.CLOUDINARY_API_KEY ||
  !process.env.CLOUDINARY_API_SECRET
) {
  throw new Error('Cloudinary config missing: set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in .env');
}

const app = express();

const corsOptions = {
  origin: [
    'http://localhost:4200',
    'http://uliastore.com.ua',
    'https://uliastore.com.ua',
    'http://www.uliastore.com.ua',
    'https://www.uliastore.com.ua',
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(compression());
app.use(cors(corsOptions));
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
      auth: '/api/auth',
      users: '/api/users',
      clothes: '/api/clothes',
      categories: '/api/categories',
      references: '/api/references',
      merchandise: '/api/merchandise',
      sales: '/api/sales',
      expenses: '/api/expenses',
      novaPoshta: '/api/nova-poshta',
      upload: '/api/upload',
      carts: '/api/carts',
    },
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/clothes', clothesRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/references', referencesRoutes);
app.use('/api/merchandise', merchandiseRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/expenses', expensesRoutes);
app.use('/api/nova-poshta', novaPoshtaRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/carts', cartsRoutes);
app.use('/', seoRoutes);

app.use(notFoundHandler);
app.use(globalErrorHandler);

module.exports = app;
