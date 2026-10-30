import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Meu Agente Imobiliário | Encontre seu próximo imóvel', description: 'Encontre imóveis e conte com o atendimento personalizado de Edison Tadeo de Oliveira para comprar ou vender.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="pt-BR"><body>{children}</body></html>; }
