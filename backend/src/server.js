require('dotenv').config();

const { validateEnvironment } = require('./config/env');

try {
  validateEnvironment();
} catch (error) {
  console.error(`Configuration error: ${error.message}`);
  process.exit(1);
}

const { createApp } = require('./app');

const PORT = Number(process.env.PORT || 5000);
const app = createApp();
const server = app.listen(PORT, () => {
  console.log(`Akisto Backend Server is running on port ${PORT}`);
});

server.on('error', (error) => {
  console.error(`Server error: ${error.message}`);
  process.exit(1);
});

let shuttingDown = false;
const shutdown = (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received; shutting down gracefully`);

  const forceExit = setTimeout(() => process.exit(1), 10_000);
  forceExit.unref();

  server.close((error) => {
    if (error) {
      console.error(`Graceful shutdown failed: ${error.message}`);
      process.exit(1);
    }
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = server;
