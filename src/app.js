'use strict';

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const config = require('./config');
const db = require('./db');
const authRoutes = require('./modules/auth/auth.routes');
const dashboardRoutes = require('./modules/dashboard/dashboard.routes');
const lookupsRoutes = require('./modules/lookups/lookups.routes');
const ratingsRoutes = require('./modules/ratings/ratings.routes');
const { notFoundHandler, errorHandler } = require('./middleware/error');

const app = express();

app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(
  helmet({
    // Allow embedding in preview iframes while keeping strong script/object CSP
    frameguard: false,
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        fontSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        frameSrc: ["'self'", 'blob:'],
        objectSrc: ["'self'", 'blob:'],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
  })
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// Liveness & DB readiness probe
app.get('/api/health', async (_req, res) => {
  try {
    await db.ping();
    res.json({ data: { status: 'ok', database: 'connected' } });
  } catch (_) {
    res.status(503).json({
      error: { code: 'DB_UNAVAILABLE', message: 'Database connection is unavailable.' },
    });
  }
});

// Feature API routers
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/lookups', lookupsRoutes);
app.use('/api/ratings', ratingsRoutes);

// Catch unknown /api/* routes with JSON 404
app.use('/api', notFoundHandler);

// Serve static SPA shell & partials from public/
app.use(
  express.static(config.publicDir, {
    index: 'index.html',
    etag: true,
    maxAge: config.isProduction ? '1h' : 0,
  })
);

// Friendly root / app routes
app.get('/login', (_req, res) => {
  res.sendFile(path.join(config.publicDir, 'index.html'));
});

app.get('/app', (_req, res) => {
  res.sendFile(path.join(config.publicDir, 'app.html'));
});

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
