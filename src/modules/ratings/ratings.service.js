'use strict';

const fs = require('fs');
const path = require('path');
const config = require('../../config');
const db = require('../../db');
const audit = require('../../shared/audit');
const ratingsRepo = require('./ratings.repo');
const lookupsRepo = require('../lookups/lookups.repo');
const { parseIsoDate, formatDisplayDate } = require('../../shared/dates');
const {
  buildBatchTemplateWorkbook,
  parseBatchUploadBuffer,
  buildRatingsExcelBuffer,
  buildRatingsCsvString,
} = require('../../shared/excel');
const {
  buildRatingsListPdf,
  buildRatingTabPdf,
  buildRatingDossierPdf,
} = require('../../shared/pdf');
const {
  badRequest,
  validationError,
  notFound,
  conflict,
} = require('../../shared/errors');

const SERVICE_NUMBER_RE = /^[A-Z0-9][A-Z0-9/-]{1,19}$/;

function normaliseServiceNumber(raw) {
  return String(raw || '').trim().toUpperCase();
}

function cleanNullableString(val, maxLen = 255) {
  if (val === undefined) return undefined;
  if (val === null) return null;
  const trimmed = String(val).trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLen);
}

function parseNullableId(val, fieldName, errors) {
  if (val === undefined) return undefined;
  if (val === null || val === '') return null;
  const parsed = Number.parseInt(val, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    errors[fieldName] = 'Invalid selection.';
    return undefined;
  }
  return parsed;
}

function parseNullableDecimal(val, { fieldName, label, min, max }, errors) {
  if (val === undefined) return undefined;
  if (val === null || String(val).trim() === '') return null;
  const num = Number(val);
  if (!Number.isFinite(num) || num < min || num > max) {
    errors[fieldName] = `${label} must be between ${min} and ${max}.`;
    return undefined;
  }
  return num;
}

function parseCheckedDate(val, fieldName, errors) {
  if (val === undefined) return undefined;
  const res = parseIsoDate(val);
  if (!res.valid) {
    errors[fieldName] = res.error;
    return undefined;
  }
  return res.value;
}

function sanitiseRatingPayload(payload = {}, { isCreate = false } = {}) {
  const errors = {};
  const record = {};

  if (isCreate || payload.service_number !== undefined) {
    const sn = normaliseServiceNumber(payload.service_number);
    if (!sn) {
      errors.service_number = 'Official Number is required.';
    } else if (!SERVICE_NUMBER_RE.test(sn)) {
      errors.service_number = 'Official Number must be 2–20 letters/digits (e.g. B0539 or B0559F).';
    } else {
      record.service_number = sn;
    }
  }

  if (isCreate || payload.surname !== undefined) {
    const surname = cleanNullableString(payload.surname, 100);
    if (!surname) {
      errors.surname = 'Surname is required.';
    } else {
      record.surname = surname.toUpperCase();
    }
  }

  if (isCreate || payload.first_name !== undefined) {
    const firstName = cleanNullableString(payload.first_name, 100);
    if (!firstName) {
      errors.first_name = 'First Name is required.';
    } else {
      record.first_name = firstName.toUpperCase();
    }
  }

  if (payload.middle_name !== undefined) {
    const mn = cleanNullableString(payload.middle_name, 100);
    record.middle_name = mn ? mn.toUpperCase() : null;
  }
  if (payload.maiden_name !== undefined) {
    const mdn = cleanNullableString(payload.maiden_name, 100);
    record.maiden_name = mdn ? mdn.toUpperCase() : null;
  }

  const fkFields = [
    'rate_id',
    'title_id',
    'gender_id',
    'marital_status_id',
    'religion_id',
    'religion_denomination_id',
    'tribe_id',
    'state_id',
    'local_government_id',
    'mother_base_id',
    'geo_political_zone_id',
    'identification_type_id',
    'hair_color_id',
    'eye_color_id',
    'complexion_id',
    'blood_group_id',
    'blood_genotype_id',
    'disability_id',
    'branch_id',
    'command_id',
    'staff_branch_id',
    'entry_mode_id',
    'exit_type_id',
    'specialisation_id',
  ];

  for (const fk of fkFields) {
    const parsed = parseNullableId(payload[fk], fk, errors);
    if (parsed !== undefined) {
      record[fk] = parsed;
    }
  }

  const dateFields = [
    'date_of_birth',
    'driver_license_expiry_date',
    'seniority_date',
    'exit_date',
    'date_employed',
  ];
  for (const df of dateFields) {
    const parsed = parseCheckedDate(payload[df], df, errors);
    if (parsed !== undefined) {
      record[df] = parsed;
    }
  }

  const textSpecs = [
    ['married_to_military_personnel', 100],
    ['home_address', 2000],
    ['place_of_birth', 150],
    ['email_address', 150],
    ['phone', 30],
    ['driver_license_number', 50],
    ['identity_number', 50],
    ['disability_comment', 2000],
    ['exit_reason', 2000],
    ['hobbies', 255],
  ];
  for (const [col, maxLen] of textSpecs) {
    if (payload[col] !== undefined) {
      record[col] = cleanNullableString(payload[col], maxLen);
    }
  }

  if (record.email_address && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.email_address)) {
    errors.email_address = 'Enter a valid email address.';
  }

  const weight = parseNullableDecimal(
    payload.weight_kg,
    { fieldName: 'weight_kg', label: 'Weight (kg)', min: 20, max: 350 },
    errors
  );
  if (weight !== undefined) record.weight_kg = weight;

  const height = parseNullableDecimal(
    payload.height_m,
    { fieldName: 'height_m', label: 'Height in metres (e.g. 1.78)', min: 0.5, max: 2.6 },
    errors
  );
  if (height !== undefined) record.height_m = height;

  const chest = parseNullableDecimal(
    payload.chest_cm,
    { fieldName: 'chest_cm', label: 'Chest (cm)', min: 30, max: 250 },
    errors
  );
  if (chest !== undefined) record.chest_cm = chest;

  if (payload.tribal_mark !== undefined) {
    record.tribal_mark = payload.tribal_mark === true || payload.tribal_mark === 1 || payload.tribal_mark === '1' ? 1 : 0;
  }

  if (payload.status !== undefined) {
    if (!['current', 'former'].includes(payload.status)) {
      errors.status = 'Status must be "current" or "former".';
    } else {
      record.status = payload.status;
    }
  } else if (record.exit_type_id || record.exit_date) {
    record.status = 'former';
  } else if (isCreate) {
    record.status = 'current';
  }

  if (Object.keys(errors).length > 0) {
    throw validationError('Please correct the highlighted fields before saving.', errors);
  }

  return record;
}

