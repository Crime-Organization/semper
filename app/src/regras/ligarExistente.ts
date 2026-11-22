// Ligar, no cartão de um item, outro que já existe (#341, etapa 2): as regras das ligações, puras. A tela lê a lista (ou a ligação)
// gravada no item logo antes de gravar, para não apagar o que outra pessoa acabou de pôr; estas regras dizem o que gravar, o que o
// Desfazer volta e por que um achado da busca não pode ser escolhido.
import { CLIENTES_MAXIMOS } from '../dados/limites';
import type { DadosTarefa } from '../dados/tipos';

/**
 * A ligação que uma regra recusa (o item já tem outro, a lista está cheia, os contratos são diferentes, o item sumiu): a mensagem
 * diz o motivo. Diferente de uma falha de rede ou do banco, tentar de novo, no cadastro ou no cartão, dá a mesma recusa.
 */
export class RecusaDaLigacao extends Error {}

// ---------- listas de pessoas (os clientes da demanda e do processo, as pessoas da tarefa e do compromisso) ----------
/** O que pôr uma pessoa na lista dá: a lista nova, ou por que não se grava (ela já estava; a lista está cheia). */
export type Acrescimo = { lista: string[] } | { recusa: 'ja' | 'cheia' };
/** Põe o id no fim da lista, sem repetir e até `maximo` (o mesmo limite do banco para todas essas listas). */
export function acrescentar(lista: readonly string[], id: string, maximo = CLIENTES_MAXIMOS): Acrescimo {
  if (lista.includes(id)) return { recusa: 'ja' };
  if (lista.length >= maximo) return { recusa: 'cheia' };
  return { lista: [...lista, id] };
}
/** A lista sem o id: o Desfazer tira só a pessoa que a ligação pôs, e fica o que outra pessoa pôs depois. */
export const semOId = (lista: readonly string[], id: string) => lista.filter(x => x !== id);
/** A recusa quando a lista encheu entre a busca e o clique. */
export const LISTA_CHEIA = `Esta lista já tem ${CLIENTES_MAXIMOS} pessoas, o máximo.`;
/** Por que o item achado não aceita mais uma pessoa ('' = aceita): `quem` diz o que a lista guarda ("clientes", "pessoas ligadas"). */
export const motivoDaListaCheia = (lista: readonly string[], quem: string, maximo = CLIENTES_MAXIMOS) =>
  lista.length >= maximo ? `Já tem ${maximo} ${quem}, o máximo.` : '';

// ---------- ligações de um só (a demanda e o contrato da tarefa, o contrato da demanda, o processo do compromisso...) ----------
/** O que ligar dá: gravar; não gravar (já estava ligado a este); ou recusar (já tem outro, e trocar o tiraria de lá). */
export type LigacaoDeUm = 'gravar' | 'ja' | 'outro';
export const ligacaoDeUm = (atual: string | null | undefined, novo: string): LigacaoDeUm => atual === novo ? 'ja' : atual ? 'outro' : 'gravar';

/**
 * O que o Desfazer grava de volta nos campos de um só: cada campo que ainda tem o valor que a ligação gravou volta ao de `antes`;
 * o que outra pessoa mudou depois fica como ela deixou (e fica fora do resultado).
 */
export function voltarOQueAindaE<T extends object>(atual: T, gravado: Partial<T>, antes: Partial<T>): Partial<T> {
  const volta: Partial<T> = {};
  for (const campo of Object.keys(gravado) as (keyof T)[]) if (atual[campo] === gravado[campo]) volta[campo] = antes[campo];
  return volta;
}

// ---------- a tarefa e a demanda ----------
/** A demanda que a tarefa recebe: os clientes e o contrato dela. */
type DemandaQueRecebe = { id: string; clientes: readonly string[]; contrato_id: string | null };
/**
 * A tarefa nova que já nasce na demanda (a cópia para outra demanda, #312): os clientes da demanda entram como pessoas da tarefa que
 * ainda não tem nenhuma, e o contrato da demanda, na tarefa que ainda não tem contrato.
 */
