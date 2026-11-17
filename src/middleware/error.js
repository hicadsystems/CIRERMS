'use strict';

const multer = require('multer');
const { AppError } = require('../shared/errors');

function notFoundHandler(req, res) {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Endpoint not found: ${req.method} ${req.originalUrl}`,
    },
  });
}

function errorHandler(err, _req, res, _next) {
  if (err instanceof AppError) {
    const payload = {
      error: {
        code: err.code,
        message: err.message,
      },
    };
    if (err.fields) {
      payload.error.fields = err.fields;
    }
    return res.status(err.status).json(payload);
  }

  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? 'Uploaded file exceeds the maximum allowed size.'
      : `Upload error: ${err.message}`;
    return res.status(400).json({
      error: {
        code: 'UPLOAD_ERROR',
        message,
      },
    });
  }

  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: {
        code: 'INVALID_JSON',
        message: 'Malformed JSON request body.',
      },
    });
  }

  if (err && err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      error: {
        code: 'DUPLICATE_RECORD',
        message: 'A record with those unique details already exists.',
      },
    });
  }

  if (err && (err.code === 'ER_NO_REFERENCED_ROW_2' || err.code === 'ER_ROW_IS_REFERENCED_2')) {
    return res.status(422).json({
      error: {
        code: 'INVALID_REFERENCE',
        message: 'One or more selected reference values do not exist.',
      },
    });
  }

  console.error('[CIRERMS Unhandled Error]', err);
  return res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected server error occurred. Please try again.',
    },
  });
}

module.exports = {
  notFoundHandler,
  errorHandler,
};
