// Página de módulo: estrutura única de toda listagem (pessoas, contratos, demandas, tarefas, processos...):
// cabeçalho numa linha só (título, contador, busca, Filtros, menu ⋯, troca Tabela/Kanban e a ação principal),
// a visualização e a barra de ações em lote. O módulo só declara o conteúdo; o desenho vem daqui e do
// estilo comum (DESIGN.md, "Página de módulo"). Nunca escreva essa estrutura à mão numa página.
import { useEffect, useState, type ReactNode } from 'react';
import type { Ordem } from '../dados';
import { Icone, type NomeIcone } from './Icone';
import { BotaoLink } from './base';
import { MenuFlutuante } from './Menu';
import { ORDENS, type Ordenacao } from './ordem';
import { useAtrasado } from './util';

export type Visao = 'tabela' | 'kanban';
const VISOES: Record<Visao, string> = { tabela: 'Tabela', kanban: 'Kanban' };

/** Filtro da lista. A primeira opção é a padrão: as outras contam como filtro ligado no botão "Filtros". */
export interface Filtro {
  id: string;
  rotulo: string;
  opcoes: [valor: string, texto: string][];
  valor: string;
  aoMudar: (valor: string) => void;
}

/** Item do menu "⋯" da barra (exportar, importar e outras ações sobre a lista inteira). */
export interface AcaoMenu { rotulo: string; icone: NomeIcone; aoEscolher: () => void }

interface Props {
  titulo: string;
  /** Texto curto ao lado do título, como "28 ativas". */
  contador?: ReactNode;
  acao?: { rotulo: string; para: string };
  /** Busca com espera enquanto digita: aoBuscar recebe o termo só quando a pessoa para de digitar. */
  busca?: { placeholder: string; aoBuscar: (termo: string) => void };
  /** Filtros e ordem ficam juntos no painel do botão "Filtros". */
  filtros?: Filtro[];
  /** Ordem da tabela (vem de useOrdem, em ui/ordem.ts); no quadro, cada coluna tem a sua. */
  ordem?: Ordenacao;
  /** Ações sobre a lista inteira, no menu "⋯" (ex.: exportar). */
  mais?: AcaoMenu[];
  visoes?: Visao[];
  visao?: Visao;
  aoTrocarVisao?: (v: Visao) => void;
  /** Barra de ações em lote (aparece presa ao pé da tela quando há itens selecionados). */
  lote?: ReactNode;
  children: ReactNode;
}

export function PaginaModulo({ titulo, contador, acao, busca, filtros = [], ordem, mais = [], visoes = ['tabela', 'kanban'], visao, aoTrocarVisao, lote, children }: Props) {
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  const [painel, setPainel] = useState<HTMLElement | null>(null);
  const [termo, setTermo] = useState('');
  const atrasado = useAtrasado(termo);
  const aoBuscar = busca?.aoBuscar;
  const [buscado, setBuscado] = useState('');
  useEffect(() => {
    if (atrasado === buscado) return;
    setBuscado(atrasado);
    aoBuscar?.(atrasado);
  }, [atrasado, buscado, aoBuscar]);
  const ligados = filtros.filter(f => f.valor !== (f.opcoes[0]?.[0] ?? '')).length;

  return <div className="miolo largo">
    <header className="cabeca">
      <div className="cabeca-titulo">
        <h1 className="titulo">{titulo}<span className="ponto">.</span></h1>
        {contador && <span className="contador">{contador}</span>}
      </div>
      <div className="barra-ferr" role="search">
        {busca && <label className="busca-campo"><Icone nome="buscar" tam={18} /><span className="sr">Buscar</span>
          <input type="search" placeholder={busca.placeholder} autoComplete="off" value={termo} onChange={e => setTermo(e.target.value)} />
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
              <select className="filtro" value={ordem.valor} onChange={e => ordem.aoMudar(e.target.value as Ordem)}>
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
            <Icone nome={v} tam={15} />{VISOES[v]}
          </button>)}
        </div>}
      </div>
      {acao && <BotaoLink variante="principal" className="cabeca-acao" to={acao.para} title={acao.rotulo} aria-label={acao.rotulo}>
        <Icone nome="mais" tam={18} /><span className="cabeca-acao-rotulo">{acao.rotulo}</span>
      </BotaoLink>}
    </header>
    {children}
    {lote && <div className="lote">{lote}</div>}
  </div>;
}
