// O item que nasce no cartão de outro (#376): o "+ Novo …" de uma seção abre o cadastro com a origem no endereço (?tarefa=,
// ?demanda=, ?processo=, ?anotacao=), o cadastro herda dela o que puder (clientes, contrato, processo) e, ao salvar, liga o item novo
// à origem e volta ao cartão de onde a pessoa partiu. Aqui, o que o cadastro herda, os textos dos avisos e para onde se volta; as
// gravações ficam nas telas.
import { CLIENTES_MAXIMOS, ITENS_DA_ANOTACAO } from '../dados/limites';
import type { TipoProcesso } from '../dados/tipos';
import { enderecoDoCartao } from './buscaGeral';
import { motivoDeContratoDiferente, RecusaDaLigacao } from './ligarExistente';
import { enderecoDoProcesso } from './painelProcessos';
import { cartaoDeOrigem } from './origemDaPessoa';
import { nomeDoProcesso } from './processo';

/** Os clientes que o item novo herda da origem: na ordem dela, sem repetir e até o máximo que o cadastro aceita. */
export function clientesDaOrigem<P extends { id: string }>(pessoas: readonly P[]): P[] {
  const vistos = new Set<string>();
  return pessoas.filter(p => {
    if (vistos.has(p.id)) return false;
    vistos.add(p.id);
    return true;
  }).slice(0, CLIENTES_MAXIMOS);
}

// ---------- a origem ----------
/** O item que nasce e o cartão de onde ele nasce. Cada origem nova é uma entrada nova em TEXTOS_DA_ORIGEM. */
export type Nascimento = 'demanda da tarefa' | 'demanda do processo' | 'contrato da demanda' | 'contrato do processo' | `${QueNasceNaAnotacao} da anotação`;
/** O que nasce já ligado à anotação, pelo "+ Novo…" da seção "Ligada a" (a pessoa nova tem o cadastro dela: regras/origemDaPessoa.ts). */
export type QueNasceNaAnotacao = 'tarefa' | 'demanda' | 'compromisso' | 'contrato';
/**
 * A origem como o cadastro a usa: o aviso do topo e o cartão para onde volta. Arquivada, ela não passa nada nem é ligada. Cheia (a
 * anotação já ligada a ITENS_DA_ANOTACAO itens, o máximo do banco), ela também não é ligada.
 */
export interface OrigemDoItem { nascimento: Nascimento; id: string; codigo: string; nome: string; cartao: string; arquivada: boolean; cheia?: boolean }
/** Um texto em volta do código e do nome da origem: "<antes> <b>código</b> (nome)<depois>". */
export type TextoEmVolta = readonly [antes: string, depois: string];
/** Por que a origem não aceita o item novo, na ordem em que se confere; sem nenhuma, ele nasce ligado a ela. */
const RECUSAS = ['arquivada', 'cheia'] as const;
type EstadoDaOrigem = typeof RECUSAS[number] | 'nasce';
type TextosDaOrigem = Record<'nasce' | 'arquivada', TextoEmVolta> & Partial<Record<'cheia', TextoEmVolta>>;
/** Os textos do item que nasce de uma anotação: "Esta tarefa", "a tarefa nova" e como ele fica ("ligada"). */
const daAnotacao = (este: string, oNovo: string, comoFica: string): TextosDaOrigem => ({
  nasce: [`${este} nasce da anotação`, ` e fica ${comoFica} a ela.`],
  arquivada: ['A anotação', ` está arquivada: ${oNovo} não fica ${comoFica} a ela.`],
  cheia: ['A anotação', ` já está ligada a ${ITENS_DA_ANOTACAO} itens, o máximo: ${oNovo} não fica ${comoFica} a ela.`]
});
const TEXTOS_DA_ORIGEM: Record<Nascimento, TextosDaOrigem> = {
  'demanda da tarefa': { nasce: ['Esta demanda nasce da tarefa', ', que fica ligada a ela.'],
    arquivada: ['A tarefa', ' está arquivada: a demanda nova não leva nada dela nem fica ligada a ela.'] },
  'demanda do processo': { nasce: ['Esta demanda nasce do processo', ' e fica ligada a ele.'],
    arquivada: ['O processo', ' está arquivado: a demanda nova não leva nada dele nem fica ligada a ele.'] },
  'contrato da demanda': { nasce: ['Este contrato nasce da demanda', ', que fica ligada a ele.'],
    arquivada: ['A demanda', ' está arquivada: o contrato novo não leva nada dela nem fica ligado a ela.'] },
  'contrato do processo': { nasce: ['Este contrato nasce do processo', ' e fica ligado a ele.'],
    arquivada: ['O processo', ' está arquivado: o contrato novo não leva nada dele nem fica ligado a ele.'] },
  'tarefa da anotação': daAnotacao('Esta tarefa', 'a tarefa nova', 'ligada'),
  'demanda da anotação': daAnotacao('Esta demanda', 'a demanda nova', 'ligada'),
  'compromisso da anotação': daAnotacao('Este compromisso', 'o compromisso novo', 'ligado'),
  'contrato da anotação': daAnotacao('Este contrato', 'o contrato novo', 'ligado')
};
const estadoDaOrigem = (o: OrigemDoItem): EstadoDaOrigem => RECUSAS.find(r => o[r]) ?? 'nasce';
/** A origem não aceita o item novo (arquivada ou cheia): o aviso do topo diz isso, e o item nasce sem a ligação. */
export const origemRecusada = (o: OrigemDoItem) => estadoDaOrigem(o) !== 'nasce';
/** O aviso do topo do cadastro: de onde o item nasce ou, com a origem arquivada (ou cheia), que ela não vale. */
export const textoDaOrigem = (o: OrigemDoItem): TextoEmVolta => {
  const textos = TEXTOS_DA_ORIGEM[o.nascimento];
  return textos[estadoDaOrigem(o)] ?? textos.nasce;
};

