// Página de módulo: estrutura única de toda listagem (pessoas, contratos, demandas, tarefas, processos...):
// cabeçalho numa linha só (título, contador, busca, Filtros, menu ⋯, troca Tabela/Kanban e a ação principal),
// a visualização e a barra de ações em lote. O módulo só declara o conteúdo; o desenho vem daqui e do
// estilo comum (DESIGN.md, "Página de módulo"). Nunca escreva essa estrutura à mão numa página.
// Com "ajuda" (os textos de regras/ajuda.ts), o cabeçalho ganha o botão "?" ao lado do título (#85), que abre a mesma janela da
// tecla "?": a explicação da tela em cima e os atalhos de teclado embaixo.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import type { OrdemComPrazo } from '../dados';
import { ATALHOS, dicaComAtalho, type Atalho } from '../regras/atalhos';
import { PARAMETRO_DA_BUSCA, PARAMETROS_DO_VER_TODOS } from '../regras/buscaGeral';
import { useAtalhosDaPagina, useAtalhosLigados } from './atalhos';
import { BotaoDeAjuda } from './BotaoDeAjuda';
import { Icone, type NomeIcone } from './Icone';
import { BotaoLink, estiloBotao } from './base';
import { MenuFlutuante } from './Menu';
import { ORDENS, type Ordenacao } from './ordem';
import { useAtrasado } from './util';

export type Visao = 'tabela' | 'kanban' | 'agenda';
const VISOES: Record<Visao, { rotulo: string; icone: NomeIcone }> = {
  tabela: { rotulo: 'Tabela', icone: 'tabela' },
  kanban: { rotulo: 'Kanban', icone: 'kanban' },
  agenda: { rotulo: 'Agenda', icone: 'calendario' }
};

/** Filtro da lista. A primeira opção é a padrão: as outras contam como filtro ligado no botão "Filtros". */
export interface Filtro {
  id: string;
  rotulo: string;
  opcoes: [valor: string, texto: string][];
  valor: string;
  aoMudar: (valor: string) => void;
}

/**
 * A ação principal da página (o botão verde do cabeçalho, que o "N" também aciona): ou leva a um endereço (o cadastro, como
 * "Nova pessoa"), ou faz algo na própria página (abre a janela da nova entrada, no Financeiro).
 */
export type AcaoPrincipal = { rotulo: string; para: string } | { rotulo: string; aoClicar: () => void };

/** Item do menu "⋯" da barra (exportar, importar e outras ações sobre a lista inteira). */
export interface AcaoMenu { rotulo: string; icone: NomeIcone; aoEscolher: () => void }

interface Props {
  titulo: string;
  /** Texto curto ao lado do título, como "28 ativas". */
  contador?: ReactNode;
  acao?: AcaoPrincipal;
  /** Busca com espera enquanto digita: aoBuscar recebe o termo só quando a pessoa para de digitar. */
  busca?: { placeholder: string; aoBuscar: (termo: string) => void };
  /** Filtros e ordem ficam juntos no painel do botão "Filtros". */
  filtros?: Filtro[];
  /** Ordem da tabela (vem de useOrdem, em ui/ordem.ts); no quadro, cada coluna tem a sua. */
  ordem?: Ordenacao<OrdemComPrazo>;
  /** Ações sobre a lista inteira, no menu "⋯" (ex.: exportar). */
  mais?: AcaoMenu[];
  visoes?: Visao[];
  visao?: Visao;
  aoTrocarVisao?: (v: Visao) => void;
  /** Barra de ações em lote (aparece presa ao pé da tela quando há itens selecionados). */
  lote?: ReactNode;
  /** A explicação curta da tela (regras/ajuda.ts, como AJUDA.pessoas): com ela, aparece o botão "?" no cabeçalho (#85). */
  ajuda?: readonly string[];
  children: ReactNode;
}

