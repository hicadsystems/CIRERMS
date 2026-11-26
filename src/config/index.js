'use strict';

const path = require('path');
const dotenv = require('dotenv');

const ROOT_DIR = path.resolve(__dirname, '..', '..');
dotenv.config({ path: path.join(ROOT_DIR, '.env') });

function toInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function toPositiveNumber(value, fallback) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const env = (process.env.NODE_ENV || 'development').trim();
const jwtSecret = process.env.JWT_SECRET || '';

if (env === 'production' && (!jwtSecret || jwtSecret.includes('replace-with') || jwtSecret.includes('change-this'))) {
  throw new Error('FATAL: Set a strong JWT_SECRET in .env before running in production.');
}

const uploadRoot = process.env.UPLOAD_DIR
  ? path.resolve(ROOT_DIR, process.env.UPLOAD_DIR)
  : path.join(ROOT_DIR, 'storage', 'uploads');

const config = Object.freeze({
  env,
  isProduction: env === 'production',
  host: process.env.HOST || '0.0.0.0',
  port: toInt(process.env.PORT, 3000),
  rootDir: ROOT_DIR,
  publicDir: path.join(ROOT_DIR, 'public'),

  db: Object.freeze({
    host: process.env.DB_HOST || '127.0.0.1',
    port: toInt(process.env.DB_PORT, 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'cirerms',
    connectionLimit: toInt(process.env.DB_POOL_LIMIT, 10),
  }),

  jwt: Object.freeze({
    secret: jwtSecret || 'cirerms-local-dev-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  }),

  // Session lock: the screen locks after this many minutes without use (decimals allowed, so a
  // test can use a few seconds). The server also locks a session that has made no request for
  // the idle time plus a grace period (a closed or sleeping tab), as a backstop.
  session: Object.freeze({
    idleMinutes: toPositiveNumber(process.env.SESSION_IDLE_MINUTES, 15),
    serverGraceSeconds: toInt(process.env.SESSION_SERVER_GRACE_SECONDS, 120),
  }),

  // Mail (Forgot Password): with no SMTP_HOST, development writes each message to MAIL_DIR instead
  // of sending it, and production logs a warning and sends nothing.
  mail: Object.freeze({
    smtpHost: (process.env.SMTP_HOST || '').trim(),
    smtpPort: toInt(process.env.SMTP_PORT, 587),
    smtpSecure: /^(1|true|yes)$/i.test((process.env.SMTP_SECURE || '').trim()),
    smtpUser: (process.env.SMTP_USER || '').trim(),
    smtpPassword: process.env.SMTP_PASSWORD || '',
    from: (process.env.MAIL_FROM || '').trim() || 'CIRERMS <no-reply@cirerms.example>',
    dir: process.env.MAIL_DIR ? path.resolve(ROOT_DIR, process.env.MAIL_DIR) : path.join(ROOT_DIR, 'storage', 'mail'),
  }),

  uploads: Object.freeze({
    rootDir: uploadRoot,
    photosDir: path.join(uploadRoot, 'photos'),
    documentsDir: path.join(uploadRoot, 'documents'),
    maxPhotoBytes: toInt(process.env.MAX_PHOTO_SIZE_MB, 5) * 1024 * 1024,
    maxDocBytes: toInt(process.env.MAX_DOC_SIZE_MB, 15) * 1024 * 1024,
    maxExcelBytes: toInt(process.env.MAX_EXCEL_SIZE_MB, 10) * 1024 * 1024,
  }),

  // Printouts: PDFs made by Chromium from the HTML templates (src/shared/printouts). Settings are read at
  // first use; with no PDF_CHROMIUM_PATH the browser comes from @sparticuz/chromium.
  pdf: Object.freeze({
    chromiumPath: (process.env.PDF_CHROMIUM_PATH || '').trim(),
    tabPoolSize: toInt(process.env.PDF_TAB_POOL_SIZE, 2),
    browserIdleMs: toInt(process.env.PDF_BROWSER_IDLE_MS, 60000),
    browserMaxPages: toInt(process.env.PDF_BROWSER_MAX_PAGES, 300),
    timeoutMs: toInt(process.env.PDF_TIMEOUT_MS, 60000),
    fontWaitMs: toInt(process.env.PDF_FONT_WAIT_MS, 5000),
    maxHtmlMb: toPositiveNumber(process.env.PDF_MAX_HTML_MB, 10),
    tempDir: process.env.PDF_TEMP_DIR ? path.resolve(ROOT_DIR, process.env.PDF_TEMP_DIR) : '',
  }),
});

module.exports = config;
