// Quem está logado. As telas internas ficam dentro de <ExigirLogin>, que carrega o contexto (perfil,
// escritório e equipe) uma vez e o entrega por useCtx(); sem sessão, leva à entrada.
import { createContext, Suspense, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { SD, type ContextoAtivo } from '../dados';
import { iniciarPreferencias } from './preferencias';
import { aplicarTema, type Tema } from './tema';
import { Casca } from './Casca';
import { Aviso, Carregando } from './base';
import { MINUTO } from './tempos';

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

const RENOVAR_APOS = 10 * MINUTO;   // relê a equipe e o próprio acesso ao trocar de tela depois de 10 min

/** "janela": o que se abre por cima das telas internas e também precisa de quem está logado (o cadastro novo, em App.tsx). */
export function ExigirLogin({ janela }: { janela?: ReactNode } = {}) {
  const [ctx, setCtx] = useState<ContextoAtivo | null>(null);
  const [erro, setErro] = useState('');
  const navegar = useNavigate();
  const local = useLocation();
  const lidoEm = useRef(0);
  const aqui = useRef('');
  aqui.current = local.pathname + local.search;

  const carregar = useCallback(async (forcar: boolean, primeira = false) => {
    // Entrou só com a senha e tem verificação em duas etapas: volta à entrada para digitar o código
    // (o banco não mostra os dados antes disso).
    let c;
    try {
      if (await SD.duasEtapasPendente()) { navegar('/entrar/?volta=' + encodeURIComponent(aqui.current), { replace: true }); return; }
      c = await SD.contexto(forcar);
    }
    catch (e) { if (primeira) setErro((e as Error).message); return; }
    if (!c) { navegar('/entrar/?volta=' + encodeURIComponent(aqui.current), { replace: true }); return; }
    if (!c.perfil) { await SD.sair().catch(() => {}); navegar('/entrar/?desativado', { replace: true }); return; }
    iniciarPreferencias(c.perfil.preferencias);
    if (primeira) aplicarTema((c.perfil.preferencias?.tema as Tema) || 'auto');
    if (forcar || primeira) lidoEm.current = Date.now();
    setCtx({ ...c, perfil: { ...c.perfil } } as ContextoAtivo);
  }, [navegar]);

  useEffect(() => { void carregar(false, true); }, [carregar]);
  useEffect(() => {
    if (lidoEm.current && Date.now() - lidoEm.current > RENOVAR_APOS) void carregar(true);
  }, [local.pathname, carregar]);

  if (erro) return <Aviso tipo="erro" style={{ margin: '40px auto', maxWidth: 520 }}>{erro}</Aviso>;
  if (!ctx) return null;
  return <SessaoCtx.Provider value={{ ctx, recarregar: (forcar = true) => carregar(forcar) }}>
    <Casca><Suspense fallback={<div className="miolo"><Carregando /></div>}><Outlet /></Suspense></Casca>
    {janela}
  </SessaoCtx.Provider>;
}
