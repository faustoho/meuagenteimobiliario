import Link from 'next/link';
import { notFound } from 'next/navigation';
import LeadForm from '../components/LeadForm';
import Vitrine from '../components/Vitrine';
import AdminLogin from '../components/AdminLogin';

const pages = ['imoveis', 'quero-comprar', 'quero-vender', 'contato', 'admin'] as const;
export function generateStaticParams() { return pages.map(slug => ({ slug })); }
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!pages.includes(slug as typeof pages[number])) notFound();
  if (slug === 'admin') return <AdminLogin />;
  if (slug === 'quero-comprar' || slug === 'quero-vender' || slug === 'contato') return <LeadForm kind={slug} />;
  return <Vitrine />;
}
