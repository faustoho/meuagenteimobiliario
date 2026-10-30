import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('./index.js', import.meta.url), 'utf8');
const { default: worker } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const origin = 'https://example.com';
const path = '/api/admin/imoveis';
const sample = { referencia: 'TEST-1', titulo: 'Casa de teste', descricao: 'Descrição completa', tipo: 'Casa', finalidade: 'Venda', cidade: 'Curitiba', bairro: 'Centro', preco: 500000, area: 120.5, quartos: 3, banheiros: 2, vagas: 0, url_origem: 'https://example.com/anuncio' };
function setup(t) {
  const sqlite = new DatabaseSync(':memory:');
  t.after(() => sqlite.close());
  sqlite.exec(`PRAGMA foreign_keys = ON;
    CREATE TABLE imoveis (id INTEGER PRIMARY KEY AUTOINCREMENT, referencia TEXT UNIQUE, titulo TEXT NOT NULL, descricao TEXT, tipo TEXT NOT NULL, finalidade TEXT NOT NULL, cidade TEXT NOT NULL, bairro TEXT, preco REAL NOT NULL, area REAL, quartos INTEGER, banheiros INTEGER, vagas INTEGER, url_origem TEXT, status TEXT NOT NULL DEFAULT 'rascunho' CHECK(status IN ('rascunho','publicado','vendido','inativo')), criado_em TEXT DEFAULT CURRENT_TIMESTAMP, atualizado_em TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE imoveis_fotos (id INTEGER PRIMARY KEY AUTOINCREMENT, imovel_id INTEGER NOT NULL REFERENCES imoveis(id) ON DELETE CASCADE, arquivo TEXT NOT NULL, legenda TEXT, ordem INTEGER NOT NULL DEFAULT 0, principal INTEGER NOT NULL DEFAULT 0 CHECK(principal IN (0,1)), criado_em TEXT DEFAULT CURRENT_TIMESTAMP);`);
  const DB = { prepare(sql) {
    let values = [];
    return { bind(...args) { values = args; return this; }, async first() { return sqlite.prepare(sql).get(...values) ?? null; }, async all() { return { results: sqlite.prepare(sql).all(...values) }; }, async run() { const result = sqlite.prepare(sql).run(...values); return { meta: { last_row_id: Number(result.lastInsertRowid), changes: Number(result.changes) } }; } };
  }, async batch(statements) {
    sqlite.exec('BEGIN');
    try { const results = []; for (const statement of statements) results.push(await statement.run()); sqlite.exec('COMMIT'); return results; }
    catch (error) { sqlite.exec('ROLLBACK'); throw error; }
  } };
  const env = { DB, ADMIN_PASSWORD: 'test-only-password', SESSION_SECRET: 'test-only-secret' };
  let cookie = '';
  async function request(route, method = 'GET', data, requestOrigin = origin) {
    return worker.fetch(new Request(origin + route, { method, headers: { origin: requestOrigin, cookie, 'content-type': 'application/json' }, ...(data === undefined ? {} : { body: JSON.stringify(data) }) }), env);
  }
  return { sqlite, env, request, async login() {
    const response = await request('/api/admin/login', 'POST', { password: env.ADMIN_PASSWORD });
    assert.equal(response.status, 200); cookie = response.headers.get('set-cookie').split(';')[0];
  } };
}
test('full property creation and edit persist all fields, preserve status, and do not touch other records', async t => {
  const app = setup(t); await app.login();
  let response = await app.request(path, 'POST', { ...sample, status: 'publicado' });
  assert.equal(response.status, 201); const { id } = await response.json();
  response = await app.request(path + '/' + id); const { imovel } = await response.json();
  for (const key of Object.keys(sample)) assert.equal(imovel[key], sample[key]);
  assert.equal(imovel.status, 'rascunho');
  await app.request(path, 'POST', { ...sample, referencia: 'TEST-2' });
  const edited = { ...sample, titulo: 'Título atualizado', quartos: 4, area: null, status: 'publicado' };
  assert.equal((await app.request(path + '/' + id, 'PUT', edited)).status, 200);
  const saved = (await (await app.request(path + '/' + id)).json()).imovel;
  assert.equal(saved.titulo, edited.titulo); assert.equal(saved.quartos, 4); assert.equal(saved.area, null); assert.equal(saved.vagas, 0); assert.equal(saved.status, 'rascunho');
  assert.equal(app.sqlite.prepare("SELECT titulo FROM imoveis WHERE referencia = 'TEST-2'").get().titulo, sample.titulo);
  assert.equal((await app.request(path + '/' + id, 'PUT', { ...sample, referencia: 'TEST-2' })).status, 409);
  assert.equal((await app.request(path + '/999', 'PUT', sample)).status, 404);
  assert.equal((await app.request(path + '/999')).status, 404);
});
test('edit and migration require session and same origin; invalid values cannot change data', async t => {
  const app = setup(t);
  assert.equal((await app.request(path + '/1', 'PUT', sample)).status, 401);
  assert.equal((await app.request('/api/admin/migrar-vitrine', 'POST')).status, 401);
  await app.login();
  assert.equal((await app.request('/api/admin/migrar-vitrine', 'POST', undefined, 'https://other.example')).status, 403);
  const id = (await (await app.request(path, 'POST', sample)).json()).id;
  assert.equal((await app.request(path + '/' + id, 'PUT', sample, 'https://other.example')).status, 403);
  for (const invalid of [{ quartos: 1.5 }, { banheiros: -1 }, { area: '120' }, { vagas: 1001 }, { url_origem: 'javascript:alert(1)' }, { url_origem: 'https://user:pass@example.com' }, { descricao: 'a'.repeat(10001) }]) assert.equal((await app.request(path + '/' + id, 'PUT', { ...sample, ...invalid })).status, 400);
  assert.equal(app.sqlite.prepare('SELECT quartos FROM imoveis WHERE id = ?').get(id).quartos, 3);
});
test('migration preserves source fields and photo, is repeatable, and preserves later edits', async t => {
  const app = setup(t); await app.login();
  await app.request(path, 'POST', sample);
  const migrate = () => app.request('/api/admin/migrar-vitrine', 'POST');
  const response = await migrate(); assert.equal(response.status, 200); const { id } = await response.json();
  let item = (await (await app.request(path + '/' + id)).json()).imovel;
  assert.equal(item.referencia, '11472745'); assert.equal(item.preco, 4500000); assert.equal(item.area, 530); assert.equal(item.quartos, 7); assert.equal(item.banheiros, 7); assert.equal(item.vagas, 2); assert.equal(item.status, 'publicado'); assert.equal(item.foto_principal, '/imoveis/msn-11472745-capa.webp');
  assert.equal((await app.request(path + '/' + id, 'PUT', { ...item, descricao: 'Descrição revisada' })).status, 200);
  assert.equal((await migrate()).status, 200);
  item = (await (await app.request(path + '/' + id)).json()).imovel;
  assert.equal(item.descricao, 'Descrição revisada'); assert.equal(item.status, 'publicado');
  assert.equal(app.sqlite.prepare('SELECT COUNT(*) AS count FROM imoveis').get().count, 2);
  assert.equal(app.sqlite.prepare('SELECT COUNT(*) AS count FROM imoveis_fotos').get().count, 1);
  assert.equal(app.sqlite.prepare('SELECT principal FROM imoveis_fotos').get().principal, 1);
});
test('migration rejects a conflicting reference without overwriting the existing property', async t => {
  const app = setup(t); await app.login();
  await app.request(path, 'POST', { ...sample, referencia: '11472745' });
  assert.equal((await app.request('/api/admin/migrar-vitrine', 'POST')).status, 409);
  assert.equal(app.sqlite.prepare('SELECT titulo FROM imoveis').get().titulo, sample.titulo);
  assert.equal(app.sqlite.prepare('SELECT COUNT(*) AS count FROM imoveis_fotos').get().count, 0);
});
test('public API needs no session or admin secrets and exposes only published properties and their photos', async t => {
  const app = setup(t); await app.login();
  const ids = [];
  for (const status of ['rascunho', 'publicado', 'vendido', 'inativo']) {
    const id = (await (await app.request(path, 'POST', { ...sample, referencia: status, titulo: status })).json()).id;
    ids.push(id);
    if (status !== 'rascunho') assert.equal((await app.request(`${path}/${id}/status`, 'PATCH', { status })).status, 200);
    app.sqlite.prepare('INSERT INTO imoveis_fotos (imovel_id, arquivo, ordem, principal) VALUES (?, ?, 0, 1)').run(id, `/imoveis/${status}.webp`);
  }
  app.sqlite.prepare('INSERT INTO imoveis_fotos (imovel_id, arquivo, ordem, principal) VALUES (?, ?, 2, 0)').run(ids[1], '/imoveis/segunda.webp');
  app.sqlite.prepare('INSERT INTO imoveis_fotos (imovel_id, arquivo, ordem, principal) VALUES (?, ?, 1, 0)').run(ids[1], 'https://untrusted.example/foto.webp');
  const response = await worker.fetch(new Request(origin + '/api/imoveis?status=rascunho'), { DB: app.env.DB });
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
  const data = await response.json(); assert.equal(data.imoveis.length, 1);
  assert.equal(data.imoveis[0].titulo, 'publicado'); assert.equal(data.imoveis[0].id, String(ids[1]));
  assert.deepEqual(data.imoveis[0].imagens, ['/imoveis/publicado.webp', '/imoveis/segunda.webp']);
  assert.ok(!('status' in data.imoveis[0])); assert.ok(!('url_origem' in data.imoveis[0]));
});
test('publish, edit, withdraw, sold, draft and republish update the public API immediately', async t => {
  const app = setup(t); await app.login();
  const id = (await (await app.request(path, 'POST', sample)).json()).id;
  const publicItems = async () => (await (await app.request('/api/imoveis')).json()).imoveis;
  assert.equal((await publicItems()).length, 0);
  for (const status of ['publicado', 'inativo', 'publicado', 'vendido', 'rascunho', 'publicado']) {
    assert.equal((await app.request(`${path}/${id}/status`, 'PATCH', { status })).status, 200);
    assert.equal((await publicItems()).length, status === 'publicado' ? 1 : 0);
  }
  assert.equal((await app.request(`${path}/${id}`, 'PUT', { ...sample, titulo: 'Anúncio atualizado', preco: 650000 })).status, 200);
  const [saved] = await publicItems(); assert.equal(saved.titulo, 'Anúncio atualizado'); assert.equal(saved.preco, 650000); assert.deepEqual(saved.imagens, []);
});
test('status changes require session, origin, method and a valid status, leaving existing data intact on error', async t => {
  const app = setup(t);
  assert.equal((await app.request(`${path}/1/status`, 'PATCH', { status: 'publicado' })).status, 401);
  await app.login();
  const id = (await (await app.request(path, 'POST', sample)).json()).id;
  const target = `${path}/${id}/status`;
  assert.equal((await app.request(target, 'PATCH', { status: 'publicado' }, 'https://other.example')).status, 403);
  for (const data of [null, {}, { status: 'qualquer' }, { status: 1 }]) assert.equal((await app.request(target, 'PATCH', data)).status, 400);
  assert.equal((await app.request(target, 'POST', { status: 'publicado' })).status, 405);
  assert.equal((await app.request(target, 'PATCH', { status: 'publicado', extra: 'x'.repeat(1100) })).status, 413);
  assert.equal((await app.request(`${path}/999/status`, 'PATCH', { status: 'publicado' })).status, 404);
  assert.equal(app.sqlite.prepare('SELECT status FROM imoveis WHERE id = ?').get(id).status, 'rascunho');
});
test('public API returns an error when D1 fails and never falls back to static listings', async () => {
  const response = await worker.fetch(new Request(origin + '/api/imoveis'), { DB: { prepare() { throw new Error('private database error'); } } });
  assert.equal(response.status, 503); assert.ok(!JSON.stringify(await response.json()).includes('private database error'));
  assert.equal((await worker.fetch(new Request(origin + '/api/imoveis', { method: 'POST' }), {})).status, 405);
});