function decoratePhotoUrls(rating) {
  if (!rating) return null;
  const sn = encodeURIComponent(rating.service_number);
  return {
    ...rating,
    passport_photo_url: rating.passport_photo_path
      ? `/api/ratings/${sn}/photo/passport?v=${encodeURIComponent(rating.passport_photo_path)}`
      : null,
    next_of_kin_photo_url: rating.next_of_kin_photo_path
      ? `/api/ratings/${sn}/photo/next-of-kin?v=${encodeURIComponent(rating.next_of_kin_photo_path)}`
      : null,
  };
}

// Shared by the list and its exports: the status, search and filter keys a list accepts.
// status is 'current' (default), 'former' or 'all' (the search palette and the Documents picker).
function parseListFilters(queryParams = {}) {
  const rawStatus = String(queryParams.status || '').toLowerCase();
  const status = rawStatus === 'former' ? 'former' : rawStatus === 'all' ? null : 'current';
  const positiveId = (v) => {
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  return {
    status,
    officialNo: String(queryParams.officialNo || '').trim(),
    name: String(queryParams.name || '').trim(),
    search: String(queryParams.search || '').trim(),
    q: String(queryParams.q || '').trim().slice(0, 100),
    rateId: positiveId(queryParams.rateId),
    shipId: positiveId(queryParams.shipId),
    sortBy: String(queryParams.sortBy || 'service_number'),
    sortDir: String(queryParams.sortDir || 'asc').toLowerCase() === 'desc' ? 'desc' : 'asc',
  };
}

async function listRatings(queryParams = {}) {
  const filters = parseListFilters(queryParams);

  const rawPage = Number.parseInt(queryParams.page, 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;

  const rawSize = Number.parseInt(queryParams.pageSize, 10);
  const pageSize = Number.isFinite(rawSize) && rawSize > 0 ? Math.min(rawSize, 200) : 25;

  return ratingsRepo.listRatings({ ...filters, page, pageSize });
}

async function getFullDossier(serviceNumberRaw) {
  const sn = normaliseServiceNumber(serviceNumberRaw);
  if (!sn) throw badRequest('Official Number is required.');

  const rating = await ratingsRepo.findByServiceNumber(sn);
  if (!rating) {
    throw notFound(`No rating found with Official Number "${sn}".`);
  }

  const children = await ratingsRepo.fetchAllChildBundles(sn);
  return {
    rating: decoratePhotoUrls(rating),
    children,
  };
}

async function getMyDetails(user) {
  if (!user.serviceNumber) {
    return {
      linked: false,
      serviceNumber: null,
      message:
        `Account "${user.username}" is an administrative account and is not linked to a personal rating service number. `
        + 'Use Current Ratings List or Former Ratings List to view personnel dossiers, or sign in as demo rating B0539 to preview a personal service dossier.',
      rating: null,
      children: null,
    };
  }

  const rating = await ratingsRepo.findByServiceNumber(user.serviceNumber);
  if (!rating) {
    return {
      linked: false,
      serviceNumber: user.serviceNumber,
      message: `Linked service number "${user.serviceNumber}" was not found in personnel records.`,
      rating: null,
      children: null,
    };
  }

  const children = await ratingsRepo.fetchAllChildBundles(rating.service_number);
  return {
    linked: true,
    serviceNumber: rating.service_number,
    message: null,
    rating: decoratePhotoUrls(rating),
    children,
  };
}

async function createRating(payload, actor) {
  const fields = sanitiseRatingPayload(payload, { isCreate: true });
  fields.created_by = actor.userId || null;

  const exists = await ratingsRepo.existsByServiceNumber(fields.service_number);
  if (exists) {
    throw conflict(
      `Official Number "${fields.service_number}" already exists in CIRERMS.`,
      'DUPLICATE_SERVICE_NUMBER',
      { service_number: `Official Number "${fields.service_number}" is already registered.` }
    );
  }

  await db.transaction(async (tx) => {
    await ratingsRepo.insertRating(fields, tx.connection);
    const after = await ratingsRepo.findRawRating(fields.service_number, tx.connection);
    await audit.record(tx, actor, { action: 'INSERT', table: 'ratings', recordId: fields.service_number, after });
  });
  return getFullDossier(fields.service_number);
}

async function updateRating(serviceNumberRaw, payload, actor) {
  const currentSn = normaliseServiceNumber(serviceNumberRaw);
  const existing = await ratingsRepo.findByServiceNumber(currentSn);
  if (!existing) {
    throw notFound(`No rating found with Official Number "${currentSn}".`);
  }

  const fields = sanitiseRatingPayload(payload, { isCreate: false });
  if (fields.service_number && fields.service_number !== currentSn) {
    const targetTaken = await ratingsRepo.existsByServiceNumber(fields.service_number);
    if (targetTaken) {
      throw conflict(
        `Official Number "${fields.service_number}" is already assigned to another rating.`,
        'DUPLICATE_SERVICE_NUMBER',
        { service_number: `Official Number "${fields.service_number}" is already in use.` }
      );
    }
  }

  const effectiveSn = fields.service_number || currentSn;
  await db.transaction(async (tx) => {
    const before = await ratingsRepo.findRawRating(currentSn, tx.connection);
    await ratingsRepo.updateRatingByServiceNumber(currentSn, fields, tx.connection);
    const after = await ratingsRepo.findRawRating(effectiveSn, tx.connection);
    await audit.record(tx, actor, { action: 'UPDATE', table: 'ratings', recordId: effectiveSn, before, after });
  });
  return getFullDossier(effectiveSn);
}

async function deleteRating(serviceNumberRaw, actor) {
  const sn = normaliseServiceNumber(serviceNumberRaw);
  const existing = await ratingsRepo.findByServiceNumber(sn);
  if (!existing) {
    throw notFound(`No rating found with Official Number "${sn}".`);
  }

  const docs = await ratingsRepo.listDocuments(sn);
  await db.transaction(async (tx) => {
    const before = await ratingsRepo.findRawRating(sn, tx.connection);
    await ratingsRepo.deleteRating(sn, tx.connection);
    await audit.record(tx, actor, { action: 'DELETE', table: 'ratings', recordId: sn, before });
  });

  // Clean up stored files best-effort after DB delete succeeds
  const photoFiles = [existing.passport_photo_path, existing.next_of_kin_photo_path].filter(Boolean);
  for (const pf of photoFiles) {
    safeUnlink(path.join(config.uploads.photosDir, path.basename(pf)));
  }
  for (const doc of docs) {
    if (doc.stored_name) {
      safeUnlink(path.join(config.uploads.documentsDir, path.basename(doc.stored_name)));
    }
  }

  return { deleted: true, serviceNumber: sn };
}

function safeUnlink(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (_) {
    // Ignore file cleanup errors
  }
}

// ============================================================================
// Photos (passport & next-of-kin)
// ============================================================================

async function saveRatingPhoto(serviceNumberRaw, kind, savedPhoto, actor) {
  const sn = normaliseServiceNumber(serviceNumberRaw);
  const col = kind === 'next-of-kin' ? 'next_of_kin_photo_path' : kind === 'passport' ? 'passport_photo_path' : null;
  if (!col) {
    safeUnlink(savedPhoto.diskPath);
    throw badRequest('Photo kind must be "passport" or "next-of-kin".');
  }

  const existing = await ratingsRepo.findByServiceNumber(sn);
  if (!existing) {
    safeUnlink(savedPhoto.diskPath);
    throw notFound(`Save the rating record before uploading a ${kind} photograph.`);
  }

  const oldPath = existing[col];
  try {
    await db.transaction(async (tx) => {
      const before = await ratingsRepo.findRawRating(sn, tx.connection);
      await ratingsRepo.updateRatingByServiceNumber(sn, { [col]: savedPhoto.storedName }, tx.connection);
      const after = await ratingsRepo.findRawRating(sn, tx.connection);
      await audit.record(tx, actor, { action: 'UPDATE', table: 'ratings', recordId: sn, before, after });
    });
  } catch (err) {
    safeUnlink(savedPhoto.diskPath);
    throw err;
  }

  if (oldPath && oldPath !== savedPhoto.storedName) {
    safeUnlink(path.join(config.uploads.photosDir, path.basename(oldPath)));
  }

  const refreshed = await ratingsRepo.findByServiceNumber(sn);
  return decoratePhotoUrls(refreshed);
}

async function resolveRatingPhotoFile(serviceNumberRaw, kind) {
  const sn = normaliseServiceNumber(serviceNumberRaw);
  const col = kind === 'next-of-kin' ? 'next_of_kin_photo_path' : kind === 'passport' ? 'passport_photo_path' : null;
  if (!col) {
    throw badRequest('Invalid photo kind.');
  }

  const existing = await ratingsRepo.findByServiceNumber(sn);
  if (!existing || !existing[col]) {
    throw notFound('Photograph not found.');
  }

  const safeName = path.basename(existing[col]);
  const diskPath = path.join(config.uploads.photosDir, safeName);
  if (!fs.existsSync(diskPath)) {
    throw notFound('Photograph file is missing on server.');
  }

  const ext = path.extname(safeName).toLowerCase();
  const mimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
  return { diskPath, mimeType };
}

// ============================================================================
// Child Tab CRUD (8 history/family tabs)
// ============================================================================

const CHILD_TAB_CONFIG = Object.freeze({
  'next-of-kin': {
    table: 'rating_next_of_kin',
    listFn: ratingsRepo.listNextOfKin,
    sanitise(body) {
      const errors = {};
      const firstName = cleanNullableString(body.first_name, 100);
      const lastName = cleanNullableString(body.last_name, 100);
      if (!firstName) errors.first_name = 'First Name is required.';
      if (!lastName) errors.last_name = 'Last Name is required.';
      const nokTypeId = parseNullableId(body.next_of_kin_type_id ?? null, 'next_of_kin_type_id', errors);
      if (Object.keys(errors).length) throw validationError('Please check Next of Kin details.', errors);
      return {
        first_name: firstName,
        last_name: lastName,
        mobile_number: cleanNullableString(body.mobile_number ?? null, 30),
        next_of_kin_type_id: nokTypeId ?? null,
      };
    },
  },

  spouse: {
    table: 'rating_spouse',
    listFn: ratingsRepo.listSpouse,
    sanitise(body) {
      const errors = {};
      const name = cleanNullableString(body.name, 200);
      if (!name) errors.name = 'Spouse Name is required.';
      const email = cleanNullableString(body.email_address ?? null, 150);
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.email_address = 'Enter a valid email address.';
      }
      if (Object.keys(errors).length) throw validationError('Please check Spouse details.', errors);
      return {
        name,
        phone_number: cleanNullableString(body.phone_number ?? null, 30),
        email_address: email,
      };
    },
  },

  children: {
    table: 'rating_children',
    listFn: ratingsRepo.listChildren,
    sanitise(body) {
      const errors = {};
      const name = cleanNullableString(body.name, 200);
      if (!name) errors.name = 'Child Name is required.';
      const email = cleanNullableString(body.email_address ?? null, 150);
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.email_address = 'Enter a valid email address.';
      }
      if (Object.keys(errors).length) throw validationError('Please check Children details.', errors);
      return {
        name,
        phone_number: cleanNullableString(body.phone_number ?? null, 30),
        email_address: email,
      };
    },
  },

  advancement: {
    table: 'rating_advancement',
    listFn: ratingsRepo.listAdvancement,
    sanitise(body) {
      const errors = {};
      const rateId = parseNullableId(body.rate_id, 'rate_id', errors);
      if (!rateId) errors.rate_id = 'Rate is required.';
      const startDate = parseCheckedDate(body.start_date ?? null, 'start_date', errors);
      const endDate = parseCheckedDate(body.end_date ?? null, 'end_date', errors);
      if (startDate && endDate && endDate < startDate) {
        errors.end_date = 'End Date cannot be earlier than Start Date.';
      }
      if (Object.keys(errors).length) throw validationError('Please check Advancement details.', errors);
      return {
        rate_id: rateId,
        start_date: startDate ?? null,
        end_date: endDate ?? null,
        decoration: cleanNullableString(body.decoration ?? null, 150),
        authority: cleanNullableString(body.authority ?? null, 150),
        gcbno: cleanNullableString(body.gcbno ?? null, 50),
      };
    },
  },

  drafting: {
    table: 'rating_drafting',
    listFn: ratingsRepo.listDrafting,
    sanitise(body) {
      const errors = {};
      const shipId = parseNullableId(body.ship_id, 'ship_id', errors);
      if (!shipId) errors.ship_id = 'Ship / Unit is required.';
      const rateId = parseNullableId(body.rate_id ?? null, 'rate_id', errors);
      const startDate = parseCheckedDate(body.start_date ?? null, 'start_date', errors);
      const endDate = parseCheckedDate(body.end_date ?? null, 'end_date', errors);
      if (startDate && endDate && endDate < startDate) {
        errors.end_date = 'End Date cannot be earlier than Start Date.';
      }
      if (Object.keys(errors).length) throw validationError('Please check Drafting details.', errors);
      return {
        ship_id: shipId,
        rate_id: rateId ?? null,
        start_date: startDate ?? null,
        end_date: endDate ?? null,
        remarks: cleanNullableString(body.remarks ?? null, 500),
      };
    },
  },

  training: {
    table: 'rating_training',
    listFn: ratingsRepo.listTraining,
    sanitise(body) {
      const errors = {};
      // the institution and the course are picked from the Static Tables; the name is kept as text too
      const institution = cleanNullableString(body.institution, 200);
      const institutionId = parseNullableId(body.institution_id ?? null, 'institution_id', errors);
      const courseId = parseNullableId(body.training_course_id ?? null, 'training_course_id', errors);
      if (!institution && !institutionId && !courseId) errors.institution_id = 'Institution is required.';
      const startDate = parseCheckedDate(body.start_date ?? null, 'start_date', errors);
      const endDate = parseCheckedDate(body.end_date ?? null, 'end_date', errors);
      if (startDate && endDate && endDate < startDate) {
        errors.end_date = 'End Date cannot be earlier than Start Date.';
      }
      if (Object.keys(errors).length) throw validationError('Please check Training details.', errors);
      return {
        institution,
        institution_id: institutionId ?? null,
        training_course_id: courseId ?? null,
        qualification: cleanNullableString(body.qualification ?? null, 200),
        classification: cleanNullableString(body.classification ?? null, 100),
        start_date: startDate ?? null,
        end_date: endDate ?? null,
      };
    },
  },

  education: {
    table: 'rating_education',
    listFn: ratingsRepo.listEducation,
    sanitise(body) {
      const errors = {};
      const institution = cleanNullableString(body.institution, 200);
      const institutionId = parseNullableId(body.institution_id ?? null, 'institution_id', errors);
      if (!institution && !institutionId) errors.institution_id = 'Institution is required.';
      const startDate = parseCheckedDate(body.start_date ?? null, 'start_date', errors);
      const endDate = parseCheckedDate(body.end_date ?? null, 'end_date', errors);
      if (startDate && endDate && endDate < startDate) {
        errors.end_date = 'End Date cannot be earlier than Start Date.';
      }
      if (Object.keys(errors).length) throw validationError('Please check Education details.', errors);
      return {
        institution,
        institution_id: institutionId ?? null,
        qualification: cleanNullableString(body.qualification ?? null, 200),
        classification: cleanNullableString(body.classification ?? null, 100),
        start_date: startDate ?? null,
        end_date: endDate ?? null,
      };
    },
  },

  language: {
    table: 'rating_language',
    listFn: ratingsRepo.listLanguage,
    sanitise(body) {
      const errors = {};
      const languageId = parseNullableId(body.language_id, 'language_id', errors);
      if (!languageId) errors.language_id = 'Language is required.';
      if (Object.keys(errors).length) throw validationError('Please select a Language.', errors);
      const toBit = (v) => (v === true || v === 1 || v === '1' || v === 'yes' ? 1 : 0);
      return {
        language_id: languageId,
        can_read: toBit(body.can_read),
        can_write: toBit(body.can_write),
        can_speak: toBit(body.can_speak),
      };
    },
  },
});

