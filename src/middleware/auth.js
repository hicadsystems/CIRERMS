'use strict';

/*
 * Who is signed in. The session cookie (or a Bearer token) carries a JWT naming the session
 * row; requireAuth loads the session, the user, their role and privileges on every request
 * (so a role change or a deactivated account takes effect at once) into req.user, and the
 * actor for the audit trail into req.actor.
 *
 *   requireAuth               refuses a locked session with 423 SESSION_LOCKED
 *   requireAuth.allowLocked   lets a locked session through (unlock, sign out, me, lock)
 *   requireAuth.allowPasswordChange   lets a session through that must still change its password
 *                             (Change Password itself); every other route answers 403
 *                             PASSWORD_CHANGE_REQUIRED until it has
 */
const jwt = require('jsonwebtoken');
const config = require('../config');
const { unauthorized, forbidden } = require('../shared/errors');
const { actorFrom } = require('../shared/audit');
const authService = require('../modules/auth/auth.service');

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

function authenticate({ allowLocked, allowPasswordChange = allowLocked }) {
  return async function authMiddleware(req, _res, next) {
    const token = extractToken(req);
    if (!token) {
      return next(unauthorized('Your session has expired or you are not signed in.'));
    }

    let payload;
    try {
      payload = jwt.verify(token, config.jwt.secret);
    } catch (_) {
      return next(unauthorized('Invalid or expired session. Please sign in again.'));
    }

    try {
      req.user = await authService.resolveSession(payload, {
        ip: req.ip,
        userAgent: req.headers['user-agent'] || null,
      });
      req.actor = actorFrom(req);
      if (req.user.locked && !allowLocked) {
        return next(authService.lockedError(req.user.lockReason));
      }
      // a new or reset account must choose its own password before anything else opens
      if (req.user.mustChangePassword && !allowPasswordChange) {
        return next(forbidden('You must choose a new password before you continue.', 'PASSWORD_CHANGE_REQUIRED'));
      }
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

const requireAuth = authenticate({ allowLocked: false });
requireAuth.allowLocked = authenticate({ allowLocked: true });
// not locked, but may be a session that has still to change its password
requireAuth.allowPasswordChange = authenticate({ allowLocked: false, allowPasswordChange: true });

module.exports = {
  COOKIE_NAME,
  requireAuth,
  extractToken,
  setSessionCookie,
  clearSessionCookie,
};
