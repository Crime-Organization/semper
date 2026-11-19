// O cadastro aberto pelo "+ Novo …" de um cartão (#376): de que cartão ele veio (o parâmetro do endereço, como ?contrato=), o que o
// cartão de origem já traz preenchido e para onde a tela vai depois de criar. Tudo puro, sem tela nem banco.
import type { Contrato, PessoaResumida, Processo, Tarefa } from '../dados/tipos';
import type { CamposProcesso } from './processo';

/** De onde veio o cadastro: o nome do parâmetro (ex.: "contrato") e o id do item. */
export interface Origem<T extends string> { tipo: T; id: string }

/** A origem que veio no endereço: o primeiro dos parâmetros indicados que veio preenchido (com dois, vale a ordem da lista). */
export function origemNoEndereco<T extends string>(params: Pick<URLSearchParams, 'get'>, nomes: readonly T[]): Origem<T> | null {
  for (const tipo of nomes) {
    const id = params.get(tipo);
    if (id) return { tipo, id };
  }
  return null;
}

/** As pessoas da origem nas linhas do cadastro; sem nenhuma, fica a linha vazia, para escolher. */
export const linhasDasPessoas = (lista: Pick<PessoaResumida, 'id'>[]) => lista.length ? lista.map(p => p.id) : [''];

/** O processo que nasce do contrato: os clientes e o responsável dele. Responsável fora da equipe ativa: fica quem está cadastrando. */
export const processoDoContrato = (k: Pick<Contrato, 'responsavel_id'> & { clientes: Pick<PessoaResumida, 'id'>[] }, ativos: string[], eu: string): Pick<CamposProcesso, 'responsavelId' | 'clientes'> =>
  ({ responsavelId: ativos.includes(k.responsavel_id) ? k.responsavel_id : eu, clientes: linhasDasPessoas(k.clientes) });

/** O processo que nasce da tarefa: as pessoas dela viram os clientes. */
export const processoDaTarefa = (t: Pick<Tarefa, 'pessoas'>): Pick<CamposProcesso, 'clientes'> => ({ clientes: linhasDasPessoas(t.pessoas) });

/**
 * A tarefa que nasce do processo: já ligada a ele e com os clientes dele como pessoas, a não ser que o endereço também traga as
 * pessoas por outro parâmetro (?pessoa=, ?demanda=, ?contrato=): aí ficam as de lá. A decisão é pelo endereço, e não pelas pessoas
 * já escolhidas na tela, porque as leituras podem responder antes de a tela ser desenhada de novo.
 */
export const tarefaDoProcesso = (p: Pick<Processo, 'id' | 'clientes'>, pessoasDeOutroParametro: boolean): { processoId: string; pessoas?: string[] } =>
  pessoasDeOutroParametro ? { processoId: p.id } : { processoId: p.id, pessoas: linhasDasPessoas(p.clientes) };

/** Por que a origem não aceita mais o item novo ligado a ela, na ordem em que se confere: arquivada, ou já com o seu único ligado. */
export const RECUSAS_DA_ORIGEM = ['arquivada', 'ocupada'] as const;
export type RecusaDaOrigem = typeof RECUSAS_DA_ORIGEM[number];
/**
 * A recusa da origem ao abrir o cadastro (null: ela aceita o item novo ligado). Acontece quando o endereço ficou velho: a pessoa voltou
 * pelo navegador depois de criar (a tarefa já ganhou o processo) ou o cartão de onde veio estava desatualizado (o item foi arquivado).
 * Com a recusa, o cadastro diz isso antes de gravar e cria o item sem a ligação, que falharia depois de gravado.
 */
export const recusaDaOrigem = (estado: Partial<Record<RecusaDaOrigem, boolean>>): RecusaDaOrigem | null => RECUSAS_DA_ORIGEM.find(r => estado[r]) ?? null;

/**
 * Para onde a tela vai depois de criar: de volta ao cartão de origem, se o item novo ficou ligado a ele (o item aparece na seção, com o
 * contador atualizado); senão (sem origem, ou a pessoa tirou a ligação no cadastro), o cartão do item novo.
 */
export const depoisDeCriar = (cartaoDeOrigem: string | null, ficouLigado: boolean, cartaoDoNovo: string) =>
  cartaoDeOrigem && ficouLigado ? cartaoDeOrigem : cartaoDoNovo;
