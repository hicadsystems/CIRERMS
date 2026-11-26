'use strict';

/*
 * Forgot Password: an e-mailed one-time code (sign-in page, no session).
 *
 *   requestCode(officialNumber, meta)   always answers the same; sends a code only to an active account with an e-mail
 *   resetPassword(body, meta)           the code and a new password; ends every session of the account
 *
 * The rules: a 6-digit code (crypto.randomInt), kept only as an HMAC with a server secret; valid for
 * 10 minutes, used once, 5 wrong tries, 3 codes an account an hour. A replaced or dead code has its hash
 * cleared. The answer to a request is the same for every Official Number and takes about the same time,
 * so it shows nothing about which accounts exist. A code is never logged or written to the audit trail.
 */
const crypto = require('crypto');
const config = require('../../config');
const db = require('../../db');
const audit = require('../../shared/audit');
const passwords = require('../../shared/password');
const mail = require('../../shared/mail');
const authRepo = require('./auth.repo');
const { resetMail } = require('./auth.mail');
const { AppError, validationError } = require('../../shared/errors');

const CODE_MINUTES = 10;
const MAX_WRONG_TRIES = 5;
const MAX_CODES_PER_HOUR = 3;
// every answer to a request takes at least this long, so a real account and any other look alike
const MIN_REQUEST_MS = 700;

const NEUTRAL_MESSAGE =
  `If this Official Number has an account with an e-mail address, a code has been sent to it. It is valid for ${CODE_MINUTES} minutes.`;
const BAD_CODE_MESSAGE = 'That code is not right, or it has expired. Check it, or ask for a new code.';

const clean = (v) => String(v || '').trim().slice(0, 50);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** The code as it is kept: an HMAC with the server secret, tied to the account. */
function hashCode(userId, code) {
  return crypto.createHmac('sha256', config.jwt.secret).update(`reset:${userId}:${code}`).digest('hex');
}

function sameHash(a, b) {
  const x = Buffer.from(String(a), 'hex');
  const y = Buffer.from(String(b), 'hex');
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
}

function actorFor(user, officialNumber, meta) {
  return {
    userId: user ? user.id : null,
    username: user ? user.username : officialNumber,
    ip: meta.ip || null,
    userAgent: meta.userAgent || null,
  };
}

const eligible = (user) => !!(user && user.is_active && user.email && /^\S+@\S+\.\S+$/.test(user.email));

/**
 * Asks for a code. Resolves { message } whatever the Official Number is; a code is e-mailed only when
 * the account is active, has an e-mail address and has not used up its 3 codes this hour.
 */
async function requestCode(officialNumber, meta = {}) {
  const startedAt = Date.now();
  const number = clean(officialNumber);
  if (!number) throw validationError('Enter your Official Number.', { username: 'Enter your Official Number.' });

  let toSend = null;
  try {
    const user = await authRepo.findForReset(number);
    toSend = await db.transaction(async (tx) => {
      const conn = tx.connection;
      let outcome = 'No code sent (no account)';
      let pending = null;
      if (user) {
        await authRepo.lockUser(user.id, conn);
        if (!user.is_active) outcome = 'No code sent (account not active)';
        else if (!eligible(user)) outcome = 'No code sent (no e-mail address)';
        else if ((await authRepo.countRecentCodes(user.id, conn)) >= MAX_CODES_PER_HOUR) {
          outcome = `No code sent (limit of ${MAX_CODES_PER_HOUR} an hour)`;
        } else {
          const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
          await authRepo.replaceCodes(user.id, hashCode(user.id, code), CODE_MINUTES, conn);
          outcome = 'Code e-mailed';
          pending = { to: user.email, username: user.username, code };
        }
      }
      await authRepo.pruneCodes(conn);
      await audit.record(tx, actorFor(user, number, meta), {
        action: 'UPDATE',
        table: 'users',
        recordId: user ? user.username : number,
        changes: [{ field: 'reset code', from: null, to: `Requested: ${outcome}` }],
      });
      return pending;
    });
  } catch (err) {
    // a database fault must not tell a real account from another: log it, answer the same
    console.error(`[CIRERMS] Forgot Password request failed: ${err.message}`);
  }

  if (toSend) {
    const message = resetMail({ officialNumber: toSend.username, code: toSend.code, minutes: CODE_MINUTES });
    // not awaited: a slow mail server must not make a real account answer slower
    mail.send({ to: toSend.to, ...message }).catch(() => {});
  }
  const wait = MIN_REQUEST_MS - (Date.now() - startedAt);
  if (wait > 0) await sleep(wait);
  return { message: NEUTRAL_MESSAGE };
}

