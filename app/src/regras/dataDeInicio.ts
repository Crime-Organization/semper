// A data de início de tarefas e demandas (#357): começa no dia em que o cartão foi criado (no horário de Brasília, como o padrão do
// banco, supabase/migrations/20261118200000_data_de_inicio.sql) e quem altera o cartão pode mudá-la. Aqui, o que ela confere, o
// filtro "Início" do quadro e da tabela e a ordem por ela (a mesma do banco, para o banco fictício ordenar igual). Tudo puro.
import { DIAS_NA_SEMANA, hojeNaAgenda } from './agenda';
import { fmtData, lerData } from './pessoa';
import { somarDias } from './prazos';

/** O nome do campo no cartão, no lápis e no histórico. */
export const ROTULO_DO_INICIO = 'Data de início';
/** A mensagem de quando a data de início fica vazia (a mesma do banco fictício e da tradução do erro do banco). */
export const INICIO_VAZIO = 'Informe a data de início.';

/** O erro da data de início escrita (dd/mm/aaaa), ou '' se está certa. Ela não pode ficar vazia: o cartão sempre tem um início. */
export function erroDaDataDeInicio(texto: string): string {
  if (!texto.trim()) return INICIO_VAZIO;
  try { lerData(texto); return ''; } catch (e) { return (e as Error).message; }
}

/** O dia, no horário de Brasília, de um instante gravado (o criado_em): é o início de um cartão que ainda não tem um. */
export const inicioDoCriadoEm = (criadoEm: string) => hojeNaAgenda(new Date(criadoEm));
/**
 * A data de criação como o cartão a mostra (dd/mm/aaaa): o mesmo dia de Brasília do início que nasce com ela, e não o dia no fuso
 * do aparelho. Assim, quem está em outro fuso (Manaus, Acre) vê a criação e o início iguais num cartão que acabou de nascer.
 */
export const dataDaCriacao = (criadoEm: string) => fmtData(inicioDoCriadoEm(criadoEm));

// ---------- o filtro "Início" ----------
/** Quanto o período "nos últimos 30 dias" volta a partir de hoje (o da semana volta DIAS_NA_SEMANA, de regras/agenda.ts). */
const DIAS_DO_MES = 30;
/** Os períodos do filtro ('' = qualquer data). */
export type PeriodoDoInicio = '' | 'hoje' | 'comecou' | 'futuro' | 'semana' | 'mes';
/** O primeiro e o último dia de início que o filtro deixa passar (aaaa-mm-dd; sem um deles, não há limite desse lado). */
export interface LimitesDoInicio { inicioDesde?: string; inicioAte?: string }
/** Cada período: o nome no filtro e os dias que ele deixa passar, contados a partir de hoje (aaaa-mm-dd, em Brasília). */
export const PERIODOS_DO_INICIO: Record<PeriodoDoInicio, { rotulo: string; limites: (hoje: string) => LimitesDoInicio }> = {
  '': { rotulo: 'Qualquer data', limites: () => ({}) },
  hoje: { rotulo: 'Começa hoje', limites: hoje => ({ inicioDesde: hoje, inicioAte: hoje }) },
  comecou: { rotulo: 'Já começou (até hoje)', limites: hoje => ({ inicioAte: hoje }) },
  futuro: { rotulo: 'Ainda vai começar', limites: hoje => ({ inicioDesde: somarDias(hoje, 1) }) },
  semana: { rotulo: `Começou nos últimos ${DIAS_NA_SEMANA} dias`, limites: hoje => ({ inicioDesde: somarDias(hoje, 1 - DIAS_NA_SEMANA), inicioAte: hoje }) },
  mes: { rotulo: `Começou nos últimos ${DIAS_DO_MES} dias`, limites: hoje => ({ inicioDesde: somarDias(hoje, 1 - DIAS_DO_MES), inicioAte: hoje }) }
};
export const PERIODOS = Object.keys(PERIODOS_DO_INICIO) as PeriodoDoInicio[];
/** Os limites do período, a partir de hoje. */
export const limitesDoPeriodo = (periodo: PeriodoDoInicio, hoje: string) => PERIODOS_DO_INICIO[periodo].limites(hoje);
/** O início está dentro dos limites do filtro? */
export const inicioNosLimites = (inicio: string, { inicioDesde, inicioAte }: LimitesDoInicio) =>
  (!inicioDesde || inicio >= inicioDesde) && (!inicioAte || inicio <= inicioAte);

// ---------- a ordem ----------
/** O que a ordem pelo início precisa do item: o início e, para desempatar no mesmo dia, quando foi criado. */
export interface ComInicio { data_inicio: string; criado_em: string }
/** Para onde a lista anda: 1, o que começou antes primeiro; -1, o que começa depois primeiro. */
export type SentidoDoInicio = 1 | -1;
/** Compara dois itens pelo início, no sentido pedido; no mesmo dia, pelo momento em que foram criados (como o banco). */
export const compararPeloInicio = (a: ComInicio, b: ComInicio, sentido: SentidoDoInicio = 1) =>
  sentido * (a.data_inicio.localeCompare(b.data_inicio) || a.criado_em.localeCompare(b.criado_em)) || 0;   // "|| 0": sem o -0 do empate

// ---------- o lápis do cartão ----------
/**
 * A data de início que o cadastro grava: no lápis do cartão, a escrita (dd/mm/aaaa, já conferida por erroDaDataDeInicio); no cadastro
 * novo (inicio null), nada, e o banco põe o dia da criação.
 */
export const inicioAoGravar = ({ inicio }: { inicio: string | null }): { data_inicio?: string } =>
  inicio === null ? {} : { data_inicio: lerData(inicio)! };
