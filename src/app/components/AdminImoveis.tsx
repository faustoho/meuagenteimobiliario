'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Building2, LoaderCircle, LogOut, Plus, RefreshCw, Pencil, Download } from 'lucide-react';

type Imovel = { id: number; referencia: string | null; titulo: string; descricao: string | null; tipo: string; finalidade: string; cidade: string; bairro: string | null; preco: number; area: number | null; quartos: number | null; banheiros: number | null; vagas: number | null; url_origem: string | null; status: string; foto_principal: string | null };
const statuses: Record<string, string> = { rascunho: 'Rascunho', publicado: 'Publicado', vendido: 'Vendido', inativo: 'Inativo' };
const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const field = 'mt-2 w-full rounded-xl border border-[#d8d2c7] bg-white px-4 py-3 outline-none focus:border-[#987447]';

export default function AdminImoveis({ onLogout, onExpired }: { onLogout: () => Promise<void>; onExpired: () => void }) {
  const [imoveis, setImoveis] = useState<Imovel[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Imovel | null>(null);
  const [migrating, setMigrating] = useState(false);
  const [statusDrafts, setStatusDrafts] = useState<Record<number, string>>({});
  const [statusChange, setStatusChange] = useState<{ id: number; titulo: string; status: string } | null>(null);
  const statusDialog = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [filter, setFilter] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/imoveis', { credentials: 'same-origin', cache: 'no-store' });
      if (response.status === 401) { onExpired(); return; }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não foi possível carregar os imóveis.');
      setImoveis(data.imoveis);
    } catch (err) { setError(err instanceof Error ? err.message : 'Falha ao carregar os imóveis.'); }
    finally { setLoading(false); }
  }, [onExpired]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (statusChange && statusDialog.current && !statusDialog.current.open) statusDialog.current.showModal(); }, [statusChange]);
  async function changeStatus() {
    if (!statusChange) return;
    setSaving(true); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/admin/imoveis/${statusChange.id}/status`, {
        method: 'PATCH', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: statusChange.status })
      });
      if (response.status === 401) { onExpired(); return; }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não foi possível alterar o status.');
      setStatusChange(null); setStatusDrafts({});
      setNotice(data.status === 'publicado' ? 'Imóvel publicado. Ele já pode ser consultado na vitrine.' : 'Status atualizado. O imóvel não aparece na vitrine pública.');
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Falha ao alterar o status.'); setStatusChange(null); }
    finally { setSaving(false); }
  }
  async function migrate() {
    setMigrating(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/admin/migrar-vitrine', { method: 'POST', credentials: 'same-origin' });
      if (response.status === 401) { onExpired(); return; }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não foi possível integrar o imóvel.');
      setNotice('Imóvel da vitrine integrado ao painel com os dados e a fotografia preservados.');
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Falha na integração.'); }
    finally { setMigrating(false); }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload: Record<string, string | number | null> = {};
    for (const key of ['referencia', 'titulo', 'descricao', 'tipo', 'finalidade', 'cidade', 'bairro', 'url_origem']) payload[key] = String(form.get(key) ?? '');
    for (const key of ['preco', 'area', 'quartos', 'banheiros', 'vagas']) payload[key] = form.get(key) === '' ? null : Number(form.get(key));
    setSaving(true); setError(''); setNotice('');
    try {
      const response = await fetch(editing ? `/api/admin/imoveis/${editing.id}` : '/api/admin/imoveis', {
        method: editing ? 'PUT' : 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (response.status === 401) { onExpired(); return; }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não foi possível salvar.');
      setCreating(false); setEditing(null); setFilter(''); setNotice(editing ? (editing.status === 'publicado' ? 'Alterações salvas e disponíveis na vitrine. O status e a fotografia foram preservados.' : 'Alterações salvas no painel. O imóvel continua fora da vitrine.') : 'Rascunho salvo. O imóvel ainda não está publicado na vitrine.');
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Falha ao salvar.'); }
    finally { setSaving(false); }
  }
  const visible = imoveis.filter(item => `${item.titulo} ${item.referencia ?? ''} ${item.cidade}`.toLocaleLowerCase('pt-BR').includes(filter.toLocaleLowerCase('pt-BR')));
  return <section className="mx-auto max-w-6xl px-6 pb-20">
    <div className="flex flex-wrap items-center justify-between gap-4 py-6">
      <div><p className="text-xs font-semibold uppercase tracking-[.22em] text-[#987447]">Painel administrativo</p><h1 className="mt-2 text-3xl font-semibold">Seus imóveis</h1><p className="mt-2 text-slate-600">Gerencie sua carteira de imóveis.</p></div>
      <div className="flex flex-wrap gap-3"><button disabled={loading || saving || migrating || creating} onClick={() => { setEditing(null); setCreating(true); setError(''); setNotice(''); }} className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3 font-semibold text-white disabled:opacity-50"><Plus size={18}/> Novo imóvel</button><button disabled={leaving || saving || migrating} onClick={async () => { setLeaving(true); try { await onLogout(); } finally { setLeaving(false); } }} className="inline-flex items-center gap-2 rounded-full border border-[#d8d2c7] px-5 py-3 font-semibold disabled:opacity-50"><LogOut size={18}/>{leaving ? 'Saindo...' : 'Sair'}</button></div>
    </div>
    {notice && <p role="status" className="mb-5 rounded-xl bg-emerald-50 p-4 text-emerald-800">{notice}</p>}
    {error && <p role="alert" className="mb-5 rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}
    <p className="mb-5 text-sm leading-6 text-slate-600">Somente imóveis com status Publicado aparecem na vitrine. Alterações nos anúncios publicados são exibidas ao abrir ou atualizar a vitrine.</p>
    {statusChange && <dialog ref={statusDialog} onCancel={event => { event.preventDefault(); if (!saving) setStatusChange(null); }} aria-labelledby="status-title" aria-describedby="status-description" className="fixed inset-0 m-auto w-[calc(100%_-_3rem)] max-w-md rounded-3xl bg-white p-7 text-ink shadow-xl backdrop:bg-black/40">
      <h2 id="status-title" className="text-xl font-semibold">{statusChange.status === 'publicado' ? 'Publicar imóvel?' : 'Alterar status do imóvel?'}</h2>
      <p className="mt-3 font-semibold">{statusChange.titulo}</p>
      <p id="status-description" className="mt-3 leading-7 text-slate-600">{statusChange.status === 'publicado' ? 'Os dados e as fotografias deste imóvel ficarão visíveis para qualquer visitante do site.' : `O imóvel será marcado como ${statuses[statusChange.status].toLocaleLowerCase('pt-BR')} e ficará fora da vitrine pública.`}</p>
      <div className="mt-6 flex flex-wrap gap-3"><button autoFocus disabled={saving} onClick={() => setStatusChange(null)} className="rounded-full border border-[#d8d2c7] px-5 py-3 font-semibold">Cancelar</button><button disabled={saving} onClick={() => void changeStatus()} className="rounded-full bg-ink px-5 py-3 font-semibold text-white disabled:opacity-50">{saving ? 'Salvando...' : statusChange.status === 'publicado' ? 'Confirmar publicação' : 'Confirmar alteração'}</button></div>
    </dialog>}
    {!loading && !error && !imoveis.some(item => item.referencia === '11472745') && <div className="mb-6 rounded-2xl border border-[#e1dbd1] bg-white p-5"><p className="text-sm text-slate-600">Traga para o painel a casa de Florianópolis já exibida na vitrine, com sua fotografia.</p><button disabled={migrating || saving || creating} onClick={() => void migrate()} className="mt-3 inline-flex items-center gap-2 font-semibold text-[#987447] disabled:opacity-50"><Download size={18}/>{migrating ? 'Integrando...' : 'Integrar imóvel da vitrine'}</button></div>}
    {creating && <form key={editing?.id ?? 'novo'} onSubmit={save} aria-label={editing ? 'Editar imóvel' : 'Novo imóvel'} className="mb-8 rounded-3xl border border-[#e1dbd1] bg-white p-6 sm:p-8">
      <h2 className="text-xl font-semibold">{editing ? 'Editar imóvel' : 'Novo imóvel'}</h2><p className="mt-2 text-sm text-slate-600">{editing ? `Status atual: ${statuses[editing.status] || editing.status}. Salvar mantém esse status.` : 'Preencha os dados do imóvel. Ele será salvo como rascunho.'}</p>
      {editing?.foto_principal?.startsWith('/imoveis/') && <img src={editing.foto_principal} alt={`Fotografia de ${editing.titulo}`} className="mt-5 h-44 w-full max-w-sm rounded-xl object-cover"/>}
      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <label className="text-sm font-semibold sm:col-span-2">Título *<input name="titulo" defaultValue={editing?.titulo ?? ''} required maxLength={200} className={field}/></label>
        <label className="text-sm font-semibold sm:col-span-2">Descrição<textarea name="descricao" defaultValue={editing?.descricao ?? ''} rows={5} maxLength={10000} className={field}/></label>
        <label className="text-sm font-semibold">Referência<input name="referencia" defaultValue={editing?.referencia ?? ''} maxLength={80} className={field}/></label>
        <label className="text-sm font-semibold">Cidade *<input name="cidade" defaultValue={editing?.cidade ?? ''} required maxLength={120} className={field}/></label>
        <label className="text-sm font-semibold">Bairro<input name="bairro" defaultValue={editing?.bairro ?? ''} maxLength={120} className={field}/></label>
        <label className="text-sm font-semibold">Tipo *<select name="tipo" defaultValue={editing?.tipo ?? 'Casa'} className={field}>{['Casa', 'Apartamento', 'Sobrado', 'Terreno', 'Comercial', 'Outro'].map(value => <option key={value}>{value}</option>)}</select></label>
        <label className="text-sm font-semibold">Finalidade *<select name="finalidade" defaultValue={editing?.finalidade ?? 'Venda'} className={field}><option>Venda</option><option>Locação</option></select></label>
        <label className="text-sm font-semibold">Preço (R$) *<input name="preco" defaultValue={editing?.preco ?? ''} type="number" min="0.01" max="1000000000000" step="0.01" required className={field}/></label>
        <label className="text-sm font-semibold">Área (m²)<input name="area" defaultValue={editing?.area ?? ''} type="number" min="0" max="1000000000" step="0.01" className={field}/></label>
        {(['quartos', 'banheiros', 'vagas'] as const).map(key => <label key={key} className="text-sm font-semibold">{{ quartos: 'Quartos', banheiros: 'Banheiros', vagas: 'Vagas' }[key]}<input name={key} defaultValue={editing?.[key] ?? ''} type="number" min="0" max="1000" step="1" className={field}/></label>)}
        <label className="text-sm font-semibold sm:col-span-2">URL de origem<input name="url_origem" defaultValue={editing?.url_origem ?? ''} type="url" maxLength={2048} placeholder="https://" className={field}/></label>
      </div><div className="mt-6 flex flex-wrap gap-3"><button disabled={saving} className="rounded-full bg-ink px-6 py-3 font-semibold text-white disabled:opacity-50">{saving ? 'Salvando...' : editing ? 'Salvar alterações' : 'Salvar rascunho'}</button><button type="button" disabled={saving} onClick={() => { setCreating(false); setEditing(null); setError(''); }} className="rounded-full border border-[#d8d2c7] px-6 py-3 font-semibold">Cancelar</button></div>
    </form>}
    <div className="rounded-3xl border border-[#e1dbd1] bg-white p-6 sm:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4"><label className="w-full max-w-md text-sm font-semibold">Buscar imóveis<input value={filter} onChange={event => setFilter(event.target.value)} placeholder="Título, referência ou cidade" className={field}/></label><button disabled={loading || saving} onClick={() => void load()} className="inline-flex items-center gap-2 text-sm font-semibold text-[#987447] disabled:opacity-50"><RefreshCw size={16}/> Atualizar lista</button></div>
      {loading ? <p role="status" className="flex items-center gap-2 py-10 text-slate-600"><LoaderCircle size={18} className="animate-spin"/> Carregando imóveis...</p> : !imoveis.length ? <div className="py-10 text-center"><Building2 className="mx-auto text-[#987447]" size={36}/><h2 className="mt-4 text-xl font-semibold">Nenhum imóvel cadastrado no painel</h2><p className="mx-auto mt-3 max-w-lg text-slate-600">Clique em Novo imóvel para começar ou integre o imóvel da vitrine pelo botão acima.</p></div> : <>
        <p className="mb-4 text-sm text-slate-500">{visible.length} de {imoveis.length} imóveis</p>
        {!visible.length ? <p className="py-8 text-slate-600">Nenhum imóvel corresponde à busca.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm">
          <thead><tr className="border-b text-slate-500"><th className="p-3">Imóvel</th><th className="p-3">Localização</th><th className="p-3">Preço</th><th className="p-3">Status</th><th className="p-3">Ações</th></tr></thead>
          <tbody>{visible.map(item => <tr key={item.id} className="border-b last:border-0">
            <td className="p-3">{item.foto_principal?.startsWith('/imoveis/') && <img src={item.foto_principal} alt="" className="mb-2 h-20 w-32 rounded-lg object-cover"/>}<p className="font-semibold">{item.titulo}</p><p className="mt-1 text-slate-500">{item.tipo} · {item.finalidade} · Ref. {item.referencia || item.id}</p></td>
            <td className="p-3">{item.cidade}{item.bairro ? ` · ${item.bairro}` : ''}</td>
            <td className="whitespace-nowrap p-3">{currency.format(item.preco)}</td>
            <td className="p-3"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${item.status === 'publicado' ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>{statuses[item.status] || item.status}</span>
              <select aria-label={`Status de ${item.titulo}`} disabled={saving || creating || migrating || loading} value={statusDrafts[item.id] ?? item.status} onChange={event => setStatusDrafts(previous => ({ ...previous, [item.id]: event.target.value }))} className="mt-3 w-full min-w-32 rounded-lg border border-[#d8d2c7] bg-white px-2 py-2 text-sm">{Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
              <button disabled={saving || creating || migrating || loading || !statusDrafts[item.id] || statusDrafts[item.id] === item.status} onClick={() => { setError(''); setStatusChange({ id: item.id, titulo: item.titulo, status: statusDrafts[item.id] }); }} aria-label={`Aplicar status de ${item.titulo}`} className="mt-2 text-sm font-semibold text-[#987447] disabled:opacity-40">Aplicar status</button>
            </td>
            <td className="p-3"><button disabled={saving || creating || migrating} onClick={() => { setEditing(item); setCreating(true); setError(''); setNotice(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }} aria-label={`Editar ${item.titulo}`} className="inline-flex items-center gap-2 font-semibold text-[#987447] disabled:opacity-50"><Pencil size={16}/> Editar</button></td>
          </tr>)}</tbody>
        </table></div>}
      </>}
    </div>
  </section>;
}