export function tarefaNaDemanda(t: { pessoas: readonly string[]; contrato_id: string | null }, d: DemandaQueRecebe): DadosTarefa {
  const dados: DadosTarefa = { demanda_id: d.id };
  if (!t.pessoas.length && d.clientes.length) dados.pessoas = [...d.clientes];
  if (!t.contrato_id && d.contrato_id) dados.contrato_id = d.contrato_id;
  return dados;
}
/** A tarefa como está gravada, no que ligar mais uma demanda mexe (#283: as listas de demandas e de contratos). */
export interface TarefaParaADemanda { demanda_ids: readonly string[]; pessoas: readonly string[]; contrato_ids: readonly string[] }
/** O que ligar a tarefa a mais uma demanda gravou: os dados e o que entrou por ela (para o Desfazer tirar só isso). */
export interface TarefaEmMaisUmaDemanda { dados: DadosTarefa; demandaId: string; contratoId: string | null; pessoas: string[] }
/**
 * Ligar a tarefa a mais uma demanda (#283), como o cadastro de tarefa faz ao acrescentar a demanda: ela entra no fim da lista; os
 * clientes dela entram como pessoas da tarefa que ainda não tem nenhuma; o contrato dela entra nos contratos da tarefa, se ainda não
 * está lá (e a lista não está cheia). `recusa`: a tarefa já está nela ('ja') ou já tem o máximo de demandas ('cheia').
 */
export function tarefaEmMaisUmaDemanda(t: TarefaParaADemanda, d: DemandaQueRecebe, maximos: { demandas: number; contratos: number }):
  TarefaEmMaisUmaDemanda | { recusa: 'ja' | 'cheia' } {
  const demandas = acrescentar(t.demanda_ids, d.id, maximos.demandas);
  if ('recusa' in demandas) return demandas;
  const dados: DadosTarefa = { demanda_ids: demandas.lista };
  const pessoas = !t.pessoas.length && d.clientes.length ? [...d.clientes] : [];
  if (pessoas.length) dados.pessoas = pessoas;
  const contratos = d.contrato_id ? acrescentar(t.contrato_ids, d.contrato_id, maximos.contratos) : null;
  if (contratos && 'lista' in contratos) dados.contrato_ids = contratos.lista;
  return { dados, demandaId: d.id, contratoId: dados.contrato_ids ? d.contrato_id : null, pessoas };
}
/**
 * O que o Desfazer de tarefaEmMaisUmaDemanda grava, com a tarefa lida de novo (`atual`): null se a tarefa já não está nesta demanda
 * (outra pessoa a tirou; nada a voltar). Senão, ela sai só desta demanda e perde só as pessoas e o contrato que a ligação pôs: as
 * outras demandas, quem outra pessoa pôs depois e o contrato tirado depois ficam como estão.
 */
export function desfazerTarefaEmMaisUmaDemanda(atual: TarefaParaADemanda, feito: TarefaEmMaisUmaDemanda): DadosTarefa | null {
  if (!atual.demanda_ids.includes(feito.demandaId)) return null;
  const volta: DadosTarefa = { demanda_ids: semOId(atual.demanda_ids, feito.demandaId) };
  if (feito.contratoId && atual.contrato_ids.includes(feito.contratoId)) volta.contrato_ids = semOId(atual.contrato_ids, feito.contratoId);
  const ficam = atual.pessoas.filter(p => !feito.pessoas.includes(p));
  if (ficam.length !== atual.pessoas.length) volta.pessoas = ficam;
  return volta;
}
/** A tarefa é de um contrato e a demanda, de outro (o padrão de motivoDeContratoDiferente). */
export const CONTRATOS_DIFERENTES = 'A tarefa e a demanda são de contratos diferentes.';
/** O contrato escolhido não é o da demanda da tarefa. */
export const DEMANDA_DE_OUTRO_CONTRATO = 'A demanda desta tarefa é de outro contrato.';
/** Uma tarefa da demanda é de outro contrato: ligar a demanda a este deixaria a tarefa em dois contratos. */
export const TAREFA_DE_OUTRO_CONTRATO = 'Uma tarefa desta demanda é de outro contrato.';
/** Por que não ligar ('' = pode): os dois têm contrato, e não é o mesmo. `motivo` é o texto da recusa. */
export const motivoDeContratoDiferente = (um: string | null | undefined, outro: string | null | undefined, motivo = CONTRATOS_DIFERENTES) =>
  um && outro && um !== outro ? motivo : '';
/** Por que não ligar a demanda ao contrato ('' = pode): alguma tarefa dela já é de outro contrato. */
export const motivoDasTarefasDaDemanda = (contratosDasTarefas: readonly (string | null)[], contrato: string) =>
  contratosDasTarefas.some(c => motivoDeContratoDiferente(c, contrato)) ? TAREFA_DE_OUTRO_CONTRATO : '';

