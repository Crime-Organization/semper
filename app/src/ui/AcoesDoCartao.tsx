// Peças comuns da edição no próprio cartão (pessoa, contrato, demanda, tarefa):
// - no topo, os botões redondos Arquivar (ou Desarquivar) e Editar (o lápis), ao lado dos botões do painel;
// - em edição, o rodapé com Cancelar e Salvar, sempre à vista no pé do cartão.
// O formulário em etapas fica para criar; para editar, o cartão mostra todos os campos de uma vez.
import { Botao } from './Botoes';
import { estiloBotao } from './base';
import { Icone } from './Icone';

/** Tamanho dos ícones dos botões redondos do topo (o mesmo dos botões do painel). */
const ICONE_DO_TOPO = 18;

/** O que o cartão passa ao formulário para editar nele: qual registro e o que fazer ao terminar (salvou ou cancelou). */
export interface EdicaoNoCartao {
  id: string;
  aoTerminar: (salvou: boolean) => void;
}

interface PropsAcoes {
  arquivado: boolean;
  aoArquivar: () => unknown;
  aoEditar: () => void;
}

export function AcoesDoCartao({ arquivado, aoArquivar, aoEditar }: PropsAcoes) {
  const arquivar = arquivado ? 'Desarquivar' : 'Arquivar';
  return <span className="cartao-topo-acoes">
    <Botao className="cartao-botao" aria-label={arquivar} title={arquivar} onClick={aoArquivar}><Icone nome="arquivo" tam={ICONE_DO_TOPO} /></Botao>
    <button type="button" className="cartao-botao cartao-editar" aria-label="Editar" title="Editar" onClick={aoEditar}><Icone nome="editar" tam={ICONE_DO_TOPO} /></button>
  </span>;
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
