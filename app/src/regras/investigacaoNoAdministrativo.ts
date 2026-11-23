// Extrajudicial e Investigação saem dos tipos de processo (#406, decisão do dono): a investigação é um processo administrativo, e o
// que é extrajudicial é demanda. O quadro administrativo ganha as colunas da investigação, cada uma na sua fase, e os processos dos
// dois tipos viram administrativos. As mesmas regras estão na migração investigacao_no_processo_administrativo (as funções
// privado.grupo_da_fase, privado.acrescentar_colunas_no_grupo e privado.coluna_administrativa_equivalente): mudou aqui, muda lá.
// Sem tela nem banco: recebe as colunas e os grupos dos quadros e devolve o que muda.
import type { MarcoColuna, Modulo } from '../dados/tipos';
import { TAMANHO_PROCESSO } from '../dados/limites';
import { chaveDaColuna, ordensEntre } from './colunasPadrao';
import { filaDoTopo } from './quadro';

/** Os tipos que saíram, com o nome (para o número que repetiria) e o quadro de cada um, que fica no banco até ser apagado. */
export type TipoQueSaiu = 'extrajudicial' | 'investigacao';
export const TIPOS_QUE_SAIRAM: Record<TipoQueSaiu, { nome: string; quadro: Modulo }> = {
  extrajudicial: { nome: 'extrajudicial', quadro: 'processos_extrajudiciais' },
  investigacao: { nome: 'investigação', quadro: 'processos_investigacoes' }
};
const QUADROS_QUE_SAIRAM = new Set<Modulo>(Object.values(TIPOS_QUE_SAIRAM).map(t => t.quadro));
/** O tipo para onde vão os que saíram. */
export const TIPO_QUE_FICA = 'administrativo';
export const QUADRO_ADMINISTRATIVO: Modulo = 'processos_administrativos';

export const ehTipoQueSaiu = (tipo: string): tipo is TipoQueSaiu => Object.hasOwn(TIPOS_QUE_SAIRAM, tipo);
/** O tipo que vale hoje (o do processo ou o "aparece em" do campo próprio): os que saíram viram administrativo; os outros ficam. */
export const tipoQueFica = <T extends string>(tipo: T | TipoQueSaiu): T | typeof TIPO_QUE_FICA => ehTipoQueSaiu(tipo) ? TIPO_QUE_FICA : tipo;

/** A fase do quadro em que cada grupo de colunas novas entra. */
export type FaseDaInvestigacao = 'inicio' | 'meio';
/** As colunas da investigação, com o grupo (e a fase) do quadro administrativo em que entram, na ordem. "Arquivado" não entra: é a coluna das concluídas. */
export const COLUNAS_DA_INVESTIGACAO: { grupo: string; fase: FaseDaInvestigacao; colunas: string[] }[] = [
  { grupo: 'Protocolo', fase: 'inicio', colunas: ['Instaurado', 'Pedido de acesso aos autos'] },
  { grupo: 'Exigências e manifestações', fase: 'meio', colunas: ['Oitiva ou depoimento', 'Perícia', 'Diligências pendentes', 'Manifestação da defesa'] },
  { grupo: 'Análise', fase: 'meio', colunas: ['Relatório final'] },
  { grupo: 'Decisão', fase: 'meio', colunas: ['Denúncia oferecida', 'Pedido de arquivamento'] }
];
/** O grupo do início do quadro administrativo. */
const GRUPO_DO_INICIO = 'Protocolo';
/** O grupo do meio do quadro administrativo que corresponde a cada grupo do meio dos quadros que saíram, pela chave do nome. */
export const GRUPOS_CORRESPONDENTES: Record<string, string> = {
  andamento: 'Exigências e manifestações', diligencias: 'Exigências e manifestações', conclusao: 'Decisão'
};
/** O grupo do meio de quem não tem correspondente. */
const GRUPO_DO_MEIO = 'Exigências e manifestações';

export type ColunaDoQuadro = { id: string; nome: string; ordem: number; grupo_id?: string | null; marco?: MarcoColuna | null };
export type GrupoDoQuadro = { id: string; nome: string; ordem: number };

