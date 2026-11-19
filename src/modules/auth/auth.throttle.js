'use strict';

/*
 * The sign-in throttle: failed password attempts per client address, shared by sign in and
 * by unlocking a locked session, so the lock screen cannot be used to guess a password faster
 * than the sign-in page. Kept in memory (one server process).
 */
const { AppError } = require('../../shared/errors');

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 25;
const attempts = new Map();

function check(key) {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry) return;
  if (now - entry.firstAt > WINDOW_MS) {
    attempts.delete(key);
    return;
  }
  if (entry.count >= MAX_FAILURES) {
    throw new AppError(429, 'TOO_MANY_ATTEMPTS', 'Too many failed password attempts. Please wait 15 minutes and try again.');
  }
}

function fail(key) {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now - entry.firstAt > WINDOW_MS) attempts.set(key, { count: 1, firstAt: now });
  else entry.count += 1;
}

function clear(key) {
  attempts.delete(key);
}

module.exports = { check, fail, clear, WINDOW_MS, MAX_FAILURES };
