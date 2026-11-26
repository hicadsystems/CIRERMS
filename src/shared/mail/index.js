'use strict';

/*
 * Mail: the one place the app sends an e-mail.
 *
 *   send({ to, subject, text, html })   sends it, or (no SMTP_HOST, development) writes it to MAIL_DIR
 *   describe()                          one line saying where mail goes, for the start-up log
 *
 * With no SMTP_HOST, development writes each message as an .eml file under MAIL_DIR (default
 * storage/mail/, git-ignored) so it can be read without a mail server. Production with no SMTP_HOST
 * sends nothing and says so in the log. Nothing here logs a message's body.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const config = require('../../config');

let smtp = null;
let filer = null;

function smtpTransport() {
  if (!smtp) {
    const { mail } = config;
    smtp = nodemailer.createTransport({
      host: mail.smtpHost,
      port: mail.smtpPort,
      secure: mail.smtpSecure,
      auth: mail.smtpUser ? { user: mail.smtpUser, pass: mail.smtpPassword } : undefined,
    });
  }
  return smtp;
}

function fileTransport() {
  if (!filer) filer = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: 'unix' });
  return filer;
}

function configured() {
  return !!config.mail.smtpHost;
}

function describe() {
  if (configured()) return `E-mail is sent through ${config.mail.smtpHost}:${config.mail.smtpPort}.`;
  if (config.isProduction) {
    return 'WARNING: SMTP_HOST is not set, so no e-mail can be sent: Forgot Password will send no codes until a mail server is set in .env.';
  }
  return `SMTP_HOST is not set: e-mail is written to ${path.relative(config.rootDir, config.mail.dir) || config.mail.dir}/ instead of being sent.`;
}

/** Sends a message; resolves { sent: true } or { sent: false, reason }. Never throws on a send problem. */
async function send({ to, subject, text, html }) {
  const message = { from: config.mail.from, to, subject, text, html };
  try {
    if (configured()) {
      await smtpTransport().sendMail(message);
      return { sent: true };
    }
    if (config.isProduction) {
      console.warn('[CIRERMS] An e-mail was not sent: SMTP_HOST is not set.');
      return { sent: false, reason: 'no mail server' };
    }
    const built = await fileTransport().sendMail(message);
    await fs.promises.mkdir(config.mail.dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..*$/, '');
    const file = path.join(config.mail.dir, `${stamp}-${crypto.randomBytes(3).toString('hex')}.eml`);
    await fs.promises.writeFile(file, built.message);
    console.log(`[CIRERMS] E-mail written to ${path.relative(config.rootDir, file)} (no mail server set).`);
    return { sent: true, file };
  } catch (err) {
    console.error(`[CIRERMS] An e-mail could not be sent: ${err.message}`);
    return { sent: false, reason: 'send failed' };
  }
}

module.exports = { send, describe, configured };
