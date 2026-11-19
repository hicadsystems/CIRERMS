'use strict';

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../../config');
const db = require('../../db');
const audit = require('../../shared/audit');
const passwords = require('../../shared/password');
const { accountName, accountInitials } = require('../../shared/rating-name');
const authRepo = require('./auth.repo');
const { validationError, unauthorized, forbidden, AppError } = require('../../shared/errors');

// Dummy hash so unknown-username checks spend similar CPU time to real bcrypt checks
const DUMMY_BCRYPT_HASH = '$2a$10$DPILpLh/fazxj74u1LMyd.vUIgQbxiAqrYUXzz8C9DZpgh2bJhT42';
// how often an active session's last-seen time is written (seconds)
const TOUCH_EVERY_SECONDS = 30;
const LOCK_REASONS = ['idle', 'manual'];

function formatUserDto(row) {
  return {
    id: row.id,
    username: row.username,
    fullName: accountName(row), // from the account's rating
    initials: accountInitials(row),
    role: row.role_name,
    roleId: row.role_id,
    fullAccess: !!row.full_access,
    serviceNumber: row.service_number || null,
    lastLoginAt: row.last_login_at || null,
    mustChangePassword: !!row.must_change_password,
  };
}

/** { screen: [actions] } from privilege rows. */
function privilegeMap(rows) {
  const map = {};
  for (const { screen, action } of rows) {
    (map[screen] = map[screen] || []).push(action);
  }
  return map;
}

function sessionSettings() {
  return {
    idleMinutes: config.session.idleMinutes,
  };
}

function lockedError(reason) {
  const err = new AppError(423, 'SESSION_LOCKED', 'This session is locked. Enter your password to unlock it.');
  err.fields = { reason: reason || 'idle' };
  return err;
}

async function login({ username, password }, meta = {}) {
  const cleanUsername = String(username || '').trim();
  const rawPassword = String(password || '');

  const fields = {};
  if (!cleanUsername) fields.username = 'Username is required.';
  if (!rawPassword) fields.password = 'Password is required.';
  if (Object.keys(fields).length > 0) {
    throw validationError('Please enter both Username and Password.', fields);
  }

  const userRow = await authRepo.findByUsername(cleanUsername);
  const hashToCheck = userRow ? userRow.password_hash : DUMMY_BCRYPT_HASH;
  const matched = await bcrypt.compare(rawPassword, hashToCheck);

  if (!userRow || !matched) {
    throw unauthorized('Invalid username or password.', 'INVALID_CREDENTIALS');
  }

  if (!userRow.is_active) {
    throw forbidden('This user account has been deactivated. Contact HICO Administration.', 'ACCOUNT_DISABLED');
  }

  const sessionId = crypto.randomBytes(16).toString('hex');
  const actor = { userId: userRow.id, username: userRow.username, ip: meta.ip, userAgent: meta.userAgent };
  await db.transaction(async (tx) => {
    await authRepo.touchLastLogin(userRow.id, tx.connection);
    await authRepo.insertSession({
      id: sessionId,
      userId: userRow.id,
      ip: meta.ip ? String(meta.ip).slice(0, 45) : null,
      userAgent: meta.userAgent ? String(meta.userAgent).slice(0, 255) : null,
    }, tx.connection);
    await audit.record(tx, actor, {
      action: 'SIGN IN',
      table: 'users',
      recordId: userRow.username,
      changes: [{ field: 'Session', from: null, to: 'Open' }],
    });
  });

  const user = formatUserDto(userRow);
  const token = jwt.sign(
    { sub: user.id, sid: sessionId, username: user.username },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );

  return { token, user };
}

/**
 * The signed-in user for a request, from the session cookie's token payload: who they are,
 * their role and privileges, and whether the session is locked. A session idle for longer
 * than the lock time plus the server's grace period is locked here (the tab was closed or
 * asleep). Throws 401 when the session has ended or the account is no longer active.
 */
async function resolveSession(payload, meta = {}) {
  const sessionId = payload && typeof payload.sid === 'string' ? payload.sid : null;
  if (!sessionId) throw unauthorized('Invalid or expired session. Please sign in again.');

  const row = await authRepo.findSession(sessionId);
  if (!row || Number(row.user_id) !== Number(payload.sub) || row.ended_at) {
    throw unauthorized('Your session has ended. Please sign in again.');
  }
  if (!row.is_active) {
    throw unauthorized('This user account has been deactivated. Contact HICO Administration.');
  }

  const user = {
    ...formatUserDto(row),
    sessionId,
    locked: !!row.locked_at,
    lockReason: row.lock_reason || null,
  };

  const idleLimit = config.session.idleMinutes * 60 + config.session.serverGraceSeconds;
  if (!user.locked && Number(row.idle_seconds) >= idleLimit) {
    await lockSession(user, 'idle', { userId: user.id, username: user.username, ip: meta.ip, userAgent: meta.userAgent });
    user.locked = true;
    user.lockReason = 'idle';
  } else if (!user.locked && Number(row.idle_seconds) >= TOUCH_EVERY_SECONDS) {
    await db.transaction((tx) => authRepo.touchSession(sessionId, tx.connection));
  }

  const rows = await authRepo.listRolePrivileges(row.role_id);
  user.privileges = new Set(rows.map((p) => `${p.screen}:${p.action}`));
  user.privilegeMap = privilegeMap(rows);
  return user;
}

