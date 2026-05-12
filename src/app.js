const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const notFoundHandler = require('./middleware/notFoundHandler');
const { globalErrorHandler } = require('./middleware/errorHandler');

const userRoutes = require('./routes/userRoutes');
const clothesRoutes = require('./routes/clothesRoutes');
const categoriesRoutes = require('./routes/categoriesRoutes');
const referencesRoutes = require('./routes/referencesRoutes');

const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:4200',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to Urban Nest API',
    version: '1.0.0',
    endpoints: {
      users: '/api/users',
      clothes: '/api/clothes',
      categories: '/api/categories',
      references: '/api/references',
    },
  });
});

app.use('/api/users', userRoutes);
app.use('/api/clothes', clothesRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/references', referencesRoutes);

app.use(notFoundHandler);
app.use(globalErrorHandler);

module.exports = app;
