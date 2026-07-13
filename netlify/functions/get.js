const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  const id = event.queryStringParameters && event.queryStringParameters.id;

  if (!id || !/^[A-Za-z0-9]{4,32}$/.test(id)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid id' }) };
  }

  try {
    const store = getStore('fleets');
    const data = await store.get(id);

    if (data == null) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Not found' }) };
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=60'
      },
      body: data
    };
  } catch (err) {
    console.error('get error', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal error' }) };
  }
};
