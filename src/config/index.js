'use strict';

const path = require('path');
const dotenv = require('dotenv');

const ROOT_DIR = path.resolve(__dirname, '..', '..');
dotenv.config({ path: path.join(ROOT_DIR, '.env') });

function toInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
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

  uploads: Object.freeze({
    rootDir: uploadRoot,
    photosDir: path.join(uploadRoot, 'photos'),
    documentsDir: path.join(uploadRoot, 'documents'),
    maxPhotoBytes: toInt(process.env.MAX_PHOTO_SIZE_MB, 5) * 1024 * 1024,
    maxDocBytes: toInt(process.env.MAX_DOC_SIZE_MB, 15) * 1024 * 1024,
    maxExcelBytes: toInt(process.env.MAX_EXCEL_SIZE_MB, 10) * 1024 * 1024,
  }),
});

module.exports = config;
