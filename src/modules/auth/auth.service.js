'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../../config');
const authRepo = require('./auth.repo');
const { validationError, unauthorized, forbidden } = require('../../shared/errors');

// Dummy hash so unknown-username checks spend similar CPU time to real bcrypt checks
const DUMMY_BCRYPT_HASH = '$2a$10$DPILpLh/fazxj74u1LMyd.vUIgQbxiAqrYUXzz8C9DZpgh2bJhT42';

function formatUserDto(row) {
  return {
    id: row.id,
    username: row.username,
    fullName: row.full_name,
    role: row.role,
    serviceNumber: row.service_number || null,
    lastLoginAt: row.last_login_at || null,
  };
}

async function login({ username, password }) {
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

  await authRepo.touchLastLogin(userRow.id);

  const user = formatUserDto(userRow);
  const token = jwt.sign(
    {
      sub: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      serviceNumber: user.serviceNumber,
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );

  return { token, user };
}

async function getCurrentUser(userId) {
  const row = await authRepo.findById(userId);
  if (!row || !row.is_active) {
    throw unauthorized('Session is no longer valid. Please sign in again.');
  }
  return formatUserDto(row);
}

module.exports = {
  login,
  getCurrentUser,
};
