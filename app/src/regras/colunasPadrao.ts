// Colunas padrão que chegam depois (#314, #315): o escritório novo nasce com elas, e o que já existe as ganha uma vez, sem mexer
// nos itens nem nas colunas que tem. Uma coluna que o escritório já criou à mão, com o mesmo nome ou um nome parecido, não se
// repete. As mesmas regras estão na função privado.acrescentar_colunas_padrao do banco (migração da #314): mudou aqui, muda lá.
// Sem tela nem banco: recebe as colunas e os grupos do quadro e devolve onde cada coluna nova entra.
import type { MarcoColuna, Modulo } from '../dados/tipos';
import { filaDoTopo } from './quadro';
import { semAcento } from './texto';

/** Uma coluna padrão nova e os nomes que contam como ela (o escritório pode tê-la criado à mão com um deles). */
export interface ColunaPadrao { nome: string; parecidos: string[] }

/**
 * Onde as colunas entram: depois de uma coluna (pelo nome, no mesmo grupo dela) ou num grupo novo, antes do grupo da coluna das
 * concluídas. Sem a coluna de referência, entram antes da coluna das concluídas; sem ela, no fim do quadro.
 */
export interface ColunasNovas { colunas: ColunaPadrao[]; depoisDe?: string; grupoNovo?: string }

/** Tarefas (#314): as duas esperas, depois de "Fazendo" (nomes decididos pelo dono, no padrão do quadro dele). */
export const COLUNAS_NOVAS_DAS_TAREFAS: ColunasNovas = {
  depoisDe: 'Fazendo',
  colunas: [
    { nome: 'Aguardando: análise do solicitante',
      parecidos: ['Aguardando retorno do solicitante', 'Aguardando retorno do advogado solicitante', 'Aguardando análise do advogado solicitante', 'Aguardando solicitante'] },
    { nome: 'Aguardando: retorno do cliente', parecidos: ['Aguardando cliente'] }
  ]
};

/**
 * Processos judiciais (#315, pedidas com os sistemas e polos criminais): num grupo novo, "Acompanhamento", depois das colunas de
 * andamento e antes do grupo de encerramento (decisão do dono). As colunas-marco não mudam.
 */
export const COLUNAS_NOVAS_DOS_PROCESSOS: ColunasNovas = {
  grupoNovo: 'Acompanhamento',
  colunas: [
    { nome: 'Aguardando MP',
      parecidos: ['Aguardando Ministério Público', 'Aguardando manifestação do MP', 'Aguardando manifestação do Ministério Público',
        'Aguardando parecer do MP', 'Aguardando parecer do Ministério Público'] },
    { nome: 'Em acompanhamento', parecidos: ['Acompanhamento', 'Acompanhando'] }
  ]
};

/** O nome reduzido ao que importa para comparar: sem acentos, maiúsculas, espaços nem sinais ("Aguardando: análise" = "aguardando analise"). */
export const chaveDaColuna = (nome: string) => semAcento(nome).replace(/[^a-z0-9]/g, '');

/** Se o quadro já tem a coluna padrão: com o mesmo nome ou com um dos parecidos. */
export function quadroJaTem(nomes: string[], coluna: ColunaPadrao) {
  const chaves = new Set([coluna.nome, ...coluna.parecidos].map(chaveDaColuna));
  return nomes.some(n => chaves.has(chaveDaColuna(n)));
}

/** As ordens de `quantas` colunas seguidas entre dois vizinhos (ou numa ponta), repartindo o espaço entre eles. */
export function ordensEntre(anterior: number | undefined, seguinte: number | undefined, quantas: number): number[] {
  return Array.from({ length: quantas }, (_, i) => {
    const n = i + 1;
    if (anterior !== undefined && seguinte !== undefined) return anterior + (seguinte - anterior) * n / (quantas + 1);
    if (anterior !== undefined) return anterior + n;
    return seguinte !== undefined ? seguinte - (quantas + 1 - n) : n;
  });
}

type ColunaDoQuadro = { id: string; nome: string; ordem: number; grupo_id?: string | null; marco?: MarcoColuna | null };
type GrupoDoQuadro = { id: string; nome: string; ordem: number };

/** O que acrescentar: um grupo novo (com a ordem dele no topo do quadro) ou o grupo em que as colunas entram (null: sem grupo). */
export interface PlanoDasColunasNovas {
  grupoNovo: { nome: string; ordem: number } | null;
  grupoId: string | null;
  colunas: { nome: string; ordem: number }[];
}

/** As ordens de quem está no mesmo lugar que a coluna: as colunas do grupo dela, ou o topo do quadro (colunas sem grupo e grupos). */
function vizinhos(colunas: ColunaDoQuadro[], grupos: GrupoDoQuadro[], grupoId: string | null): number[] {
  const lista = grupoId ? colunas.filter(c => c.grupo_id === grupoId) : filaDoTopo(colunas, grupos);
  return lista.map(c => c.ordem);
}
const antes = (ordens: number[], ordem: number) => ordens.filter(o => o < ordem).reduce<number | undefined>((m, o) => Math.max(m ?? o, o), undefined);
const depois = (ordens: number[], ordem: number) => ordens.filter(o => o > ordem).reduce<number | undefined>((m, o) => Math.min(m ?? o, o), undefined);
const noFim = (colunas: ColunaDoQuadro[], grupos: GrupoDoQuadro[]) => Math.max(0, ...colunas.map(c => c.ordem), ...grupos.map(g => g.ordem));

