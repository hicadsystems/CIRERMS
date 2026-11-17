'use strict';

const mysql = require('mysql2/promise');
const config = require('../config');

let pool = null;

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      database: config.db.database,
      waitForConnections: true,
      connectionLimit: config.db.connectionLimit,
      queueLimit: 0,
      charset: 'utf8mb4',
      // Return DATE columns directly as 'YYYY-MM-DD' strings (no timezone shift)
      dateStrings: ['DATE'],
      timezone: 'Z',
      decimalNumbers: true,
      multipleStatements: false,
    });
  }
  return pool;
}

/**
 * Execute a single parameterised SQL statement using `?` placeholders.
 * Pass `conn` when running inside `transaction()`.
 */
async function query(sql, params = [], conn = null) {
  const executor = conn || getPool();
  const [rows] = await executor.query(sql, params);
  return rows;
}

/**
 * Run `callback(tx)` inside a single MySQL transaction.
 * `tx.query(sql, params)` binds every statement to the transaction connection.
 */
async function transaction(callback) {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const tx = {
      query: (sql, params = []) => query(sql, params, conn),
      connection: conn,
    };
    const result = await callback(tx);
    await conn.commit();
    return result;
  } catch (err) {
    try {
      await conn.rollback();
    } catch (_) {
      // Ignore rollback error so original error surfaces
    }
    throw err;
  } finally {
    conn.release();
  }
}

async function ping() {
  const conn = await getPool().getConnection();
  try {
    await conn.ping();
  } finally {
    conn.release();
  }
}

async function close() {
  if (pool) {
    const active = pool;
    pool = null;
    await active.end();
  }
}

module.exports = {
  getPool,
  query,
  transaction,
  ping,
  close,
};