type Arquivavel = { id: string; codigo: string; arquivado_em: string | null };
/** A tarefa como origem da demanda nova. */
export const origemDaTarefa = (t: Arquivavel & { titulo: string }): OrigemDoItem => ({
  nascimento: 'demanda da tarefa', id: t.id, codigo: t.codigo, nome: t.titulo, cartao: enderecoDoCartao('tarefas', t.id), arquivada: !!t.arquivado_em
});
/** A demanda como origem do contrato novo. */
export const origemDaDemanda = (d: Arquivavel & { titulo: string }): OrigemDoItem => ({
  nascimento: 'contrato da demanda', id: d.id, codigo: d.codigo, nome: d.titulo, cartao: enderecoDoCartao('demandas', d.id), arquivada: !!d.arquivado_em
});
/** O processo como origem da demanda ou do contrato novo. */
export const origemDoProcesso = (
  p: Arquivavel & { tipo: TipoProcesso; numero: string; titulo: string | null; cliente_nome: string }, nasce: 'demanda' | 'contrato'
): OrigemDoItem => ({
  nascimento: `${nasce} do processo`, id: p.id, codigo: p.codigo, nome: nomeDoProcesso(p), cartao: enderecoDoProcesso(p), arquivada: !!p.arquivado_em
});

/**
 * A anotação como origem da tarefa, da demanda, do compromisso ou do contrato novo. `itens`: a quantos itens ela já está ligada
 * (os que a pessoa vê e os que não vê), para saber se ela ainda aceita mais um.
 */
export const origemDaAnotacao = (a: Arquivavel & { titulo: string }, itens: number, nasce: QueNasceNaAnotacao): OrigemDoItem => ({
  nascimento: `${nasce} da anotação`, id: a.id, codigo: a.codigo, nome: a.titulo, cartao: cartaoDeOrigem({ modulo: 'anotacoes', id: a.id }),
  arquivada: !!a.arquivado_em, cheia: itens >= ITENS_DA_ANOTACAO
});

/**
 * Ao salvar: se o item novo é ligado à origem e para onde a tela vai. Liga com a origem ativa (e não cheia) e sem `semLigar` (o motivo, já
 * mostrado no cadastro, de a ligação ser recusada); aí volta ao cartão de origem, onde o item aparece. Senão, abre o cartão do
 * item novo (`doCriado`), já que no da origem ele não estaria.
 */
export function aoSalvarPelaOrigem(origem: OrigemDoItem | null, semLigar: string, doCriado: string) {
  const liga = !!origem && !origemRecusada(origem) && !semLigar;
  return { liga, volta: origem && liga ? origem.cartao : doCriado };
}

