const encoder = new TextEncoder();
const COOKIE = 'mai_admin';
const SESSION_SECONDS = 60 * 60 * 8;
const WINDOW_SECONDS = 15 * 60;
const MAX_ATTEMPTS = 5;

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra } });
}
function bytesToHex(bytes) { return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join(''); }
async function digest(value) { return new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))); }
function equalBytes(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
async function hmac(secret, message) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return bytesToHex(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(message))));
}
function cookie(value, maxAge) {
  return `${COOKIE}=${value}; Path=/api/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}
function readCookie(request) {
  const raw = request.headers.get('cookie') || '';
  return raw.split(';').map(x => x.trim()).find(x => x.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1) || '';
}
async function authorized(request, env) {
  const token = readCookie(request);
  const match = /^(\\d+)\\.([0-9a-f]{64})$/.exec(token);
  if (!match || !env.SESSION_SECRET) return false;
  const expires = Number(match[1]);
  if (!Number.isSafeInteger(expires) || expires <= Math.floor(Date.now() / 1000) || expires > Math.floor(Date.now() / 1000) + SESSION_SECONDS) return false;
  const expected = await hmac(env.SESSION_SECRET, 'admin:' + expires);
  return equalBytes(encoder.encode(match[2]), encoder.encode(expected));
}
async function limiter(env, request) {
  if (!env.DB) throw new Error('D1 não configurado');
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const key = await hmac(env.SESSION_SECRET, 'login-ip:' + ip);
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS admin_login_attempts (ip_hash TEXT PRIMARY KEY, attempts INTEGER NOT NULL, window_start INTEGER NOT NULL)').run();
  const record = await env.DB.prepare('SELECT attempts, window_start FROM admin_login_attempts WHERE ip_hash = ?').bind(key).first();
  if (record && now - record.window_start < WINDOW_SECONDS && record.attempts >= MAX_ATTEMPTS) return { blocked: true };
  return {
    blocked: false,
    async failed() {
      await env.DB.prepare('INSERT INTO admin_login_attempts (ip_hash, attempts, window_start) VALUES (?, 1, ?) ON CONFLICT(ip_hash) DO UPDATE SET attempts = CASE WHEN ? - window_start >= ? THEN 1 ELSE attempts + 1 END, window_start = CASE WHEN ? - window_start >= ? THEN ? ELSE window_start END').bind(key, now, now, WINDOW_SECONDS, now, WINDOW_SECONDS, now).run();
    },
    async reset() { await env.DB.prepare('DELETE FROM admin_login_attempts WHERE ip_hash = ?').bind(key).run(); }
  };
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/admin/')) return env.ASSETS.fetch(request);
    if (!env.ADMIN_PASSWORD || !env.SESSION_SECRET || !env.DB) return json({ error: 'Configuração administrativa incompleta.' }, 503);
    const route = url.pathname;
    if (route === '/api/admin/session' && request.method === 'GET') return json({ authenticated: await authorized(request, env) });
    if (route === '/api/admin/login' && request.method === 'POST') {
      if (request.headers.get('origin') !== url.origin) return json({ error: 'Origem inválida.' }, 403);
      if (!request.headers.get('content-type')?.includes('application/json')) return json({ error: 'Formato inválido.' }, 415);
      const body = await request.text();
      if (body.length > 4096) return json({ error: 'Requisição muito grande.' }, 413);
      let data;
      try { data = JSON.parse(body); } catch { return json({ error: 'Dados inválidos.' }, 400); }
      if (typeof data.password !== 'string' || data.password.length > 256) return json({ error: 'Senha inválida.' }, 400);
      try {
        const limit = await limiter(env, request);
        if (limit.blocked) return json({ error: 'Muitas tentativas. Aguarde 15 minutos.' }, 429);
        const [actual, expected] = await Promise.all([digest(data.password), digest(env.ADMIN_PASSWORD)]);
        if (!equalBytes(actual, expected)) {
          await limit.failed();
          return json({ error: 'Senha incorreta.' }, 401);
        }
        await limit.reset();
        const expires = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
        const token = expires + '.' + await hmac(env.SESSION_SECRET, 'admin:' + expires);
        return json({ authenticated: true }, 200, { 'set-cookie': cookie(token, SESSION_SECONDS) });
      } catch { return json({ error: 'Não foi possível validar o acesso. Tente novamente.' }, 503); }
    }
    if (route === '/api/admin/logout' && request.method === 'POST') {
      if (request.headers.get('origin') !== url.origin) return json({ error: 'Origem inválida.' }, 403);
      return json({ authenticated: false }, 200, { 'set-cookie': cookie('', 0) });
    }
    return json({ error: 'Rota não encontrada.' }, 404);
  }
};
