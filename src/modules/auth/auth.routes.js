'use strict';

/*
 * Sign in, sign out, who am I, and the session lock. Public module: these routes guard
 * themselves (sign in needs no session; the rest need one, locked or not).
 */
const express = require('express');
const authService = require('./auth.service');
const reset = require('./auth.reset');
const throttle = require('./auth.throttle');
const { requireAuth, setSessionCookie, clearSessionCookie } = require('../../middleware/auth');
const { asyncHandler } = require('../../shared/errors');

const router = express.Router();

const clientKey = (req) => req.ip || 'unknown';

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const key = clientKey(req);
    throttle.check(key);

    try {
      const { token, user } = await authService.login(
        { username: req.body?.username, password: req.body?.password },
        { ip: req.ip, userAgent: req.headers['user-agent'] || null }
      );
      throttle.clear(key);
      setSessionCookie(req, res, token);
      res.json({ data: { user, token } });
    } catch (err) {
      if (err && err.code === 'INVALID_CREDENTIALS') throttle.fail(key);
      throw err;
    }
  })
);

// Forgot Password (sign-in page, no session). Step 1: ask for a code. The answer is the same for every
// Official Number, and for a client the throttle has stopped; a code goes only to an active account with an
// e-mail address. Every request counts against the client's throttle, like a failed sign-in.
router.post(
  '/forgot-password',
  asyncHandler(async (req, res) => {
    const key = clientKey(req);
    const meta = { ip: req.ip, userAgent: req.headers['user-agent'] || null };
    try {
      throttle.check(key);
    } catch (err) {
      if (err && err.code === 'TOO_MANY_ATTEMPTS') {
        return res.json({ data: await reset.throttledAnswer() });
      }
      throw err;
    }
    throttle.fail(key);
    const result = await reset.requestCode(req.body?.username, meta);
    return res.json({ data: result });
  })
);

// Step 2: the code and the new password. A wrong code counts against the client's throttle.
router.post(
  '/reset-password',
  asyncHandler(async (req, res) => {
    const key = clientKey(req);
    throttle.check(key);
    try {
      const result = await reset.resetPassword(req.body || {}, { ip: req.ip, userAgent: req.headers['user-agent'] || null });
      throttle.clear(key);
      res.json({ data: result });
    } catch (err) {
      if (err && err.code === 'INVALID_CODE') throttle.fail(key);
      throw err;
    }
  })
);

// Sign Out works from the lock screen too; an expired session just clears the cookie.
router.post('/logout', (req, res, next) => {
  requireAuth.allowLocked(req, res, async (err) => {
    try {
      if (!err && req.user) await authService.signOut(req.user, req.actor);
      clearSessionCookie(req, res);
      res.json({ data: { loggedOut: true } });
    } catch (e) {
      next(e);
    }
  });
});

// For the sign-in page: is a session open? Always 200, so a signed-out visit logs no error.
router.get('/status', (req, res, next) => {
  requireAuth.allowLocked(req, res, (err) => {
    if (err && !(err.status === 401)) return next(err);
    return res.json({ data: { signedIn: !err && !!req.user } });
  });
});

router.get(
  '/me',
  requireAuth.allowLocked,
  asyncHandler(async (req, res) => {
    res.json({ data: authService.describeSession(req.user) });
  })
);

// Keeps an active session open while the person works without calling the server.
router.post(
  '/ping',
  requireAuth.allowPasswordChange,
  (_req, res) => {
    res.json({ data: { ok: true } });
  }
);

// Change Password (account menu, and the forced change at first sign-in or after a reset).
// Open to a session that must change its password, since that is how it stops having to.
router.post(
  '/change-password',
  requireAuth.allowPasswordChange,
  asyncHandler(async (req, res) => {
    const key = clientKey(req);
    throttle.check(key);
    try {
      const result = await authService.changePassword(req.user, req.actor, req.body || {});
      throttle.clear(key);
      res.json({ data: result });
    } catch (err) {
      if (err && err.code === 'WRONG_PASSWORD') throttle.fail(key);
      throw err;
    }
  })
);

router.post(
  '/lock',
  requireAuth.allowLocked,
  asyncHandler(async (req, res) => {
    const result = await authService.lockSession(req.user, req.body?.reason, req.actor);
    res.json({ data: result });
  })
);

router.post(
  '/unlock',
  requireAuth.allowLocked,
  asyncHandler(async (req, res) => {
    const key = clientKey(req);
    throttle.check(key);
    try {
      const result = await authService.unlockSession(req.user, req.body?.password, req.actor);
      throttle.clear(key);
      res.json({ data: result });
    } catch (err) {
      if (err && err.code === 'WRONG_PASSWORD' && req.body?.password) throttle.fail(key);
      throw err;
    }
  })
);

module.exports = router;
