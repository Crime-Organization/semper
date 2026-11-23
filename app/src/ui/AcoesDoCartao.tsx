// Peças comuns do topo e da edição no próprio cartão (pessoa, contrato, demanda, tarefa, processo, compromisso, anotação):
// - no topo (desde a #382, o mesmo desenho da anotação em todos: TopoDoCartao), o lápis (LapisDoCartao, verde, nos cartões que se
//   editam por ele) e o menu ⋯ (MenuDoCartao), com as ações a mais, Arquivar ou Desarquivar e, no arquivado e para quem pode,
//   Excluir. Eles e o ícone de etiqueta vão para o mesmo lugar dos botões da janela (o formato e o X), com NoTopoDoCartao. Em
//   edição, no lugar deles, só o texto "Modo de edição" (ModoDeEdicao);
// - em edição, o rodapé com Cancelar e Salvar, sempre à vista no pé do cartão;
// - para quem só lê um cartão com ações a mais, elas em botões redondos (AcoesDeQuemLe).
// O formulário em etapas fica para criar; para editar, o cartão mostra todos os campos de uma vez.
import { useContext, useEffect, useRef, useState, type ReactNode, type Ref } from 'react';
import { createPortal } from 'react-dom';
import { AvisoAoSair } from './AvisoAoSair';
import { falha } from './avisos';
import { Botao } from './Botoes';
import { BotoesNoPainel } from './PainelCartao';
import { estiloBotao, propsDaDica } from './base';
import { Icone, ICONE_DO_TOPO, type NomeIcone } from './Icone';
import { confirmar } from './janela';
import { MenuFlutuante } from './Menu';

// O tamanho dos ícones dos botões redondos (ICONE_DO_TOPO) mora em Icone.tsx, onde o "Expandir tudo" das seções também o acha
// sem dar volta pelo painel; continua saindo daqui para quem já o importava.
export { ICONE_DO_TOPO };
/** Tamanho dos ícones dentro do menu ⋯ (como nos outros menus). */
const ICONE_DO_MENU = 15;
/** O nome do ⋯ quando quem usa não dá outro. */
const MAIS_ACOES = 'Mais ações';

/** O que o cartão passa ao formulário para editar nele: qual registro e o que fazer ao terminar (salvou ou cancelou). */
export interface EdicaoNoCartao {
  id: string;
  /** Contrato editado por quem não é parte: só o que não é valor. */
  semValores?: boolean;
  aoTerminar: (salvou: boolean) => void;
}

/** O Excluir do cartão arquivado (no ⋯): como a janela chama o item ("a pessoa", "o contrato"…) e o que fazer depois de confirmar. */
export interface ExclusaoNoCartao {
  oQue: string;
  aoConfirmar: () => unknown;
  /**
   * A pergunta própria do módulo, no lugar da de sempre (ex.: o contrato, que mostra o que sai junto e os valores, #284). Diz se a
   * pessoa confirmou.
   */
  perguntar?: () => Promise<boolean>;
}

/** Uma ação a mais do cartão: no ⋯, uma linha; para quem só lê (AcoesDeQuemLe), um botão redondo só com o ícone. */
export interface AcaoDoTopo {
  rotulo: string;
  icone: NomeIcone;
  aoClicar: () => unknown;
}

/**
 * Os botões do topo do cartão. No painel ao lado (e na janela estreita, ou sem a coluna dos comentários), vão para a linha dos
 * botões do painel, lado a lado com o formato e o "X"; na janela larga com a coluna, ficam no topo do cartão, encostados à
 * direita do conteúdo.
 */
export function NoTopoDoCartao({ children }: { children: ReactNode }) {
  const noPainel = useContext(BotoesNoPainel);
  const botoes = <span className="cartao-topo-acoes">{children}</span>;
  return noPainel ? createPortal(botoes, noPainel) : botoes;
}

/** Pergunta antes de excluir (a exclusão é definitiva). Diz se a pessoa confirmou. */
async function confirmarExclusao(excluir: ExclusaoNoCartao) {
  return !!await confirmar(`Excluir ${excluir.oQue}?`, 'A exclusão é definitiva e não pode ser desfeita.', 'Excluir definitivamente', true);
}

/** Os botões das ações a mais (Botao: fica desligado enquanto a ação roda). */
const BotoesExtras = ({ acoes }: { acoes: AcaoDoTopo[] }) => <>
  {acoes.map(a => <Botao key={a.rotulo} className="cartao-botao" aria-label={a.rotulo} {...propsDaDica(a.rotulo)} onClick={a.aoClicar}><Icone nome={a.icone} tam={ICONE_DO_TOPO} /></Botao>)}
</>;

/** Só as ações a mais, para quem vê o cartão mas não o altera: sem o lápis nem o ⋯ de quem altera. */
export function AcoesDeQuemLe({ acoes }: { acoes: AcaoDoTopo[] }) {
  return <NoTopoDoCartao><BotoesExtras acoes={acoes} /></NoTopoDoCartao>;
}

/**
 * O lápis do cartão: o botão redondo verde que abre a edição. O nome ("Editar", "Editar sem os valores") é também a dica, a do
 * sistema ([data-dica]), como a do ícone de etiqueta e a do ⋯ ao lado dele.
 */
export function LapisDoCartao({ rotulo, aoEditar }: { rotulo: string; aoEditar: () => void }) {
  return <button type="button" className="cartao-botao cartao-editar" aria-label={rotulo} {...propsDaDica(rotulo)} onClick={aoEditar}>
    <Icone nome="editar" tam={ICONE_DO_TOPO} />
  </button>;
}

