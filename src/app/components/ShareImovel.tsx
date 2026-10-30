'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Copy, Share2 } from 'lucide-react';

export default function ShareImovel({ id, titulo, referencia, showDetails = false }: { id: string; titulo: string; referencia?: string; showDetails?: boolean }) {
  const [url, setUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [manual, setManual] = useState(false);
  const path = `/imovel?id=${encodeURIComponent(id)}`;
  useEffect(() => { setUrl(new URL(path, window.location.origin).href); }, [path]);
  async function copy() {
    try { await navigator.clipboard.writeText(url); setCopied(true); setManual(false); }
    catch { setManual(true); setCopied(false); }
  }
  const message = `${titulo}${referencia ? ` (ref. ${referencia})` : ''}\n${url}`;
  return <div className="mt-4 border-t border-[#eee9e2] pt-4">
    {showDetails && <Link href={path} className="mb-4 block rounded-full border border-[#d8d2c7] px-4 py-3 text-center text-sm font-semibold">Ver imóvel</Link>}
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
      <a href={url ? `https://wa.me/?text=${encodeURIComponent(message)}` : undefined} aria-disabled={!url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-semibold text-[#987447]"><Share2 size={16}/> Compartilhar no WhatsApp</a>
      <button disabled={!url} onClick={() => void copy()} className="inline-flex items-center gap-2 text-sm font-semibold text-[#987447] disabled:opacity-50"><Copy size={16}/> Copiar link</button>
    </div>
    {copied && <p role="status" className="mt-3 text-sm text-emerald-800">Link copiado!</p>}
    {manual && <label className="mt-3 block text-sm text-slate-600">Copie o endereço abaixo:<input readOnly value={url} onFocus={event => event.target.select()} className="mt-2 w-full rounded-lg border px-3 py-2"/></label>}
  </div>;
}
