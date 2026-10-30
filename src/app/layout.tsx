import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Meu Agente Imobiliário | Encontre seu próximo imóvel', description: 'Encontre imóveis e conte com atendimento personalizado para comprar ou vender.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="pt-BR"><body>{children}</body></html>; }