/**
 * An entry that picks its institution or course from the Static Tables keeps their names as text
 * too (the record shows the name; the Institution and Course rows can be renamed or made inactive
 * without losing it).
 */
async function resolveLinks(fields) {
  const out = { ...fields };
  const errors = {};
  if (out.training_course_id) {
    const [course] = await db.query(
      'SELECT name, institution_id FROM ref_training WHERE id = ?',
      [out.training_course_id]
    );
    if (!course) errors.training_course_id = 'Pick a course from the list.';
    else {
      out.qualification = course.name;
      if (!out.institution_id && course.institution_id) out.institution_id = course.institution_id;
    }
  }
  if (out.institution_id) {
    const [inst] = await db.query('SELECT name FROM ref_institution WHERE id = ?', [out.institution_id]);
    if (!inst) errors.institution_id = 'Pick an institution from the list.';
    else out.institution = inst.name;
  }
  if ('institution' in out && !out.institution) errors.institution_id = 'Institution is required.';
  if (Object.keys(errors).length) throw validationError('Please check the details.', errors);
  return out;
}

function getChildConfig(tabKey) {
  const cfg = CHILD_TAB_CONFIG[tabKey];
  if (!cfg) {
    throw badRequest(`Unsupported record tab "${tabKey}".`);
  }
  return cfg;
}