/** Em edição, no lugar dos botões do topo, só o aviso "Modo de edição", em texto (Cancelar e Salvar estão no pé do cartão). */
export const ModoDeEdicao = () => <span className="cartao-modo-edicao" role="status">Modo de edição</span>;

export interface PropsDoMenu {
  arquivado: boolean;
  /** O nome do ⋯ para o leitor de tela e na dica (ex.: "Mais ações da tarefa"). */
  rotulo?: string;
  /** Arquivar e desarquivar, para quem altera o cartão; sem isto (quem só lê), o menu tem só as ações a mais. */
  aoArquivar?: () => unknown;
  /** Só com o item arquivado e para quem pode excluí-lo. */
  excluir?: ExclusaoNoCartao;
  /** As ações a mais (duplicar, baixar), antes de Arquivar. */
  extras?: AcaoDoTopo[];
  /** O ⋯ em si, para quem precisa pôr o foco nele (o item que volta do arquivo pela faixa: useFocoAoDesarquivar). */
  refDoBotao?: Ref<HTMLButtonElement>;
}

/** Uma linha do menu ⋯: a ação a mais, ou Arquivar e Excluir (este em vermelho, com a pergunta `antes`). */
type ItemDoMenu = AcaoDoTopo & { perigo?: boolean; antes?: () => Promise<boolean> };

/**
 * O menu ⋯ do cartão (desde a #382, em todos, como na anotação): as ações a mais, Arquivar (ou Desarquivar) e, no arquivado e para
 * quem pode, Excluir, que pergunta antes. Enquanto uma ação roda, o ⋯ fica desligado (sem baixar ou duplicar duas vezes). Sem nada
 * dentro (quem só lê um cartão sem ações a mais), o ⋯ não aparece: um menu vazio só faria clicar à toa.
 */
export function MenuDoCartao({ arquivado, rotulo = MAIS_ACOES, aoArquivar, excluir, extras = [], refDoBotao }: PropsDoMenu) {
  const [botao, setBotao] = useState<HTMLElement | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const itens: ItemDoMenu[] = [...extras];
  if (aoArquivar) itens.push({ rotulo: arquivado ? 'Desarquivar' : 'Arquivar', icone: arquivado ? 'arquivoAberto' : 'arquivo', aoClicar: aoArquivar });
  if (arquivado && excluir) {
    itens.push({ rotulo: 'Excluir', icone: 'lixeira', perigo: true, antes: () => excluir.perguntar?.() ?? confirmarExclusao(excluir), aoClicar: excluir.aoConfirmar });
  }
  // O foco volta ao ⋯ ao escolher um item (o menu some, e o foco iria para o começo da página): a pergunta ou a janela que o
  // item abre o devolvem para lá ao fechar. Se a janela fechou com o ⋯ ainda desligado (a ação rodando), o foco volta a ele quando
  // a ação termina, a não ser que já esteja em outro lugar.
  const devolverFoco = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (ocupado || !devolverFoco.current) return;
    if (!document.activeElement || document.activeElement === document.body) devolverFoco.current.focus();
    devolverFoco.current = null;
  }, [ocupado]);
  async function fazer(i: ItemDoMenu) {
    botao?.focus();
    devolverFoco.current = botao;
    setBotao(null);
    // O ⋯ desliga só depois da pergunta: desligado com ela aberta, o foco não teria para onde voltar ao cancelar.
    if (i.antes && !await i.antes()) { devolverFoco.current = null; return; }
    setOcupado(true);
    try { await i.aoClicar(); } catch (e) { falha(e); } finally { setOcupado(false); }
  }
  if (!itens.length) return null;
  return <>
    <button ref={refDoBotao} type="button" className="cartao-botao" aria-label={rotulo} {...propsDaDica(rotulo)} aria-haspopup="menu" aria-expanded={!!botao} disabled={ocupado}
      onClick={e => { const alvo = e.currentTarget; setBotao(b => b ? null : alvo); }}>
      <Icone nome="pontos" tam={ICONE_DO_TOPO} />
    </button>
    {botao && <MenuFlutuante botao={botao} rotulo={rotulo} aoFechar={() => setBotao(null)}>
      {itens.map(i => <button key={i.rotulo} type="button" role="menuitem" className={i.perigo ? 'perigo' : undefined} onClick={() => void fazer(i)}>
        <Icone nome={i.icone} tam={ICONE_DO_MENU} /> {i.rotulo}
      </button>)}
    </MenuFlutuante>}
  </>;
}

interface PropsRodape {
  ocupado: boolean;
  aoCancelar: () => void;
  aoSalvar: () => void;
  /**
   * Os campos do lápis (#395): mudados e não salvos, fechar o cartão (o X, o Esc, o menu, um link) pergunta antes, como no cadastro
   * novo, em vez de perder o que a pessoa mudou. Cancelar e Salvar saem sem perguntar.
   */
  estado?: unknown;
}

/** Rodapé da edição no cartão: preso ao pé do cartão enquanto se rola, com Cancelar e Salvar. */
export function RodapeDaEdicao({ ocupado, aoCancelar, aoSalvar, estado }: PropsRodape) {
  // O lápis não sai da tela por conta própria: ao salvar ou cancelar, ele só fecha, e o aviso sai junto, sem perguntar.
  const liberada = useRef(false);
  return <>
    {estado !== undefined && <AvisoAoSair estado={estado} liberada={liberada} ocupado={ocupado} />}
    <div className="edicao-rodape">
      <button type="button" className={estiloBotao()} disabled={ocupado} onClick={aoCancelar}>Cancelar</button>
      <button type="button" className={estiloBotao({ variante: 'principal' })} disabled={ocupado} onClick={aoSalvar}>{ocupado ? 'Salvando…' : 'Salvar'}</button>
    </div>
  </>;
}
