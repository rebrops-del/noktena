import http from 'node:http';

const PORT = Number(process.env.PORT || 3000);
const UPSTREAM = 'https://oldtlbkrftflfthfsqdv.supabase.co/functions/v1/noktena-admin-api';
const ALLOWED_ORIGINS = new Set([
  'https://noktena.ru',
  'https://www.noktena.ru'
]);

function applyCors(req, res) {
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.has(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
  else res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'authorization,content-type,apikey,x-client-info');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Cache-Control', 'no-store');
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return chunks.length ? Buffer.concat(chunks) : undefined;
}

const server = http.createServer(async (req, res) => {
  applyCors(req, res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  const incoming = new URL(req.url || '/', 'http://localhost');

  if (incoming.pathname === '/health') {
    return sendJson(res, 200, { ok: true, service: 'noktena-admin-proxy' });
  }

  if (incoming.pathname !== '/api/noktena-admin') {
    return sendJson(res, 404, { ok: false, error: 'NOT_FOUND' });
  }

  if (!['GET', 'POST'].includes(req.method || '')) {
    return sendJson(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' });
  }

  try {
    const upstreamUrl = new URL(UPSTREAM);
    for (const [key, value] of incoming.searchParams) upstreamUrl.searchParams.append(key, value);

    const headers = {};
    for (const name of ['authorization', 'content-type', 'apikey', 'x-client-info']) {
      const value = req.headers[name];
      if (value) headers[name] = Array.isArray(value) ? value.join(',') : value;
    }

    const body = req.method === 'POST' ? await readBody(req) : undefined;
    const upstream = await fetch(upstreamUrl, {
      method: req.method,
      headers,
      body
    });

    const payload = Buffer.from(await upstream.arrayBuffer());
    res.statusCode = upstream.status;
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json; charset=utf-8');
    res.setHeader('X-Noktena-Proxy', 'railway');
    return res.end(payload);
  } catch (error) {
    return sendJson(res, 502, {
      ok: false,
      error: 'UPSTREAM_UNAVAILABLE',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`noktena admin proxy listening on ${PORT}`);
});