async function ensureRatingExists(serviceNumberRaw) {
  const sn = normaliseServiceNumber(serviceNumberRaw);
  const rating = await ratingsRepo.findByServiceNumber(sn);
  if (!rating) {
    throw notFound(`No rating found with Official Number "${sn}".`);
  }
  return rating;
}

async function listChildRecords(serviceNumberRaw, tabKey) {
  const cfg = getChildConfig(tabKey);
  const rating = await ensureRatingExists(serviceNumberRaw);
  const items = await cfg.listFn(rating.service_number);
  return { items, currentShipName: rating.current_ship_name || null };
}

async function createChildRecord(serviceNumberRaw, tabKey, body, actor) {
  const cfg = getChildConfig(tabKey);
  const rating = await ensureRatingExists(serviceNumberRaw);
  const fields = await resolveLinks(cfg.sanitise(body || {}));

  try {
    await db.transaction(async (tx) => {
      const id = await ratingsRepo.insertChildRow(cfg.table, {
        service_number: rating.service_number,
        ...fields,
        created_by: actor.userId || null,
      }, tx.connection);
      const after = await ratingsRepo.findChildRow(cfg.table, id, rating.service_number, tx.connection);
      await audit.record(tx, actor, { action: 'INSERT', table: cfg.table, recordId: `${rating.service_number}:${id}`, after });
    });
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY' && tabKey === 'language') {
      throw conflict(
        'This language is already recorded for this rating. Edit the existing row instead.',
        'DUPLICATE_LANGUAGE',
        { language_id: 'Language already added for this rating.' }
      );
    }
    throw err;
  }

  const updatedRating = tabKey === 'drafting' ? await ratingsRepo.findByServiceNumber(rating.service_number) : rating;
  const items = await cfg.listFn(rating.service_number);
  return { items, currentShipName: updatedRating.current_ship_name || null };
}

