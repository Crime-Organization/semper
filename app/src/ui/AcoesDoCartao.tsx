// Peças comuns da edição no próprio cartão (pessoa, contrato, demanda, tarefa):
// - no topo, os botões redondos Arquivar e Editar (o lápis), ao lado dos botões do painel; com o item arquivado, Desarquivar
//   (a caixa aberta) e, para quem pode excluir, a lixeira no lugar do lápis. Antes deles, as ações a mais do cartão (ex.: baixar
//   a anotação), que quem só lê o cartão também tem (AcoesDeQuemLe);
// - em edição, o rodapé com Cancelar e Salvar, sempre à vista no pé do cartão.
// O formulário em etapas fica para criar; para editar, o cartão mostra todos os campos de uma vez.
import { useContext, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { falha } from './avisos';
import { Botao } from './Botoes';
import { BotoesNoPainel } from './PainelCartao';
import { estiloBotao } from './base';
import { Icone, type NomeIcone } from './Icone';
import { confirmar } from './janela';

/** Tamanho dos ícones dos botões redondos do topo (o mesmo dos botões do painel). */
const ICONE_DO_TOPO = 18;

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
 * Os botões do topo do cartão. No painel ao lado (e na janela estreita), vão para a linha dos botões do painel, lado a lado com
 * o formato e o "X"; na janela larga, ficam na linha dos selos do cartão, encostados à direita do conteúdo.
 */
function NoTopo({ children }: { children: ReactNode }) {
  const noPainel = useContext(BotoesNoPainel);
  const botoes = <span className="cartao-topo-acoes">{children}</span>;
  return noPainel ? createPortal(botoes, noPainel) : botoes;
}

/** Os botões das ações a mais (Botao: fica desligado enquanto a ação roda). */
const BotoesExtras = ({ acoes }: { acoes: AcaoDoTopo[] }) => <>
  {acoes.map(a => <Botao key={a.rotulo} className="cartao-botao" aria-label={a.rotulo} title={a.rotulo} onClick={a.aoClicar}><Icone nome={a.icone} tam={ICONE_DO_TOPO} /></Botao>)}
</>;

/** Só as ações a mais, para quem vê o cartão mas não o altera: sem Arquivar, Editar nem a lixeira. */
export function AcoesDeQuemLe({ acoes }: { acoes: AcaoDoTopo[] }) {
  return <NoTopo><BotoesExtras acoes={acoes} /></NoTopo>;
}

/** Arquivar, Editar e a lixeira (com as ações a mais antes deles), para quem altera o cartão; veja NoTopo. */
export function AcoesDoCartao({ arquivado, editando, aoArquivar, aoEditar, excluir, extras = [] }: PropsAcoes) {
  const [excluindo, setExcluindo] = useState(false);
  const arquivar = arquivado ? 'Desarquivar' : 'Arquivar';
  async function pedirExclusao() {
    if (!excluir || !await confirmar(`Excluir ${excluir.oQue}?`, 'A exclusão é definitiva e não pode ser desfeita.', 'Excluir definitivamente', true)) return;
    // Desliga só depois da janela: com o botão desligado enquanto ela está aberta, o foco não teria para onde voltar ao cancelar.
    setExcluindo(true);
    try { await excluir.aoConfirmar(); } catch (e) { falha(e); } finally { setExcluindo(false); }
  }
  return <NoTopo>
    {editando
      ? <span className="cartao-modo-edicao" role="status">Modo de edição</span>
      : <>
        <BotoesExtras acoes={extras} />
        <Botao className="cartao-botao" aria-label={arquivar} title={arquivar} onClick={aoArquivar}><Icone nome={arquivado ? 'arquivoAberto' : 'arquivo'} tam={ICONE_DO_TOPO} /></Botao>
        {!arquivado && <button type="button" className="cartao-botao cartao-editar" aria-label="Editar" title="Editar" onClick={aoEditar}><Icone nome="editar" tam={ICONE_DO_TOPO} /></button>}
        {arquivado && excluir && <button type="button" className="cartao-botao cartao-excluir" aria-label="Excluir" title="Excluir" disabled={excluindo} onClick={() => void pedirExclusao()}><Icone nome="lixeira" tam={ICONE_DO_TOPO} /></button>}
      </>}
  </NoTopo>;
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