/** Locks the session (idle time or Lock Screen) and records it; nothing when already locked. */
async function lockSession(user, reason, actor) {
  const why = LOCK_REASONS.includes(reason) ? reason : 'manual';
  return db.transaction(async (tx) => {
    const changed = await authRepo.lockSession(user.sessionId, why, tx.connection);
    if (changed) {
      await audit.record(tx, actor, {
        action: 'LOCK',
        table: 'users',
        recordId: user.username,
        changes: [{ field: 'Session', from: 'Open', to: why === 'idle' ? 'Locked (idle)' : 'Locked' }],
      });
    }
    return { locked: true, lockReason: changed ? why : user.lockReason || why };
  });
}

/** Unlocks with the account's password only. A wrong password is a 422 the throttle counts. */
async function unlockSession(user, password, actor) {
  const raw = String(password || '');
  if (!raw) {
    throw new AppError(422, 'WRONG_PASSWORD', 'Enter your password.', { password: 'Enter your password' });
  }
  const row = await authRepo.findById(user.id);
  const matched = await bcrypt.compare(raw, row ? row.password_hash : DUMMY_BCRYPT_HASH);
  if (!row || !matched) {
    throw new AppError(422, 'WRONG_PASSWORD', 'Wrong password.', { password: 'Wrong password' });
  }
  await db.transaction(async (tx) => {
    const changed = await authRepo.unlockSession(user.sessionId, tx.connection);
    if (changed) {
      await audit.record(tx, actor, {
        action: 'UNLOCK',
        table: 'users',
        recordId: user.username,
        changes: [{ field: 'Session', from: 'Locked', to: 'Open' }],
      });
    }
  });
  return { locked: false };
}

async function signOut(user, actor) {
  await db.transaction(async (tx) => {
    const changed = await authRepo.endSession(user.sessionId, tx.connection);
    if (changed) {
      await audit.record(tx, actor, {
        action: 'SIGN OUT',
        table: 'users',
        recordId: user.username,
        changes: [{ field: 'Session', from: user.locked ? 'Locked' : 'Open', to: 'Closed' }],
      });
    }
  });
}

/**
 * Change Password: the current one, a new one and its confirmation. The new one follows the
 * rules (shared/password.js); the person's other sessions are signed out, this one stays.
 * Neither password is written to the audit trail.
 */
async function changePassword(user, actor, { currentPassword, newPassword, confirmPassword } = {}) {
  const fields = {};
  if (!currentPassword) fields.currentPassword = 'Enter your current password.';
  if (!newPassword) fields.newPassword = 'Enter a new password.';
  else {
    const bad = passwords.validateNew(newPassword, { current: currentPassword || null });
    if (bad) fields.newPassword = bad;
  }
  if (!confirmPassword) fields.confirmPassword = 'Confirm the new password.';
  else if (newPassword && confirmPassword !== newPassword) fields.confirmPassword = 'The passwords do not match.';
  if (Object.keys(fields).length) throw validationError('Check the highlighted fields.', fields);

  const row = await authRepo.findById(user.id);
  if (!row || !(await passwords.verify(currentPassword, row.password_hash))) {
    throw new AppError(422, 'WRONG_PASSWORD', 'Your current password is wrong.', { currentPassword: 'Wrong password.' });
  }
  const passwordHash = await passwords.hash(newPassword);
  const signedOut = await db.transaction(async (tx) => {
    await authRepo.setPassword(user.id, passwordHash, tx.connection);
    const ended = await authRepo.endOtherSessions(user.id, user.sessionId, tx.connection);
    await audit.record(tx, actor, {
      action: 'UPDATE',
      table: 'users',
      recordId: user.username,
      changes: [
        { field: 'credentials', from: null, to: user.mustChangePassword ? 'Chose own password' : 'Changed by the user' },
        { field: 'other sessions', from: ended ? `${ended} open` : 'None open', to: 'Ended' },
      ],
    });
    return ended;
  });
  return { changed: true, otherSessionsEnded: signedOut };
}

/** What the app shell needs: the user, their privileges and the session's lock state and settings. */
function describeSession(user) {
  const { privileges, privilegeMap: map, sessionId, locked, lockReason, ...dto } = user;
  return {
    user: dto,
    privileges: map,
    session: { locked, lockReason, ...sessionSettings() },
  };
}

module.exports = {
  login,
  resolveSession,
  lockSession,
  unlockSession,
  signOut,
  changePassword,
  describeSession,
  lockedError,
};