async function updateChildRecord(serviceNumberRaw, tabKey, rowIdRaw, body, actor) {
  const cfg = getChildConfig(tabKey);
  const rating = await ensureRatingExists(serviceNumberRaw);
  const rowId = Number.parseInt(rowIdRaw, 10);
  if (!Number.isFinite(rowId) || rowId <= 0) {
    throw badRequest('Invalid record ID.');
  }

  const existingRow = await ratingsRepo.findChildRow(cfg.table, rowId, rating.service_number);
  if (!existingRow) {
    throw notFound('Record not found.');
  }

  const fields = await resolveLinks(cfg.sanitise(body || {}));
  try {
    await db.transaction(async (tx) => {
      const before = await ratingsRepo.findChildRow(cfg.table, rowId, rating.service_number, tx.connection);
      await ratingsRepo.updateChildRow(cfg.table, rowId, rating.service_number, fields, tx.connection);
      const after = await ratingsRepo.findChildRow(cfg.table, rowId, rating.service_number, tx.connection);
      await audit.record(tx, actor, { action: 'UPDATE', table: cfg.table, recordId: `${rating.service_number}:${rowId}`, before, after });
    });
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY' && tabKey === 'language') {
      throw conflict(
        'This language is already recorded for this rating.',
        'DUPLICATE_LANGUAGE',
        { language_id: 'Language already added for this rating.' }
      );
    }
    throw err;
  }

  const updatedRating = tabKey === 'drafting' ? await ratingsRepo.findByServiceNumber(rating.service_number) : rating;
  const items = await cfg.listFn(rating.service_number);
  return { items, currentShipName: updatedRating.current_ship_name || null };
}

async function deleteChildRecord(serviceNumberRaw, tabKey, rowIdRaw, actor) {
  const cfg = getChildConfig(tabKey);
  const rating = await ensureRatingExists(serviceNumberRaw);
  const rowId = Number.parseInt(rowIdRaw, 10);
  if (!Number.isFinite(rowId) || rowId <= 0) {
    throw badRequest('Invalid record ID.');
  }

  await db.transaction(async (tx) => {
    const before = await ratingsRepo.findChildRow(cfg.table, rowId, rating.service_number, tx.connection);
    const removed = before && await ratingsRepo.deleteChildRow(cfg.table, rowId, rating.service_number, tx.connection);
    if (!removed) {
      throw notFound('Record not found.');
    }
    await audit.record(tx, actor, { action: 'DELETE', table: cfg.table, recordId: `${rating.service_number}:${rowId}`, before });
  });

  const updatedRating = tabKey === 'drafting' ? await ratingsRepo.findByServiceNumber(rating.service_number) : rating;
  const items = await cfg.listFn(rating.service_number);
  return { items, currentShipName: updatedRating.current_ship_name || null };
}

// ============================================================================
// Documents (Navpers / View Document & 10th Profile Tab)
// ============================================================================

async function getDocumentsBundle(serviceNumberRaw, queryParams = {}) {
  const rating = await ensureRatingExists(serviceNumberRaw);

  let categoryId = null;
  if (queryParams.categoryId) {
    const parsed = Number.parseInt(queryParams.categoryId, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw badRequest('categoryId must be a positive integer.');
    }
    categoryId = parsed;
  }

  const categoryCode = queryParams.categoryCode ? String(queryParams.categoryCode).trim().toUpperCase() : null;

  const documents = await ratingsRepo.listDocuments(rating.service_number, {
    categoryId,
    categoryCode,
  });

  const decoratedDocs = documents.map((d) => ({
    id: d.id,
    service_number: d.service_number,
    category_id: d.category_id,
    category_code: d.category_code,
    category_name: d.category_name,
    original_name: d.original_name,
    mime_type: d.mime_type,
    size_bytes: d.size_bytes,
    created_at: d.created_at,
    view_url: `/api/ratings/${encodeURIComponent(d.service_number)}/documents/${d.id}/file`,
    download_url: `/api/ratings/${encodeURIComponent(d.service_number)}/documents/${d.id}/file?download=1`,
  }));

  return {
    rating: {
      service_number: rating.service_number,
      full_name: rating.full_name,
      rate_name: rating.rate_name,
      current_ship_name: rating.current_ship_name,
      branch_name: rating.branch_name,
      status: rating.status,
    },
    documents: decoratedDocs,
  };
}

async function uploadRatingDocument(serviceNumberRaw, body, savedDocument, actor) {
  const sn = normaliseServiceNumber(serviceNumberRaw);
  const rating = await ratingsRepo.findByServiceNumber(sn);
  if (!rating) {
    safeUnlink(savedDocument.diskPath);
    throw notFound(`No rating found with Official Number "${sn}".`);
  }

  const categories = await lookupsRepo.fetchDocumentCategories();
  let matchedCat = null;

  if (body && body.category_id) {
    const catId = Number.parseInt(body.category_id, 10);
    matchedCat = categories.find((c) => Number(c.id) === catId) || null;
  } else if (body && body.category_code) {
    const code = String(body.category_code).trim().toUpperCase();
    matchedCat = categories.find((c) => c.code.toUpperCase() === code) || null;
  }

  if (!matchedCat) {
    safeUnlink(savedDocument.diskPath);
    throw validationError('Please select a valid Document Category.', {
      category_id: 'Document Category is required.',
    });
  }

  try {
    await db.transaction(async (tx) => {
      const id = await ratingsRepo.insertChildRow('rating_documents', {
        service_number: rating.service_number,
        category_id: matchedCat.id,
        original_name: savedDocument.originalName,
        stored_name: savedDocument.storedName,
        mime_type: savedDocument.mimeType,
        size_bytes: savedDocument.sizeBytes,
        created_by: actor.userId || null,
      }, tx.connection);
      const after = await ratingsRepo.findChildRow('rating_documents', id, rating.service_number, tx.connection);
      await audit.record(tx, actor, { action: 'INSERT', table: 'rating_documents', recordId: `${rating.service_number}:${id}`, after });
    });
  } catch (err) {
    safeUnlink(savedDocument.diskPath);
    throw err;
  }

  return getDocumentsBundle(rating.service_number);
}

