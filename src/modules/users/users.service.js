'use strict';

const db = require('../../db');
const audit = require('../../shared/audit');
const password = require('../../shared/password');
const usersRepo = require('./users.repo');
const { validationError, notFound, conflict } = require('../../shared/errors');

const PAGE_SIZE = 25;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+?[0-9][0-9 ()-]{5,28}$/;

const text = (v, max) => {
  const s = String(v ?? '').trim();
  return s ? s.slice(0, max) : null;
};

function toDto(r) {
  return {
    id: r.id,
    username: r.username,
    fullName: r.full_name,
    roleId: r.role_id,
    role: r.role_name,
    fullAccess: !!r.full_access,
    serviceNumber: r.service_number || null,
    email: r.email || null,
    phone: r.phone || null,
    specialisationId: r.specialisation_id || null,
    specialisation: r.specialisation_name || null,
    isActive: !!r.is_active,
    mustChangePassword: !!r.must_change_password,
    lastLoginAt: r.last_login_at || null,
    passwordChangedAt: r.password_changed_at || null,
    createdAt: r.created_at,
  };
}

/** The row as the audit trail keeps it: readable names, never the hash. */
function auditRow(r) {
  return {
    username: r.username,
    full_name: r.full_name,
    role: r.role_name,
    service_number: r.service_number,
    specialisation: r.specialisation_name,
    email: r.email,
    phone: r.phone,
    status: r.is_active ? 'Active' : 'Inactive',
  };
}

