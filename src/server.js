'use strict';

const app = require('./app');
const config = require('./config');
const db = require('./db');
const { privilegeCatalogue } = require('./modules');
const accessService = require('./modules/access/access.service');

async function start() {
  try {
    await db.ping();
  } catch (err) {
    console.error(
      `[CIRERMS] Database connection failed (${config.db.host}:${config.db.port}/${config.db.database}): ${err.message}`
    );
    process.exit(1);
  }

  // the privilege catalogue from the module manifests; the Administrator gets new privileges
  try {
    await accessService.syncCatalogue(privilegeCatalogue());
  } catch (err) {
    console.error(`[CIRERMS] Could not sync the privilege catalogue (run npm run migrate): ${err.message}`);
    process.exit(1);
  }

  const server = app.listen(config.port, config.host, () => {
    console.log(
      `[CIRERMS] Server listening on http://${config.host}:${config.port} (env=${config.env})`
    );
  });

  const shutdown = async (signal) => {
    console.log(`[CIRERMS] Received ${signal}, shutting down gracefully...`);
    server.close(async () => {
      await db.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 5000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start();
