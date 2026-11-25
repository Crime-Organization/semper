// O dia útil do escritório e o dia útil anterior a uma data (#439): a despesa do escritório vai para a agenda Administrativo no dia
// útil ANTERIOR ao vencimento (#166). Puro (sem rede, sem banco, sem importar nada): usado pela função do servidor que sincroniza as
// agendas, pelas regras do site (regras/demandaDoCompromisso.ts) e testado em app/src/regras/diaUtilAnterior.test.ts.
//
// Não é útil: sábado, domingo, feriado nacional de data fixa (os mesmos de feriadosNacionais em app/src/regras/prazos.ts e de
// privado.feriado_nacional no banco) e os dias sem expediente que o escritório lançou no Calendário para todos os órgãos (feriado ou
// suspensão que fecha o fórum; a suspensão só de prazos tem expediente, e o dia lançado para um órgão só vale nos prazos dele). É a
// mesma conta de privado.dia_util_do_escritorio, em supabase/migrations/20261123000750_demandas_dos_compromissos.sql.

/** Os feriados nacionais de data fixa, em mês-dia (Leis 662/1949, 6.802/1980, 10.607/2002 e 14.759/2023). */
export const FERIADOS_NACIONAIS_FIXOS: readonly string[] = ['01-01', '04-21', '05-01', '09-07', '10-12', '11-02', '11-15', '11-20', '12-25'];
/** Os tipos de dia lançado no Calendário que fecham o escritório (os de TIPOS_SEM_EXPEDIENTE sem expediente, em regras/prazos.ts). */
export const TIPOS_QUE_FECHAM: readonly string[] = ['feriado', 'suspensao'];
/** Os dias da semana sem expediente (0 = domingo, 6 = sábado). */
const FIM_DE_SEMANA = new Set([0, 6]);
/** Até quantos dias para trás se procura um dia útil (um ano, como a contagem dos prazos). Sem nenhum, fica o dia de antes. */
export const DIAS_PARA_TRAS = 366;

/** Um dia que o escritório lançou no Calendário ("aaaa-mm-dd"); `orgao_id` null vale para todos os órgãos. */
export interface DiaSemExpedienteLancado { data: string; tipo: string; orgao_id: string | null }

const paraData = (iso: string) => new Date(`${iso}T00:00:00Z`);
/** A data `n` dias depois (ou antes, com n negativo), em "aaaa-mm-dd". */
export function somarDiasCorridos(iso: string, n: number) {
  const d = paraData(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** O dia é útil no escritório: nem fim de semana, nem feriado nacional, nem um dia sem expediente lançado para todos os órgãos. */
export function diaUtil(iso: string, lancados: readonly DiaSemExpedienteLancado[] = []) {
  if (FIM_DE_SEMANA.has(paraData(iso).getUTCDay())) return false;
  if (FERIADOS_NACIONAIS_FIXOS.includes(iso.slice(5))) return false;
  return !lancados.some(d => d.data === iso && d.orgao_id === null && TIPOS_QUE_FECHAM.includes(d.tipo));
}

/** O primeiro dia útil de `iso` para trás (o próprio dia, se for útil). Sem nenhum num ano inteiro, fica o próprio dia. */
export function diaUtilAteODia(iso: string, lancados: readonly DiaSemExpedienteLancado[] = []) {
  for (let i = 0; i <= DIAS_PARA_TRAS; i++) {
    const dia = somarDiasCorridos(iso, -i);
    if (diaUtil(dia, lancados)) return dia;
  }
  return iso;
}

/**
 * O dia útil anterior ao vencimento: o primeiro dia útil ANTES dele, mesmo que o vencimento seja útil (vence na segunda: fica na sexta;
 * vence na quarta: fica na terça). Sem nenhum num ano inteiro, fica o dia de antes.
 */
export const diaUtilAnterior = (vencimento: string, lancados: readonly DiaSemExpedienteLancado[] = []) =>
  diaUtilAteODia(somarDiasCorridos(vencimento, -1), lancados);