async function list(query = {}) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(query.pageSize, 10) || PAGE_SIZE));
  const roleId = Number.parseInt(query.roleId, 10) || null;
  let active = null;
  if (query.active === '1' || query.active === 'true') active = true;
  if (query.active === '0' || query.active === 'false') active = false;
  const { items, total } = await usersRepo.list({ q: text(query.q, 100), roleId, active }, { page, pageSize });
  return { items: items.map(toDto), page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

async function get(idRaw) {
  const row = await usersRepo.findById(Number.parseInt(idRaw, 10) || 0);
  if (!row) throw notFound('Account not found.');
  return toDto(row);
}

/** The choices for the dialogs and filters: roles and Specialisations. */
async function meta() {
  const [roles, specs] = await Promise.all([usersRepo.listRoles(), usersRepo.listSpecialisations()]);
  return {
    roles: roles.map((r) => ({ id: r.id, name: r.name, fullAccess: !!r.full_access })),
    specialisations: specs.map((s) => ({ id: s.id, name: s.name, active: !!s.is_active })),
  };
}

/** Finds one account by user name or official number, for Manage Password. */
async function lookup(term) {
  const t = text(term, 50);
  if (!t) throw validationError('Enter an official number or user name.', { q: 'Enter an official number or user name.' });
  const row = await usersRepo.findByLogin(t);
  if (!row) throw notFound(`No account has the official number or user name "${t}".`, 'ACCOUNT_NOT_FOUND');
  return toDto(row);
}

/**
 * Checks and cleans the fields of an add or an edit; `current` is the account being edited. Every account
 * belongs to a rating: on an add the official number is required, the rating must exist and have no account
 * yet, and it becomes the user name. On an edit the rating (and so the user name) is fixed.
 */
async function parseFields(body, { current = null } = {}, conn = null) {
  const errors = {};
  const f = {
    fullName: text(body.fullName, 150),
    roleId: Number.parseInt(body.roleId, 10) || null,
    serviceNumber: current ? current.service_number : (text(body.serviceNumber, 20) || '').toUpperCase() || null,
    email: text(body.email, 150),
    phone: text(body.phone, 30),
    specialisationId: Number.parseInt(body.specialisationId, 10) || null,
  };

  if (!current) {
    if (!f.serviceNumber) {
      errors.serviceNumber = 'Find the rating this account is for.';
    } else if (!(await usersRepo.findRating(f.serviceNumber, conn))) {
      errors.serviceNumber = 'No rating has this official number.';
    } else {
      const holder = await usersRepo.findByServiceNumber(f.serviceNumber, conn);
      if (holder) errors.serviceNumber = `This rating already has the account ${holder.username}.`;
    }
  }
  if (!f.fullName) errors.fullName = 'Full name is required.';
  if (!f.roleId) errors.roleId = 'Choose a role.';
  if (f.email && !EMAIL.test(f.email)) errors.email = 'Enter a valid e-mail address.';
  if (f.phone && !PHONE.test(f.phone)) errors.phone = 'Enter a valid phone number.';

  if (f.roleId && !(await usersRepo.findRole(f.roleId, conn))) errors.roleId = 'That role does not exist.';
  if (f.specialisationId) {
    const s = await usersRepo.findSpecialisation(f.specialisationId, conn);
    // an inactive Specialisation the account already holds stays; it cannot be newly picked
    if (!s) errors.specialisationId = 'That Specialisation does not exist.';
    else if (!s.is_active && !(current && current.specialisation_id === s.id)) errors.specialisationId = 'That Specialisation is inactive.';
  }
  if (Object.keys(errors).length) {
    const dup = errors.serviceNumber && errors.serviceNumber.includes('already has');
    const e = validationError(dup ? errors.serviceNumber : 'Check the highlighted fields.', errors);
    if (dup) {
      e.status = 409;
      e.code = 'RATING_HAS_ACCOUNT';
    }
    throw e;
  }
  return f;
}

/** Ratings to start an account from (official number or name), each with the account it already has. */
async function findRatings(term) {
  const q = text(term, 50);
  if (!q || q.length < 2) return [];
  const rows = await usersRepo.searchRatings(q, 8);
  return rows.map((r) => ({
    serviceNumber: r.service_number,
    name: [r.surname, r.first_name, r.middle_name].filter(Boolean).join(' '),
    rate: r.rate_name || null,
    status: r.status,
    account: r.account || null,
  }));
}

/** Adds an account with a random one-time password, returned once and kept nowhere in clear. */
async function create(body, actor) {
  const oneTime = password.generateOneTime();
  const passwordHash = await password.hash(oneTime);
  const id = await db.transaction(async (tx) => {
    const f = await parseFields(body, {}, tx.connection);
    if (await usersRepo.findByUsername(f.serviceNumber, tx.connection)) {
      throw conflict('That user name is already in use.', 'DUPLICATE_USERNAME', { serviceNumber: 'That user name is already in use.' });
    }
    const newId = await usersRepo.insert({ ...f, passwordHash, createdBy: actor.userId }, tx.connection);
    const after = await usersRepo.findById(newId, tx.connection);
    const changes = audit.diff(null, auditRow(after));
    changes.push({ field: 'credentials', from: null, to: 'One-time password issued' });
    await audit.record(tx, actor, { action: 'INSERT', table: 'users', recordId: after.username, changes });
    return newId;
  });
  return { user: await get(id), oneTimePassword: oneTime };
}

async function update(idRaw, body, actor) {
  const id = Number.parseInt(idRaw, 10) || 0;
  await db.transaction(async (tx) => {
    const before = await usersRepo.findById(id, tx.connection, { lock: true });
    if (!before) throw notFound('Account not found.');
    const f = await parseFields(body, { current: before }, tx.connection);
    if (f.roleId !== before.role_id) {
      if (id === actor.userId) {
        throw conflict('You cannot change the role of your own account.', 'SELF_ROLE_CHANGE', { roleId: 'You cannot change your own role.' });
      }
      const role = await usersRepo.findRole(f.roleId, tx.connection);
      if (before.full_access && before.is_active && !role.full_access
        && (await usersRepo.countOtherActiveAdministrators(id, tx.connection)) === 0) {
        throw conflict('This is the last active administrator. Make another account an administrator first.', 'LAST_ADMIN', { roleId: 'The last active administrator cannot be moved to another role.' });
      }
    }
    await usersRepo.update(id, f, tx.connection);
    const after = await usersRepo.findById(id, tx.connection);
    await audit.record(tx, actor, { action: 'UPDATE', table: 'users', recordId: before.username, before: auditRow(before), after: auditRow(after) });
  });
  return get(id);
}

/** Deactivates (active = false) or reactivates an account. Deactivating ends its sessions. */
async function setActive(idRaw, active, actor) {
  const id = Number.parseInt(idRaw, 10) || 0;
  await db.transaction(async (tx) => {
    const before = await usersRepo.findById(id, tx.connection, { lock: true });
    if (!before) throw notFound('Account not found.');
    if (!!before.is_active === active) {
      throw conflict(active ? 'This account is already active.' : 'This account is already deactivated.', 'NO_CHANGE');
    }
    if (!active) {
      if (id === actor.userId) throw conflict('You cannot deactivate your own account.', 'SELF_DEACTIVATE');
      if (before.full_access && (await usersRepo.countOtherActiveAdministrators(id, tx.connection)) === 0) {
        throw conflict('This is the last active administrator and cannot be deactivated.', 'LAST_ADMIN');
      }
    }
    await usersRepo.setActive(id, active, tx.connection);
    if (!active) await usersRepo.endSessions(id, tx.connection);
    const after = await usersRepo.findById(id, tx.connection);
    await audit.record(tx, actor, { action: 'UPDATE', table: 'users', recordId: before.username, before: auditRow(before), after: auditRow(after) });
  });
  return get(id);
}

/**
 * An administrator's reset: a new one-time password, shown once; the person's sessions end and they
 * choose their own password at next sign-in. The password is in the response only.
 */
async function resetPassword(idRaw, actor) {
  const id = Number.parseInt(idRaw, 10) || 0;
  const oneTime = password.generateOneTime();
  const passwordHash = await password.hash(oneTime);
  const username = await db.transaction(async (tx) => {
    const target = await usersRepo.findById(id, tx.connection, { lock: true });
    if (!target) throw notFound('Account not found.');
    if (id === actor.userId) throw conflict('Use Change Password in the account menu for your own account.', 'SELF_RESET');
    if (!target.is_active) throw conflict('This account is deactivated. Reactivate it before resetting its password.', 'ACCOUNT_INACTIVE');
    await usersRepo.setOneTimePassword(id, passwordHash, tx.connection);
    const ended = await usersRepo.endSessions(id, tx.connection);
    await audit.record(tx, actor, {
      action: 'UPDATE',
      table: 'users',
      recordId: target.username,
      changes: [
        { field: 'credentials', from: null, to: 'Reset by an administrator: one-time password issued' },
        { field: 'sessions', from: ended ? `${ended} open` : 'None open', to: 'Ended' },
      ],
    });
    return target.username;
  });
  return { user: await get(id), username, oneTimePassword: oneTime };
}

module.exports = { list, get, meta, lookup, findRatings, create, update, setActive, resetPassword };
