// O "+ Novo…" da seção "Ligada a" da anotação (#376): um menu com um item por módulo ligado no escritório (as pessoas sempre),
// cada um abrindo o cadastro do item com a anotação no endereço (?anotacao=). Ao salvar, o item nasce ligado à anotação e a tela
// volta a ela. O processo fica de fora: ele nasce da distribuição, quase sempre a partir da demanda, e ligar um que já existe basta.
// Se a anotação tem uma pessoa só ligada (e ativa), ela já vem no cadastro como cliente ou pessoa do item novo.
import type { ItemDaAnotacao, ModuloDaAnotacao } from '../dados/tipos';
import { cadastroDePessoaDe, ORIGEM_DA_PESSOA } from './origemDaPessoa';

/** Os módulos que nascem já ligados à anotação. */
export type ModuloDoNovoNaAnotacao = Exclude<ModuloDaAnotacao, 'processos'>;

/** O parâmetro do endereço dos cadastros com o id da anotação de origem (o mesmo do cadastro de pessoa). */
export const PARAMETRO_DA_ANOTACAO_DE_ORIGEM = ORIGEM_DA_PESSOA.anotacoes.parametro;

interface NovoNaAnotacao {
  /** O item do menu. */
  rotulo: string;
  /** O cadastro do módulo. */
  cadastro: string;
  /** O parâmetro do cadastro que traz a pessoa já escolhida (o cliente ou a pessoa ligada); null: o próprio item é a pessoa. */
  pessoa: string | null;
}

/** Cada item do menu, na ordem em que aparece. Módulo novo = uma entrada nova. */
export const NOVO_NA_ANOTACAO: Record<ModuloDoNovoNaAnotacao, NovoNaAnotacao> = {
  tarefas: { rotulo: 'Tarefa', cadastro: '/tarefas/nova/', pessoa: 'pessoa' },
  demandas: { rotulo: 'Demanda', cadastro: '/demandas/nova/', pessoa: 'cliente' },
  compromissos: { rotulo: 'Compromisso', cadastro: '/agenda/novo/', pessoa: 'pessoa' },
  pessoas: { rotulo: 'Pessoa', cadastro: '/pessoas/nova/', pessoa: null },
  contratos: { rotulo: 'Contrato', cadastro: '/contratos/novo/', pessoa: 'cliente' }
};
const MODULOS_DO_NOVO = Object.keys(NOVO_NA_ANOTACAO) as ModuloDoNovoNaAnotacao[];

/** Os itens do menu: os módulos que se podem ligar à anotação (os ligados no escritório e as pessoas), sem o processo. */
export const modulosDoNovo = (ligaveis: readonly ModuloDaAnotacao[]) => MODULOS_DO_NOVO.filter(m => ligaveis.includes(m));

/** A pessoa que vem no cadastro: a única pessoa ligada à anotação, se ela está ativa; com nenhuma ou mais de uma, nada. */
export function pessoaUnica(itens: readonly Pick<ItemDaAnotacao, 'modulo' | 'id' | 'arquivado_em'>[]): string | null {
  const pessoas = itens.filter(i => i.modulo === 'pessoas');
  return pessoas.length === 1 && !pessoas[0].arquivado_em ? pessoas[0].id : null;
}

/** O endereço do cadastro do item novo, já ligado à anotação `anotacaoId` (e com a pessoa única dela, quando há). */
export function cadastroNaAnotacao(modulo: ModuloDoNovoNaAnotacao, anotacaoId: string, itens: readonly Pick<ItemDaAnotacao, 'modulo' | 'id' | 'arquivado_em'>[]) {
  const { cadastro, pessoa } = NOVO_NA_ANOTACAO[modulo];
  if (!pessoa) return cadastroDePessoaDe('anotacoes', anotacaoId);
  const unica = pessoaUnica(itens);
  return `${cadastro}?${new URLSearchParams({ [PARAMETRO_DA_ANOTACAO_DE_ORIGEM]: anotacaoId, ...(unica ? { [pessoa]: unica } : {}) })}`;
}

/** Por que o "+ Novo…" da anotação nova ainda espera: ela só vai ao banco quando a pessoa escreve. */
export const NOVO_ESPERA_A_ANOTACAO = 'Para criar um item já ligado, escreva antes o título ou o texto: a anotação é gravada assim que você escreve.';
