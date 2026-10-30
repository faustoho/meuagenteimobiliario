const MAX_BYTES = 8 * 1024 * 1024;
const MAX_PHOTOS = 30;
const localPhoto = /^\/imoveis\/[a-z0-9_-]+\.(webp|png|jpe?g|avif)$/i;
const storedPhoto = /^imoveis\/[1-9]\d*\/[a-f0-9-]+\.(jpg|png|webp)$/;
const json = (data, status = 200, extra = {}) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra } });
export function photoUrl(photo, admin = false) {
  if (localPhoto.test(photo.arquivo || '')) return photo.arquivo;
  return storedPhoto.test(photo.arquivo || '') ? `/api/${admin ? 'admin/' : ''}fotos/${photo.id}` : null;
}
async function bytes(request, limit) {
  if (Number(request.headers.get('content-length')) > limit) throw new Error('size');
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks = []; let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > limit) { await reader.cancel(); throw new Error('size'); }
    chunks.push(value);
  }
  const result = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return result;
}
function format(data, mime) {
  if (mime === 'image/jpeg' && data.length > 4 && data[0] === 255 && data[1] === 216 && data[2] === 255 && data.at(-2) === 255 && data.at(-1) === 217) return 'jpg';
  if (mime === 'image/png' && data.length >= 33 && [137,80,78,71,13,10,26,10].every((v, i) => data[i] === v) && new TextDecoder().decode(data.slice(12,16)) === 'IHDR' && new TextDecoder().decode(data.slice(-8,-4)) === 'IEND') return 'png';
  if (mime === 'image/webp' && data.length >= 20 && new TextDecoder().decode(data.slice(0,4)) === 'RIFF' && new TextDecoder().decode(data.slice(8,12)) === 'WEBP' && ['VP8 ', 'VP8L', 'VP8X'].includes(new TextDecoder().decode(data.slice(12,16))) && new DataView(data.buffer, data.byteOffset).getUint32(4, true) + 8 === data.length) return 'webp';
  return null;
}
export async function servePhoto(request, env, id, admin = false) {
  if (!Number.isSafeInteger(id) || id < 1) return json({ error: 'Foto inválida.' }, 400);
  if (!['GET', 'HEAD'].includes(request.method)) return json({ error: 'Método não permitido.' }, 405, { allow: 'GET, HEAD' });
  try {
    const photo = await env.DB.prepare(`SELECT f.id, f.arquivo FROM imoveis_fotos f JOIN imoveis i ON i.id = f.imovel_id WHERE f.id = ?${admin ? '' : " AND i.status = 'publicado'"}`).bind(id).first();
    if (!photo || !storedPhoto.test(photo.arquivo)) return json({ error: 'Foto não encontrada.' }, 404);
    if (!env.FOTOS) return json({ error: 'Armazenamento de fotos indisponível.' }, 503);
    const object = await env.FOTOS.get(photo.arquivo);
    if (!object) return json({ error: 'Foto não encontrada.' }, 404);
    const extension = photo.arquivo.split('.').at(-1);
    const headers = { 'content-type': { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }[extension], 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'content-length': String(object.size), 'content-disposition': 'inline' };
    return new Response(request.method === 'HEAD' ? null : object.body, { headers });
  } catch { return json({ error: 'Não foi possível carregar a foto.' }, 503); }
}
// Chamado somente após validar a sessão administrativa no Worker.
export async function managePhotos(request, env, propertyId, photoId = null) {
  try {
    if (!await env.DB.prepare('SELECT id FROM imoveis WHERE id = ?').bind(propertyId).first()) return json({ error: 'Imóvel não encontrado.' }, 404);
    if (request.method === 'GET' && photoId === null) {
      const { results } = await env.DB.prepare('SELECT id, arquivo, legenda, ordem, principal FROM imoveis_fotos WHERE imovel_id = ? ORDER BY ordem, id').bind(propertyId).all();
      return json({ fotos: results.map(photo => ({ id: photo.id, legenda: photo.legenda, ordem: photo.ordem, principal: Boolean(photo.principal), url: photoUrl(photo, true) })), limite: MAX_PHOTOS });
    }
    if (request.headers.get('origin') !== new URL(request.url).origin) return json({ error: 'Origem inválida.' }, 403);
    if (request.method === 'POST' && photoId === null) {
      if (!env.FOTOS) return json({ error: 'Armazenamento de fotos indisponível.' }, 503);
      const mime = request.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime)) return json({ error: 'Use fotos JPG, PNG ou WebP.' }, 415);
      const count = await env.DB.prepare('SELECT COUNT(*) AS total FROM imoveis_fotos WHERE imovel_id = ?').bind(propertyId).first();
      if (count.total >= MAX_PHOTOS) return json({ error: 'Limite de 30 fotos por imóvel.' }, 409);
      let data;
      try { data = await bytes(request, MAX_BYTES); } catch { return json({ error: 'Cada foto deve ter no máximo 8 MB.' }, 413); }
      const extension = format(data, mime);
      if (!extension) return json({ error: 'Arquivo inválido. Envie uma foto JPG, PNG ou WebP.' }, 415);
      const key = `imoveis/${propertyId}/${crypto.randomUUID()}.${extension}`;
      await env.FOTOS.put(key, data, { httpMetadata: { contentType: mime } });
      try {
        const result = await env.DB.prepare('INSERT INTO imoveis_fotos (imovel_id, arquivo, ordem, principal) SELECT ?, ?, COALESCE((SELECT MAX(ordem) + 1 FROM imoveis_fotos WHERE imovel_id = ?), 0), CASE WHEN EXISTS (SELECT 1 FROM imoveis_fotos WHERE imovel_id = ? AND principal = 1) THEN 0 ELSE 1 END WHERE EXISTS (SELECT 1 FROM imoveis WHERE id = ?) AND (SELECT COUNT(*) FROM imoveis_fotos WHERE imovel_id = ?) < ?').bind(propertyId, key, propertyId, propertyId, propertyId, propertyId, MAX_PHOTOS).run();
        if (!result.meta.changes) { await env.FOTOS.delete(key); return json({ error: 'O cadastro mudou ou atingiu o limite de fotos. Atualize a lista.' }, 409); }
        return json({ id: result.meta.last_row_id, uploaded: true }, 201);
      } catch {
        try { await env.FOTOS.delete(key); } catch { console.error('Fotos: falha ao limpar upload não registrado.'); }
        return json({ error: 'Não foi possível registrar a foto. Tente novamente.' }, 503);
      }
    }
    if (request.method === 'PATCH' && photoId === null) {
      if (!request.headers.get('content-type')?.includes('application/json')) return json({ error: 'Formato inválido.' }, 415);
      let body; try { body = await bytes(request, 4096); } catch { return json({ error: 'Requisição muito grande.' }, 413); }
      let data; try { data = JSON.parse(new TextDecoder().decode(body)); } catch { return json({ error: 'Dados inválidos.' }, 400); }
      if (!data || !Array.isArray(data.ids) || !data.ids.length || data.ids.length > MAX_PHOTOS || data.ids.some(id => !Number.isSafeInteger(id) || id < 1) || new Set(data.ids).size !== data.ids.length || !data.ids.includes(data.principal)) return json({ error: 'Ordem ou capa inválida.' }, 400);
      const { results } = await env.DB.prepare('SELECT id FROM imoveis_fotos WHERE imovel_id = ?').bind(propertyId).all();
      if (results.length !== data.ids.length || results.some(photo => !data.ids.includes(photo.id))) return json({ error: 'A lista de fotos mudou. Atualize antes de salvar.' }, 409);
      const cases = data.ids.map(() => 'WHEN ? THEN ?').join(' ');
      const values = data.ids.flatMap((id, index) => [id, index]);
      const result = await env.DB.prepare(`UPDATE imoveis_fotos SET ordem = CASE id ${cases} END, principal = CASE WHEN id = ? THEN 1 ELSE 0 END WHERE imovel_id = ? AND (SELECT COUNT(*) FROM imoveis_fotos WHERE imovel_id = ?) = ?`).bind(...values, data.principal, propertyId, propertyId, data.ids.length).run();
      return result.meta.changes === data.ids.length ? json({ saved: true }) : json({ error: 'A lista de fotos mudou. Atualize antes de salvar.' }, 409);
    }
    if (request.method === 'DELETE' && photoId !== null) {
      const photo = await env.DB.prepare('SELECT id, arquivo FROM imoveis_fotos WHERE id = ? AND imovel_id = ?').bind(photoId, propertyId).first();
      if (!photo) return json({ error: 'Foto não encontrada.' }, 404);
      if (storedPhoto.test(photo.arquivo) && !env.FOTOS) return json({ error: 'Armazenamento de fotos indisponível.' }, 503);
      await env.DB.batch([
        env.DB.prepare('DELETE FROM imoveis_fotos WHERE id = ? AND imovel_id = ?').bind(photoId, propertyId),
        env.DB.prepare('UPDATE imoveis_fotos SET principal = CASE WHEN id = (SELECT id FROM imoveis_fotos WHERE imovel_id = ? ORDER BY principal DESC, ordem, id LIMIT 1) THEN 1 ELSE 0 END WHERE imovel_id = ?').bind(propertyId, propertyId)
      ]);
      let cleanupPending = false;
      if (storedPhoto.test(photo.arquivo)) { try { await env.FOTOS.delete(photo.arquivo); } catch { cleanupPending = true; console.error('Fotos: limpeza de objeto pendente após exclusão.'); } }
      // Fotos locais legadas nunca são apagadas dos assets do site.
      return json({ deleted: true, cleanupPending });
    }
    return json({ error: 'Método não permitido.' }, 405, { allow: photoId === null ? 'GET, POST, PATCH' : 'DELETE' });
  } catch { return json({ error: 'Não foi possível processar as fotos.' }, 503); }
}
