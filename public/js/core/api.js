const TOKEN_STORAGE_KEY = 'cirerms_session_fallback';

// The session lock (shell/lock.js) registers here: a 423 SESSION_LOCKED answer shows it.
let lockedHandler = null;
export function setLockedHandler(fn) {
  lockedHandler = typeof fn === 'function' ? fn : null;
}
function reportLocked(payload) {
  if (lockedHandler) lockedHandler((payload && payload.error && payload.error.fields && payload.error.fields.reason) || 'idle');
}

export function setFallbackToken(token) {
  try {
    if (token) {
      sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch (_) {
    // Ignore storage restriction errors
  }
}

export function getFallbackToken() {
  try {
    return sessionStorage.getItem(TOKEN_STORAGE_KEY);
  } catch (_) {
    return null;
  }
}

function buildAuthHeaders(extra = {}) {
  const headers = { ...extra };
  const token = getFallbackToken();
  if (token && !headers.Authorization) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

/** What a person reads when the network or the server cannot be reached (a fetch TypeError, not an HTTP error). */
export const UNREACHABLE_MESSAGE = 'CIRERMS cannot reach the server. Check your connection and try again.';

/** fetch(), with an unreachable server given a plain message and code NETWORK instead of the browser's "Failed to fetch". */
async function send(url, options) {
  try {
    return await fetch(url, options);
  } catch (err) {
    if (err && err.name === 'AbortError') throw err;
    throw new ApiClientError(0, 'NETWORK', UNREACHABLE_MESSAGE);
  }
}

export class ApiClientError extends Error {
  constructor(status, code, message, fields = null) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

async function request(url, { method = 'GET', body = undefined, isFormData = false, skipAuthRedirect = false, signal = undefined } = {}) {
  const headers = buildAuthHeaders(
    body !== undefined && !isFormData ? { 'Content-Type': 'application/json' } : {}
  );

  const response = await send(url, {
    method,
    credentials: 'include',
    headers,
    signal,
    body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
  });

  if (response.status === 401 && !skipAuthRedirect) {
    setFallbackToken(null);
    if (!window.location.pathname.endsWith('/index.html') && window.location.pathname !== '/' && window.location.pathname !== '/login') {
      window.location.href = '/index.html';
    }
  }

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : null;

  if (response.status === 423) reportLocked(payload);

  if (!response.ok) {
    const errInfo = payload?.error || {};
    throw new ApiClientError(
      response.status,
      errInfo.code || 'REQUEST_FAILED',
      errInfo.message || `Request failed with status ${response.status}.`,
      errInfo.fields || null
    );
  }

  return payload;
}

function parseFilenameFromDisposition(disposition) {
  if (!disposition) return null;
  const match = /filename="?([^";]+)"?/i.exec(disposition);
  return match ? match[1] : null;
}

export async function fetchBlob(url) {
  const response = await send(url, {
    method: 'GET',
    credentials: 'include',
    headers: buildAuthHeaders(),
  });

  if (response.status === 401) {
    setFallbackToken(null);
    window.location.href = '/index.html';
    throw new ApiClientError(401, 'UNAUTHORIZED', 'Session expired.');
  }

  if (!response.ok) {
    const ct = response.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const payload = await response.json();
      if (response.status === 423) reportLocked(payload);
      throw new ApiClientError(
        response.status,
        payload?.error?.code || 'DOWNLOAD_FAILED',
        payload?.error?.message || 'Unable to retrieve file.'
      );
    }
    throw new ApiClientError(response.status, 'DOWNLOAD_FAILED', 'Unable to retrieve file.');
  }

  const blob = await response.blob();
  const mimeType = response.headers.get('content-type') || blob.type || 'application/octet-stream';
  const fileName = parseFilenameFromDisposition(response.headers.get('content-disposition'));

  return { blob, mimeType, fileName };
}

export async function downloadFile(url, fallbackName = 'download') {
  const { blob, fileName } = await fetchBlob(url);
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = fileName || fallbackName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
}

export const api = {
  get: (url, opts) => request(url, { ...opts, method: 'GET' }),
  post: (url, body, opts) => request(url, { ...opts, method: 'POST', body }),
  put: (url, body, opts) => request(url, { ...opts, method: 'PUT', body }),
  del: (url, opts) => request(url, { ...opts, method: 'DELETE' }),
  upload: (url, formData, opts) => request(url, { ...opts, method: 'POST', body: formData, isFormData: true }),
  fetchBlob,
  downloadFile,
};
