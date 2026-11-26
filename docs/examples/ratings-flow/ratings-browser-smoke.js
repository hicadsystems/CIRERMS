(async () => {
  const base = window.location.origin;
  const appMain = document.getElementById('app-main');

  if (!appMain) {
    throw new Error('Open the signed-in CIRERMS application at /app before running this script.');
  }

  const originalHash = window.location.hash || '#ratings/current';
  const results = [];

  async function checkApi(label, path) {
    const response = await fetch(`${base}${path}`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json') ? await response.json() : null;

    if (!response.ok) {
      throw new Error(`${label}: API returned HTTP ${response.status}: ${payload?.error?.message || 'request failed'}`);
    }

    results.push(`PASS API ${label}: HTTP ${response.status}`);
    return payload;
  }

  async function openRoute(hash, expectedHeading) {
    window.location.hash = hash;

    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      const heading = document.querySelector('#app-main h1');
      if (heading && heading.textContent.trim() === expectedHeading) {
        results.push(`PASS UI ${hash}: ${expectedHeading}`);
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    const visible = document.querySelector('#app-main')?.innerText.trim().slice(0, 300) || '(empty)';
    throw new Error(`UI ${hash}: expected heading "${expectedHeading}". Visible text: ${visible}`);
  }

  try {
    const list = await checkApi(
      'current ratings',
      '/api/ratings?status=current&page=1&pageSize=25'
    );
    if (!Array.isArray(list.data)) throw new Error('Current ratings response data is not an array.');
    if (!list.data.length) throw new Error('No current ratings found. Seed the development database first.');

    const rating = list.data[0];
    if (!rating.service_number) throw new Error('First current rating has no service_number.');
    const sn = encodeURIComponent(rating.service_number);

    await checkApi('rating dossier', `/api/ratings/${sn}`);
    await checkApi('rating documents', `/api/ratings/${sn}/documents`);
    await checkApi('upload template', '/api/ratings/batch-template');

    await openRoute('#ratings/current', 'Current Ratings');
    await openRoute('#ratings/former', 'Former Ratings');
    await openRoute(`#ratings/edit/${sn}`, `Rating ${rating.service_number}`);
    await openRoute('#ratings/upload', 'Batch Upload');
    await openRoute('#ratings/documents', 'Documents');

    console.table(results.map((result) => ({ result })));
    console.info('Ratings browser smoke test passed. No rating records were changed.');
  } finally {
    window.location.hash = originalHash;
  }
})().catch((err) => {
  console.error('Ratings browser smoke test failed:', err);
});