export function PaginaModulo({ titulo, contador, acao, busca, filtros = [], ordem, mais = [], visoes = ['tabela', 'kanban'], visao, aoTrocarVisao, lote, ajuda, children }: Props) {
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  const [painel, setPainel] = useState<HTMLElement | null>(null);
  // A busca pode chegar pelo endereço (/pessoas/?busca=maria): é o "Ver todos em …" da busca geral (#321). Ela entra no
  // campo ao abrir a página e cada vez que o endereço a traz. Lida, ela sai do endereço (com os outros parâmetros do "Ver todos",
  // que a página já leu ao desenhar): o campo é o que vale, a busca antiga não volta ao recarregar, e um novo "Ver todos" com o
  // mesmo termo preenche o campo de novo.
  const [parametros, setParametros] = useSearchParams();
  const doEndereco = parametros.get(PARAMETRO_DA_BUSCA);
  const [termo, setTermo] = useState(doEndereco ?? '');
  const [enderecoLido, setEnderecoLido] = useState(doEndereco);
  if (doEndereco !== enderecoLido) {
    setEnderecoLido(doEndereco);
    if (doEndereco !== null) setTermo(doEndereco);
  }
  useEffect(() => {
    if (doEndereco === null) return;
    setParametros(p => { PARAMETROS_DO_VER_TODOS.forEach(k => p.delete(k)); return p; }, { replace: true });
  }, [doEndereco, setParametros]);
  const atrasado = useAtrasado(termo);
  const aoBuscar = busca?.aoBuscar;
  const [buscado, setBuscado] = useState('');
  useEffect(() => {
    if (atrasado === buscado) return;
    setBuscado(atrasado);
    aoBuscar?.(atrasado);
  }, [atrasado, buscado, aoBuscar]);
  // Os atalhos de teclado (#86): "/" vai à busca, "N" faz o mesmo que a ação principal e "?" mostra a lista.
  const campoDaBusca = useRef<HTMLInputElement>(null);
  const navegar = useNavigate();
  const abrirAjuda = useAtalhosDaPagina({
    tela: ajuda ? { titulo, textos: ajuda } : undefined,
    buscar: busca ? () => { campoDaBusca.current?.focus(); campoDaBusca.current?.select(); } : undefined,
    novo: acao ? { rotulo: acao.rotulo, abrir: 'para' in acao ? () => { void navegar(acao.para); } : acao.aoClicar } : undefined
  });
  // Com os atalhos de uma tecla desligados pela pessoa, a dica e o leitor de tela não os prometem.
  const atalhosLigados = useAtalhosLigados();
  const dicaDoAtalho = (texto: string, atalho: Atalho) => atalhosLigados
    ? { title: dicaComAtalho(texto, atalho), 'aria-keyshortcuts': ATALHOS[atalho].nome } : { title: texto };
  const ligados = filtros.filter(f => f.valor !== (f.opcoes[0]?.[0] ?? '')).length;

  return <div className="miolo largo">
    <header className="cabeca">
      <div className="cabeca-titulo">
        <h1 className="titulo">{titulo}<span className="ponto">.</span></h1>
        {ajuda && <BotaoDeAjuda aoAbrir={abrirAjuda} />}
        {contador && <span className="contador">{contador}</span>}
      </div>
      <div className="barra-ferr" role="search">
        {busca && <label className="busca-campo"><Icone nome="buscar" tam={18} /><span className="sr">Buscar</span>
          <input ref={campoDaBusca} type="search" placeholder={busca.placeholder} {...dicaDoAtalho('Buscar', 'buscar')} autoComplete="off" value={termo} onChange={e => setTermo(e.target.value)} />
        </label>}
        {(filtros.length > 0 || ordem) && <button type="button" className="barra-botao barra-filtros" aria-haspopup="dialog" aria-expanded={!!painel}
          aria-label={ligados ? `Filtros (${ligados} ligado${ligados > 1 ? 's' : ''})` : 'Filtros'} onClick={e => setPainel(painel ? null : e.currentTarget)}>
          <Icone nome="filtro" tam={16} /> Filtros{ligados > 0 && <span className="filtros-ligados" aria-hidden="true">{ligados}</span>}
        </button>}
        {painel && <MenuFlutuante botao={painel} aoFechar={() => setPainel(null)} painel rotulo="Filtros">
          <div className="painel-filtros">
            {filtros.map(f => <label key={f.id}>{f.rotulo}
              <select className="filtro" value={f.valor} onChange={e => f.aoMudar(e.target.value)}>
                {f.opcoes.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
              </select>
            </label>)}
            {ordem && <label>Ordenar
              <select className="filtro" value={ordem.valor} onChange={e => ordem.aoMudar(e.target.value as OrdemComPrazo)}>
                {ordem.opcoes.map(o => <option key={o} value={o}>{ORDENS[o]}</option>)}
              </select>
            </label>}
          </div>
        </MenuFlutuante>}
        {mais.length > 0 && <button type="button" className="barra-mais" title="Mais ações" aria-label="Mais ações" aria-haspopup="menu"
          aria-expanded={!!menu} onClick={e => setMenu(menu ? null : e.currentTarget)}><Icone nome="pontos" tam={20} /></button>}
        {menu && <MenuFlutuante botao={menu} aoFechar={() => setMenu(null)}>
          {mais.map(a => <button key={a.rotulo} type="button" role="menuitem" onClick={() => { setMenu(null); a.aoEscolher(); }}>
            <Icone nome={a.icone} tam={15} /> {a.rotulo}
          </button>)}
        </MenuFlutuante>}
        {visoes.length > 1 && <div className="abas" role="group" aria-label="Visualização">
          {visoes.map(v => <button key={v} type="button" aria-pressed={v === visao} onClick={() => aoTrocarVisao?.(v)}>
            <Icone nome={VISOES[v].icone} tam={15} />{VISOES[v].rotulo}
          </button>)}
        </div>}
      </div>
      {acao && ('para' in acao
        ? <BotaoLink variante="principal" className="cabeca-acao" to={acao.para} {...dicaDoAtalho(acao.rotulo, 'novo')} aria-label={acao.rotulo}>
          <Icone nome="mais" tam={18} /><span className="cabeca-acao-rotulo">{acao.rotulo}</span>
        </BotaoLink>
        : <button type="button" className={estiloBotao({ variante: 'principal' }, 'cabeca-acao')} {...dicaDoAtalho(acao.rotulo, 'novo')} aria-label={acao.rotulo} onClick={acao.aoClicar}>
          <Icone nome="mais" tam={18} /><span className="cabeca-acao-rotulo">{acao.rotulo}</span>
        </button>)}
    </header>
    {children}
    {lote && <div className="lote">{lote}</div>}
  </div>;
}
