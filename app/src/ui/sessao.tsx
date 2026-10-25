// Quem está logado. As telas internas ficam dentro de <ExigirLogin>, que carrega o contexto (perfil,
// escritório e equipe) uma vez e o entrega por useCtx(); sem sessão, leva à entrada.
import { createContext, Suspense, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { SD, type ContextoAtivo } from '../dados';
import { aplicarTema, type Tema } from './tema';
import { Casca } from './Casca';

interface Sessao {
  ctx: ContextoAtivo;
  /** Relê o contexto. forcar=false só redesenha com o que já está em memória (ex.: depois de salvarPerfil). */
  recarregar: (forcar?: boolean) => Promise<void>;
}
const SessaoCtx = createContext<Sessao | null>(null);

export function useSessao() {
  const s = useContext(SessaoCtx);
  if (!s) throw new Error('useSessao fora de <ExigirLogin>');
  return s;
}
export const useCtx = () => useSessao().ctx;

const RENOVAR_APOS = 10 * 60 * 1000;   // relê a equipe e o próprio acesso ao trocar de tela depois de 10 min

export function ExigirLogin() {
  const [ctx, setCtx] = useState<ContextoAtivo | null>(null);
  const [erro, setErro] = useState('');
  const navegar = useNavigate();
  const local = useLocation();
  const lidoEm = useRef(0);
  const aqui = useRef('');
  aqui.current = local.pathname + local.search;

  const carregar = useCallback(async (forcar: boolean, primeira = false) => {
    let c;
    try { c = await SD.contexto(forcar); }
    catch (e) { if (primeira) setErro((e as Error).message); return; }
    if (!c) { navegar('/?volta=' + encodeURIComponent(aqui.current), { replace: true }); return; }
    if (!c.perfil) { await SD.sair(); navegar('/?desativado', { replace: true }); return; }
    if (primeira) aplicarTema((c.perfil.preferencias?.tema as Tema) || 'auto');
    if (forcar || primeira) lidoEm.current = Date.now();
    setCtx({ ...c, perfil: { ...c.perfil } } as ContextoAtivo);
  }, [navegar]);

  useEffect(() => { carregar(false, true); }, [carregar]);
  useEffect(() => {
    if (lidoEm.current && Date.now() - lidoEm.current > RENOVAR_APOS) carregar(true);
  }, [local.pathname, carregar]);

  if (erro) return <div className="aviso erro" style={{ margin: '40px auto', maxWidth: 520 }}>{erro}</div>;
  if (!ctx) return null;
  return <SessaoCtx.Provider value={{ ctx, recarregar: (forcar = true) => carregar(forcar) }}>
    <Casca><Suspense fallback={<div className="miolo"><p className="carregando">Carregando…</p></div>}><Outlet /></Suspense></Casca>
  </SessaoCtx.Provider>;
}
