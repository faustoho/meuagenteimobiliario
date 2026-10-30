'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ArrowLeft, KeyRound, LoaderCircle, LogOut, ShieldCheck } from 'lucide-react';

export default function AdminLogin() {
  const [password, setPassword] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    fetch('/api/admin/session', { credentials: 'same-origin', cache: 'no-store' })
      .then(async r => { if (!r.ok) throw new Error('Serviço indisponível.'); return r.json(); })
      .then(data => setAuthenticated(Boolean(data.authenticated)))
      .catch(() => setError('Não foi possível verificar a sessão.'))
      .finally(() => setLoading(false));
  }, []);
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Não foi possível entrar.');
      setPassword('');
      setAuthenticated(true);
    } catch (err) { setError(err instanceof Error ? err.message : 'Erro de autenticação.'); }
    finally { setSubmitting(false); }
  }
  async function logout() {
    try {
      const response = await fetch('/api/admin/logout', { method: 'POST', credentials: 'same-origin' });
      if (!response.ok) throw new Error('Não foi possível encerrar a sessão.');
      setAuthenticated(false);
      setPassword('');
      setError('');
    } catch (err) { setError(err instanceof Error ? err.message : 'Erro ao sair.'); }
  }
  return <main className="min-h-screen bg-[#f5f2ec]">
    <header className="mx-auto max-w-6xl px-6 py-8"><Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-[#987447]"><ArrowLeft size={17}/> Voltar ao site</Link></header>
    <section className="mx-auto max-w-md px-6 pb-20 pt-12">
      <div className="rounded-3xl border border-[#e1dbd1] bg-white p-8 shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-ink text-[#d9b78c]">{authenticated ? <ShieldCheck size={28}/> : <KeyRound size={28}/>}</div>
        <p className="mt-6 text-center text-xs font-semibold uppercase tracking-[.22em] text-[#987447]">Meu Agente Imobiliário</p>
        <h1 className="mt-3 text-center text-3xl font-semibold">{authenticated ? 'Acesso autorizado' : 'Acesso administrativo'}</h1>
        {loading ? <p className="mt-8 flex items-center justify-center gap-2 text-sm text-slate-500"><LoaderCircle className="animate-spin" size={18}/> Verificando acesso...</p> : authenticated ? <>
          <p className="mt-5 text-center leading-7 text-slate-600">Sua sessão administrativa está ativa. O cadastro e a edição de imóveis serão liberados na próxima etapa.</p>
          <button onClick={logout} className="mt-8 flex w-full items-center justify-center gap-2 rounded-full border border-[#d8d2c7] px-6 py-3 font-semibold"><LogOut size={18}/> Sair do painel</button>
        </> : <form onSubmit={login} className="mt-8">
          <label htmlFor="admin-password" className="text-sm font-semibold">Senha administrativa</label>
          <input id="admin-password" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} className="mt-2 w-full rounded-xl border border-[#d8d2c7] px-4 py-3 outline-none focus:border-[#987447]" placeholder="Digite sua senha"/>
          <button disabled={submitting} type="submit" className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-ink px-6 py-4 font-semibold text-white disabled:opacity-60">{submitting ? 'Verificando...' : 'Entrar'}</button>
        </form>}
        {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <p className="mt-7 text-center text-xs leading-5 text-slate-500">Área restrita. O acesso é destinado exclusivamente à administração.</p>
      </div>
    </section>
  </main>;
}
