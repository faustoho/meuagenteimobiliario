import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('./index.js', import.meta.url), 'utf8');
const { default: worker } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const origin = 'https://example.com';
const sample = { titulo: 'Casa de teste', cidade: 'Curitiba', tipo: 'Casa', finalidade: 'Venda', preco: 500000, referencia: 'TESTE' };
function setup() {
  const calls = [];
  const env = { ADMIN_PASSWORD: 'test-password-only', SESSION_SECRET: 'test-session-only', DB: { prepare(sql) {
    const statement = { bind(...values) { calls.push({ sql, values }); return statement; }, async first() { return null; }, async run() { return { meta: { last_row_id: 42 } }; }, async all() { calls.push({ sql }); return { results: [{ id: 42, ...sample, status: 'rascunho' }] }; } };
    return statement;
  } } };
  return { env, calls };
}
async function login(env) {
  const response = await worker.fetch(new Request(origin + '/api/admin/login', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify({ password: env.ADMIN_PASSWORD }) }), env);
  assert.equal(response.status, 200);
  return response.headers.get('set-cookie').split(';')[0];
}
function post(cookie, data = sample, requestOrigin = origin) {
  return new Request(origin + '/api/admin/imoveis', { method: 'POST', headers: { cookie, origin: requestOrigin, 'content-type': 'application/json' }, body: JSON.stringify(data) });
}
test('list and create reject unauthenticated requests before touching D1', async () => {
  const { env, calls } = setup();
  for (const request of [new Request(origin + '/api/admin/imoveis'), post('')]) assert.equal((await worker.fetch(request, env)).status, 401);
  assert.equal(calls.length, 0);
});
test('signed session lists D1 properties and tampered session is rejected', async () => {
  const { env } = setup(); const cookie = await login(env);
  const response = await worker.fetch(new Request(origin + '/api/admin/imoveis', { headers: { cookie } }), env);
  assert.equal(response.status, 200); assert.equal((await response.json()).imoveis[0].id, 42);
  assert.equal((await worker.fetch(new Request(origin + '/api/admin/imoveis', { headers: { cookie: cookie + 'x' } }), env)).status, 401);
});
test('create requires same origin, valid input, and always saves a draft', async () => {
  const { env, calls } = setup(); const cookie = await login(env);
  for (const data of [null, [], { ...sample, preco: -1 }, { ...sample, titulo: ' ' }, { ...sample, tipo: 'inválido' }]) assert.equal((await worker.fetch(post(cookie, data), env)).status, 400);
  assert.equal((await worker.fetch(post(cookie, sample, 'https://other.example'), env)).status, 403);
  const response = await worker.fetch(post(cookie, { ...sample, status: 'publicado' }), env);
  assert.equal(response.status, 201); assert.deepEqual(await response.json(), { id: 42, status: 'rascunho' });
  const insert = calls.find(call => call.sql.startsWith('INSERT INTO imoveis '));
  assert.ok(insert.sql.includes("'rascunho'")); assert.deepEqual(insert.values, ['TESTE', 'Casa de teste', 'Casa', 'Venda', 'Curitiba', 500000]);
});
test('duplicate references return 409 and database failures return 503', async () => {
  const { env } = setup(); const cookie = await login(env);
  env.DB.prepare = () => ({ bind() { return this; }, async first() { return { id: 1 }; } });
  assert.equal((await worker.fetch(post(cookie), env)).status, 409);
  env.DB.prepare = () => { throw new Error('database unavailable'); };
  assert.equal((await worker.fetch(new Request(origin + '/api/admin/imoveis', { headers: { cookie } }), env)).status, 503);
});
test('logout clears the browser cookie with its original security attributes', async () => {
  const { env } = setup();
  const response = await worker.fetch(new Request(origin + '/api/admin/logout', { method: 'POST', headers: { origin } }), env);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('set-cookie'), /mai_admin=; Path=\/api\/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=0/);
});
