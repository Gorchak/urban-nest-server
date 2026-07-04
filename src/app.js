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

const defaultAllowedOrigins = [
  'http://localhost:4200',
  'http://uliastore.com.ua',
  'https://uliastore.com.ua',
  'http://www.uliastore.com.ua',
  'https://www.uliastore.com.ua',
];

const configuredAllowedOrigins = [
  process.env.CLIENT_URL,
  process.env.FRONTEND_URL,
  process.env.SITE_URL,
  ...(process.env.CORS_ORIGINS || '').split(','),
]
  .map((origin) => String(origin || '').trim().replace(/\/+$/, ''))
  .filter(Boolean);

const allowedOrigins = new Set([...defaultAllowedOrigins, ...configuredAllowedOrigins]);

const isAllowedOrigin = (origin) => {
  if (!origin) return true;

  const normalizedOrigin = origin.replace(/\/+$/, '');
  if (allowedOrigins.has(normalizedOrigin)) return true;

  try {
    const { hostname, protocol } = new URL(normalizedOrigin);
    return ['http:', 'https:'].includes(protocol) && (
      hostname === 'uliastore.com.ua' ||
      hostname === 'www.uliastore.com.ua' ||
      hostname === 'localhost'
    );
  } catch {
    return false;
  }
};

const corsOptions = {
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
      return;
    }

    callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204,
};

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(compression());
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
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
app.use('/api/nova-poshta', novaPoshtaRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/carts', cartsRoutes);
app.use('/', seoRoutes);

app.use(notFoundHandler);
app.use(globalErrorHandler);

module.exports = app;