// ---------- o prazo do processo e a tarefa que o cumpre ----------
/** A tarefa como está gravada, no que ligar ao prazo mexe. */
export type TarefaParaOPrazo = Pick<DadosTarefa, 'processo_id' | 'prazo'>;
/** A recusa quando a tarefa já é de outro processo (ligá-la a este prazo a tiraria de lá). */
export const TAREFA_DE_OUTRO_PROCESSO = 'Esta tarefa já está ligada a outro processo.';
/**
 * O que gravar na tarefa ao ligá-la ao prazo, como o "Criar tarefa" faz: o processo, se ela não tem; e o prazo dela passa a ser o
 * último dia do prazo processual (o mesmo que acontece quando ele muda depois). `recusa` quando a tarefa é de outro processo.
 */
export function tarefaNoPrazo(t: TarefaParaOPrazo, processoId: string, final: string): { dados: DadosTarefa } | { recusa: string } {
  const processo = ligacaoDeUm(t.processo_id, processoId);
  if (processo === 'outro') return { recusa: TAREFA_DE_OUTRO_PROCESSO };
  const dados: DadosTarefa = {};
  if (processo === 'gravar') dados.processo_id = processoId;
  if (t.prazo !== final) dados.prazo = final;
  return { dados };
}

// ---------- os textos de pôr uma pessoa num item ----------
/** Os itens que guardam uma lista de pessoas do cadastro (até CLIENTES_MAXIMOS). */
export type ItemComPessoas = 'demandas' | 'processos' | 'tarefas' | 'compromissos';
/** O que a tela diz ao pôr uma pessoa na lista de cada item: no cartão da pessoa e no cartão do item. */
export interface TextosDaPessoaNoItem {
  /** O que a lista guarda, no motivo da lista cheia ("Já tem 10 clientes, o máximo."). */
  quem: string;
  /** O botão no cartão do item. */
  rotulo: string;
  /** O aviso no cartão da pessoa, com o nome do item, e no cartão do item, com o nome da pessoa. */
  noCartaoDaPessoa: (item: string) => string;
  noCartaoDoItem: (pessoa: string) => string;
  /** Quando ela já estava na lista (outra pessoa a pôs enquanto a busca estava aberta). */
  ja: string;
  /** No cartão do item com a lista cheia. */
  cheio: string;
}
export const PESSOA_NO_ITEM: Record<ItemComPessoas, TextosDaPessoaNoItem> = {
  demandas: { quem: 'clientes', rotulo: 'Ligar cliente existente', noCartaoDaPessoa: d => `Pessoa ligada como cliente da demanda ${d}.`, noCartaoDoItem: p => `Cliente ligado: ${p}.`,
    ja: 'Esta pessoa já é cliente desta demanda.', cheio: `Esta demanda já tem ${CLIENTES_MAXIMOS} clientes, o máximo.` },
  processos: { quem: 'clientes', rotulo: 'Ligar cliente existente', noCartaoDaPessoa: p => `Pessoa ligada como cliente do processo ${p}.`, noCartaoDoItem: p => `Cliente ligado: ${p}.`,
    ja: 'Esta pessoa já é cliente deste processo.', cheio: `Este processo já tem ${CLIENTES_MAXIMOS} clientes, o máximo.` },
  tarefas: { quem: 'pessoas ligadas', rotulo: 'Ligar pessoa existente', noCartaoDaPessoa: t => `Pessoa ligada à tarefa ${t}.`, noCartaoDoItem: p => `Pessoa ligada: ${p}.`,
    ja: 'Esta pessoa já está ligada a esta tarefa.', cheio: `Esta tarefa já tem ${CLIENTES_MAXIMOS} pessoas ligadas, o máximo.` },
  compromissos: { quem: 'pessoas ligadas', rotulo: 'Ligar pessoa existente', noCartaoDaPessoa: c => `Pessoa ligada ao compromisso ${c}.`, noCartaoDoItem: p => `Pessoa ligada: ${p}.`,
    ja: 'Esta pessoa já está ligada a este compromisso.', cheio: `Este compromisso já tem ${CLIENTES_MAXIMOS} pessoas ligadas, o máximo.` }
};
/** No cartão do item: por que não se pode pôr mais uma pessoa (undefined = pode). */
export const listaDoItemCheia = (modulo: ItemComPessoas, ligadas: readonly unknown[]) => ligadas.length >= CLIENTES_MAXIMOS ? PESSOA_NO_ITEM[modulo].cheio : undefined;
