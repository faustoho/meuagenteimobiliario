'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ArrowLeft, MessageCircle } from 'lucide-react';

const PHONE = '5541984836669';
type Kind = 'quero-comprar' | 'quero-vender' | 'contato';
const config = {
  'quero-comprar': { eyebrow: 'Encontre seu próximo lar', title: 'Quero comprar um imóvel', intro: 'Conte um pouco do que procura. Sua mensagem será enviada diretamente ao WhatsApp do Edson.', action: 'Enviar interesse pelo WhatsApp' },
  'quero-vender': { eyebrow: 'Valorize seu patrimônio', title: 'Quero vender meu imóvel', intro: 'Compartilhe as principais informações do seu imóvel para iniciar uma conversa com o Edson.', action: 'Conversar sobre a venda' },
  'contato': { eyebrow: 'Atendimento personalizado', title: 'Fale com o Edson', intro: 'Envie sua mensagem diretamente pelo WhatsApp. Será um prazer conversar sobre seus planos.', action: 'Abrir conversa no WhatsApp' }
};
export default function LeadForm({ kind }: { kind: Kind }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [type, setType] = useState('');
  const [budget, setBudget] = useState('');
  const [details, setDetails] = useState('');
  const cfg = config[kind];
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const purpose = kind === 'quero-comprar' ? 'Tenho interesse em comprar um imóvel' : kind === 'quero-vender' ? 'Tenho interesse em vender um imóvel' : 'Gostaria de entrar em contato';
    const lines = ['Olá, Edson! ' + purpose + '.', 'Nome: ' + name.trim(), 'Telefone: ' + phone.trim(), city.trim() && 'Cidade / bairro: ' + city.trim(), type && 'Tipo de imóvel: ' + type, budget.trim() && (kind === 'quero-comprar' ? 'Faixa de investimento: ' : 'Valor pretendido: ') + budget.trim(), details.trim() && 'Observações: ' + details.trim()].filter(Boolean);
    window.open('https://wa.me/' + PHONE + '?text=' + encodeURIComponent(lines.join('\n')), '_blank', 'noopener,noreferrer');
  }
  const field = 'mt-2 w-full rounded-xl border border-[#d8d2c7] bg-white px-4 py-3 text-ink outline-none focus:border-[#987447] focus:ring-2 focus:ring-[#987447]/20';
  return <main className="min-h-screen">
    <header className="mx-auto max-w-6xl px-6 py-8"><Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-[#987447]"><ArrowLeft size={16}/> Voltar ao início</Link></header>
    <section className="mx-auto grid max-w-6xl gap-12 px-6 pb-24 pt-10 lg:grid-cols-[.85fr_1.15fr]">
      <div><p className="text-xs font-semibold uppercase tracking-[.25em] text-[#987447]">{cfg.eyebrow}</p><h1 className="mt-5 text-4xl font-semibold leading-tight md:text-5xl">{cfg.title}</h1><p className="mt-6 max-w-md text-lg leading-8 text-slate-600">{cfg.intro}</p><div className="mt-10 rounded-2xl bg-ink p-7 text-white"><MessageCircle className="text-[#d9b78c]" size={28}/><p className="mt-4 text-xl font-semibold">Atendimento direto com Edson Tadeo de Oliveira</p><p className="mt-2 text-sm leading-6 text-white/70">Você revisará a mensagem no WhatsApp antes de enviá-la. Nenhuma informação é armazenada neste site.</p></div></div>
      <form onSubmit={submit} className="rounded-3xl border border-[#e1dbd1] bg-white p-6 shadow-sm md:p-9">
        <h2 className="text-2xl font-semibold">Conte-nos um pouco mais</h2><p className="mt-2 text-sm text-slate-500">Os campos com * são obrigatórios.</p>
        <div className="mt-7 grid gap-5 sm:grid-cols-2">
          <label className="text-sm font-semibold">Seu nome *<input className={field} value={name} onChange={e=>setName(e.target.value)} required maxLength={100} placeholder="Nome completo"/></label>
          <label className="text-sm font-semibold">Telefone / WhatsApp *<input className={field} value={phone} onChange={e=>setPhone(e.target.value)} required type="tel" maxLength={30} placeholder="(41) 99999-9999"/></label>
          {kind !== 'contato' && <><label className="text-sm font-semibold">Cidade ou bairro<input className={field} value={city} onChange={e=>setCity(e.target.value)} maxLength={120} placeholder="Onde fica ou onde procura"/></label>
          <label className="text-sm font-semibold">Tipo de imóvel<select className={field} value={type} onChange={e=>setType(e.target.value)}><option value="">Selecione</option><option>Apartamento</option><option>Casa</option><option>Sobrado</option><option>Terreno</option><option>Comercial</option><option>Outro</option></select></label>
          <label className="text-sm font-semibold sm:col-span-2">{kind === 'quero-comprar' ? 'Faixa de investimento' : 'Valor pretendido'}<input className={field} value={budget} onChange={e=>setBudget(e.target.value)} maxLength={80} placeholder="Ex.: R$ 400 mil a R$ 600 mil"/></label></>}
          <label className="text-sm font-semibold sm:col-span-2">{kind === 'contato' ? 'Sua mensagem' : 'Mais detalhes'}<textarea className={field} value={details} onChange={e=>setDetails(e.target.value)} maxLength={1500} rows={5} placeholder={kind === 'quero-comprar' ? 'Quartos, vagas, preferências...' : kind === 'quero-vender' ? 'Metragem, quartos, vagas, diferenciais...' : 'Como podemos ajudar?'}/></label>
        </div>
        <button type="submit" className="mt-7 inline-flex w-full items-center justify-center gap-3 rounded-full bg-ink px-7 py-4 font-semibold text-white transition hover:opacity-90"><MessageCircle size={20}/>{cfg.action}</button>
        <p className="mt-4 text-center text-xs leading-5 text-slate-500">Ao continuar, o WhatsApp será aberto com as informações preenchidas. O envio só acontece após sua confirmação.</p>
      </form>
    </section>
  </main>;
}
