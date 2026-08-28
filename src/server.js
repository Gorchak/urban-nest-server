require('dotenv').config();

// .env.local is a developer override and must never replace secrets supplied by
// the hosting platform in production.
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config({ path: '.env.local', override: true });
}
const app = require('./app');
const { connectDB, ensurePerformanceIndexes, closeDB } = require('./config/database');

const PORT = process.env.PORT || 3000;

let server;
let shuttingDown = false;
let shutdownTimer;

const startServer = async () => {
  await connectDB();
  await ensurePerformanceIndexes();

  server = app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  });
};

const gracefulShutdown = async (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n${signal} received. Starting graceful shutdown...`);

  if (server) {
    server.close(async () => {
      clearTimeout(shutdownTimer);
      console.log('HTTP server closed');
      await closeDB();
      process.exit(0);
    });
  } else {
    await closeDB();
    process.exit(0);
  }

  shutdownTimer = setTimeout(() => {
    console.error('Forced shutdown due to timeout');
    process.exit(1);
  }, 10000);
  shutdownTimer.unref();
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err.message);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err.message);
  gracefulShutdown('UNHANDLED_REJECTION');
});

startServer();
