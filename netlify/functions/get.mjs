import { getStore } from '@netlify/blobs';

function json(status, obj) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

// Prefer explicit siteID/token (set as BLOBS_SITE_ID / BLOBS_TOKEN env vars)
// when present, since automatic environment injection has been unreliable
// on some deploys. Falls back to zero-config getStore() otherwise.
function fleetStore() {
  const siteID = process.env.BLOBS_SITE_ID;
  const token = process.env.BLOBS_TOKEN;
  if (siteID && token) {
    return getStore({ name: 'fleets', siteID, token });
  }
  return getStore('fleets');
}

export default async (req) => {
  const url = new URL(req.url);
  const id = url.searchParams.get('id');

  if (!id || !/^[A-Za-z0-9]{4,32}$/.test(id)) {
    return json(400, { error: 'Invalid id' });
  }

  try {
    const store = fleetStore();
    const data = await store.get(id);

    if (data == null) {
      return json(404, { error: 'Not found' });
    }

    return new Response(data, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=60'
      }
    });
  } catch (err) {
    console.error('get error', err && err.stack ? err.stack : err);
    return json(500, { error: 'Internal error', detail: String((err && err.message) || err) });
  }
};