/**
 * O plano para acrescentar as colunas que faltam no quadro (null: nada falta, ou o quadro ainda não tem colunas, e o preparo do
 * escritório é que o monta). O grupo de uma coluna que não existe mais conta como sem grupo, como na tela.
 */
export function planoDasColunasNovas(colunas: ColunaDoQuadro[], grupos: GrupoDoQuadro[], novas: ColunasNovas): PlanoDasColunasNovas | null {
  const faltam = novas.colunas.filter(c => !quadroJaTem(colunas.map(x => x.nome), c)).map(c => c.nome);
  if (!colunas.length || !faltam.length) return null;
  const existe = new Set(grupos.map(g => g.id));
  const grupoDe = (c: ColunaDoQuadro) => (c.grupo_id && existe.has(c.grupo_id) ? c.grupo_id : null);
  const comOrdens = (grupoId: string | null, ordens: number[]): PlanoDasColunasNovas =>
    ({ grupoNovo: null, grupoId, colunas: faltam.map((nome, i) => ({ nome, ordem: ordens[i] })) });
  const fim = colunas.find(c => c.marco === 'concluido');

  if (novas.grupoNovo) {
    const chave = chaveDaColuna(novas.grupoNovo);
    const jaExiste = [...grupos].sort((a, b) => a.ordem - b.ordem).find(g => chaveDaColuna(g.nome) === chave);
    // O grupo já existe (criado à mão): as colunas entram no fim dele.
    if (jaExiste) return comOrdens(jaExiste.id, ordensEntre(antes(vizinhos(colunas, grupos, jaExiste.id), Infinity), undefined, faltam.length));
    // Senão, o grupo novo fica no topo logo antes do grupo da coluna das concluídas (ou dela mesma, se está sem grupo).
    const alvo = fim && (grupoDe(fim) ? grupos.find(g => g.id === grupoDe(fim))!.ordem : fim.ordem);
    const ordem = alvo === undefined ? noFim(colunas, grupos) + 1 : ordensEntre(antes(vizinhos(colunas, grupos, null), alvo), alvo, 1)[0];
    return { grupoNovo: { nome: novas.grupoNovo, ordem }, grupoId: null, colunas: faltam.map((nome, i) => ({ nome, ordem: i + 1 })) };
  }

  const ancora = novas.depoisDe ? [...colunas].sort((a, b) => a.ordem - b.ordem).find(c => chaveDaColuna(c.nome) === chaveDaColuna(novas.depoisDe!)) : undefined;
  if (ancora) {
    const grupo = grupoDe(ancora);
    return comOrdens(grupo, ordensEntre(ancora.ordem, depois(vizinhos(colunas, grupos, grupo), ancora.ordem), faltam.length));
  }
  if (fim) {
    const grupo = grupoDe(fim);
    return comOrdens(grupo, ordensEntre(antes(vizinhos(colunas, grupos, grupo), fim.ordem), fim.ordem, faltam.length));
  }
  return comOrdens(null, ordensEntre(noFim(colunas, grupos), undefined, faltam.length));
}

/** As colunas novas de cada tarefa do quadro, com o quadro em que entram (o banco fictício acrescenta cada uma uma vez, como a migração). */
export const COLUNAS_NOVAS_POR_TAREFA: { tarefa: number; modulo: Modulo; novas: ColunasNovas }[] = [
  { tarefa: 314, modulo: 'tarefas', novas: COLUNAS_NOVAS_DAS_TAREFAS },
  { tarefa: 315, modulo: 'processos_judiciais', novas: COLUNAS_NOVAS_DOS_PROCESSOS }
];

/**
 * A coluna de aprovação das tarefas (#313), como privado.marcar_coluna_de_aprovacao: a primeira coluna comum (sem marco, pela ordem)
 * com o nome de "Aguardando: análise do solicitante" ou um dos parecidos. undefined: o quadro não a tem (a migração a cria antes,
 * depois de "Fazendo", com planoDasColunasNovas).
 */
export function colunaDeAprovacaoNoQuadro<C extends ColunaDoQuadro>(colunas: readonly C[]): C | undefined {
  const padrao = COLUNAS_NOVAS_DAS_TAREFAS.colunas[0];
  return [...colunas].sort((a, b) => a.ordem - b.ordem).find(c => !c.marco && quadroJaTem([c.nome], padrao));
}
/** Só a coluna de "Aguardando: análise do solicitante", para acrescentar ao quadro que não a tem mais (#313). */
export const COLUNA_DE_APROVACAO_DAS_TAREFAS: ColunasNovas = { depoisDe: 'Fazendo', colunas: [COLUNAS_NOVAS_DAS_TAREFAS.colunas[0]] };
