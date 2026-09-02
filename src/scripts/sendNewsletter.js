require('dotenv').config();
const { connectDB, ensurePerformanceIndexes, closeDB } = require('../config/database');
const { sendNewProductsNewsletter } = require('../services/newsletterService');
(async () => {
  try {
    await connectDB();
    await ensurePerformanceIndexes();
    console.log('Newsletter result:', await sendNewProductsNewsletter());
  } catch (error) {
    console.error('Newsletter failed:', error.message);
    process.exitCode = 1;
  } finally {
    await closeDB();
  }
})();
