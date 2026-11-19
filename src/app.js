'use strict';

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const config = require('./config');
const db = require('./db');
const { mountModules } = require('./modules');
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
        // PDF.js draws the app's own PDF preview in a worker served from our own origin
        workerSrc: ["'self'", 'blob:'],
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

// Every module's router, from its manifest (src/modules/<module>/<module>.module.js)
mountModules(app);

// Catch unknown /api/* routes with JSON 404
app.use('/api', notFoundHandler);

// PDF.js (the pdfjs-dist package), served from our own origin for the app's PDF preview
// (public/js/ui/pdf-preview.js): the library and worker, and the fonts a PDF may name without embedding
try {
  const pdfjsDir = path.dirname(require.resolve('pdfjs-dist/package.json'));
  app.use('/vendor/pdfjs/build', express.static(path.join(pdfjsDir, 'build'), { maxAge: config.isProduction ? '1d' : 0 }));
  app.use('/vendor/pdfjs/standard_fonts', express.static(path.join(pdfjsDir, 'standard_fonts'), { maxAge: config.isProduction ? '1d' : 0 }));
} catch (_) {
  console.warn('[CIRERMS] pdfjs-dist is not installed: run npm install; the PDF preview needs it.');
}

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