/** Em ordem, como o banco (ordem e, no empate, o id). */
const porOrdem = <T extends { id: string; ordem: number }>(lista: readonly T[]) =>
  [...lista].sort((a, b) => a.ordem - b.ordem || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
/** O lugar da coluna das concluídas no alto do quadro: o do grupo dela ou, sem grupo, o dela. */
function lugarDasConcluidas(colunas: readonly ColunaDoQuadro[], grupos: readonly GrupoDoQuadro[]) {
  const fim = colunas.find(c => c.marco === 'concluido');
  return fim && (grupos.find(g => g.id === fim.grupo_id)?.ordem ?? fim.ordem);
}

/** Sem grupo de mesmo nome: no início, o grupo da coluna do início; no meio, o último grupo antes do grupo da coluna das concluídas. */
const GRUPO_SEM_O_NOME: Record<FaseDaInvestigacao, (colunas: readonly ColunaDoQuadro[], grupos: readonly GrupoDoQuadro[]) => GrupoDoQuadro | undefined> = {
  inicio: (colunas, grupos) => grupos.find(g => g.id === colunas.find(c => c.marco === 'inicio')?.grupo_id),
  meio: (colunas, grupos) => {
    const alvo = lugarDasConcluidas(colunas, grupos);
    return porOrdem(grupos).filter(g => alvo === undefined || g.ordem < alvo).at(-1);
  }
};
/** O grupo de uma fase num quadro: o de mesmo nome (o de menor ordem) ou, sem ele, o da fase. null: as colunas ficam sem grupo. */
export function grupoDaFase(colunas: readonly ColunaDoQuadro[], grupos: readonly GrupoDoQuadro[], nome: string, fase: FaseDaInvestigacao): string | null {
  const chave = chaveDaColuna(nome);
  return (porOrdem(grupos).find(g => chaveDaColuna(g.nome) === chave) ?? GRUPO_SEM_O_NOME[fase](colunas, grupos))?.id ?? null;
}

/**
 * As colunas que faltam (pelo nome, sem maiúsculas, acentos, espaços e sinais), com a ordem de cada uma. Num grupo, no fim dele: entre
 * a última coluna dele e a coluna seguinte do quadro, para a ordem geral também ficar certa. Sem grupo, no alto do quadro: logo
 * depois da coluna do início (fase do início, se ela está sem grupo) ou logo antes da coluna das concluídas (ou do grupo dela).
 */
export function colunasNoGrupo(colunas: readonly ColunaDoQuadro[], grupos: readonly GrupoDoQuadro[], nomes: string[], grupoId: string | null,
  fase: FaseDaInvestigacao): { nome: string; ordem: number }[] {
  const faltam = nomes.filter(n => !colunas.some(c => chaveDaColuna(c.nome) === chaveDaColuna(n)));
  if (!faltam.length) return [];
  const [anterior, seguinte] = grupoId ? vizinhosNoGrupo(colunas, grupoId) : vizinhosNoTopo(colunas, grupos, fase);
  const ordens = ordensEntre(anterior, seguinte, faltam.length);
  return faltam.map((nome, i) => ({ nome, ordem: ordens[i] }));
}
const maior = (ordens: number[]) => (ordens.length ? Math.max(...ordens) : undefined);
const menor = (ordens: number[]) => (ordens.length ? Math.min(...ordens) : undefined);
function vizinhosNoGrupo(colunas: readonly ColunaDoQuadro[], grupoId: string): [number | undefined, number | undefined] {
  const anterior = maior(colunas.filter(c => c.grupo_id === grupoId).map(c => c.ordem));
  return [anterior, anterior === undefined ? undefined : menor(colunas.map(c => c.ordem).filter(o => o > anterior))];
}
function vizinhosNoTopo(colunas: readonly ColunaDoQuadro[], grupos: readonly GrupoDoQuadro[], fase: FaseDaInvestigacao): [number | undefined, number | undefined] {
  const topo = filaDoTopo([...colunas], [...grupos]).map(x => x.ordem);
  const existe = new Set(grupos.map(g => g.id));
  const inicio = colunas.find(c => c.marco === 'inicio' && !(c.grupo_id && existe.has(c.grupo_id)));
  if (fase === 'inicio' && inicio) return [inicio.ordem, menor(topo.filter(o => o > inicio.ordem))];
  const alvo = lugarDasConcluidas(colunas, grupos);
  return [maior(topo.filter(o => alvo === undefined || o < alvo)), alvo];
}

/**
 * As colunas da investigação que o quadro administrativo ganha, fase por fase (cada fase já conta as que a anterior pôs). Um quadro
 * sem nenhuma coluna fica como está (o preparo do escritório é que o monta).
 */
export function colunasDaInvestigacaoNoQuadro(colunas: readonly ColunaDoQuadro[], grupos: readonly GrupoDoQuadro[]) {
  const novas: { nome: string; ordem: number; grupo_id: string | null }[] = [];
  if (!colunas.length) return novas;
  for (const { grupo, fase, colunas: nomes } of COLUNAS_DA_INVESTIGACAO) {
    const todas = [...colunas, ...novas.map((n, i) => ({ ...n, id: `nova-${i}`, marco: null }))];
    const grupoId = grupoDaFase(todas, grupos, grupo, fase);
    novas.push(...colunasNoGrupo(todas, grupos, nomes, grupoId, fase).map(c => ({ ...c, grupo_id: grupoId })));
  }
  return novas;
}

/** A fase de uma coluna dos quadros que saíram: a do marco dela ou a do grupo da coluna-marco em que ela está. */
type FaseDaColuna = 'inicio' | 'meio' | 'fim';
const FASES_PELO_MARCO: [FaseDaColuna, MarcoColuna][] = [['fim', 'concluido'], ['inicio', 'inicio']];
type ColunaComQuadro = ColunaDoQuadro & { modulo?: Modulo };
type GrupoComQuadro = GrupoDoQuadro & { modulo?: Modulo };
/** A coluna equivalente no quadro administrativo, para cada fase (undefined: o quadro não a tem). */
const COLUNA_DA_FASE: Record<FaseDaColuna, (adm: readonly ColunaDoQuadro[], grupos: readonly GrupoDoQuadro[], grupoAntigo: string) => string | undefined> = {
  fim: adm => adm.find(c => c.marco === 'concluido')?.id,
  inicio: (adm, grupos) => primeiraDoGrupo(adm, grupoDaFase(adm, grupos, GRUPO_DO_INICIO, 'inicio')),
  meio: (adm, grupos, grupoAntigo) => primeiraDoGrupo(adm, grupoDaFase(adm, grupos, GRUPOS_CORRESPONDENTES[chaveDaColuna(grupoAntigo)] ?? GRUPO_DO_MEIO, 'meio'))
};
const primeiraDoGrupo = (colunas: readonly ColunaDoQuadro[], grupoId: string | null) => grupoId ? porOrdem(colunas.filter(c => c.grupo_id === grupoId))[0]?.id : undefined;

/**
 * A coluna do quadro administrativo que equivale a uma coluna dos quadros que saíram: a de mesmo nome; sem ela, a da fase equivalente
 * (concluídas → concluídas; início → primeira do grupo do início; meio → primeira do grupo do meio correspondente); sem nada disso, a do
 * início. Coluna vazia continua vazia; coluna que não é de um dos quadros que saíram volta como veio.
 */
export function colunaEquivalente(etapaId: string | null, colunas: readonly ColunaComQuadro[], grupos: readonly GrupoComQuadro[]): string | null {
  const e = colunas.find(c => c.id === etapaId);
  if (!e?.modulo || !QUADROS_QUE_SAIRAM.has(e.modulo)) return etapaId;
  const adm = colunas.filter(c => c.modulo === QUADRO_ADMINISTRATIVO), gruposAdm = grupos.filter(g => g.modulo === QUADRO_ADMINISTRATIVO);
  const mesmoNome = porOrdem(adm).find(c => chaveDaColuna(c.nome) === chaveDaColuna(e.nome));
  if (mesmoNome) return mesmoNome.id;
  const doQuadroAntigo = colunas.filter(c => c.modulo === e.modulo);
  const grupoDoMarco = (marco: MarcoColuna) => doQuadroAntigo.find(c => c.marco === marco)?.grupo_id;
  const fase = FASES_PELO_MARCO.find(([, marco]) => e.marco === marco || (!!e.grupo_id && e.grupo_id === grupoDoMarco(marco)))?.[0] ?? 'meio';
  const grupoAntigo = grupos.find(g => g.id === e.grupo_id)?.nome ?? '';
  return COLUNA_DA_FASE[fase](adm, gruposAdm, grupoAntigo) ?? adm.find(c => c.marco === 'inicio')?.id ?? null;
}

/** O número de quem vem de um tipo que saiu e repetiria o de um administrativo: ganha, no fim, o nome do tipo de antes. */
export function numeroQueNaoRepete(numero: string, tipo: TipoQueSaiu): string {
  const sufixo = ` (${TIPOS_QUE_SAIRAM[tipo].nome})`;
  return numero.slice(0, TAMANHO_PROCESSO.numero - sufixo.length) + sufixo;
}
