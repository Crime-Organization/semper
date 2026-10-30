// Casca do app: barra lateral (no celular, menu que abre por cima) e área de conteúdo.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router';
import { MARCA } from '../marca';
import { SD } from '../dados';
import { Avatar } from './Avatar';
import { Icone } from './Icone';
import { avisar } from './avisos';
import { useSessao } from './sessao';
import { definirTema, TEMAS, useTema, type Tema } from './tema';
import { PAPEIS } from './util';

export function Casca({ children }: { children: ReactNode }) {
  const { ctx } = useSessao();
  const p = ctx.perfil;
  const nomeEsc = ctx.escritorio?.nome || MARCA.nome;
  const tema = useTema();
  const navegar = useNavigate();
  const local = useLocation();
  const [aberta, setAberta] = useState(false);
  const lateral = useRef<HTMLElement>(null);

  // No celular, o menu fecha ao trocar de tela ou ao tocar fora dele.
  useEffect(() => setAberta(false), [local.pathname, local.search, local.hash]);
  useEffect(() => {
    if (!aberta) return;
    const fora = (e: MouseEvent) => { if (!lateral.current?.contains(e.target as Node)) setAberta(false); };
    document.addEventListener('click', fora);
    return () => document.removeEventListener('click', fora);
  }, [aberta]);

  const trocarTema = () => {
    const ordem: Tema[] = ['auto', 'claro', 'escuro'];
    const proximo = ordem[(ordem.indexOf(tema) + 1) % ordem.length];
    definirTema(proximo);
    avisar(`Tema: ${TEMAS[proximo]}${proximo === 'auto' ? ' (segue o aparelho)' : ''}.`);
  };
  const sair = async () => { await SD.sair(); navegar('/entrar/'); };
  const item = (para: string, icone: 'inicio' | 'pessoas' | 'contratos' | 'demandas' | 'tarefas' | 'equipe' | 'configuracoes', rotulo: string) =>
    <NavLink to={para}><Icone nome={icone} /><span>{rotulo}</span></NavLink>;

  return <>
    <div className="topo-cel">
      <button type="button" aria-label="Abrir menu" onClick={e => { e.stopPropagation(); setAberta(a => !a); }}><Icone nome="menu" tam={18} /></button>
      <b className="topo-nome">{nomeEsc} <span style={{ color: 'var(--accent-ink)' }}>{MARCA.nome}</span></b>
      <span style={{ width: 40 }} />
    </div>
    <div className="app">
      <aside className={'side' + (aberta ? ' aberta' : '')} aria-label="Menu" ref={lateral}>
        {/* O nome do escritório vem das Configurações. */}
        <Link className="marca-app" to="/inicio/" aria-label={`${nomeEsc}: início`}>
          <span className="ini">{nomeEsc.trim().charAt(0)}</span>
          <span style={{ minWidth: 0 }}><b>{nomeEsc}</b><small>{MARCA.nome}</small></span>
        </Link>
        <nav className="nav" aria-label="Seções">
          {item('/inicio/', 'inicio', 'Início')}
          <div className="nav-linha">
            {item('/pessoas/', 'pessoas', 'Pessoas')}
            <Link className="nav-mais" to="/pessoas/nova/" aria-label="Cadastrar pessoa" title="Cadastrar pessoa"><Icone nome="mais" tam={15} /></Link>
          </div>
          {/* Cada módulo aparece só no escritório que o tem ligado (o dono da plataforma liga e desliga). */}
          {ctx.escritorio?.modulos?.contratos && <div className="nav-linha">
            {item('/contratos/', 'contratos', 'Contratos')}
            <Link className="nav-mais" to="/contratos/novo/" aria-label="Cadastrar contrato" title="Cadastrar contrato"><Icone nome="mais" tam={15} /></Link>
          </div>}
          {ctx.escritorio?.modulos?.demandas && <div className="nav-linha">
            {item('/demandas/', 'demandas', 'Demandas')}
            <Link className="nav-mais" to="/demandas/nova/" aria-label="Cadastrar demanda" title="Cadastrar demanda"><Icone nome="mais" tam={15} /></Link>
          </div>}
          {ctx.escritorio?.modulos?.tarefas && <div className="nav-linha">
            {item('/tarefas/', 'tarefas', 'Tarefas')}
            <Link className="nav-mais" to="/tarefas/nova/" aria-label="Cadastrar tarefa" title="Cadastrar tarefa"><Icone nome="mais" tam={15} /></Link>
          </div>}
          {ctx.ehAdmin && item('/equipe/', 'equipe', 'Equipe e acessos')}
          {ctx.ehAdmin && item('/configuracoes/', 'configuracoes', 'Configurações')}
        </nav>
        <div className="side-rodape">
          <div className="usuario">
            <Avatar p={p} tam={32} />
            <div style={{ minWidth: 0 }}>
              <b>{p.nome}</b><span className="arroba">@{p.usuario}</span>
              <span className={'papel' + (p.papel === 'usuario' ? ' comum' : '')}>{PAPEIS[p.papel]}</span>
            </div>
          </div>
          <nav className="nav" aria-label="Conta">
            <Link to="/inicio/#conta"><Icone nome="conta" /><span>Minha conta</span></Link>
            <button type="button" title="Trocar entre automático, claro e escuro" onClick={trocarTema}><Icone nome="tema" /><span>Tema: {TEMAS[tema]}</span></button>
            <button type="button" onClick={sair}><Icone nome="sair" /><span>Sair</span></button>
          </nav>
        </div>
      </aside>
      <main className="conteudo">{children}</main>
    </div>
  </>;
}
