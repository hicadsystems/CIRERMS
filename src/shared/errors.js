'use strict';

class AppError extends Error {
  constructor(status, code, message, fields = null) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    if (fields && Object.keys(fields).length > 0) {
      this.fields = fields;
    }
  }
}

function badRequest(message, code = 'BAD_REQUEST', fields = null) {
  return new AppError(400, code, message, fields);
}

function validationError(message, fields = {}) {
  return new AppError(422, 'VALIDATION_ERROR', message, fields);
}

function unauthorized(message = 'Authentication required.', code = 'UNAUTHORIZED') {
  return new AppError(401, code, message);
}

function forbidden(message = 'You do not have permission to perform this action.', code = 'FORBIDDEN') {
  return new AppError(403, code, message);
}

function notFound(message = 'Requested resource was not found.', code = 'NOT_FOUND') {
  return new AppError(404, code, message);
}

function conflict(message, code = 'CONFLICT', fields = null) {
  return new AppError(409, code, message, fields);
}

function asyncHandler(fn) {
  return function wrappedMiddleware(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  AppError,
  badRequest,
  validationError,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  asyncHandler,
};
