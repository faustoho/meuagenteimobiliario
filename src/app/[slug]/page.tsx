import Link from 'next/link';
import { notFound } from 'next/navigation';
import LeadForm from '../components/LeadForm';

const pages = ['imoveis', 'quero-comprar', 'quero-vender', 'contato'] as const;
export function generateStaticParams() { return pages.map(slug => ({ slug })); }
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!pages.includes(slug as typeof pages[number])) notFound();
  if (slug === 'quero-comprar' || slug === 'quero-vender' || slug === 'contato') return <LeadForm kind={slug} />;
  return <main className="mx-auto min-h-screen max-w-5xl px-6 py-12">
    <Link href="/" className="text-sm font-semibold text-[#987447]">← Voltar ao início</Link>
    <h1 className="mt-20 text-5xl font-semibold">Imóveis</h1>
    <p className="mt-6 max-w-xl text-lg text-slate-600">Estamos preparando nossa seleção de imóveis. Enquanto isso, conte ao Edson o que você procura.</p>
    <Link href="/quero-comprar" className="mt-8 inline-flex rounded-full bg-ink px-6 py-3 font-semibold text-white">Conte o que procura</Link>
  </main>;
}