// ---------- o que impediria a ligação, avisado antes de salvar ----------
/** A demanda que nasce de uma tarefa com contrato e ganha outro contrato: a tarefa não pode ficar nela (#283, um contrato só). */
export const CONTRATO_FORA_DA_TAREFA = 'A tarefa de origem é de outro contrato. Com este, ela não fica ligada à demanda nova.';
/** Por que a tarefa de origem não ficaria na demanda nova ('' = fica): a demanda escolheu um contrato diferente do da tarefa. */
export const motivoDoContratoDaTarefa = (contratoDaTarefa: string | null | undefined, escolhido: string) =>
  motivoDeContratoDiferente(contratoDaTarefa, escolhido || null, CONTRATO_FORA_DA_TAREFA);

/** Uma tarefa da demanda de origem já é de um contrato: ligar a demanda ao contrato novo deixaria a tarefa em dois (#283). */
export const TAREFA_DA_DEMANDA_EM_CONTRATO = 'Uma tarefa desta demanda já é de outro contrato. Por isso, a demanda não fica ligada ao contrato novo.';
/** Por que a demanda de origem não ficaria no contrato novo ('' = fica): o contrato ainda não existe, e qualquer contrato numa tarefa dela já é outro. */
export const motivoDasTarefasParaOContratoNovo = (contratosDasTarefas: readonly (string | null)[]) =>
  contratosDasTarefas.some(Boolean) ? TAREFA_DA_DEMANDA_EM_CONTRATO : '';

/**
 * Enquanto o banco não sabe que a demanda de origem já cuida de um dos objetos, o contrato assinado ainda cria uma demanda por
 * objeto, além dela (privado.demandas_do_contrato). O cadastro avisa, para a pessoa conferir a repetida.
 */
export const OBJETOS_AINDA_VIRAM_DEMANDAS = 'Quando este contrato for assinado, cada objeto dele ainda vira uma demanda nova, além desta. '
  + 'Se uma delas repetir o trabalho desta demanda, arquive a repetida.';

// ---------- a ligação que falhou depois de gravar ----------
/** O que nasce de cada origem e o que se liga a ela, nos textos dos avisos. */
export type LigacaoDaOrigem = 'tarefa na demanda' | 'demanda no contrato' | 'processo no contrato' | 'processo na demanda' | `anotação: ${QueNasceNaAnotacao}`;
const TEXTO_DA_LIGACAO: Record<LigacaoDaOrigem, (codigo: string) => string> = {
  'tarefa na demanda': codigo => `Não foi possível ligar a tarefa ${codigo} à demanda nova`,
  'demanda no contrato': codigo => `Não foi possível ligar a demanda ${codigo} ao contrato novo`,
  'processo no contrato': codigo => `Não foi possível ligar o processo ${codigo} ao contrato novo`,
  'processo na demanda': codigo => `Não foi possível ligar o processo ${codigo} à demanda nova`,
  'anotação: tarefa': codigo => `Não foi possível ligar a anotação ${codigo} à tarefa nova`,
  'anotação: demanda': codigo => `Não foi possível ligar a anotação ${codigo} à demanda nova`,
  'anotação: compromisso': codigo => `Não foi possível ligar a anotação ${codigo} ao compromisso novo`,
  'anotação: contrato': codigo => `Não foi possível ligar a anotação ${codigo} ao contrato novo`
};
/**
 * O aviso de quando o item novo já foi gravado, mas a ligação com a origem falhou: o item continua (salvar de novo o duplicaria),
 * e a pessoa fica sabendo qual ligação faltou e por quê. Só a falha que pode passar (a rede, o banco) sugere ligar pelo cartão: a
 * recusa de uma regra (RecusaDaLigacao) daria a mesma recusa lá.
 */
export function avisoDaLigacaoQueFalhou(ligacao: LigacaoDaOrigem, codigo: string, erro: unknown) {
  const motivo = (erro as Error | undefined)?.message?.trim();
  const depois = erro instanceof RecusaDaLigacao ? '' : ' Ligue pelo cartão.';
  return TEXTO_DA_LIGACAO[ligacao](codigo) + (motivo ? `: ${motivo.replace(/\.$/, '')}.` : '.') + depois;
}
