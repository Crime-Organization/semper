// O fuso do escritório, comum a todos os módulos: a agenda, os gráficos e o Financeiro mostram o dia e a hora do relógio de
// Brasília, onde quer que esteja o computador de quem abre. Tudo puro, sem tela nem banco, e sem depender de nenhum módulo.

/** O fuso do escritório (o relógio de Brasília). */
export const FUSO_DO_ESCRITORIO = 'America/Sao_Paulo';

/** O dia (dd/mm/aaaa) de um momento guardado pelo banco (com fuso), no relógio do escritório. */
export const diaNoEscritorio = (momento: string) => new Date(momento).toLocaleDateString('pt-BR', { timeZone: FUSO_DO_ESCRITORIO });

/** O dia (aaaa-mm-dd) de um momento guardado pelo banco (com fuso), no relógio do escritório (ex.: o dia em que a tarefa foi concluída). */
export const isoNoEscritorio = (momento: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: FUSO_DO_ESCRITORIO, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(momento));
/** A hora (HH:MM) de um momento guardado pelo banco, no relógio do escritório (ex.: quando começou o registro que está contando). */
export const horaNoEscritorio = (momento: string) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO_DO_ESCRITORIO, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(momento));
