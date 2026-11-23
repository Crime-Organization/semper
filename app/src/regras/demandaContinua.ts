// A demanda contínua (#313, parte C): reúne as tarefas avulsas (sem demanda). Uma por grupo da equipe (#378) e uma "Geral", para quem
// não está em grupo nenhum. O banco a cria (supabase/migrations/20261123003418_demanda_continua.sql); ela nunca é arquivada, concluída
// nem excluída, e estar nela não abre as tarefas dela: quem vê a tarefa avulsa continua o mesmo de antes. Tudo puro, sem tela nem banco.
import type { Demanda, GrupoDaEquipe } from '../dados/tipos';

/** O valor da "Geral" na escolha do cadastro (o banco a guarda sem grupo). */
export const CONTINUA_GERAL = 'geral';
/** O nome da contínua de quem não está em grupo nenhum. */
export const NOME_DA_GERAL = 'Geral';
/** O título que o banco dá à contínua (privado.titulo_da_continua): "Contínua: " e o nome do grupo (ou "Geral"). */
export const tituloDaContinua = (nome: string) => `Contínua: ${nome}`;
/** A descrição com que o banco cria a contínua. */
export const DESCRICAO_DA_CONTINUA = 'Reúne as tarefas avulsas (sem demanda). Cada pessoa vê só as tarefas em que está, como antes.';
/** O selo da contínua no cartão e na lista. */
export const SELO_DA_CONTINUA = 'Contínua';
/** O que o cartão diz da contínua, no lugar do Arquivar e do Concluir. */
export const NOTA_DA_CONTINUA = 'Esta é a demanda contínua: ela reúne as tarefas avulsas (sem demanda) e nunca é arquivada nem concluída. '
  + 'Cada pessoa vê só as tarefas em que está, como antes.';

// As recusas, iguais às do banco (privado.guardar_continua e public.demanda_continua).
export const CONTINUA_NAO_ARQUIVA = 'A demanda contínua não pode ser arquivada.';
export const CONTINUA_NAO_CONCLUI = 'A demanda contínua não é concluída: ela reúne as tarefas avulsas.';
export const CONTINUA_NAO_EXCLUI = 'A demanda contínua não pode ser excluída.';
export const CONTINUA_SEM_EQUIPE = 'A demanda contínua só reúne as tarefas avulsas: ela não tem colaboradores, grupos, clientes nem contrato.';
/** O cadastro, sem demanda, com mais de um grupo para escolher. */
export const SEM_GRUPO_DA_CONTINUA = 'Escolha o grupo da tarefa avulsa.';

/** Uma opção do grupo da tarefa avulsa no cadastro: o id do grupo (ou CONTINUA_GERAL) e o nome. */
export interface OpcaoDaContinua { valor: string; nome: string }

/** Os grupos em que a pessoa está, em ordem de nome. */
const gruposDe = (grupos: readonly GrupoDaEquipe[] | undefined, eu: string) =>
  (grupos ?? []).filter(g => g.integrantes.includes(eu)).toSorted((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

/** As opções do cadastro: os grupos de quem cadastra; quem não está em grupo nenhum, só a Geral. */
export function opcoesDaContinua(grupos: readonly GrupoDaEquipe[] | undefined, eu: string): OpcaoDaContinua[] {
  const meus = gruposDe(grupos, eu);
  return meus.length ? meus.map(g => ({ valor: g.id, nome: g.nome })) : [{ valor: CONTINUA_GERAL, nome: NOME_DA_GERAL }];
}
/** A escolha que o cadastro já traz: a única opção, se só há uma; senão, nenhuma (a pessoa escolhe). */
export const continuaInicial = (opcoes: readonly OpcaoDaContinua[]) => opcoes.length === 1 ? opcoes[0].valor : '';
/** O grupo que vai ao banco (null: a Geral). */
export const grupoDaContinuaAoGravar = (valor: string) => valor === CONTINUA_GERAL ? null : valor;
/**
 * A contínua da tarefa gravada sem demanda por outro caminho (como o gatilho "continua" do banco): a do grupo de quem a cria, se ele
 * está em um só; senão (nenhum ou vários), a Geral (null).
 */
export const grupoPeloGatilho = (gruposDaPessoa: readonly string[]) => gruposDaPessoa.length === 1 ? gruposDaPessoa[0] : null;

/**
 * A tarefa que ganha uma demanda de verdade deixa de ser avulsa: a contínua sai da lista (como ligacoes_da_tarefa). Só com a contínua,
 * ela fica. `continua` diz se o id é de uma contínua.
 */
export const semAContinuaComDemanda = (ids: readonly string[], continua: (id: string) => boolean) =>
  ids.some(id => !continua(id)) ? ids.filter(id => !continua(id)) : [...ids];

/**
 * A tarefa volta à contínua (o Desfazer de ligá-la a uma demanda): antes ela não estava em nenhuma contínua, e depois fica só em
 * contínuas (sem nenhuma demanda de verdade). Quem altera a tarefa pode devolvê-la mesmo sem usar aquela contínua (sem estar no grupo
 * dela): a contínua não abre a tarefa a ninguém. `antes` nulo: a tarefa é nova (aí vale a regra de quem usa a contínua).
 */
export const voltaAContinua = (antes: readonly string[] | null, depois: readonly string[], continua: (id: string) => boolean) =>
  !!antes && !antes.some(continua) && depois.length > 0 && depois.every(continua);

/** Quem pode usar a contínua (ligar a tarefa a ela e vê-la): na Geral, toda a equipe; na de um grupo, quem está nele e o administrador. */
export const usaAContinua = (d: Pick<Demanda, 'continua' | 'continua_grupo_id'>, ehAdmin: boolean, meusGrupos: readonly string[]) =>
  !!d.continua && (!d.continua_grupo_id || ehAdmin || meusGrupos.includes(d.continua_grupo_id));

/** A demanda é contínua? (As que não dizem são comuns.) */
export const ehContinua = (d: Pick<Demanda, 'continua'> | null | undefined) => !!d?.continua;
