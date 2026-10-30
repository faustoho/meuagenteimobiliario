'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Bath, BedDouble, CarFront, MapPin, MessageCircle, Ruler, Search, SlidersHorizontal } from 'lucide-react';
import type { Imovel } from '../../data/imoveis';
import PhotoGallery from './PhotoGallery';

type ImovelPublico = Omit<Imovel, 'area' | 'quartos' | 'banheiros' | 'vagas'> & { area: number | null; quartos: number | null; banheiros: number | null; vagas: number | null };

const whatsapp = '5541984836669';
const money = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n);
export default function Vitrine() {
  const [imoveis, setImoveis] = useState<ImovelPublico[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/imoveis', { cache: 'no-store' });
      if (!response.ok) throw new Error('Não foi possível carregar os imóveis.');
      const data = await response.json();
      if (!Array.isArray(data.imoveis)) throw new Error('Resposta inválida.');
      setImoveis(data.imoveis);
    } catch { setImoveis([]); setError('Não foi possível carregar os imóveis agora. Tente novamente ou fale com o Edison.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    void load();
    const refresh = () => { if (document.visibilityState === 'visible') void load(); };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [load]);
  const [busca, setBusca] = useState('');
  const [finalidade, setFinalidade] = useState('');
  const [tipo, setTipo] = useState('');
  const [cidade, setCidade] = useState('');
  const [maximo, setMaximo] = useState('');
  const cidades = [...new Set(imoveis.map(i => i.cidade))].sort();
  const tipos = [...new Set(imoveis.map(i => i.tipo))].sort();
  const encontrados = useMemo(() => imoveis.filter(i => {
    const q = busca.trim().toLocaleLowerCase('pt-BR');
    return (!q || [i.titulo, i.bairro, i.cidade, i.referencia || ''].join(' ').toLocaleLowerCase('pt-BR').includes(q))
      && (!finalidade || i.finalidade === finalidade)
      && (!tipo || i.tipo === tipo)
      && (!cidade || i.cidade === cidade)
      && (!maximo || i.preco <= Number(maximo));
  }), [imoveis, busca, finalidade, tipo, cidade, maximo]);
  const field = 'w-full rounded-xl border border-[#d8d2c7] bg-white px-4 py-3 text-sm outline-none focus:border-[#987447] focus:ring-2 focus:ring-[#987447]/20';
  function reset() { setBusca(''); setFinalidade(''); setTipo(''); setCidade(''); setMaximo(''); }
  return <main className="min-h-screen">
    <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-7">
      <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-[#987447]"><ArrowLeft size={17}/> Início</Link>
      <Link href="/contato" className="text-sm font-semibold">Fale com o Edison</Link>
    </header>
    <section className="bg-ink px-6 py-16 text-white md:py-20">
      <div className="mx-auto max-w-6xl">
        <p className="text-xs font-semibold uppercase tracking-[.25em] text-[#d9b78c]">Meu Agente Imobiliário</p>
        <h1 className="mt-4 text-4xl font-semibold md:text-6xl">Encontre seu próximo imóvel.</h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-white/75">Explore oportunidades e conte com o atendimento personalizado de Edison Tadeo de Oliveira para encontrar o imóvel ideal.</p>
      </div>
    </section>
    <section className="mx-auto max-w-6xl px-6 py-12">
      <div className="rounded-2xl border border-[#e1dbd1] bg-white p-5 shadow-sm md:p-7">
        <div className="mb-5 flex items-center gap-2 font-semibold"><SlidersHorizontal size={20} className="text-[#987447]"/> Filtrar imóveis</div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="relative sm:col-span-2 lg:col-span-3"><span className="sr-only">Buscar por bairro, cidade ou referência</span><Search size={18} className="absolute left-4 top-3.5 text-slate-400"/><input value={busca} onChange={e=>setBusca(e.target.value)} className={field + ' pl-11'} placeholder="Buscar por bairro, cidade ou referência"/></label>
          <label><span className="sr-only">Finalidade</span><select className={field} value={finalidade} onChange={e=>setFinalidade(e.target.value)}><option value="">Comprar ou alugar</option><option>Venda</option><option>Locação</option></select></label>
          <label><span className="sr-only">Tipo de imóvel</span><select className={field} value={tipo} onChange={e=>setTipo(e.target.value)}><option value="">Todos os tipos</option>{tipos.map(t=><option key={t}>{t}</option>)}</select></label>
          <label><span className="sr-only">Cidade</span><select className={field} value={cidade} onChange={e=>setCidade(e.target.value)}><option value="">Todas as cidades</option>{cidades.map(c=><option key={c}>{c}</option>)}</select></label>
          <label><span className="sr-only">Preço máximo</span><select className={field} value={maximo} onChange={e=>setMaximo(e.target.value)}><option value="">Qualquer preço</option><option value="300000">Até R$ 300 mil</option><option value="500000">Até R$ 500 mil</option><option value="750000">Até R$ 750 mil</option><option value="1000000">Até R$ 1 milhão</option><option value="1500000">Até R$ 1,5 milhão</option><option value="3000000">Até R$ 3 milhões</option></select></label>
          <button onClick={reset} className="rounded-xl border border-[#d8d2c7] px-4 py-3 text-sm font-semibold transition hover:bg-sand">Limpar filtros</button>
        </div>
      </div>
      <div className="mb-7 mt-12 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-[#987447]">Oportunidades</p><h2 className="mt-2 text-3xl font-semibold">Imóveis disponíveis</h2></div>{!loading && !error && <span className="text-sm text-slate-500">{encontrados.length} {encontrados.length === 1 ? 'imóvel encontrado' : 'imóveis encontrados'}</span>}</div>
      {loading ? <p role="status" className="py-12 text-center text-slate-600">Carregando imóveis...</p> : error ? <div role="alert" className="rounded-2xl border border-[#e1dbd1] bg-white p-8 text-center"><p>{error}</p><button onClick={() => void load()} className="mt-5 rounded-full bg-ink px-6 py-3 font-semibold text-white">Tentar novamente</button></div> : encontrados.length ? <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">{encontrados.map(i=><article key={i.id} className="overflow-hidden rounded-2xl border border-[#e1dbd1] bg-white shadow-sm">
        <PhotoGallery imagens={i.imagens} titulo={i.titulo} finalidade={i.finalidade}/>
        <div className="p-6"><p className="text-xs font-semibold uppercase tracking-wider text-[#987447]">{i.tipo}</p><h3 className="mt-2 text-xl font-semibold">{i.titulo}</h3><p className="mt-2 flex items-center gap-1 text-sm text-slate-500"><MapPin size={15}/>{[i.bairro, i.cidade].filter(Boolean).join(', ')}</p><p className="mt-5 text-2xl font-semibold">{money(i.preco)}{i.finalidade === 'Locação' && <span className="text-sm font-normal text-slate-500">/mês</span>}</p>
        <div className="mt-5 flex flex-wrap gap-4 border-t border-[#eee9e2] pt-4 text-sm text-slate-600">{i.area != null && <span className="inline-flex items-center gap-1"><Ruler size={16}/>{i.area} m²</span>}{i.quartos != null && <span className="inline-flex items-center gap-1"><BedDouble size={16}/>{i.quartos}</span>}{i.banheiros != null && <span className="inline-flex items-center gap-1"><Bath size={16}/>{i.banheiros}</span>}{i.vagas != null && <span className="inline-flex items-center gap-1"><CarFront size={16}/>{i.vagas}</span>}</div>
        <a href={'https://wa.me/' + whatsapp + '?text=' + encodeURIComponent('Olá, Edison! Gostaria de saber mais sobre o imóvel: ' + i.titulo + (i.referencia ? ' (ref. ' + i.referencia + ')' : '') + '.')} target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-ink px-4 py-3 text-sm font-semibold text-white"><MessageCircle size={17}/> Consultar imóvel</a>
        </div></article>)}</div> : <div className="rounded-3xl border border-dashed border-[#cfc6b7] bg-white px-6 py-16 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-sand"><Search size={25} className="text-[#987447]"/></div>
          <h3 className="mt-5 text-2xl font-semibold">{imoveis.length ? 'Nenhum imóvel encontrado' : 'Nossa vitrine está sendo preparada'}</h3>
          <p className="mx-auto mt-3 max-w-lg leading-7 text-slate-600">{imoveis.length ? 'Tente ajustar os filtros ou fale diretamente com o Edison sobre o imóvel que procura.' : 'Estamos organizando os primeiros imóveis para apresentar aqui. Enquanto isso, conte ao Edison o que você procura e receba atendimento personalizado.'}</p>
          <Link href="/quero-comprar" className="mt-7 inline-flex items-center gap-2 rounded-full bg-ink px-7 py-4 font-semibold text-white">Conte o que procura <ArrowRight size={18}/></Link>
        </div>}
    </section>
  </main>;
}
