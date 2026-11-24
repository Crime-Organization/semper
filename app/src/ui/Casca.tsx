// Casca do app: barra lateral (no celular, menu que abre por cima) e área de conteúdo.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router';
import { MARCA } from '../marca';
import { rotuloDoMenu, textoDoContador } from '../regras/mensagens';
import { SD } from '../dados';
import { enderecoDaAnotacaoNova } from '../regras/anotacao';
import { modulosLigados } from '../regras/buscaGeral';
import { podeSairDoCadastro } from './AvisoAoSair';
import { Avatar } from './Avatar';
import { Icone } from './Icone';
import { avisar } from './avisos';
import { estiloBotao, propsDaDica } from './base';
import { BotaoBuscaGeral, BuscaGeral } from './BuscaGeral';
import { cronometrosAtivos, pausarTodos } from './cronometros';
import { abandonarGravacao, estaGravando } from './gravacaoDaImportacao';
import { confirmar } from './janela';
import { naoLidas, useConferirNaoLidas } from './mensagens';
import { ICONE_DO_MAIS, MaisDoMenu } from './MaisDoMenu';
import { MenuFinanceiro } from './MenuFinanceiro';
import { BotaoNovidades } from './Novidades';
import { useSessao } from './sessao';
import { SubmenuLateral } from './SubmenuLateral';
import { definirTema, TEMAS, useTema, type Tema } from './tema';
import { escritorioNaAba, PAPEIS } from './util';

