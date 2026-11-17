'use strict';

const jwt = require('jsonwebtoken');
const config = require('../config');
const { unauthorized } = require('../shared/errors');

const COOKIE_NAME = 'cirerms_session';
const EIGHT_HOURS_SECONDS = 8 * 60 * 60;

function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader || typeof cookieHeader !== 'string') return cookies;
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) continue;
    const key = part.slice(0, eqIdx).trim();
    const rawVal = part.slice(eqIdx + 1).trim();
    if (!key) continue;
    try {
      cookies[key] = decodeURIComponent(rawVal);
    } catch (_) {
      cookies[key] = rawVal;
    }
  }
  return cookies;
}

function isSecureRequest(req) {
  if (req.secure) return true;
  const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
  return proto === 'https';
}

function setSessionCookie(req, res, token) {
  const secure = isSecureRequest(req);
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    `Max-Age=${EIGHT_HOURS_SECONDS}`,
    'HttpOnly',
  ];
  if (secure) {
    // SameSite=None + Partitioned (CHIPS) allows HttpOnly cookies to work in both standalone HTTPS and embedded previews
    parts.push('SameSite=None', 'Secure', 'Partitioned');
  } else {
    parts.push('SameSite=Lax');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearSessionCookie(req, res) {
  const secure = isSecureRequest(req);
  const parts = [
    `${COOKIE_NAME}=`,
    'Path=/',
    'Max-Age=0',
    'HttpOnly',
  ];
  if (secure) {
    parts.push('SameSite=None', 'Secure', 'Partitioned');
  } else {
    parts.push('SameSite=Lax');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

function extractToken(req) {
  const cookies = parseCookies(req.headers.cookie);
  if (cookies[COOKIE_NAME]) {
    return cookies[COOKIE_NAME];
  }
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  return null;
}

function requireAuth(req, _res, next) {
  const token = extractToken(req);
  if (!token) {
    return next(unauthorized('Your session has expired or you are not signed in.'));
  }

  try {
    const payload = jwt.verify(token, config.jwt.secret);
    req.user = {
      id: payload.sub,
      username: payload.username,
      fullName: payload.fullName,
      role: payload.role,
      serviceNumber: payload.serviceNumber || null,
    };
    return next();
  } catch (_) {
    return next(unauthorized('Invalid or expired session. Please sign in again.'));
  }
}

module.exports = {
  COOKIE_NAME,
  requireAuth,
  setSessionCookie,
  clearSessionCookie,
};
