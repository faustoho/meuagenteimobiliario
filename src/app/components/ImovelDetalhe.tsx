'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Bath, BedDouble, CarFront, MapPin, MessageCircle, Ruler } from 'lucide-react';
import type { ImovelPublico } from '../../data/imovel-publico';
import PhotoGallery from './PhotoGallery';
import ShareImovel from './ShareImovel';

export default function ImovelDetalhe() {
  const [imovel, setImovel] = useState<ImovelPublico | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [unavailable, setUnavailable] = useState(false);
  const [url, setUrl] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError(''); setUnavailable(false); setImovel(null);
    const id = new URLSearchParams(window.location.search).get('id');
    if (!id || !/^[1-9]\d*$/.test(id)) { setUnavailable(true); setLoading(false); return; }
    setUrl(new URL(`/imovel?id=${id}`, window.location.origin).href);
    try {
      const response = await fetch(`/api/imoveis/${id}`, { cache: 'no-store' });
      if (response.status === 404 || response.status === 400) { setUnavailable(true); return; }
      if (!response.ok) throw new Error('Falha ao carregar.');
      const data = await response.json();
      setImovel(data.imovel);
    } catch { setError('Não foi possível carregar o imóvel agora. Tente novamente.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    void load();
    const refresh = () => { if (document.visibilityState === 'visible') void load(); };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [load]);
  return <main className="min-h-screen bg-[#f5f2ec]">
    <header className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-8"><Link href="/imoveis" className="inline-flex items-center gap-2 text-sm font-semibold text-[#987447]"><ArrowLeft size={17}/> Voltar aos imóveis</Link><Link href="/contato" className="text-sm font-semibold">Fale com o Edison</Link></header>
    <section className="mx-auto max-w-5xl px-6 pb-16">
      {loading ? <p role="status" className="py-16 text-center text-slate-600">Carregando imóvel...</p> : unavailable ? <div className="rounded-3xl bg-white p-8 text-center"><h1 className="text-2xl font-semibold">Imóvel indisponível</h1><p className="mt-4 text-slate-600">Este anúncio não está disponível. Confira outras oportunidades na nossa vitrine.</p><Link href="/imoveis" className="mt-6 inline-block rounded-full bg-ink px-6 py-3 font-semibold text-white">Ver outros imóveis</Link></div> : error ? <div role="alert" className="rounded-3xl bg-white p-8 text-center"><p>{error}</p><button onClick={() => void load()} className="mt-5 rounded-full bg-ink px-6 py-3 font-semibold text-white">Tentar novamente</button></div> : imovel && <article className="overflow-hidden rounded-3xl border border-[#e1dbd1] bg-white">
        <PhotoGallery imagens={imovel.imagens} titulo={imovel.titulo} finalidade={imovel.finalidade}/>
        <div className="p-6 sm:p-9"><p className="text-xs font-semibold uppercase tracking-widest text-[#987447]">{imovel.tipo} · {imovel.finalidade}{imovel.referencia ? ` · Ref. ${imovel.referencia}` : ''}</p><h1 className="mt-3 text-3xl font-semibold sm:text-4xl">{imovel.titulo}</h1><p className="mt-4 flex items-center gap-2 text-slate-600"><MapPin size={18}/>{[imovel.bairro, imovel.cidade].filter(Boolean).join(', ')}</p><p className="mt-6 text-3xl font-semibold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(imovel.preco)}{imovel.finalidade === 'Locação' && <span className="text-base font-normal">/mês</span>}</p>
        <div className="my-6 flex flex-wrap gap-5 border-y border-[#eee9e2] py-5 text-slate-600">{imovel.area !== null && <span className="inline-flex items-center gap-2"><Ruler size={18}/>{imovel.area} m²</span>}{imovel.quartos !== null && <span className="inline-flex items-center gap-2"><BedDouble size={18}/>{imovel.quartos} quartos</span>}{imovel.banheiros !== null && <span className="inline-flex items-center gap-2"><Bath size={18}/>{imovel.banheiros} banheiros</span>}{imovel.vagas !== null && <span className="inline-flex items-center gap-2"><CarFront size={18}/>{imovel.vagas} vagas</span>}</div>
        {imovel.descricao && <div className="mb-7"><h2 className="text-xl font-semibold">Sobre o imóvel</h2><p className="mt-3 whitespace-pre-line leading-8 text-slate-600">{imovel.descricao}</p></div>}
        <a href={`https://wa.me/5541984836669?text=${encodeURIComponent(`Olá, Edison! Gostaria de saber mais sobre ${imovel.titulo}${imovel.referencia ? ` (ref. ${imovel.referencia})` : ''}.\n${url}`)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-full bg-ink px-6 py-3 font-semibold text-white"><MessageCircle size={18}/> Consultar com o Edison</a>
        <ShareImovel id={imovel.id} titulo={imovel.titulo} referencia={imovel.referencia}/>
        </div>
      </article>}
    </section>
  </main>;
}