export function Casca({ children }: { children: ReactNode }) {
  const { ctx } = useSessao();
  const p = ctx.perfil;
  const nomeEsc = ctx.escritorio?.nome || MARCA.nome;
  const logo = ctx.escritorio?.logo || null;
  // O nome do escritório vai para o título da aba (#323) enquanto se está no sistema; ao sair, a aba volta a só "SEMPER".
  useEffect(() => {
    escritorioNaAba.mudar(ctx.escritorio?.nome ?? null);
    return () => escritorioNaAba.mudar(null);
  }, [ctx.escritorio?.nome]);
  const quantasNaoLidas = naoLidas.usar();
  useConferirNaoLidas();
  const tema = useTema();
  const navegar = useNavigate();
  const local = useLocation();
  const [aberta, setAberta] = useState(false);
  const lateral = useRef<HTMLElement>(null);
  // Os módulos da busca geral (#321): os que o escritório tem ligados. A lista só muda quando os módulos mudam.
  const modulosDoEscritorio = ctx.escritorio?.modulos;
  const modulosDaBusca = useMemo(() => modulosLigados(modulosDoEscritorio), [modulosDoEscritorio]);

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
  // Sair não recarrega a página: o que fica guardado nela (a importação de pessoas) é esquecido, para quem entrar depois.
  const sair = async () => {
    if (!await podeSairDoCadastro()) return;
    if (estaGravando() && !await confirmar('Sair com a importação gravando?',
      'Saindo agora, as linhas que faltam não são gravadas (as que já entraram continuam no SEMPER).', 'Sair', true)) return;
    abandonarGravacao();
    await SD.sair();
    navegar('/entrar/');
  };
  const item = (para: string, icone: 'pessoas' | 'contratos' | 'demandas' | 'tarefas' | 'documentos' | 'equipe' | 'configuracoes', rotulo: string) =>
    <NavLink to={para}><Icone nome={icone} /><span>{rotulo}</span></NavLink>;

  return <>
    {/* A barra do topo, só no celular: o menu lateral vira uma gaveta fechada, então as Novidades (#353) ficam também aqui,
        só com o ícone, para o ponto de novidade aparecer sem abrir o menu. */}
    <header className="topo-cel">
      <button type="button" aria-label="Abrir menu" onClick={e => { e.stopPropagation(); setAberta(a => !a); }}><Icone nome="menu" tam={18} /></button>
      <b className="topo-nome">{logo && <LogoDoEscritorio logo={logo} nome={nomeEsc} />}<span className="topo-nome-texto">{nomeEsc}</span> <span style={{ color: 'var(--accent-ink)' }}>{MARCA.nome}</span></b>
      {/* A busca geral (#321) também fica aqui, só com a lupa: no celular não há Ctrl+K. */}
      <span className="topo-acoes"><BotaoBuscaGeral soIcone /><BotaoNovidades soIcone /></span>
    </header>
    <div className="app">
      <aside className={'side' + (aberta ? ' aberta' : '')} aria-label="Menu" ref={lateral}>
        {/* O nome e a logomarca do escritório vêm das Configurações. A logomarca fica no lugar da letra (#323). O Início não é item da
            lista: é a casinha na ponta desta linha (#435), uma bolinha igual aos "+" dos módulos e na mesma coluna, e é o único
            caminho para ele no menu. */}
        <div className="marca-app" role="group" aria-label={nomeEsc}>
          {logo ? <LogoDoEscritorio logo={logo} nome={nomeEsc} /> : <span className="ini">{nomeEsc.trim().charAt(0)}</span>}
          <span className="marca-texto"><b>{nomeEsc}</b><small>{MARCA.nome}</small></span>
          <span className="nav-coluna-do-mais">
            <NavLink className="nav-mais marca-inicio" to="/inicio/" aria-label="Início" {...propsDaDica('Início')}>
              <Icone nome="inicio" tam={ICONE_DO_MAIS} />
            </NavLink>
          </span>
        </div>
        {/* A busca geral (#321): em todos os módulos de uma vez; o atalho é Ctrl+K (Cmd+K no Mac), em qualquer página. */}
        <BotaoBuscaGeral />
        <nav className="nav" aria-label="Seções">
          <NavLink to="/mensagens/" aria-label={rotuloDoMenu(quantasNaoLidas)}>
            <Icone nome="sino" /><span>Mensagens</span>
            {/* O número fica na coluna dos "+" dos módulos abaixo, centrado nela (#404). */}
            {quantasNaoLidas > 0 && <span className="nav-coluna-do-mais"><span className="nav-contador">{textoDoContador(quantasNaoLidas)}</span></span>}
          </NavLink>
          <div className="nav-linha">
            {item('/pessoas/', 'pessoas', 'Pessoas')}
            <MaisDoMenu para="/pessoas/nova/" rotulo="Cadastrar pessoa" />
          </div>
          {/* Cada módulo aparece só no escritório que o tem ligado (o dono da plataforma liga e desliga). A ordem é a do dono (#435):
              primeiro o trabalho do dia (Mensagens, Pessoas, Tarefas, Agenda, Documentos), depois Contratos, Demandas e Processos. */}
          {ctx.escritorio?.modulos?.tarefas && <div className="nav-linha">
            {item('/tarefas/', 'tarefas', 'Tarefas')}
            <MaisDoMenu para="/tarefas/nova/" rotulo="Cadastrar tarefa" />
          </div>}
          {/* A Agenda guarda o "+" de cadastrar compromisso na coluna dos "+" (#404); a seta dela fica logo antes dele. */}
          <SubmenuLateral id="agenda" icone="calendario" rotulo="Agenda e calendário" caminhos={['/agenda', '/calendario']}
            mais={ctx.escritorio?.modulos?.compromissos && <MaisDoMenu para="/agenda/novo/" rotulo="Cadastrar compromisso" />}>
            {ctx.escritorio?.modulos?.compromissos && <NavLink to="/agenda/"><span>Agenda</span></NavLink>}
            <NavLink to="/calendario/"><span>Feriados e prazos</span></NavLink>
          </SubmenuLateral>
          {ctx.escritorio?.modulos?.anotacoes && <div className="nav-linha">
            {item('/documentos/', 'documentos', 'Documentos')}
            <MaisDoMenu para={enderecoDaAnotacaoNova()} rotulo="Cadastrar anotação" />
          </div>}
          {ctx.escritorio?.modulos?.contratos && <div className="nav-linha">
            {item('/contratos/', 'contratos', 'Contratos')}
            <MaisDoMenu para="/contratos/novo/" rotulo="Cadastrar contrato" />
          </div>}
          {ctx.escritorio?.modulos?.demandas && <div className="nav-linha">
            {item('/demandas/', 'demandas', 'Demandas')}
            <MaisDoMenu para="/demandas/nova/" rotulo="Cadastrar demanda" />
          </div>}
          {ctx.escritorio?.modulos?.processos && <SubmenuLateral id="processos" icone="processos" rotulo="Processos" caminhos={['/processos']} para="/processos/">
            <NavLink to="/processos/administrativo/"><span>Administrativo</span></NavLink>
            <NavLink to="/processos/judicial/"><span>Judicial</span></NavLink>
          </SubmenuLateral>}
          {ctx.escritorio?.modulos?.financeiro && <MenuFinanceiro />}
          {ctx.ehAdmin && item('/equipe/', 'equipe', 'Equipe e acessos')}
          {ctx.ehAdmin && item('/configuracoes/', 'configuracoes', 'Configurações')}
        </nav>
        <CronometrosAtivos />
        <div className="side-rodape">
          <div className="usuario">
            {/* A bolinha vem da equipe, que traz a foto. */}
            <Avatar p={ctx.equipe.find(m => m.id === p.id) ?? p} tam={32} />
            <div style={{ minWidth: 0 }}>
              <b>{p.nome}</b><span className="arroba">@{p.usuario}</span>
              <span className={'papel' + (p.papel === 'usuario' ? ' comum' : '')}>{PAPEIS[p.papel]}</span>
            </div>
          </div>
          <nav className="nav" aria-label="Conta">
            {/* No computador não há barra no topo: as novidades ficam aqui, junto do tema e da conta de cada pessoa (#353). */}
            <BotaoNovidades />
            <Link to="/minha-conta/"><Icone nome="conta" /><span>Minha conta</span></Link>
            <button type="button" title="Trocar entre automático, claro e escuro" onClick={trocarTema}><Icone nome="tema" /><span>Tema: {TEMAS[tema]}</span></button>
            <button type="button" onClick={sair}><Icone nome="sair" /><span>Sair</span></button>
          </nav>
        </div>
      </aside>
      <main className="conteudo">{children}</main>
    </div>
    <BuscaGeral modulos={modulosDaBusca} />
  </>;
}

/**
 * A logomarca do escritório (#323), numa placa clara nos dois temas, como na prévia das Configurações: a logomarca é feita para
 * fundo claro.
 */
function LogoDoEscritorio({ logo, nome }: { logo: string; nome: string }) {
  return <span className="marca-logo"><img src={logo} alt={`Logomarca de ${nome}`} /></span>;
}

/**
 * No menu, quando alguma tarefa está com o cronômetro contando (nesta aba ou em outra): quantas e o botão
 * "Pausar todos", que pausa todas de uma vez.
 */
function CronometrosAtivos() {
  const ativos = Object.values(cronometrosAtivos.usar());
  if (!ativos.length) return null;
  const titulos = ativos.map(a => a.titulo).join(', ');
  return <div className="cronometros-ativos" role="status" title={titulos}>
    <span><Icone nome="relogio" tam={15} /> {ativos.length === 1 ? '1 tarefa contando' : `${ativos.length} tarefas contando`}</span>
    <button type="button" className={estiloBotao({ forma: 'mini' })} onClick={pausarTodos}>Pausar todos</button>
  </div>;
}