async function resolveRatingDocumentFile(serviceNumberRaw, docIdRaw) {
  const sn = normaliseServiceNumber(serviceNumberRaw);
  const docId = Number.parseInt(docIdRaw, 10);
  if (!Number.isFinite(docId) || docId <= 0) {
    throw badRequest('Invalid document ID.');
  }

  const doc = await ratingsRepo.findDocumentById(docId, sn);
  if (!doc) {
    throw notFound('Document not found.');
  }

  const safeStored = path.basename(doc.stored_name);
  const diskPath = path.join(config.uploads.documentsDir, safeStored);
  if (!fs.existsSync(diskPath)) {
    throw notFound('Stored document file is missing on server.');
  }

  return {
    diskPath,
    originalName: doc.original_name,
    mimeType: doc.mime_type || 'application/octet-stream',
  };
}

async function deleteRatingDocument(serviceNumberRaw, docIdRaw, actor) {
  const sn = normaliseServiceNumber(serviceNumberRaw);
  const docId = Number.parseInt(docIdRaw, 10);
  if (!Number.isFinite(docId) || docId <= 0) {
    throw badRequest('Invalid document ID.');
  }

  const doc = await ratingsRepo.findDocumentById(docId, sn);
  if (!doc) {
    throw notFound('Document not found.');
  }

  await db.transaction(async (tx) => {
    const before = await ratingsRepo.findChildRow('rating_documents', docId, sn, tx.connection);
    await ratingsRepo.deleteChildRow('rating_documents', docId, sn, tx.connection);
    await audit.record(tx, actor, { action: 'DELETE', table: 'rating_documents', recordId: `${sn}:${docId}`, before });
  });
  safeUnlink(path.join(config.uploads.documentsDir, path.basename(doc.stored_name)));

  return getDocumentsBundle(sn);
}

// ============================================================================
// Exports (Excel, CSV, List PDF, Dossier PDF, Per-Tab PDF)
// ============================================================================

async function exportRatingsList(queryParams = {}, generatedBy = '') {
  const filters = parseListFilters(queryParams);
  const status = filters.status || 'current';
  const format = String(queryParams.format || 'xlsx').toLowerCase();

  const { items } = await ratingsRepo.listRatings({ ...filters, status, exportAll: true });

  // the report's filter line names the rate and ship rather than their ids
  let lookupRate = null;
  let lookupShip = null;
  if (filters.rateId || filters.shipId) {
    const lookups = await lookupsRepo.fetchAllLookups();
    lookupRate = (lookups.rates || []).find((x) => Number(x.id) === filters.rateId) || null;
    lookupShip = (lookups.ships || []).find((x) => Number(x.id) === filters.shipId) || null;
  }
  const { officialNo, name, search, q } = filters;
  const filterSummary = [q, officialNo, name, search, lookupRate && lookupRate.name, lookupShip && lookupShip.name]
    .filter(Boolean)
    .join(' / ');

  const dateTag = new Date().toISOString().slice(0, 10);
  const baseName = `CIRERMS_${status}_ratings_${dateTag}`;

  if (format === 'csv') {
    const csv = buildRatingsCsvString(status, items);
    return {
      buffer: Buffer.from(csv, 'utf8'),
      mimeType: 'text/csv; charset=utf-8',
      fileName: `${baseName}.csv`,
      inline: false,
    };
  }

  if (format === 'pdf' || format === 'print') {
    const pdfBuf = await buildRatingsListPdf({ status, rows: items, search: filterSummary, generatedBy });
    return {
      buffer: pdfBuf,
      mimeType: 'application/pdf',
      fileName: `${baseName}.pdf`,
      inline: format === 'print',
    };
  }

  const xlsxBuf = await buildRatingsExcelBuffer(status, items);
  return {
    buffer: xlsxBuf,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    fileName: `${baseName}.xlsx`,
    inline: false,
  };
}

async function exportRatingDossierPdf(serviceNumberRaw, generatedBy = '') {
  const { rating, children } = await getFullDossier(serviceNumberRaw);
  const buffer = await buildRatingDossierPdf({ rating, children, generatedBy });
  return {
    buffer,
    fileName: `CIRERMS_Dossier_${rating.service_number}.pdf`,
  };
}

const TAB_PDF_SPECS = Object.freeze({
  advancement: {
    title: 'Advancement',
    listFn: ratingsRepo.listAdvancement,
    columns: [
      { header: 'S/N', weight: 0.5, value: (_, i) => i + 1 },
      { header: 'Rate', key: 'rate_name', weight: 1.9 },
      { header: 'Start Date', weight: 1.2, value: (r) => formatDisplayDate(r.start_date) },
      { header: 'End Date', weight: 1.2, value: (r) => formatDisplayDate(r.end_date) },
      { header: 'Decoration', key: 'decoration', weight: 1.4 },
      { header: 'Authority', key: 'authority', weight: 1.4 },
      { header: 'GCB No.', key: 'gcbno', weight: 1.0 },
    ],
  },
  drafting: {
    title: 'Drafting',
    listFn: ratingsRepo.listDrafting,
    columns: [
      { header: 'S/N', weight: 0.5, value: (_, i) => i + 1 },
      { header: 'Ship / Unit', key: 'ship_name', weight: 1.9 },
      { header: 'Rate', key: 'rate_name', weight: 1.7 },
      { header: 'Start Date', weight: 1.2, value: (r) => formatDisplayDate(r.start_date) },
      { header: 'End Date', weight: 1.2, value: (r) => (r.end_date ? formatDisplayDate(r.end_date) : 'Present') },
      { header: 'Remarks', key: 'remarks', weight: 2.1 },
    ],
  },
  training: {
    title: 'Training',
    listFn: ratingsRepo.listTraining,
    columns: [
      { header: 'S/N', weight: 0.5, value: (_, i) => i + 1 },
      { header: 'Name', key: 'rating_name', weight: 1.7 },
      { header: 'Institution', key: 'institution', weight: 2.2 },
      { header: 'Qualification', key: 'qualification', weight: 1.8 },
      { header: 'Class', key: 'classification', weight: 1.0 },
      { header: 'Start Date', weight: 1.1, value: (r) => formatDisplayDate(r.start_date) },
      { header: 'End Date', weight: 1.1, value: (r) => formatDisplayDate(r.end_date) },
    ],
  },
  education: {
    title: 'Education',
    listFn: ratingsRepo.listEducation,
    columns: [
      { header: 'S/N', weight: 0.5, value: (_, i) => i + 1 },
      { header: 'Institution', key: 'institution', weight: 2.4 },
      { header: 'Qualification', key: 'qualification', weight: 2.0 },
      { header: 'Class', key: 'classification', weight: 1.1 },
      { header: 'Start Date', weight: 1.2, value: (r) => formatDisplayDate(r.start_date) },
      { header: 'End Date', weight: 1.2, value: (r) => formatDisplayDate(r.end_date) },
    ],
  },
});

