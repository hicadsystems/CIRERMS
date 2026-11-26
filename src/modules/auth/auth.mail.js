'use strict';

/* The e-mail that carries a Forgot Password code: plain words, the code large, no link. */

const NAME = 'CIRERMS, Nigerian Navy';

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** { subject, text, html } for the code e-mailed to an account. */
function resetMail({ officialNumber, code, minutes }) {
  const subject = 'Your CIRERMS code';
  const text = [
    `A request was made to reset the password of Official Number ${officialNumber}.`,
    '',
    'Your code is:',
    '',
    `    ${code}`,
    '',
    `It is valid for ${minutes} minutes and works once.`,
    '',
    'If you did not ask for this, ignore this e-mail; your password has not changed.',
    '',
    NAME,
    '',
  ].join('\n');
  const html = [
    '<div style="font-family: Arial, Helvetica, sans-serif; font-size: 15px; line-height: 1.5;">',
    `<p>A request was made to reset the password of Official Number ${escapeHtml(officialNumber)}.</p>`,
    '<p>Your code is:</p>',
    `<p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; margin: 12px 0;">${escapeHtml(code)}</p>`,
    `<p>It is valid for ${minutes} minutes and works once.</p>`,
    '<p>If you did not ask for this, ignore this e-mail; your password has not changed.</p>',
    `<p>${NAME}</p>`,
    '</div>',
  ].join('\n');
  return { subject, text, html };
}

module.exports = { resetMail };
