'use strict';

const BASE_URL = (process.env.CIRERMS_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');
const USERNAME = process.env.CIRERMS_TEST_USERNAME || '';
const PASSWORD = process.env.CIRERMS_TEST_PASSWORD || '';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(path, { method = 'GET', token = '', body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return response;
}

async function readJson(response, label) {
  const contentType = response.headers.get('content-type') || '';
  assert(contentType.includes('application/json'), `${label}: expected JSON, got "${contentType}"`);
  return response.json();
}

async function checkJson(path, token, label, validate) {
  const response = await request(path, { token });
  const payload = await readJson(response, label);
  assert(response.status === 200, `${label}: expected HTTP 200, got ${response.status}: ${JSON.stringify(payload)}`);
  assert(payload && payload.data !== undefined, `${label}: response is missing "data"`);
  validate(payload);
  console.log(`PASS ${label}: HTTP ${response.status}`);
  return payload;
}

async function main() {
  assert(USERNAME && PASSWORD, 'Set CIRERMS_TEST_USERNAME and CIRERMS_TEST_PASSWORD first.');

  const healthResponse = await request('/api/health');
  const health = await readJson(healthResponse, 'health');
  assert(healthResponse.status === 200, `health: expected HTTP 200, got ${healthResponse.status}`);
  assert(health.data && health.data.database === 'connected', 'health: database is not connected');
  console.log(`PASS health: HTTP ${healthResponse.status}`);

  const loginResponse = await request('/api/auth/login', {
    method: 'POST',
    body: { username: USERNAME, password: PASSWORD },
  });
  const login = await readJson(loginResponse, 'login');
  assert(loginResponse.status === 200, `login: expected HTTP 200, got ${loginResponse.status}: ${JSON.stringify(login)}`);
  const token = login.data && login.data.token;
  assert(typeof token === 'string' && token.length > 0, 'login: response has no bearer token');
  console.log(`PASS login: HTTP ${loginResponse.status}`);

  const list = await checkJson(
    '/api/ratings?status=current&page=1&pageSize=25',
    token,
    'current ratings list',
    (payload) => {
      assert(Array.isArray(payload.data), 'current ratings list: data must be an array');
      assert(payload.data.length <= 25, 'current ratings list: returned more than 25 rows');
      assert(payload.meta && Number.isInteger(payload.meta.page), 'current ratings list: missing paging metadata');
    }
  );

  const rating = list.data[0];
  if (!rating) {
    throw new Error('No current demo ratings were returned. Run npm run seed against a development database.');
  }
  assert(typeof rating.service_number === 'string', 'current ratings list: first row has no service_number');
  const serviceNumber = encodeURIComponent(rating.service_number);

  await checkJson(
    `/api/ratings/${serviceNumber}`,
    token,
    `rating dossier ${rating.service_number}`,
    (payload) => {
      assert(payload.data.rating, 'rating dossier: response is missing data.rating');
      assert(
        String(payload.data.rating.service_number).toUpperCase() === decodeURIComponent(serviceNumber).toUpperCase(),
        'rating dossier: returned a different service number'
      );
    }
  );

  await checkJson(
    `/api/ratings/${serviceNumber}/documents`,
    token,
    `documents for ${rating.service_number}`,
    (payload) => {
      assert(payload.data.rating, 'documents: response is missing data.rating');
    }
  );

  const templateResponse = await request('/api/ratings/batch-template', { token });
  assert(
    templateResponse.status === 200,
    `batch template: expected HTTP 200, got ${templateResponse.status}`
  );
  const templateType = templateResponse.headers.get('content-type') || '';
  assert(
    templateType.includes('spreadsheetml'),
    `batch template: expected XLSX content type, got "${templateType}"`
  );
  const templateBytes = await templateResponse.arrayBuffer();
  assert(templateBytes.byteLength > 4, 'batch template: received an empty workbook');
  console.log(`PASS batch template: HTTP ${templateResponse.status}, xlsx bytes received`);

  console.log('Ratings API smoke test passed.');
}

main().catch((err) => {
  console.error(`Ratings API smoke test failed: ${err.message}`);
  process.exitCode = 1;
});
