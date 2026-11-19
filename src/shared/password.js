'use strict';

/*
 * Passwords: the one place they are hashed, checked, generated and judged.
 *
 *   hash(plain)            bcrypt hash to store (never stored or logged in clear)
 *   verify(plain, hash)    true when they match
 *   validateNew(plain, { current })   the message for a password that breaks the rules, or null
 *   generateOneTime()      a random one-time password that meets the rules, shown once
 *
 * The rules: at least 8 characters with a letter and a digit, and different from the current one.
 */
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const ROUNDS = 10;
const MIN_LENGTH = 8;
const MAX_LENGTH = 72; // bcrypt ignores everything after 72 bytes

const hash = (plain) => bcrypt.hash(String(plain), ROUNDS);
const verify = (plain, stored) => bcrypt.compare(String(plain), stored);

/** The reason a new password is refused, or null when it is acceptable. */
function validateNew(plain, { current = null } = {}) {
  const p = String(plain ?? '');
  if (p.length < MIN_LENGTH) return `Use at least ${MIN_LENGTH} characters.`;
  if (Buffer.byteLength(p) > MAX_LENGTH) return `Use at most ${MAX_LENGTH} characters.`;
  if (!/[A-Za-z]/.test(p)) return 'Include at least one letter.';
  if (!/\d/.test(p)) return 'Include at least one number.';
  if (current !== null && p === String(current)) return 'Choose a password different from the current one.';
  return null;
}

// no 0/O, 1/l/I: a one-time password is read off a screen and typed
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const DIGITS = '23456789';

function pick(set) {
  return set[crypto.randomInt(set.length)];
}

/** 12 random characters with letters and digits (always valid under validateNew). */
function generateOneTime(length = 12) {
  const chars = [pick(LETTERS.toUpperCase()), pick(LETTERS.toLowerCase()), pick(DIGITS), pick(DIGITS)];
  const all = LETTERS + DIGITS;
  while (chars.length < length) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

module.exports = { MIN_LENGTH, hash, verify, validateNew, generateOneTime };