async function exportRatingTabPdf(serviceNumberRaw, tabKey, generatedBy = '') {
  const spec = TAB_PDF_SPECS[tabKey];
  if (!spec) {
    throw badRequest(`PDF export is not configured for tab "${tabKey}".`);
  }
  const rating = await ensureRatingExists(serviceNumberRaw);
  const rows = await spec.listFn(rating.service_number);
  const buffer = await buildRatingTabPdf({
    rating,
    tabTitle: spec.title,
    columns: spec.columns,
    rows,
    generatedBy,
  });

  return {
    buffer,
    fileName: `CIRERMS_${rating.service_number}_${spec.title}.pdf`,
  };
}

// ============================================================================
// Batch Upload (.xlsx template + transactional importer)
// ============================================================================

async function generateBatchTemplate() {
  const lookups = await lookupsRepo.fetchAllLookups();
  const buffer = await buildBatchTemplateWorkbook(lookups);
  return {
    buffer,
    fileName: 'CIRERMS_Ratings_Batch_Upload_Template.xlsx',
  };
}

function buildLookupResolver(items = [], { allowParenCode = false } = {}) {
  const map = new Map();
  for (const item of items) {
    const norm = String(item.name || '').trim().toLowerCase();
    if (norm) map.set(norm, item.id);
    if (allowParenCode) {
      const m = /\(([^)]+)\)/.exec(item.name || '');
      if (m && m[1]) {
        map.set(m[1].trim().toLowerCase(), item.id);
      }
    }
  }
  return (rawVal) => {
    if (rawVal == null) return { empty: true, id: null };
    const clean = String(rawVal).trim();
    if (!clean) return { empty: true, id: null };
    const id = map.get(clean.toLowerCase()) || null;
    return { empty: false, id, raw: clean };
  };
}

