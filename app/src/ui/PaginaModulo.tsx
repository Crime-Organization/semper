// Página de módulo: estrutura única de toda listagem (pessoas, contratos, demandas, tarefas, processos...):
// cabeçalho com a ação principal na altura do título, barra de busca, filtros e ordem, troca Tabela/Kanban,
// a visualização e a barra de ações em lote. O módulo só declara o conteúdo; o desenho vem daqui e do
// estilo comum (DESIGN.md, "Página de módulo"). Nunca escreva essa estrutura à mão numa página.
import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import type { Ordem } from '../dados';
import { Icone, type NomeIcone } from './Icone';
import { MenuFlutuante } from './Menu';
import { ORDENS, type Ordenacao } from './ordem';
import { useAtrasado } from './util';

export type Visao = 'tabela' | 'kanban';
const VISOES: Record<Visao, string> = { tabela: 'Tabela', kanban: 'Kanban' };

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
  olho?: string;
  titulo: string;
  acao?: { rotulo: string; para: string };
  /** Busca com espera enquanto digita: aoBuscar recebe o termo só quando a pessoa para de digitar. */
  busca?: { placeholder: string; aoBuscar: (termo: string) => void };
  filtros?: Filtro[];
  /** Controle "Ordenar" da tabela (vem de useOrdem, em ui/ordem.ts); no quadro, cada coluna tem o seu. */
  ordem?: Ordenacao;
  /** Ações sobre a lista inteira, no menu "⋯" ao lado dos filtros (ex.: exportar). */
  mais?: AcaoMenu[];
  visoes?: Visao[];
  visao?: Visao;
  aoTrocarVisao?: (v: Visao) => void;
  lead?: ReactNode;
  /** Barra de ações em lote (aparece presa ao pé da tela quando há itens selecionados). */
  lote?: ReactNode;
  children: ReactNode;
}

export function PaginaModulo({ olho, titulo, acao, busca, filtros = [], ordem, mais = [], visoes = ['tabela', 'kanban'], visao, aoTrocarVisao, lead, lote, children }: Props) {
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  const [termo, setTermo] = useState('');
  const atrasado = useAtrasado(termo, 350);
  const aoBuscar = busca?.aoBuscar;
  const [buscado, setBuscado] = useState('');
  useEffect(() => {
    if (atrasado === buscado) return;
    setBuscado(atrasado);
    aoBuscar?.(atrasado);
  }, [atrasado, buscado, aoBuscar]);

  return <div className="miolo largo">
    <header className="cabeca">
      {olho && <p className="olho">{olho}</p>}
      <div className="cabeca-linha">
        <h1 className="titulo">{titulo}<span className="ponto">.</span></h1>
        {acao && <Link className="btn pri cabeca-acao" to={acao.para} title={acao.rotulo} aria-label={acao.rotulo}>
          <Icone nome="mais" tam={18} /><span className="cabeca-acao-rotulo">{acao.rotulo}</span>
        </Link>}
      </div>
      <p className="lead">{lead || ' '}</p>
    </header>
    <div className="barra-ferr" role="search">
      {busca && <label className="busca-campo"><Icone nome="buscar" tam={18} /><span className="sr">Buscar</span>
        <input type="search" placeholder={busca.placeholder} autoComplete="off" value={termo} onChange={e => setTermo(e.target.value)} />
      </label>}
      {filtros.map(f => <select key={f.id} className="filtro" aria-label={f.rotulo} value={f.valor} onChange={e => f.aoMudar(e.target.value)}>
        {f.opcoes.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
      </select>)}
      {ordem && <select className="filtro" aria-label="Ordenar" title="Ordenar" value={ordem.valor} onChange={e => ordem.aoMudar(e.target.value as Ordem)}>
        {ordem.opcoes.map(o => <option key={o} value={o}>{ORDENS[o]}</option>)}
      </select>}
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
    {children}
    {lote && <div className="lote">{lote}</div>}
  </div>;
}
