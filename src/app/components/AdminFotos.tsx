'use client';

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { ArrowDown, ArrowUp, ImagePlus, Star, Trash2, X } from 'lucide-react';

type Foto = { id: number; url: string | null; principal: boolean; ordem: number; legenda: string | null };
export default function AdminFotos({ id, titulo, onExpired, onChanged, onClose }: { id: number; titulo: string; onExpired: () => void; onChanged: () => Promise<void>; onClose: () => void }) {
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [deleting, setDeleting] = useState<Foto | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const upload = useRef<HTMLInputElement>(null);
  const endpoint = `/api/admin/imoveis/${id}/fotos`;
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(endpoint, { cache: 'no-store', credentials: 'same-origin' });
      if (response.status === 401) { onExpired(); return; }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não foi possível carregar as fotos.');
      setFotos(data.fotos); setDirty(false);
    } catch (err) { setError(err instanceof Error ? err.message : 'Falha ao carregar fotos.'); }
    finally { setLoading(false); }
  }, [endpoint, onExpired]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (deleting && dialog.current && !dialog.current.open) dialog.current.showModal(); }, [deleting]);
  async function send(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []); event.target.value = '';
    if (!files.length) return;
    setError(''); setNotice('');
    if (fotos.length + files.length > 30) { setError('Você pode cadastrar até 30 fotos por imóvel.'); return; }
    if (files.some(file => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size === 0 || file.size > 8 * 1024 * 1024)) { setError('Escolha fotos JPG, PNG ou WebP com até 8 MB cada.'); return; }
    setBusy(true); let completed = 0;
    try {
      for (const file of files) {
        setNotice(`Enviando foto ${completed + 1} de ${files.length}...`);
        const response = await fetch(endpoint, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': file.type }, body: file });
        if (response.status === 401) { onExpired(); return; }
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Não foi possível enviar a foto.');
        completed++;
      }
      setNotice(`${completed} ${completed === 1 ? 'foto enviada' : 'fotos enviadas'}.`);
    } catch (err) { setNotice(completed ? `${completed} fotos foram enviadas antes da interrupção.` : ''); setError(err instanceof Error ? err.message : 'Falha no envio.'); }
    finally { await load(); await onChanged(); setBusy(false); }
  }
  function move(index: number, direction: number) {
    const next = [...fotos]; [next[index], next[index + direction]] = [next[index + direction], next[index]];
    setFotos(next); setDirty(true); setNotice('');
  }
  async function save() {
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch(endpoint, { method: 'PATCH', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ids: fotos.map(foto => foto.id), principal: fotos.find(foto => foto.principal)?.id }) });
      if (response.status === 401) { onExpired(); return; }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não foi possível salvar.');
      setDirty(false); setNotice('Capa e ordem das fotos salvas.'); await load(); await onChanged();
    } catch (err) { setError(err instanceof Error ? err.message : 'Falha ao salvar.'); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (!deleting) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch(`${endpoint}/${deleting.id}`, { method: 'DELETE', credentials: 'same-origin' });
      if (response.status === 401) { onExpired(); return; }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não foi possível excluir.');
      setNotice(data.cleanupPending ? 'Foto removida do anúncio. A limpeza do arquivo no armazenamento ficou pendente.' : 'Foto excluída.');
      await load(); await onChanged();
    } catch (err) { setError(err instanceof Error ? err.message : 'Falha ao excluir.'); }
    finally { setDeleting(null); setBusy(false); }
  }
  return <section aria-label={`Fotos de ${titulo}`} className="mb-8 rounded-3xl border border-[#e1dbd1] bg-white p-6 sm:p-8">
    <div className="flex items-start justify-between gap-4"><div><h2 className="text-2xl font-semibold">Fotos do imóvel</h2><p className="mt-2 text-slate-600">{titulo}</p></div><button disabled={busy || dirty} onClick={onClose} aria-label="Fechar fotos" className="rounded-full border p-2 disabled:opacity-40"><X size={20}/></button></div>
    <p className="mt-4 text-sm leading-6 text-slate-600">Até 30 fotos por imóvel. JPG, PNG ou WebP, com até 8 MB cada. A capa será a primeira imagem da vitrine.</p>
    {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-red-700">{error}</p>}
    {notice && <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 text-emerald-800">{notice}</p>}
    <div className="mt-5 flex flex-wrap gap-3"><input ref={upload} type="file" multiple accept="image/jpeg,image/png,image/webp" aria-label="Selecionar fotos" className="sr-only" disabled={busy || dirty || loading} onChange={event => void send(event)}/><button disabled={busy || dirty || loading || fotos.length >= 30} onClick={() => upload.current?.click()} className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3 font-semibold text-white disabled:opacity-40"><ImagePlus size={18}/> Enviar fotos</button><button disabled={busy || !dirty} onClick={() => void save()} className="rounded-full border border-[#d8d2c7] px-5 py-3 font-semibold disabled:opacity-40">{busy ? 'Aguarde...' : 'Salvar capa e ordem'}</button>{dirty && <button disabled={busy} onClick={() => { setError(''); void load(); }} className="px-3 py-2 text-sm font-semibold text-[#987447]">Descartar alterações</button>}</div>
    {dirty && <p className="mt-3 text-sm text-amber-800">Salve a capa e a ordem antes de enviar, excluir ou fechar as fotos.</p>}
    {loading ? <p className="mt-6" role="status">Carregando fotos...</p> : !fotos.length ? <p className="mt-6 text-slate-600">Nenhuma foto cadastrada. Envie as primeiras imagens deste imóvel.</p> : <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{fotos.map((foto, index) => <div key={foto.id} className="overflow-hidden rounded-2xl border border-[#e1dbd1]">
      {foto.url ? <img src={foto.url} alt={`Foto ${index + 1} de ${titulo}`} className="h-44 w-full bg-sand object-cover"/> : <div className="flex h-44 items-center justify-center bg-sand">Imagem indisponível</div>}
      <div className="p-4"><p className="text-sm font-semibold">Foto {index + 1}{foto.principal ? ' · Capa' : ''}</p><div className="mt-3 flex flex-wrap gap-2"><button disabled={busy || foto.principal} onClick={() => { setFotos(fotos.map(item => ({ ...item, principal: item.id === foto.id }))); setDirty(true); setNotice(''); }} aria-label={`Usar foto ${index + 1} como capa`} className="inline-flex items-center gap-1 rounded-lg border px-2 py-2 text-xs font-semibold disabled:opacity-40"><Star size={15}/> Capa</button><button disabled={busy || index === 0} onClick={() => move(index, -1)} aria-label={`Mover foto ${index + 1} para antes`} className="rounded-lg border p-2 disabled:opacity-40"><ArrowUp size={15}/></button><button disabled={busy || index === fotos.length - 1} onClick={() => move(index, 1)} aria-label={`Mover foto ${index + 1} para depois`} className="rounded-lg border p-2 disabled:opacity-40"><ArrowDown size={15}/></button><button disabled={busy || dirty} onClick={() => setDeleting(foto)} aria-label={`Excluir foto ${index + 1}`} className="rounded-lg border p-2 text-red-700 disabled:opacity-40"><Trash2 size={15}/></button></div></div>
    </div>)}</div>}
    {deleting && <dialog ref={dialog} onCancel={event => { event.preventDefault(); if (!busy) setDeleting(null); }} aria-labelledby="delete-photo-title" className="fixed inset-0 m-auto w-[calc(100%_-_3rem)] max-w-md rounded-3xl bg-white p-7 text-ink shadow-xl backdrop:bg-black/40"><h2 id="delete-photo-title" className="text-xl font-semibold">Excluir esta foto?</h2>{deleting.url && <img src={deleting.url} alt="Foto a excluir" className="mt-4 h-40 w-full rounded-xl object-cover"/>}<p className="mt-4 leading-7 text-slate-600">A foto será removida deste imóvel. Se ela for a capa, outra foto será escolhida automaticamente.</p><div className="mt-6 flex gap-3"><button autoFocus disabled={busy} onClick={() => setDeleting(null)} className="rounded-full border px-5 py-3 font-semibold">Cancelar</button><button disabled={busy} onClick={() => void remove()} className="rounded-full bg-red-700 px-5 py-3 font-semibold text-white">{busy ? 'Excluindo...' : 'Confirmar exclusão'}</button></div></dialog>}
  </section>;
}
