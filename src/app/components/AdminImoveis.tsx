'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Building2, LoaderCircle, LogOut, Plus, RefreshCw } from 'lucide-react';

type Imovel = { id: number; referencia: string | null; titulo: string; tipo: string; finalidade: string; cidade: string; bairro: string | null; preco: number; status: string };
const statuses: Record<string, string> = { rascunho: 'Rascunho', publicado: 'Publicado', vendido: 'Vendido', inativo: 'Inativo' };
const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const field = 'mt-2 w-full rounded-xl border border-[#d8d2c7] bg-white px-4 py-3 outline-none focus:border-[#987447]';

export default function AdminImoveis({ onLogout, onExpired }: { onLogout: () => Promise<void>; onExpired: () => void }) {
  const [imoveis, setImoveis] = useState<Imovel[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [creating, setCreating] = useState(false);
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
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/admin/imoveis', {
        method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ referencia: form.get('referencia'), titulo: form.get('titulo'), tipo: form.get('tipo'), finalidade: form.get('finalidade'), cidade: form.get('cidade'), preco: Number(form.get('preco')) })
      });
      if (response.status === 401) { onExpired(); return; }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não foi possível salvar.');
      setCreating(false); setFilter(''); setNotice('Rascunho salvo. O imóvel ainda não está publicado na vitrine.');
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Falha ao salvar.'); }
    finally { setSaving(false); }
  }
  const visible = imoveis.filter(item => `${item.titulo} ${item.referencia ?? ''} ${item.cidade}`.toLocaleLowerCase('pt-BR').includes(filter.toLocaleLowerCase('pt-BR')));
  return <section className="mx-auto max-w-6xl px-6 pb-20">
    <div className="flex flex-wrap items-center justify-between gap-4 py-6">
      <div><p className="text-xs font-semibold uppercase tracking-[.22em] text-[#987447]">Painel administrativo</p><h1 className="mt-2 text-3xl font-semibold">Seus imóveis</h1><p className="mt-2 text-slate-600">Gerencie sua carteira de imóveis.</p></div>
      <div className="flex flex-wrap gap-3"><button disabled={loading || saving} onClick={() => { setCreating(true); setError(''); setNotice(''); }} className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3 font-semibold text-white disabled:opacity-50"><Plus size={18}/> Novo imóvel</button><button disabled={leaving || saving} onClick={async () => { setLeaving(true); try { await onLogout(); } finally { setLeaving(false); } }} className="inline-flex items-center gap-2 rounded-full border border-[#d8d2c7] px-5 py-3 font-semibold disabled:opacity-50"><LogOut size={18}/>{leaving ? 'Saindo...' : 'Sair'}</button></div>
    </div>
    {notice && <p role="status" className="mb-5 rounded-xl bg-emerald-50 p-4 text-emerald-800">{notice}</p>}
    {error && <p role="alert" className="mb-5 rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}
    {creating && <form onSubmit={save} aria-label="Novo imóvel" className="mb-8 rounded-3xl border border-[#e1dbd1] bg-white p-6 sm:p-8">
      <h2 className="text-xl font-semibold">Novo imóvel</h2><p className="mt-2 text-sm text-slate-600">Comece pelos dados principais. O imóvel será salvo como rascunho.</p>
      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <label className="text-sm font-semibold sm:col-span-2">Título *<input name="titulo" required maxLength={200} className={field}/></label>
        <label className="text-sm font-semibold">Referência<input name="referencia" maxLength={80} className={field}/></label>
        <label className="text-sm font-semibold">Cidade *<input name="cidade" required maxLength={120} className={field}/></label>
        <label className="text-sm font-semibold">Tipo *<select name="tipo" className={field}>{['Casa', 'Apartamento', 'Sobrado', 'Terreno', 'Comercial', 'Outro'].map(value => <option key={value}>{value}</option>)}</select></label>
        <label className="text-sm font-semibold">Finalidade *<select name="finalidade" className={field}><option>Venda</option><option>Locação</option></select></label>
        <label className="text-sm font-semibold">Preço (R$) *<input name="preco" type="number" min="0.01" max="1000000000000" step="0.01" required className={field}/></label>
      </div><div className="mt-6 flex flex-wrap gap-3"><button disabled={saving} className="rounded-full bg-ink px-6 py-3 font-semibold text-white disabled:opacity-50">{saving ? 'Salvando...' : 'Salvar rascunho'}</button><button type="button" disabled={saving} onClick={() => { setCreating(false); setError(''); }} className="rounded-full border border-[#d8d2c7] px-6 py-3 font-semibold">Cancelar</button></div>
    </form>}
    <div className="rounded-3xl border border-[#e1dbd1] bg-white p-6 sm:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4"><label className="w-full max-w-md text-sm font-semibold">Buscar imóveis<input value={filter} onChange={event => setFilter(event.target.value)} placeholder="Título, referência ou cidade" className={field}/></label><button disabled={loading || saving} onClick={() => void load()} className="inline-flex items-center gap-2 text-sm font-semibold text-[#987447] disabled:opacity-50"><RefreshCw size={16}/> Atualizar lista</button></div>
      {loading ? <p role="status" className="flex items-center gap-2 py-10 text-slate-600"><LoaderCircle size={18} className="animate-spin"/> Carregando imóveis...</p> : !imoveis.length ? <div className="py-10 text-center"><Building2 className="mx-auto text-[#987447]" size={36}/><h2 className="mt-4 text-xl font-semibold">Nenhum imóvel cadastrado no painel</h2><p className="mx-auto mt-3 max-w-lg text-slate-600">Clique em Novo imóvel para começar. O imóvel já exibido na vitrine continua disponível e será integrado ao painel na etapa de migração.</p></div> : <>
        <p className="mb-4 text-sm text-slate-500">{visible.length} de {imoveis.length} imóveis</p>
        {!visible.length ? <p className="py-8 text-slate-600">Nenhum imóvel corresponde à busca.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="p-3">Imóvel</th><th className="p-3">Localização</th><th className="p-3">Preço</th><th className="p-3">Status</th></tr></thead><tbody>{visible.map(item => <tr key={item.id} className="border-b last:border-0"><td className="p-3"><p className="font-semibold">{item.titulo}</p><p className="mt-1 text-slate-500">{item.tipo} · {item.finalidade} · Ref. {item.referencia || item.id}</p></td><td className="p-3">{item.cidade}{item.bairro ? ` · ${item.bairro}` : ''}</td><td className="whitespace-nowrap p-3">{currency.format(item.preco)}</td><td className="p-3"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${item.status === 'publicado' ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>{statuses[item.status] || item.status}</span></td></tr>)}</tbody></table></div>}
      </>}
    </div>
  </section>;
}
