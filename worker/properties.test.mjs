import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import worker from './index.js';
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
  const objects = new Map();
  const FOTOS = { async put(key, value) { objects.set(key, new Uint8Array(value)); return { key }; }, async get(key) { const data = objects.get(key); return data ? { body: data, size: data.length } : null; }, async delete(key) { objects.delete(key); } };
  const env = { DB, FOTOS, ADMIN_PASSWORD: 'test-only-password', SESSION_SECRET: 'test-only-secret' };
  let cookie = '';
  async function request(route, method = 'GET', data, requestOrigin = origin) {
    return worker.fetch(new Request(origin + route, { method, headers: { origin: requestOrigin, cookie, 'content-type': 'application/json' }, ...(data === undefined ? {} : { body: JSON.stringify(data) }) }), env);
  }
  return { sqlite, env, objects, request, async rawRequest(route, method, body, type = 'image/png', requestOrigin = origin) {
    return worker.fetch(new Request(origin + route, { method, headers: { cookie, origin: requestOrigin, 'content-type': type }, body }), env);
  }, async login() {
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

const png = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jgX8AAAAASUVORK5CYII=', 'base64'));
test('uploads have unique safe keys, private photo access, primary selection, ordering and public status checks', async t => {
  const app = setup(t); await app.login();
  const id = (await (await app.request(path, 'POST', sample)).json()).id;
  const photosPath = `${path}/${id}/fotos`;
  const ids = [];
  for (let i = 0; i < 2; i++) {
    const response = await app.rawRequest(photosPath, 'POST', png); assert.equal(response.status, 201); ids.push((await response.json()).id);
  }
  assert.equal(app.objects.size, 2);
  for (const key of app.objects.keys()) assert.match(key, new RegExp(`^imoveis/${id}/[a-f0-9-]+\\.png$`));
  const fotos = (await (await app.request(photosPath)).json()).fotos;
  assert.equal(fotos[0].principal, true); assert.equal(fotos[1].principal, false); assert.equal(fotos[0].url, `/api/admin/fotos/${ids[0]}`);
  const privateImage = await app.request(`/api/admin/fotos/${ids[0]}`);
  assert.equal(privateImage.status, 200); assert.equal(privateImage.headers.get('content-type'), 'image/png'); assert.equal(privateImage.headers.get('x-content-type-options'), 'nosniff');
  assert.deepEqual(new Uint8Array(await privateImage.arrayBuffer()), png);
  assert.equal((await app.request(`/api/fotos/${ids[0]}`)).status, 404);
  assert.equal((await worker.fetch(new Request(origin + `/api/admin/fotos/${ids[0]}`), app.env)).status, 401);
  assert.equal((await app.request(photosPath, 'PATCH', { ids: [...ids].reverse(), principal: ids[1] })).status, 200);
  assert.equal((await app.request(`${path}/${id}/status`, 'PATCH', { status: 'publicado' })).status, 200);
  const images = (await (await app.request('/api/imoveis')).json()).imoveis[0].imagens;
  assert.deepEqual(images, [`/api/fotos/${ids[1]}`, `/api/fotos/${ids[0]}`]);
  assert.equal((await worker.fetch(new Request(origin + `/api/fotos/${ids[0]}`), { DB: app.env.DB, FOTOS: app.env.FOTOS })).status, 200);
  assert.equal((await app.request(`/api/fotos/${ids[0]}`, 'HEAD')).status, 200);
  await app.request(`${path}/${id}/status`, 'PATCH', { status: 'inativo' });
  assert.equal((await app.request(`/api/fotos/${ids[0]}`)).status, 404);
});
test('uploads reject unauthenticated, cross-origin, oversized and spoofed files and enforce 30 photo limit', async t => {
  const app = setup(t);
  assert.equal((await app.rawRequest(`${path}/1/fotos`, 'POST', png)).status, 401);
  await app.login(); const id = (await (await app.request(path, 'POST', sample)).json()).id; const target = `${path}/${id}/fotos`;
  assert.equal((await app.rawRequest(target, 'POST', png, 'image/png', 'https://other.example')).status, 403);
  assert.equal((await app.rawRequest(target, 'POST', png, 'image/svg+xml')).status, 415);
  assert.equal((await app.rawRequest(target, 'POST', '<html>not a photo</html>')).status, 415);
  assert.equal((await app.rawRequest(target, 'POST', new Uint8Array(8 * 1024 * 1024 + 1))).status, 413);
  assert.equal(app.objects.size, 0);
  for (let i = 0; i < 30; i++) assert.equal((await app.rawRequest(target, 'POST', png)).status, 201);
  assert.equal((await app.rawRequest(target, 'POST', png)).status, 409); assert.equal(app.objects.size, 30);
});
test('ordering rejects missing, duplicated and foreign photo ids; deleting a cover promotes a remaining photo', async t => {
  const app = setup(t); await app.login();
  const id = (await (await app.request(path, 'POST', sample)).json()).id; const target = `${path}/${id}/fotos`;
  const first = (await (await app.rawRequest(target, 'POST', png)).json()).id;
  const second = (await (await app.rawRequest(target, 'POST', png)).json()).id;
  const other = (await (await app.request(path, 'POST', { ...sample, referencia: 'OTHER' })).json()).id;
  const foreign = (await (await app.rawRequest(`${path}/${other}/fotos`, 'POST', png)).json()).id;
  for (const data of [{ ids: [first, first], principal: first }, { ids: [], principal: first }, { ids: [first, second], principal: 999 }]) assert.equal((await app.request(target, 'PATCH', data)).status, 400);
  assert.equal((await app.request(target, 'PATCH', { ids: [first], principal: first })).status, 409);
  assert.equal((await app.request(target, 'PATCH', { ids: [first, foreign], principal: first })).status, 409);
  assert.equal((await app.request(`${target}/${foreign}`, 'DELETE')).status, 404);
  assert.equal((await app.request(`${target}/${first}`, 'DELETE', undefined, 'https://other.example')).status, 403);
  assert.equal((await app.request(`${target}/${first}`, 'DELETE')).status, 200);
  assert.equal(app.objects.size, 2); assert.equal((await app.request(`/api/admin/fotos/${first}`)).status, 404);
  let photos = (await (await app.request(target)).json()).fotos; assert.equal(photos.length, 1); assert.equal(photos[0].principal, true); assert.equal(photos[0].id, second);
  assert.equal((await app.request(`${target}/${second}`, 'DELETE')).status, 200);
  photos = (await (await app.request(target)).json()).fotos; assert.equal(photos.length, 0);
  assert.equal((await app.request(`${path}/${other}/fotos`)).status, 200);
});
test('failed D1 registration removes the uploaded object; failed R2 upload does not register a photo', async t => {
  const app = setup(t); await app.login();
  const id = (await (await app.request(path, 'POST', sample)).json()).id; const target = `${path}/${id}/fotos`;
  const prepare = app.env.DB.prepare;
  app.env.DB.prepare = sql => { if (sql.startsWith('INSERT INTO imoveis_fotos')) throw new Error('D1 failed'); return prepare(sql); };
  assert.equal((await app.rawRequest(target, 'POST', png)).status, 503); assert.equal(app.objects.size, 0);
  app.env.DB.prepare = prepare; app.env.FOTOS.put = async () => { throw new Error('R2 failed'); };
  assert.equal((await app.rawRequest(target, 'POST', png)).status, 503);
  assert.equal(app.sqlite.prepare('SELECT COUNT(*) AS total FROM imoveis_fotos').get().total, 0);
});
test('individual public property links keep their id across edits and never reveal private or missing properties', async t => {
  const app = setup(t); await app.login();
  const id = (await (await app.request(path, 'POST', sample)).json()).id;
  const endpoint = `/api/imoveis/${id}`;
  assert.equal((await app.request(endpoint)).status, 404);
  await app.request(`${path}/${id}/status`, 'PATCH', { status: 'publicado' });
  let response = await worker.fetch(new Request(origin + endpoint), { DB: app.env.DB });
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
  let item = (await response.json()).imovel;
  assert.equal(item.id, String(id)); assert.equal(item.titulo, sample.titulo); assert.equal(item.descricao, sample.descricao);
  await app.request(`${path}/${id}`, 'PUT', { ...sample, referencia: 'NOVA-REF', titulo: 'Título revisado' });
  item = (await (await app.request(endpoint)).json()).imovel;
  assert.equal(item.id, String(id)); assert.equal(item.titulo, 'Título revisado'); assert.equal(item.referencia, 'NOVA-REF');
  for (const status of ['vendido', 'inativo', 'rascunho']) {
    await app.request(`${path}/${id}/status`, 'PATCH', { status });
    response = await app.request(endpoint); assert.equal(response.status, 404); assert.ok(!JSON.stringify(await response.json()).includes('Título revisado'));
  }
  assert.equal((await app.request('/api/imoveis/999999')).status, 404);
  assert.equal((await app.request('/api/imoveis/999999999999999999999999999')).status, 400);
  assert.equal((await app.request(endpoint, 'POST', {})).status, 405);
});
