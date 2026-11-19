// Peças comuns da edição no próprio cartão (pessoa, contrato, demanda, tarefa):
// - no topo, os botões redondos Arquivar e Editar (o lápis), ao lado dos botões do painel; com o item arquivado, Desarquivar
//   (a caixa aberta) e, para quem pode excluir, a lixeira no lugar do lápis. Antes deles, as ações a mais do cartão (ex.: baixar
//   a anotação), que quem só lê o cartão também tem (AcoesDeQuemLe);
// - em edição, o rodapé com Cancelar e Salvar, sempre à vista no pé do cartão;
// - no cartão que se muda todo no próprio lugar, sem lápis (a anotação), o menu ⋯ (MenuDoCartao) com as mesmas ações; ele e os
//   outros botões do topo desse cartão (a etiqueta da anotação) vão para o mesmo lugar dos de cima, com NoTopoDoCartao.
// O formulário em etapas fica para criar; para editar, o cartão mostra todos os campos de uma vez.
import { useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { falha } from './avisos';
import { Botao } from './Botoes';
import { BotoesNoPainel } from './PainelCartao';
import { estiloBotao } from './base';
import { Icone, ICONE_DO_TOPO, type NomeIcone } from './Icone';
import { confirmar } from './janela';
import { MenuFlutuante } from './Menu';

// O tamanho dos ícones dos botões redondos (ICONE_DO_TOPO) mora em Icone.tsx, onde o "Expandir tudo" das seções também o acha
// sem dar volta pelo painel; continua saindo daqui para quem já o importava.
export { ICONE_DO_TOPO };
/** Tamanho dos ícones dentro do menu ⋯ (como nos outros menus). */
const ICONE_DO_MENU = 15;

/** O que o cartão passa ao formulário para editar nele: qual registro e o que fazer ao terminar (salvou ou cancelou). */
export interface EdicaoNoCartao {
  id: string;
  /** Contrato editado por quem não é parte: só o que não é valor. */
  semValores?: boolean;
  aoTerminar: (salvou: boolean) => void;
}

/** A lixeira do cartão arquivado: como a janela chama o item ("a pessoa", "o contrato"…) e o que fazer depois de confirmar. */
export interface ExclusaoNoCartao {
  oQue: string;
  aoConfirmar: () => unknown;
}

/** Uma ação a mais no topo do cartão: botão redondo só com o ícone, com o nome como dica e como nome para o leitor de tela. */
export interface AcaoDoTopo {
  rotulo: string;
  icone: NomeIcone;
  aoClicar: () => unknown;
}

interface PropsAcoes {
  arquivado: boolean;
  /** Em edição, no lugar dos botões fica só o aviso "Modo de edição", em texto (Cancelar e Salvar estão no pé do cartão). */
  editando: boolean;
  aoArquivar: () => unknown;
  aoEditar: () => void;
  /** Só com o item arquivado e para quem pode excluí-lo; sem isto, a lixeira não aparece. */
  excluir?: ExclusaoNoCartao;
  /** Ações a mais, antes de Arquivar (somem em edição, com os outros botões). */
  extras?: AcaoDoTopo[];
}

/**
 * Os botões do topo do cartão. No painel ao lado (e na janela estreita, ou sem a coluna dos comentários), vão para a linha dos
 * botões do painel, lado a lado com o formato e o "X"; na janela larga com a coluna, ficam na linha dos selos do cartão,
 * encostados à direita do conteúdo.
 */
export function NoTopoDoCartao({ children }: { children: ReactNode }) {
  const noPainel = useContext(BotoesNoPainel);
  const botoes = <span className="cartao-topo-acoes">{children}</span>;
  return noPainel ? createPortal(botoes, noPainel) : botoes;
}

/** Pergunta antes de excluir (a exclusão é definitiva) e só então exclui. Diz se a pessoa confirmou. */
async function confirmarExclusao(excluir: ExclusaoNoCartao) {
  return !!await confirmar(`Excluir ${excluir.oQue}?`, 'A exclusão é definitiva e não pode ser desfeita.', 'Excluir definitivamente', true);
}

/** Os botões das ações a mais (Botao: fica desligado enquanto a ação roda). */
const BotoesExtras = ({ acoes }: { acoes: AcaoDoTopo[] }) => <>
  {acoes.map(a => <Botao key={a.rotulo} className="cartao-botao" aria-label={a.rotulo} title={a.rotulo} onClick={a.aoClicar}><Icone nome={a.icone} tam={ICONE_DO_TOPO} /></Botao>)}
</>;

/** Só as ações a mais, para quem vê o cartão mas não o altera: sem Arquivar, Editar nem a lixeira. */
export function AcoesDeQuemLe({ acoes }: { acoes: AcaoDoTopo[] }) {
  return <NoTopoDoCartao><BotoesExtras acoes={acoes} /></NoTopoDoCartao>;
}

/** Arquivar, Editar e a lixeira (com as ações a mais antes deles), para quem altera o cartão; veja NoTopoDoCartao. */
export function AcoesDoCartao({ arquivado, editando, aoArquivar, aoEditar, excluir, extras = [] }: PropsAcoes) {
  const [excluindo, setExcluindo] = useState(false);
  const arquivar = arquivado ? 'Desarquivar' : 'Arquivar';
  async function pedirExclusao() {
    if (!excluir || !await confirmarExclusao(excluir)) return;
    // Desliga só depois da janela: com o botão desligado enquanto ela está aberta, o foco não teria para onde voltar ao cancelar.
    setExcluindo(true);
    try { await excluir.aoConfirmar(); } catch (e) { falha(e); } finally { setExcluindo(false); }
  }
  return <NoTopoDoCartao>
    {editando
      ? <span className="cartao-modo-edicao" role="status">Modo de edição</span>
      : <>
        <BotoesExtras acoes={extras} />
        <Botao className="cartao-botao" aria-label={arquivar} title={arquivar} onClick={aoArquivar}><Icone nome={arquivado ? 'arquivoAberto' : 'arquivo'} tam={ICONE_DO_TOPO} /></Botao>
        {!arquivado && <button type="button" className="cartao-botao cartao-editar" aria-label="Editar" title="Editar" onClick={aoEditar}><Icone nome="editar" tam={ICONE_DO_TOPO} /></button>}
        {arquivado && excluir && <button type="button" className="cartao-botao cartao-excluir" aria-label="Excluir" title="Excluir" disabled={excluindo} onClick={() => void pedirExclusao()}><Icone nome="lixeira" tam={ICONE_DO_TOPO} /></button>}
      </>}
  </NoTopoDoCartao>;
}

interface PropsDoMenu {
  arquivado: boolean;
  /** Arquivar e desarquivar, para quem altera o cartão; sem isto (quem só lê), o menu tem só as ações a mais. */
  aoArquivar?: () => unknown;
  /** Só com o item arquivado e para quem pode excluí-lo. */
  excluir?: ExclusaoNoCartao;
  /** As ações a mais (duplicar, baixar), antes de Arquivar. */
  extras?: AcaoDoTopo[];
}

/** Uma linha do menu ⋯: a ação a mais, ou Arquivar e Excluir (este em vermelho, com a pergunta `antes`). */
type ItemDoMenu = AcaoDoTopo & { perigo?: boolean; antes?: () => Promise<boolean> };

/**
 * O menu ⋯ do cartão que não tem lápis, porque tudo nele se muda no próprio lugar (a anotação): as ações a
 * mais, Arquivar (ou Desarquivar) e, no arquivado e para quem pode, Excluir, com a mesma confirmação da lixeira. Enquanto uma
 * ação roda, o ⋯ fica desligado (sem baixar ou duplicar duas vezes).
 */
export function MenuDoCartao({ arquivado, aoArquivar, excluir, extras = [] }: PropsDoMenu) {
  const [botao, setBotao] = useState<HTMLElement | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const itens: ItemDoMenu[] = [...extras];
  if (aoArquivar) itens.push({ rotulo: arquivado ? 'Desarquivar' : 'Arquivar', icone: arquivado ? 'arquivoAberto' : 'arquivo', aoClicar: aoArquivar });
  if (arquivado && excluir) {
    itens.push({ rotulo: 'Excluir', icone: 'lixeira', perigo: true, antes: () => confirmarExclusao(excluir), aoClicar: excluir.aoConfirmar });
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
  return <>
    <button type="button" className="cartao-botao" aria-label="Mais ações" title="Mais ações" aria-haspopup="menu" aria-expanded={!!botao} disabled={ocupado}
      onClick={e => { const alvo = e.currentTarget; setBotao(b => b ? null : alvo); }}>
      <Icone nome="pontos" tam={ICONE_DO_TOPO} />
    </button>
    {botao && <MenuFlutuante botao={botao} aoFechar={() => setBotao(null)}>
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
}

/** Rodapé da edição no cartão: preso ao pé do cartão enquanto se rola, com Cancelar e Salvar. */
export function RodapeDaEdicao({ ocupado, aoCancelar, aoSalvar }: PropsRodape) {
  return <div className="edicao-rodape">
    <button type="button" className={estiloBotao()} disabled={ocupado} onClick={aoCancelar}>Cancelar</button>
    <button type="button" className={estiloBotao({ variante: 'principal' })} disabled={ocupado} onClick={aoSalvar}>{ocupado ? 'Salvando…' : 'Salvar'}</button>
  </div>;
}
