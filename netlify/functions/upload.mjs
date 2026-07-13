import { getStore } from '@netlify/blobs';

const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2MB safety cap (fleet files are typically tens of KB)
const ID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function generateId(len = 9) {
  let id = '';
  for (let i = 0; i < len; i++) {
    id += ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)];
  }
  return id;
}

async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function json(status, obj) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

// Prefer explicit siteID/token (set as BLOBS_SITE_ID / BLOBS_TOKEN env vars)
// when present, since automatic environment injection has been unreliable
// on some deploys. Falls back to zero-config getStore() otherwise.
function blobStore(name) {
  const siteID = process.env.BLOBS_SITE_ID;
  const token = process.env.BLOBS_TOKEN;
  if (siteID && token) {
    return getStore({ name, siteID, token });
  }
  return getStore(name);
}

export default async (req) => {
  if (req.method !== 'POST') {
    return json(405, { error: 'Method Not Allowed' });
  }

  const body = await req.text();
  if (!body.trim()) {
    return json(400, { error: 'Empty body' });
  }
  if (Buffer.byteLength(body, 'utf8') > MAX_SIZE_BYTES) {
    return json(413, { error: 'File too large' });
  }
  // Very light sanity check that this looks like a Nebulous fleet XML export,
  // not an attempt to store arbitrary unrelated data.
  if (!/<Fleet[\s>]/.test(body) || !/<Ships>/.test(body)) {
    return json(400, { error: 'Does not look like a .fleet XML file' });
  }

  try {
    const store = blobStore('fleets');
    const hashStore = blobStore('fleet-hashes');

    // Dedup: if this exact content was uploaded before, hand back the same
    // link instead of writing a duplicate blob.
    const hash = await sha256Hex(body);
    let existingId = null;
    try { existingId = await hashStore.get(hash); } catch (e) { existingId = null; }
    if (existingId) {
      return json(200, { id: existingId, deduped: true });
    }

    let id;
    // Extremely unlikely to collide at this ID length, but check anyway.
    for (let attempt = 0; attempt < 5; attempt++) {
      id = generateId();
      let existing = null;
      try { existing = await store.get(id); } catch (e) { existing = null; }
      if (existing == null) break;
    }

    await store.set(id, body, {
      metadata: { createdAt: new Date().toISOString(), size: Buffer.byteLength(body, 'utf8') }
    });
    await hashStore.set(hash, id);

    return json(200, { id, deduped: false });
  } catch (err) {
    console.error('upload error', err && err.stack ? err.stack : err);
    return json(500, { error: 'Internal error', detail: String((err && err.message) || err) });
  }
};
