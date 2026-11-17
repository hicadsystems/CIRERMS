'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const config = require('../config');
const { badRequest } = require('../shared/errors');

function ensureUploadDirs() {
  fs.mkdirSync(config.uploads.photosDir, { recursive: true });
  fs.mkdirSync(config.uploads.documentsDir, { recursive: true });
}

function detectImageSignature(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return null;
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { ext: '.jpg', mime: 'image/jpeg' };
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89
    && buf[1] === 0x50
    && buf[2] === 0x4e
    && buf[3] === 0x47
    && buf[4] === 0x0d
    && buf[5] === 0x0a
    && buf[6] === 0x1a
    && buf[7] === 0x0a
  ) {
    return { ext: '.png', mime: 'image/png' };
  }
  // WebP: RIFF....WEBP
  if (
    buf.slice(0, 4).toString('ascii') === 'RIFF'
    && buf.slice(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { ext: '.webp', mime: 'image/webp' };
  }
  return null;
}

function detectDocumentSignature(buf, originalExt) {
  const imageSig = detectImageSignature(buf);
  if (imageSig) return imageSig;
  if (!Buffer.isBuffer(buf) || buf.length < 5) return null;

  // PDF: %PDF-
  if (buf.slice(0, 5).toString('ascii') === '%PDF-') {
    return { ext: '.pdf', mime: 'application/pdf' };
  }

  // DOCX (OOXML ZIP): 50 4B 03 04
  if (
    originalExt === '.docx'
    && buf[0] === 0x50
    && buf[1] === 0x4b
    && buf[2] === 0x03
    && buf[3] === 0x04
  ) {
    return {
      ext: '.docx',
      mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
  }

  // Legacy DOC (OLE Compound File): D0 CF 11 E0 A1 B1 1A E1
  if (
    originalExt === '.doc'
    && buf.length >= 8
    && buf[0] === 0xd0
    && buf[1] === 0xcf
    && buf[2] === 0x11
    && buf[3] === 0xe0
  ) {
    return { ext: '.doc', mime: 'application/msword' };
  }

  return null;
}

function detectXlsxSignature(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 4) return false;
  return buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04;
}

const photoMulter = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.uploads.maxPhotoBytes, files: 1 },
}).single('photo');

const documentMulter = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.uploads.maxDocBytes, files: 1 },
}).single('document');

const excelMulter = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.uploads.maxExcelBytes, files: 1 },
}).single('file');

function persistValidatedPhoto(req, _res, next) {
  photoMulter(req, _res, (err) => {
    if (err) return next(err);
    if (!req.file) {
      return next(badRequest('Please select an image file (.jpg, .png, or .webp) to upload.', 'MISSING_FILE'));
    }

    const origExt = path.extname(req.file.originalname || '').toLowerCase();
    if (!['.jpg', '.jpeg', '.png', '.webp'].includes(origExt)) {
      return next(badRequest('Only JPG, PNG, or WebP images are permitted.', 'INVALID_FILE_TYPE'));
    }

    const detected = detectImageSignature(req.file.buffer);
    if (!detected) {
      return next(badRequest('Uploaded file content is not a valid JPEG, PNG, or WebP image.', 'INVALID_FILE_SIGNATURE'));
    }

    ensureUploadDirs();
    const storedName = `${crypto.randomUUID()}${detected.ext}`;
    const diskPath = path.join(config.uploads.photosDir, storedName);
    fs.writeFileSync(diskPath, req.file.buffer);

    req.savedPhoto = {
      storedName,
      diskPath,
      mimeType: detected.mime,
      sizeBytes: req.file.size,
    };
    return next();
  });
}

function persistValidatedDocument(req, _res, next) {
  documentMulter(req, _res, (err) => {
    if (err) return next(err);
    if (!req.file) {
      return next(badRequest('Please choose a document file to upload.', 'MISSING_FILE'));
    }

    const origName = path.basename(req.file.originalname || 'document');
    const origExt = path.extname(origName).toLowerCase();
    if (!['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.doc', '.docx'].includes(origExt)) {
      return next(
        badRequest('Unsupported document type. Allowed formats: PDF, JPG, PNG, WebP, DOC, DOCX.', 'INVALID_FILE_TYPE')
      );
    }

    const detected = detectDocumentSignature(req.file.buffer, origExt);
    if (!detected) {
      return next(
        badRequest('File content does not match a valid PDF, image, or Word document.', 'INVALID_FILE_SIGNATURE')
      );
    }

    ensureUploadDirs();
    const storedName = `${crypto.randomUUID()}${detected.ext}`;
    const diskPath = path.join(config.uploads.documentsDir, storedName);
    fs.writeFileSync(diskPath, req.file.buffer);

    req.savedDocument = {
      originalName: origName.slice(0, 250),
      storedName,
      diskPath,
      mimeType: detected.mime,
      sizeBytes: req.file.size,
    };
    return next();
  });
}

function parseValidatedExcel(req, _res, next) {
  excelMulter(req, _res, (err) => {
    if (err) return next(err);
    if (!req.file) {
      return next(badRequest('Please choose an Excel (.xlsx) file before clicking Process.', 'MISSING_FILE'));
    }

    const origExt = path.extname(req.file.originalname || '').toLowerCase();
    if (origExt !== '.xlsx') {
      return next(
        badRequest('Only modern Excel (.xlsx) workbooks are accepted. Download the template to get started.', 'INVALID_FILE_TYPE')
      );
    }

    if (!detectXlsxSignature(req.file.buffer)) {
      return next(badRequest('The uploaded file is not a valid .xlsx workbook.', 'INVALID_FILE_SIGNATURE'));
    }

    return next();
  });
}

module.exports = {
  persistValidatedPhoto,
  persistValidatedDocument,
  parseValidatedExcel,
};
