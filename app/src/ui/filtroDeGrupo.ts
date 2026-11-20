// O filtro "Grupo da equipe" das páginas de Demandas e de Tarefas (#378), no painel "Filtros" da página de módulo, como o de etiqueta
// (filtroDeEtiqueta). As colunas do quadro são as mesmas para todos; o filtro só muda os cartões. Sem grupos no escritório, não há
// filtro (nada muda para quem não usa grupos).
import type { GrupoDaEquipe } from '../dados/tipos';
import { FILTRO_DOS_MEUS_GRUPOS, meusGrupos } from '../regras/gruposDaEquipe';
import type { Filtro } from './PaginaModulo';

/** O nome do filtro e das opções que não são um grupo. */
export const ROTULO_DO_FILTRO_DE_GRUPO = 'Grupo da equipe', TODOS_OS_GRUPOS = 'Todos os grupos', DOS_MEUS_GRUPOS = 'Dos meus grupos';

/** "Todos os grupos", "Dos meus grupos" (só para quem está em algum) e cada grupo do escritório. Sem grupos, nenhum filtro. */
export function filtroDeGrupo(grupos: readonly GrupoDaEquipe[] | undefined, eu: string, valor: string | undefined, aoMudar: (grupo: string) => void): Filtro[] {
  if (!grupos?.length) return [];
  const meus = meusGrupos(grupos, eu).length ? [[FILTRO_DOS_MEUS_GRUPOS, DOS_MEUS_GRUPOS] as [string, string]] : [];
  return [{ id: 'grupo', rotulo: ROTULO_DO_FILTRO_DE_GRUPO, valor: valor || '', aoMudar,
    opcoes: [['', TODOS_OS_GRUPOS], ...meus, ...grupos.map(g => [g.id, g.nome] as [string, string])] }];
}
