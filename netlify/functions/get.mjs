import { getStore } from '@netlify/blobs';

function json(status, obj) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export default async (req) => {
  const url = new URL(req.url);
  const id = url.searchParams.get('id');

  if (!id || !/^[A-Za-z0-9]{4,32}$/.test(id)) {
    return json(400, { error: 'Invalid id' });
  }

  try {
    const store = getStore('fleets');
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
