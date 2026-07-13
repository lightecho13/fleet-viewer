const { getStore } = require('@netlify/blobs');

const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2MB safety cap (fleet files are typically tens of KB)
const ID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function generateId(len) {
  len = len || 9;
  let id = '';
  for (let i = 0; i < len; i++) {
    id += ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)];
  }
  return id;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const body = event.body || '';
  if (!body.trim()) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Empty body' }) };
  }
  if (Buffer.byteLength(body, 'utf8') > MAX_SIZE_BYTES) {
    return { statusCode: 413, body: JSON.stringify({ error: 'File too large' }) };
  }
  // Very light sanity check that this looks like a Nebulous fleet XML export,
  // not an attempt to store arbitrary unrelated data.
  if (!/<Fleet[\s>]/.test(body) || !/<Ships>/.test(body)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Does not look like a .fleet XML file' }) };
  }

  try {
    const store = getStore('fleets');
    let id;
    // Extremely unlikely to collide at this ID length, but check anyway.
    for (let attempt = 0; attempt < 5; attempt++) {
      id = generateId();
      const existing = await store.get(id).catch(() => null);
      if (existing == null) break;
    }

    await store.set(id, body, {
      metadata: { createdAt: new Date().toISOString(), size: Buffer.byteLength(body, 'utf8') }
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    };
  } catch (err) {
    console.error('upload error', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal error' }) };
  }
};
