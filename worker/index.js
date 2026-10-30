const encoder = new TextEncoder();
const COOKIE = 'mai_admin';
const SESSION_SECONDS = 60 * 60 * 8;
const WINDOW_SECONDS = 15 * 60;
const MAX_ATTEMPTS = 5;
const PROPERTY_COLUMNS = 'referencia, titulo, descricao, tipo, finalidade, cidade, bairro, preco, area, quartos, banheiros, vagas, url_origem';
const PROPERTY_KEYS = PROPERTY_COLUMNS.split(', ');
function validateProperty(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Dados inválidos.');
  const result = {};
  for (const [key, max] of Object.entries({ referencia: 80, titulo: 200, descricao: 10000, cidade: 120, bairro: 120, url_origem: 2048 })) {
    const value = data[key] ?? '';
    if (typeof value !== 'string' || value.trim().length > max) throw new Error('Confira o campo ' + key + '.');
    result[key] = value.trim() || null;
  }
  if (!result.titulo || !result.cidade) throw new Error('Informe título e cidade.');
  if (!['Apartamento', 'Casa', 'Sobrado', 'Terreno', 'Comercial', 'Outro'].includes(data.tipo) || !['Venda', 'Locação'].includes(data.finalidade)) throw new Error('Tipo ou finalidade inválidos.');
  result.tipo = data.tipo; result.finalidade = data.finalidade;
  if (typeof data.preco !== 'number' || !Number.isFinite(data.preco) || data.preco <= 0 || data.preco > 1e12) throw new Error('Informe um preço válido.');
  result.preco = data.preco;
  for (const key of ['area', 'quartos', 'banheiros', 'vagas']) {
    const value = data[key] ?? null;
    if (value !== null && (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > (key === 'area' ? 1e9 : 1000) || (key !== 'area' && !Number.isInteger(value)))) throw new Error('Confira o campo ' + key + '.');
    result[key] = value;
  }
  if (result.url_origem) {
    let parsed;
    try { parsed = new URL(result.url_origem); } catch { throw new Error('URL de origem inválida.'); }
    if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error('Use uma URL http ou https sem credenciais.');
  }
  return PROPERTY_KEYS.map(key => result[key]);
}

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
  const match = /^(\d+)\.([0-9a-f]{64})$/.exec(token);
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
    if (url.pathname === '/api/imoveis') {
      if (request.method !== 'GET') return json({ error: 'Método não permitido.' }, 405, { allow: 'GET' });
      try {
        const { results } = await env.DB.prepare(`SELECT i.id, i.referencia, i.titulo, i.descricao, i.tipo, i.finalidade, i.cidade, i.bairro, i.preco, i.area, i.quartos, i.banheiros, i.vagas, f.arquivo FROM imoveis i LEFT JOIN imoveis_fotos f ON f.imovel_id = i.id WHERE i.status = 'publicado' ORDER BY i.criado_em DESC, i.id DESC, f.principal DESC, f.ordem, f.id`).all();
        const items = new Map();
        for (const row of results) {
          if (!items.has(row.id)) items.set(row.id, { id: String(row.id), referencia: row.referencia || undefined, titulo: row.titulo, descricao: row.descricao || undefined, tipo: row.tipo, finalidade: row.finalidade, cidade: row.cidade, bairro: row.bairro || '', preco: row.preco, area: row.area, quartos: row.quartos, banheiros: row.banheiros, vagas: row.vagas, imagens: [] });
          if (typeof row.arquivo === 'string' && /^\/imoveis\/[a-z0-9_-]+\.(webp|png|jpe?g|avif)$/i.test(row.arquivo)) items.get(row.id).imagens.push(row.arquivo);
        }
        return json({ imoveis: [...items.values()] });
      } catch { return json({ error: 'Não foi possível carregar os imóveis. Tente novamente.' }, 503); }
    }
    if (!url.pathname.startsWith('/api/admin/')) return env.ASSETS.fetch(request);
    const missingBindings = ['ADMIN_PASSWORD', 'SESSION_SECRET', 'DB'].filter(name => !env[name]);
    if (missingBindings.length) {
      // Registra apenas nomes de configurações ausentes; nunca registra valores secretos.
      console.error('Admin: bindings ausentes na versão ativa:', missingBindings.join(', '));
      return json({ error: 'Configuração administrativa incompleta.' }, 503);
    }
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
    if (route === '/api/admin/migrar-vitrine') {
      if (!await authorized(request, env)) return json({ error: 'Sua sessão expirou. Entre novamente.' }, 401);
      if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405, { allow: 'POST' });
      if (request.headers.get('origin') !== url.origin) return json({ error: 'Origem inválida.' }, 403);
      // Fonte fixa e conhecida: nunca busca ou importa URLs enviadas pelo navegador.
      const referencia = '11472745';
      const origem = 'https://www.msnimoveis.com.br/imovel/venda/casa-em-florianopolis-sc-11472745';
      const foto = '/imoveis/msn-11472745-capa.webp';
      try {
        const existing = await env.DB.prepare('SELECT id, url_origem FROM imoveis WHERE referencia = ?').bind(referencia).first();
        if (existing && existing.url_origem !== origem) return json({ error: 'A referência 11472745 já pertence a outro cadastro. Nenhum dado foi alterado.' }, 409);
        await env.DB.batch([
          env.DB.prepare(`INSERT INTO imoveis (${PROPERTY_COLUMNS}, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'publicado') ON CONFLICT(referencia) DO NOTHING`).bind(referencia, 'Casa com piscina à venda em Florianópolis', 'Casa à venda em Florianópolis/SC, com 530 m² de área total, 7 dormitórios, 7 banheiros e 2 vagas de garagem. Consulte o anúncio original para mais informações.', 'Casa', 'Venda', 'Florianópolis', 'Bairro não informado', 4500000, 530, 7, 7, 2, origem),
          env.DB.prepare('INSERT INTO imoveis_fotos (imovel_id, arquivo, legenda, ordem, principal) SELECT id, ?, ?, 0, CASE WHEN EXISTS (SELECT 1 FROM imoveis_fotos WHERE imovel_id = imoveis.id AND principal = 1) THEN 0 ELSE 1 END FROM imoveis WHERE referencia = ? AND url_origem = ? AND NOT EXISTS (SELECT 1 FROM imoveis_fotos WHERE imovel_id = imoveis.id AND arquivo = ?)').bind(foto, 'Casa com piscina em Florianópolis', referencia, origem, foto)
        ]);
        const migrated = await env.DB.prepare('SELECT id FROM imoveis WHERE referencia = ?').bind(referencia).first();
        return json({ id: migrated.id, migrated: true });
      } catch { return json({ error: 'Não foi possível integrar o imóvel da vitrine.' }, 503); }
    }
    const statusMatch = /^\/api\/admin\/imoveis\/([1-9]\d*)\/status$/.exec(route);
    if (statusMatch) {
      if (!await authorized(request, env)) return json({ error: 'Sua sessão expirou. Entre novamente.' }, 401);
      if (request.method !== 'PATCH') return json({ error: 'Método não permitido.' }, 405, { allow: 'PATCH' });
      if (request.headers.get('origin') !== url.origin) return json({ error: 'Origem inválida.' }, 403);
      if (!request.headers.get('content-type')?.includes('application/json')) return json({ error: 'Formato inválido.' }, 415);
      const id = Number(statusMatch[1]);
      if (!Number.isSafeInteger(id)) return json({ error: 'Imóvel inválido.' }, 400);
      const body = await request.text();
      if (encoder.encode(body).length > 1024) return json({ error: 'Requisição muito grande.' }, 413);
      let data;
      try { data = JSON.parse(body); } catch { return json({ error: 'Dados inválidos.' }, 400); }
      if (!data || !['rascunho', 'publicado', 'vendido', 'inativo'].includes(data.status)) return json({ error: 'Status inválido.' }, 400);
      try {
        const result = await env.DB.prepare('UPDATE imoveis SET status = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?').bind(data.status, id).run();
        return result.meta.changes ? json({ id, status: data.status }) : json({ error: 'Imóvel não encontrado.' }, 404);
      } catch { return json({ error: 'Não foi possível alterar o status.' }, 503); }
    }
    const propertyMatch = /^\/api\/admin\/imoveis\/([1-9]\d*)$/.exec(route);
    if (route === '/api/admin/imoveis' || propertyMatch) {
      if (!await authorized(request, env)) return json({ error: 'Sua sessão expirou. Entre novamente.' }, 401);
      const id = propertyMatch ? Number(propertyMatch[1]) : null;
      if (id !== null && !Number.isSafeInteger(id)) return json({ error: 'Imóvel inválido.' }, 400);
      if (request.method === 'GET') {
        try {
          const columns = `id, ${PROPERTY_COLUMNS}, status, (SELECT arquivo FROM imoveis_fotos WHERE imovel_id = imoveis.id ORDER BY principal DESC, ordem, id LIMIT 1) AS foto_principal`;
          if (id !== null) {
            const imovel = await env.DB.prepare(`SELECT ${columns} FROM imoveis WHERE id = ?`).bind(id).first();
            return imovel ? json({ imovel }) : json({ error: 'Imóvel não encontrado.' }, 404);
          }
          const { results } = await env.DB.prepare(`SELECT ${columns} FROM imoveis ORDER BY criado_em DESC, id DESC`).all();
          return json({ imoveis: results });
        } catch { return json({ error: 'Não foi possível carregar os imóveis.' }, 503); }
      }
      if ((request.method === 'POST' && id === null) || (request.method === 'PUT' && id !== null)) {
        if (request.headers.get('origin') !== url.origin) return json({ error: 'Origem inválida.' }, 403);
        if (!request.headers.get('content-type')?.includes('application/json')) return json({ error: 'Formato inválido.' }, 415);
        const body = await request.text();
        if (encoder.encode(body).length > 65536) return json({ error: 'Requisição muito grande.' }, 413);
        let data;
        try { data = JSON.parse(body); } catch { return json({ error: 'Dados inválidos.' }, 400); }
        let values;
        try { values = validateProperty(data); } catch (error) { return json({ error: error.message }, 400); }
        const referencia = values[0];
        try {
          if (id !== null && !await env.DB.prepare('SELECT id FROM imoveis WHERE id = ?').bind(id).first()) return json({ error: 'Imóvel não encontrado.' }, 404);
          if (referencia) {
            const duplicate = await env.DB.prepare('SELECT id FROM imoveis WHERE referencia = ?').bind(referencia).first();
            if (duplicate && duplicate.id !== id) return json({ error: 'Esta referência já está cadastrada.' }, 409);
          }
          if (id !== null) {
            const result = await env.DB.prepare(`UPDATE imoveis SET ${PROPERTY_KEYS.map(key => key + ' = ?').join(', ')}, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?`).bind(...values, id).run();
            return result.meta.changes ? json({ id, saved: true }) : json({ error: 'Imóvel não encontrado.' }, 404);
          }
          const result = await env.DB.prepare(`INSERT INTO imoveis (${PROPERTY_COLUMNS}, status) VALUES (${PROPERTY_KEYS.map(() => '?').join(', ')}, 'rascunho')`).bind(...values).run();
          return json({ id: result.meta.last_row_id, status: 'rascunho' }, 201);
        } catch (error) {
          if (String(error).includes('UNIQUE constraint failed: imoveis.referencia')) return json({ error: 'Esta referência já está cadastrada.' }, 409);
          return json({ error: 'Não foi possível salvar o imóvel.' }, 503);
        }
      }
      return json({ error: 'Método não permitido.' }, 405, { allow: id === null ? 'GET, POST' : 'GET, PUT' });
    }
    return json({ error: 'Rota não encontrada.' }, 404);
  }
};
