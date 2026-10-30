'use client';

import { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Images, X } from 'lucide-react';

export default function PhotoGallery({ imagens, titulo, finalidade }: { imagens: string[]; titulo: string; finalidade: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(0);
  const next = (step: number) => setIndex(current => (current + step + imagens.length) % imagens.length);
  return <>
    <div className="relative h-60 bg-[#e8e3da]">{imagens.length ? <button onClick={() => { setIndex(0); dialog.current?.showModal(); }} aria-label={`Ver fotos de ${titulo}`} className="h-full w-full"><img src={imagens[0]} alt={titulo} loading="lazy" className="h-full w-full object-cover"/><span className="absolute bottom-4 right-4 inline-flex items-center gap-2 rounded-full bg-black/70 px-3 py-2 text-xs font-semibold text-white"><Images size={15}/>{imagens.length} {imagens.length === 1 ? 'foto' : 'fotos'}</span></button> : <div className="flex h-full items-center justify-center text-sm text-slate-500">Foto em preparação</div>}<span className="pointer-events-none absolute left-4 top-4 rounded-full bg-white px-3 py-1 text-xs font-semibold">{finalidade}</span></div>
    {imagens.length > 0 && <dialog ref={dialog} aria-label={`Galeria de ${titulo}`} onKeyDown={event => { if (event.key === 'ArrowRight') { event.preventDefault(); next(1); } if (event.key === 'ArrowLeft') { event.preventDefault(); next(-1); } }} className="fixed inset-0 m-auto max-h-[95vh] w-[calc(100%_-_2rem)] max-w-5xl overflow-y-auto rounded-2xl bg-ink p-4 text-white shadow-xl backdrop:bg-black/80 sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-4"><h2 className="text-lg font-semibold">{titulo}</h2><button autoFocus onClick={() => dialog.current?.close()} aria-label="Fechar galeria" className="rounded-full border border-white/30 p-2"><X size={20}/></button></div>
      <div className="relative"><img src={imagens[index] ?? imagens[0]} alt={`${titulo} — foto ${index + 1}`} className="max-h-[65vh] w-full rounded-xl object-contain"/>{imagens.length > 1 && <><button onClick={() => next(-1)} aria-label="Foto anterior" className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/70 p-2"><ChevronLeft/></button><button onClick={() => next(1)} aria-label="Próxima foto" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/70 p-2"><ChevronRight/></button></>}</div>
      <p aria-live="polite" className="mt-3 text-center text-sm text-white/75">Foto {index + 1} de {imagens.length}</p>
      {imagens.length > 1 && <div className="mt-4 flex gap-3 overflow-x-auto pb-2">{imagens.map((image, position) => <button key={image} onClick={() => setIndex(position)} aria-label={`Ver foto ${position + 1}`} aria-pressed={index === position} className={`shrink-0 overflow-hidden rounded-lg border-2 ${index === position ? 'border-[#d9b78c]' : 'border-transparent'}`}><img src={image} alt="" className="h-16 w-24 object-cover" loading="lazy"/></button>)}</div>}
    </dialog>}
  </>;
}