/** The answer for a client the throttle has stopped: nothing sent, the same words, the same wait. */
async function throttledAnswer() {
  await sleep(MIN_REQUEST_MS);
  return { message: NEUTRAL_MESSAGE };
}

/** The same answer for an unknown number, a wrong code, an expired one and a dead one. */
function badCode() {
  return new AppError(422, 'INVALID_CODE', BAD_CODE_MESSAGE, { code: BAD_CODE_MESSAGE });
}

/**
 * Sets a new password with the e-mailed code. Resolves { reset: true }; throws 422 INVALID_CODE when the
 * code does not work (every reason answers alike), or 422 with the fields when the form is wrong.
 */
async function resetPassword({ username, code, newPassword, confirmPassword } = {}, meta = {}) {
  const number = clean(username);
  const typed = String(code || '').replace(/\s+/g, '');
  const fields = {};
  if (!number) fields.username = 'Enter your Official Number.';
  if (!typed) fields.code = 'Enter the 6-digit code from the e-mail.';
  else if (!/^\d{6}$/.test(typed)) fields.code = 'The code is 6 digits.';
  if (!newPassword) fields.newPassword = 'Enter a new password.';
  else {
    const bad = passwords.validateNew(newPassword);
    if (bad) fields.newPassword = bad;
  }
  if (!confirmPassword) fields.confirmPassword = 'Confirm the new password.';
  else if (newPassword && confirmPassword !== newPassword) fields.confirmPassword = 'The passwords do not match.';
  if (Object.keys(fields).length) throw validationError('Check the highlighted fields.', fields);

  const passwordHash = await passwords.hash(newPassword);
  const user = await authRepo.findForReset(number);

  const worked = await db.transaction(async (tx) => {
    const conn = tx.connection;
    let note = 'No code for this account';
    let live = null;
    if (user) {
      await authRepo.lockUser(user.id, conn);
      live = await authRepo.findLiveCode(user.id, conn);
    }
    const actor = actorFor(user, number, meta);
    const fail = async (why) => {
      await audit.record(tx, actor, {
        action: 'UPDATE',
        table: 'users',
        recordId: user ? user.username : number,
        changes: [{ field: 'reset code', from: null, to: `Refused: ${why}` }],
      });
      return false;
    };

    if (!user || !user.is_active) return fail(user ? 'account not active' : note);
    if (!live) return fail(note);
    if (live.expired) {
      await authRepo.killCode(live.id, conn);
      return fail('code expired');
    }
    const right = sameHash(hashCode(user.id, typed), live.code_hash);
    if (!right) {
      await authRepo.countWrongTry(live.id, MAX_WRONG_TRIES, conn);
      return fail(Number(live.wrong_tries) + 1 >= MAX_WRONG_TRIES ? 'wrong code, code now dead' : 'wrong code');
    }

    await authRepo.setPassword(user.id, passwordHash, conn);
    const ended = await authRepo.endAllSessions(user.id, conn);
    await authRepo.deleteCode(live.id, conn);
    await audit.record(tx, actor, {
      action: 'UPDATE',
      table: 'users',
      recordId: user.username,
      changes: [
        { field: 'credentials', from: null, to: 'Password reset by e-mailed code' },
        { field: 'sessions', from: ended ? `${ended} open` : 'None open', to: 'Ended' },
      ],
    });
    return true;
  });

  if (!worked) throw badCode();
  return { reset: true };
}

module.exports = {
  requestCode,
  throttledAnswer,
  resetPassword,
  NEUTRAL_MESSAGE,
  CODE_MINUTES,
  MAX_WRONG_TRIES,
  MAX_CODES_PER_HOUR,
};