async function processBatchUpload(buffer, actor) {
  const userId = actor.userId;
  const parsed = await parseBatchUploadBuffer(buffer);
  if (parsed.headerErrors.length > 0) {
    throw badRequest(parsed.headerErrors.join(' '), 'INVALID_TEMPLATE_HEADERS');
  }

  if (parsed.rows.length === 0) {
    throw badRequest('The uploaded worksheet contains no data rows below the header row.', 'EMPTY_WORKBOOK');
  }

  const [lookups, existingSnSet] = await Promise.all([
    lookupsRepo.fetchAllLookups(),
    ratingsRepo.getAllServiceNumbersSet(),
  ]);

  const resolveRate = buildLookupResolver(lookups.rates, { allowParenCode: true });
  const resolveTitle = buildLookupResolver(lookups.titles);
  const resolveGender = buildLookupResolver(lookups.genders);
  const resolveMarital = buildLookupResolver(lookups.maritalStatuses);
  const resolveReligion = buildLookupResolver(lookups.religions);
  const resolveTribe = buildLookupResolver(lookups.tribes);
  const resolveState = buildLookupResolver(lookups.states);
  const resolveZone = buildLookupResolver(lookups.geoPoliticalZones);
  const resolveBranch = buildLookupResolver(lookups.branches);
  const resolveCommand = buildLookupResolver(lookups.commands);
  const resolveMotherBase = buildLookupResolver(lookups.motherBases);
  const resolveShip = buildLookupResolver(lookups.ships);
  const resolveEntryMode = buildLookupResolver(lookups.entryModes);
  const resolveSpec = buildLookupResolver(lookups.specialisations);

  const lgaByStateAndName = new Map();
  const lgaByNameFallback = new Map();
  for (const lga of lookups.localGovernments || []) {
    const key = `${lga.stateId}::${String(lga.name).trim().toLowerCase()}`;
    lgaByStateAndName.set(key, lga.id);
    lgaByNameFallback.set(String(lga.name).trim().toLowerCase(), lga.id);
  }

  const seenInFile = new Set();
  const validToInsert = [];
  const skippedDuplicates = [];
  const rowErrors = [];

  for (const { rowNumber, data } of parsed.rows) {
    const issues = [];
    const sn = normaliseServiceNumber(data.service_number);

    if (!sn) {
      issues.push('Official Number is compulsory.');
    } else if (!SERVICE_NUMBER_RE.test(sn)) {
      issues.push(`Official Number "${sn}" is invalid (use 2–20 letters/digits).`);
    } else if (existingSnSet.has(sn)) {
      skippedDuplicates.push({
        rowNumber,
        serviceNumber: sn,
        reason: 'Official Number already exists in CIRERMS database.',
      });
      continue;
    } else if (seenInFile.has(sn)) {
      skippedDuplicates.push({
        rowNumber,
        serviceNumber: sn,
        reason: 'Duplicate Official Number repeated earlier in this Excel file.',
      });
      continue;
    }

    const surname = cleanNullableString(data.surname, 100);
    if (!surname) issues.push('Surname is compulsory.');

    const firstName = cleanNullableString(data.first_name, 100);
    if (!firstName) issues.push('First Name is compulsory.');

    const rateRes = resolveRate(data.rate);
    if (rateRes.empty) issues.push('Rate is compulsory.');
    else if (!rateRes.id) issues.push(`Unknown Rate "${rateRes.raw}".`);

    const genderRes = resolveGender(data.gender);
    if (genderRes.empty) issues.push('Gender is compulsory.');
    else if (!genderRes.id) issues.push(`Unknown Gender "${genderRes.raw}".`);

    const checkOptLookup = (res, label) => {
      if (!res.empty && !res.id) {
        issues.push(`Unknown ${label} "${res.raw}".`);
      }
      return res.id;
    };

    const titleId = checkOptLookup(resolveTitle(data.title), 'Title');
    const maritalId = checkOptLookup(resolveMarital(data.marital_status), 'Marital Status');
    const religionId = checkOptLookup(resolveReligion(data.religion), 'Religion');
    const tribeId = checkOptLookup(resolveTribe(data.tribe), 'Tribe');
    const stateId = checkOptLookup(resolveState(data.state), 'State of Origin');
    const zoneId = checkOptLookup(resolveZone(data.geo_political_zone), 'Geo-Political Zone');
    const branchId = checkOptLookup(resolveBranch(data.branch), 'Branch');
    const commandId = checkOptLookup(resolveCommand(data.command), 'Command');
    const motherBaseId = checkOptLookup(resolveMotherBase(data.mother_base), 'Mother Base');
    const shipId = checkOptLookup(resolveShip(data.current_ship), 'Current Ship');
    const entryModeId = checkOptLookup(resolveEntryMode(data.entry_mode), 'Entry Mode');
    const specId = checkOptLookup(resolveSpec(data.specialisation), 'Specialisation');

    let lgaId = null;
    const rawLga = cleanNullableString(data.local_government, 150);
    if (rawLga) {
      const normLga = rawLga.toLowerCase();
      if (stateId) {
        lgaId = lgaByStateAndName.get(`${stateId}::${normLga}`) || null;
        if (!lgaId) {
          issues.push(`Local Government "${rawLga}" does not match selected State.`);
        }
      } else {
        lgaId = lgaByNameFallback.get(normLga) || null;
        if (!lgaId) {
          issues.push(`Unknown Local Government "${rawLga}".`);
        }
      }
    }

    const dobRes = parseIsoDate(data.date_of_birth);
    if (!dobRes.valid) issues.push(`Date of Birth: ${dobRes.error}`);

    const employedRes = parseIsoDate(data.date_employed);
    if (!employedRes.valid) issues.push(`Date Employed: ${employedRes.error}`);

    const seniorityRes = parseIsoDate(data.seniority_date);
    if (!seniorityRes.valid) issues.push(`Seniority Date: ${seniorityRes.error}`);

    const email = cleanNullableString(data.email_address, 150);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      issues.push(`Invalid Email Address "${email}".`);
    }

    if (issues.length > 0) {
      rowErrors.push({
        rowNumber,
        serviceNumber: sn || '-',
        messages: issues,
      });
      continue;
    }

    seenInFile.add(sn);
    const middleName = cleanNullableString(data.middle_name, 100);

    validToInsert.push({
      rowNumber,
      shipId,
      ratingRecord: {
        service_number: sn,
        status: 'current',
        surname: surname.toUpperCase(),
        first_name: firstName.toUpperCase(),
        middle_name: middleName ? middleName.toUpperCase() : null,
        rate_id: rateRes.id,
        title_id: titleId,
        gender_id: genderRes.id,
        date_of_birth: dobRes.value,
        marital_status_id: maritalId,
        religion_id: religionId,
        tribe_id: tribeId,
        state_id: stateId,
        local_government_id: lgaId,
        geo_political_zone_id: zoneId,
        phone: cleanNullableString(data.phone, 30),
        email_address: email,
        home_address: cleanNullableString(data.home_address, 2000),
        branch_id: branchId,
        command_id: commandId,
        mother_base_id: motherBaseId,
        entry_mode_id: entryModeId,
        date_employed: employedRes.value,
        seniority_date: seniorityRes.value,
        specialisation_id: specId,
        created_by: userId || null,
      },
    });
  }

  if (validToInsert.length > 0) {
    await db.transaction(async (tx) => {
      const todayIso = new Date().toISOString().slice(0, 10);
      for (const item of validToInsert) {
        await ratingsRepo.insertRating(item.ratingRecord, tx.connection);
        const after = await ratingsRepo.findRawRating(item.ratingRecord.service_number, tx.connection);
        await audit.record(tx, actor, { action: 'INSERT', table: 'ratings', recordId: item.ratingRecord.service_number, after });
        if (item.shipId) {
          const postingId = await ratingsRepo.insertChildRow(
            'rating_drafting',
            {
              service_number: item.ratingRecord.service_number,
              ship_id: item.shipId,
              rate_id: item.ratingRecord.rate_id,
              start_date:
                item.ratingRecord.date_employed
                || item.ratingRecord.seniority_date
                || todayIso,
              end_date: null,
              remarks: 'Initial posting imported via Batch Upload',
              created_by: userId || null,
            },
            tx.connection
          );
          const posting = await ratingsRepo.findChildRow('rating_drafting', postingId, item.ratingRecord.service_number, tx.connection);
          await audit.record(tx, actor, {
            action: 'INSERT',
            table: 'rating_drafting',
            recordId: `${item.ratingRecord.service_number}:${postingId}`,
            after: posting,
          });
        }
      }
    });
  }

  return {
    totalRows: parsed.rows.length,
    insertedCount: validToInsert.length,
    skippedDuplicateCount: skippedDuplicates.length,
    errorCount: rowErrors.length,
    inserted: validToInsert.map((v) => ({
      rowNumber: v.rowNumber,
      serviceNumber: v.ratingRecord.service_number,
      fullName: [v.ratingRecord.surname, v.ratingRecord.first_name, v.ratingRecord.middle_name]
        .filter(Boolean)
        .join(' '),
    })),
    skippedDuplicates,
    errors: rowErrors,
  };
}

module.exports = {
  listRatings,
  getFullDossier,
  getMyDetails,
  createRating,
  updateRating,
  deleteRating,
  saveRatingPhoto,
  resolveRatingPhotoFile,
  listChildRecords,
  createChildRecord,
  updateChildRecord,
  deleteChildRecord,
  getDocumentsBundle,
  uploadRatingDocument,
  resolveRatingDocumentFile,
  deleteRatingDocument,
  exportRatingsList,
  exportRatingDossierPdf,
  exportRatingTabPdf,
  generateBatchTemplate,
  processBatchUpload,
};
