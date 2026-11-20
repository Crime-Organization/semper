// Grupos da equipe (#378): regras puras de quem está num grupo, o que se mostra de cada grupo e o aviso antes de excluir.
// As regras de quem vê e altera cada item ficam no banco (supabase/migrations/20261119233811_grupos_da_equipe.sql); estas são as
// mesmas, para a tela saber o que mostrar e para o banco fictício se comportar igual.
import { GRUPOS_POR_ITEM } from '../dados/limites';
import type { GrupoDaEquipe, ItensDoGrupo, Membro, ModuloDoPedido } from '../dados/tipos';
import { normal } from './texto';

/** Nomes por extenso, como se fala: "A, B e C" (como nomesPorExtenso, em regras/contrato.ts, sem depender dele). */
const porExtenso = (nomes: string[]) => new Intl.ListFormat('pt-BR', { style: 'long', type: 'conjunction' }).format(nomes);

/** O valor do filtro "Grupo da equipe" que junta os grupos de quem está logado ("Dos meus grupos"). */
export const FILTRO_DOS_MEUS_GRUPOS = 'meus';
/** Até quantos nomes a dica de um grupo mostra; os outros viram "e mais N". */
export const INTEGRANTES_NA_DICA = 5;

/** Os grupos em que a pessoa está (como privado.meus_grupos, para quem está logado). */
export const meusGrupos = (grupos: readonly GrupoDaEquipe[] | undefined, perfilId: string) =>
  (grupos ?? []).filter(g => g.integrantes.includes(perfilId)).map(g => g.id);

/** A pessoa está num dos grupos do item? Item sem grupo, nunca. */
export const estaPeloGrupo = (doItem: readonly string[] | undefined, meus: readonly string[]) =>
  !!doItem?.length && doItem.some(id => meus.includes(id));

/** Quem participa pelo grupo: os integrantes ativos, sem a conta reservada e sem quem foi excluído (como privado.integrantes_dos_grupos). */
export const integrantesAtivos = (grupo: Pick<GrupoDaEquipe, 'integrantes'>, equipe: readonly Membro[]) =>
  equipe.filter(m => grupo.integrantes.includes(m.id) && m.ativo !== false && !m.reservada && !m.excluido);

const pessoas = (n: number) => `${n} ${n === 1 ? 'pessoa' : 'pessoas'}`;

/** O nome do grupo com quantas pessoas participam por ele: "Núcleo A · 4 pessoas". */
export const textoDoGrupo = (grupo: GrupoDaEquipe, equipe: readonly Membro[]) => `${grupo.nome} · ${pessoas(integrantesAtivos(grupo, equipe).length)}`;

/**
 * A dica do grupo, com os nomes de quem participa por ele: "Núcleo A · 4 pessoas: Ana, Beto, Caio e Davi". Passando de
 * INTEGRANTES_NA_DICA, os primeiros e "e mais N". Sem ninguém: "Núcleo A · ninguém ainda".
 */
export function dicaDosIntegrantes(grupo: GrupoDaEquipe, equipe: readonly Membro[]) {
  const nomes = integrantesAtivos(grupo, equipe).map(m => m.nome).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  if (!nomes.length) return `${grupo.nome} · ninguém ainda`;
  const lista = nomes.length > INTEGRANTES_NA_DICA
    ? `${nomes.slice(0, INTEGRANTES_NA_DICA).join(', ')} e mais ${nomes.length - INTEGRANTES_NA_DICA}`
    : porExtenso(nomes);
  return `${grupo.nome} · ${pessoas(nomes.length)}: ${lista}`;
}

/**
 * Os grupos que ainda podem entrar no item, pelo termo digitado (sem acento nem maiúsculas): os que ainda não estão nele, até o
 * limite de grupos por item (cheio, nenhum).
 */
export function candidatosDeGrupo(grupos: readonly GrupoDaEquipe[] | undefined, termo: string, jaNoItem: readonly string[], limite = GRUPOS_POR_ITEM) {
  if (jaNoItem.length >= limite) return [];
  const t = normal(termo);
  return (grupos ?? []).filter(g => !jaNoItem.includes(g.id) && normal(g.nome).includes(t));
}

/** O filtro "Grupo da equipe" em ids: 'meus' são os grupos de quem está logado; um id, ele mesmo; vazio, nenhum filtro (null). */
export const gruposDoFiltro = (filtro: string | undefined, meus: readonly string[]) =>
  !filtro ? null : filtro === FILTRO_DOS_MEUS_GRUPOS ? [...meus] : [filtro];

/** O filtro guardado só vale se o grupo ainda existe (ou é "Dos meus grupos"); senão volta a "Todos os grupos" (undefined). */
export const filtroQueVale = (filtro: string | undefined, grupos: readonly GrupoDaEquipe[] | undefined) =>
  filtro && (filtro === FILTRO_DOS_MEUS_GRUPOS || (grupos ?? []).some(g => g.id === filtro)) ? filtro : undefined;

/** O nome de cada módulo, no singular e no plural, para contar os itens do grupo. */
const NOME_DO_MODULO: Record<ModuloDoPedido, [string, string]> = {
  demandas: ['demanda', 'demandas'],
  tarefas: ['tarefa', 'tarefas'],
  processos: ['processo', 'processos'],
  compromissos: ['compromisso', 'compromissos'],
  contratos: ['contrato', 'contratos'],
  anotacoes: ['documento', 'documentos']
};
/** "5 demandas e 1 tarefa": os itens de cada módulo, na ordem em que vieram. */
export const itensPorModulo = (contagem: readonly ItensDoGrupo[]) =>
  porExtenso(contagem.filter(c => c.quantos > 0).map(c => `${c.quantos} ${NOME_DO_MODULO[c.modulo][c.quantos === 1 ? 0 : 1]}`));

/** A pergunta antes de excluir o grupo, com em quantos itens ele está (contando os arquivados). */
export function avisoDaExclusao(nome: string, contagem: readonly ItensDoGrupo[]) {
  const total = contagem.reduce((s, c) => s + c.quantos, 0);
  const onde = total
    ? `Ele está em ${total} ${total === 1 ? 'item' : 'itens'}, contando os arquivados (${itensPorModulo(contagem)}). Quem participa só pelo grupo deixa de ver ${total === 1 ? 'esse item' : 'esses itens'}.`
    : 'Ele não está em nenhum item.';
  return `Excluir o grupo ${nome}? ${onde} As pessoas continuam na equipe. Não dá para desfazer.`;
}
