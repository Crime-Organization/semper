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

// ---------- a volta pela marca do "+ Novo …" ----------
// O "+ Novo …" de uma seção do cartão abre o cadastro com o item de origem no
// endereço (?cliente=, ?demanda=…) e a marca da volta (&volta=cartao). Depois de gravar o item novo, a tela volta a esse cartão,
// onde ele já aparece ligado. Sem a marca (por exemplo, o "Criar o processo?" de quando a demanda é concluída), o cadastro segue
// para o cartão do item novo, como sempre.

/** Cada parâmetro de origem e o começo do endereço do cartão que ele abre. Origem nova = uma entrada nova aqui. */
export const CARTAO_DA_ORIGEM = {
  /** "Novo contrato (ou processo) com esta pessoa como cliente", no cartão da pessoa. */
  cliente: '/pessoas/?id=',
  /** "Novo processo", no cartão da demanda. */
  demanda: '/demandas/?id='
} as const satisfies Record<string, string>;
export type OrigemDoCadastro = keyof typeof CARTAO_DA_ORIGEM;

/** O parâmetro e o valor que só o "+ Novo …" das seções põe no endereço: pedem a volta ao cartão de origem. */
export const MARCA_DA_VOLTA = { nome: 'volta', valor: 'cartao' } as const;

/** O endereço do cadastro aberto pelo "+ Novo …" de uma seção: com a origem e a marca da volta. */
export function cadastroComVolta(cadastro: string, origem: OrigemDoCadastro, id: string): string {
  const busca = new URLSearchParams({ [origem]: id, [MARCA_DA_VOLTA.nome]: MARCA_DA_VOLTA.valor });
  return cadastro + '?' + busca.toString();
}

/**
 * As origens que este cadastro aceita, na ordem em que valem, cada uma com a conferência de que o item gravado ficou mesmo
 * ligado a ela (o cliente continua entre os gravados, a ligação com a demanda deu certo). Um id que não existe, um cliente
 * trocado ou uma ligação que falhou não contam: voltar ali mostraria um cartão sem o item novo.
 */
export type OrigensAceitas = Partial<Record<OrigemDoCadastro, (id: string) => boolean>>;

/**
 * O cartão para onde o cadastro volta depois de gravar: o da primeira origem aceita (na ordem dada) que veio no endereço e
 * ficou ligada ao item. Sem a marca da volta, ou sem nenhuma origem assim, null: o cadastro segue para o cartão do item novo.
 */
export function cartaoDeOrigem(params: { get: (nome: string) => string | null }, aceitas: OrigensAceitas): string | null {
  if (params.get(MARCA_DA_VOLTA.nome) !== MARCA_DA_VOLTA.valor) return null;
  const ligadas = (Object.entries(aceitas) as [OrigemDoCadastro, (id: string) => boolean][])
    .map(([origem, ficouLigada]) => ({ origem, id: params.get(origem), ficouLigada }));
  const achada = ligadas.find(o => o.id && o.ficouLigada(o.id));
  return achada ? CARTAO_DA_ORIGEM[achada.origem] + encodeURIComponent(achada.id!) : null;
}

// ---------- a volta pelo "+" do menu lateral ----------
// O "+" do menu lateral (#404) abre o cadastro por cima da tela onde a pessoa está e leva, no estado da navegação (que não aparece
// no endereço), o endereço dessa tela. Depois de gravar, o cadastro volta para lá, em vez de abrir o módulo do item novo.

/** O que o "+" do menu lateral põe no estado da navegação: o endereço da tela de onde a pessoa saiu. */
export interface EstadoDaVolta { volta: string }

/** O estado da navegação do "+" do menu lateral, com o endereço da tela onde a pessoa está. */
export const estadoDaVolta = (endereco: string): EstadoDaVolta => ({ volta: endereco });

/** O caminho do endereço, sem a busca, o "#" e a barra do fim ("/agenda/novo/?x=1" → "/agenda/novo"). */
const soOCaminho = (endereco: string) => endereco.replace(/[?#].*$/, '').replace(/\/+$/, '');

/**
 * Para onde o cadastro volta depois de gravar, pelo estado da navegação: o endereço que o "+" do menu lateral guardou. Só vale um
 * endereço de dentro do sistema (começa com uma barra só, não "//outro-site"), e não o do próprio cadastro (a pessoa clicou no "+"
 * já dentro dele): voltar ali abriria o formulário de novo. Sem isso, null: o cadastro segue para o cartão do item novo.
 */
export function voltaDoMenu(estado: unknown, cadastro: string): string | null {
  const volta = (estado as Partial<EstadoDaVolta> | null)?.volta;
  if (typeof volta !== 'string' || !/^\/(?!\/)/.test(volta)) return null;
  return soOCaminho(volta) === soOCaminho(cadastro) ? null : volta;
}
