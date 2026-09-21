const UPSTREAM = 'https://oldtlbkrftflfthfsqdv.supabase.co/functions/v1/noktena-admin-api';

export const config = {
  api: {
    bodyParser: false
  }
};

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'authorization,content-type,apikey,x-client-info');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Cache-Control', 'no-store');
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return chunks.length ? Buffer.concat(chunks) : undefined;
}

export default async function handler(req, res) {
  cors(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  if (!['GET', 'POST'].includes(req.method || '')) {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ ok: false, error: 'METHOD_NOT_ALLOWED' }));
  }

  try {
    const incoming = new URL(req.url || '/api/noktena-admin', 'https://proxy.local');
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
    res.setHeader('X-Noktena-Proxy', 'vercel');
    return res.end(payload);
  } catch (error) {
    res.statusCode = 502;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({
      ok: false,
      error: 'UPSTREAM_UNAVAILABLE',
      message: error instanceof Error ? error.message : String(error)
    }));
  }
}
