'use strict';

const express = require('express');
const authService = require('./auth.service');
const { requireAuth, setSessionCookie, clearSessionCookie } = require('../../middleware/auth');
const { asyncHandler, AppError } = require('../../shared/errors');

const router = express.Router();

// Lightweight in-memory failed-login throttle per client IP
const loginAttempts = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 25;

function checkLoginThrottle(ip) {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry) return;
  if (now - entry.firstAt > WINDOW_MS) {
    loginAttempts.delete(ip);
    return;
  }
  if (entry.count >= MAX_FAILURES) {
    throw new AppError(429, 'TOO_MANY_ATTEMPTS', 'Too many failed sign-in attempts. Please wait 15 minutes and try again.');
  }
}

function recordLoginFailure(ip) {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now - entry.firstAt > WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, firstAt: now });
  } else {
    entry.count += 1;
  }
}

function clearLoginFailures(ip) {
  loginAttempts.delete(ip);
}

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const ip = req.ip || 'unknown';
    checkLoginThrottle(ip);

    try {
      const { token, user } = await authService.login({
        username: req.body?.username,
        password: req.body?.password,
      });
      clearLoginFailures(ip);
      setSessionCookie(req, res, token);
      res.json({ data: { user, token } });
    } catch (err) {
      if (err && err.code === 'INVALID_CREDENTIALS') {
        recordLoginFailure(ip);
      }
      throw err;
    }
  })
);

router.post('/logout', (req, res) => {
  clearSessionCookie(req, res);
  res.json({ data: { loggedOut: true } });
});

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await authService.getCurrentUser(req.user.id);
    res.json({ data: { user } });
  })
);

module.exports = router;
