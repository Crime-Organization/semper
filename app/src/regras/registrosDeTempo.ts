// Os registros de tempo de uma tarefa (#400), sem tela nem banco: a lista (do mais novo ao mais antigo), quem mexe em qual, o
// registro que o cronômetro ainda está contando, e a correção (a duração e/ou o dia, sempre com o motivo).
// Decisões do dono (21/11/2026): cada pessoa apaga e corrige os próprios registros; os administradores, os de qualquer um do
// escritório; quem não é administrador nunca vê as durações dos outros (o banco nem as devolve). O registro que o cronômetro está
// contando só se mexe depois de pausar.
import { PERIODO_MAXIMO, TAMANHO_MOTIVO } from '../dados/limites';
import { fmtDuracao, lerAjuste } from './cronometro';
import { lerData } from './pessoa';

interface Registro { id: number; perfil_id: string | null; inicio: string; segundos: number; ajuste: boolean }

/** De onde veio o registro: contado pelo cronômetro ou ajustado à mão. */
export type TipoDoRegistro = 'cronometro' | 'ajuste';
export const tipoDoRegistro = (r: { ajuste: boolean }): TipoDoRegistro => r.ajuste ? 'ajuste' : 'cronometro';
/** O nome de cada tipo na lista. */
export const NOME_DO_TIPO: Record<TipoDoRegistro, string> = { cronometro: 'Cronômetro', ajuste: 'Ajuste' };

/** A lista dos registros: do mais novo ao mais antigo. */
export const registrosEmOrdem = <R extends Registro>(registros: readonly R[]) =>
  [...registros].sort((a, b) => b.inicio.localeCompare(a.inicio) || b.id - a.id);

/** A recusa de quem tenta mudar ou apagar o registro de outra pessoa sem ser administrador (ou um que já não existe). */
export const REGISTRO_DE_TEMPO_INTOCAVEL = 'Só quem registrou o tempo, ou um administrador, muda ou apaga o registro.';
/** Quem mexe no registro: o dono e os administradores do escritório (a regra do banco). */
export const possoMexer = (r: { perfil_id: string | null }, eu: string, souAdmin: boolean) => souAdmin || r.perfil_id === eu;

/** O registro que o cronômetro deste cartão está contando agora: só se mexe nele depois de pausar. */
export const emAndamento = (r: { id: number }, periodoId: number | null, contando: boolean) => contando && r.id === periodoId;

/** Por quanto tempo, depois de começar, o cronômetro ainda grava num período: um dia, em milissegundos (o banco fecha o período depois). */
const JANELA_DO_CRONOMETRO = 24 * 60 * 60 * 1000;
/**
 * O período contado de outra pessoa que ainda pode estar contando (em outra aba ou aparelho dela): começou há menos de um dia. Daqui
 * não se sabe se está; se estiver, o cronômetro dela abre um período novo depois da mudança (PERIODO_CORRIGIDO), e a tela avisa.
 */
export const talvezContando = (r: { perfil_id: string | null; inicio: string; ajuste: boolean }, eu: string, agora: number) =>
  !r.ajuste && r.perfil_id !== eu && agora - Date.parse(r.inicio) < JANELA_DO_CRONOMETRO;

/** A recusa do banco ao cronômetro que grava num período já corrigido (privado.conferir_tempo): ele conta num período novo. */
export const PERIODO_CORRIGIDO = 'Este período foi corrigido: o cronômetro conta num período novo.';
/** O motivo do Desfazer de uma mudança: fixo, para caber no tamanho do motivo (TAMANHO_MOTIVO) seja qual for o da mudança. */
export const MOTIVO_DO_DESFAZER = 'Desfeita a mudança anterior';

/** A duração como a lista mostra: o período contado como "1 h 20 min"; o ajuste com o sinal ("+30 min", "−10 min"). */
export function duracaoDoRegistro(r: { segundos: number; ajuste: boolean }) {
  if (!r.ajuste) return fmtDuracao(r.segundos);
  return `${r.segundos < 0 ? '−' : '+'}${fmtDuracao(Math.abs(r.segundos))}`;
}

const MINUTO_EM_SEGUNDOS = 60, HORA_EM_MINUTOS = 60;
/** A duração como a pessoa escreve (o que o campo "Duração" já traz ao mudar): "45min", "1h", "1h20", "-20min". */
export function duracaoParaEscrever(segundos: number) {
  const minutos = Math.round(Math.abs(segundos) / MINUTO_EM_SEGUNDOS), h = Math.floor(minutos / HORA_EM_MINUTOS), m = minutos % HORA_EM_MINUTOS;
  const texto = !h ? `${m}min` : m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
  return (segundos < 0 ? '-' : '') + texto;
}

/** O dia do registro (aaaa-mm-dd), no fuso de quem usa. */
export function diaDoRegistro(inicio: string) {
  const d = new Date(inicio);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
/** O instante do registro levado a outro dia (aaaa-mm-dd), na mesma hora do dia, no fuso de quem usa. */
export function inicioNoDia(inicio: string, dia: string) {
  const d = new Date(inicio);
  const [a, m, x] = dia.split('-').map(Number);
  d.setFullYear(a, m - 1, x);
  return d.toISOString();
}

/** Lê a duração da correção: o período contado vai de 1 minuto a 12 horas; o ajuste, como o ajuste (com "-" para tirar). */
export function lerDuracaoDoRegistro(texto: string, ajuste: boolean) {
  const segundos = lerAjuste(texto);
  if (ajuste) return segundos;
  if (segundos < 0) throw new Error('O tempo contado não fica negativo: escreva quanto foi (ex.: 45min, 1h20).');
  if (segundos > PERIODO_MAXIMO) throw new Error(`Um período contado vai até ${PERIODO_MAXIMO / (HORA_EM_MINUTOS * MINUTO_EM_SEGUNDOS)} horas.`);
  return segundos;
}

/** O que a pessoa escreve para corrigir o registro: a duração, o dia (dd/mm/aaaa) e o motivo. */
export interface CamposDaCorrecao { duracao: string; dia: string; motivo: string }
/** O que o banco recebe da correção: a duração, o instante (no dia novo) e o motivo. */
export interface Correcao { segundos: number; inicio: string; motivo: string }

/**
 * Confere a correção: a duração (lerDuracaoDoRegistro), o dia (uma data que existe, até hoje) e o motivo, obrigatório. Devolve os
 * erros por campo, ou a correção pronta para gravar.
 */
export function conferirCorrecao(r: { inicio: string; ajuste: boolean }, campos: CamposDaCorrecao, hoje: string):
  { erros: Partial<Record<keyof CamposDaCorrecao, string>>; correcao?: Correcao } {
  const erros: Partial<Record<keyof CamposDaCorrecao, string>> = {};
  let segundos = 0, dia: string | null = null;
  try { segundos = lerDuracaoDoRegistro(campos.duracao, r.ajuste); } catch (e) { erros.duracao = (e as Error).message; }
  try { dia = lerData(campos.dia); } catch (e) { erros.dia = (e as Error).message; }
  if (!erros.dia && !dia) erros.dia = 'Diga o dia do registro.';
  else if (dia && dia > hoje) erros.dia = 'O dia do registro não pode ser depois de hoje.';
  const motivo = campos.motivo.trim();
  if (!motivo) erros.motivo = 'Diga o motivo da mudança (ele fica no histórico da tarefa).';
  else if (motivo.length > TAMANHO_MOTIVO) erros.motivo = `O motivo pode ter até ${TAMANHO_MOTIVO} caracteres.`;
  if (Object.keys(erros).length || !dia) return { erros };
  return { erros, correcao: { segundos, inicio: dia === diaDoRegistro(r.inicio) ? r.inicio : inicioNoDia(r.inicio, dia), motivo } };
}

/** O fuso em que o histórico mostra o dia do registro (o mesmo do banco, privado.registro_de_tempo_no_historico). */
const FUSO_DO_HISTORICO = 'America/Sao_Paulo';
/** O dia do registro no histórico: dd/mm/aaaa, no horário de Brasília. */
export const diaNoHistorico = (inicio: string) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO_DO_HISTORICO, day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(inicio));
/**
 * O registro como o histórico da tarefa o descreve, sem a duração (o histórico é de todos que veem a tarefa): "o tempo contado de
 * Ana, de 18/11/2026". O banco escreve o mesmo texto (supabase/migrations/20261121164027_tempo_apagar_e_corrigir.sql).
 */
export const registroNoHistorico = (nome: string | null, ajuste: boolean, inicio: string) =>
  `${ajuste ? 'o ajuste de tempo' : 'o tempo contado'} de ${nome ?? 'usuário removido'}, de ${diaNoHistorico(inicio)}`;
/** O que cada ação faz no histórico da tarefa (o mesmo texto do banco). */
export const NO_HISTORICO = {
  apagado: (registro: string) => `Apagado ${registro}`,
  devolvido: (registro: string) => `Devolvido ${registro}`,
  corrigido: (registro: string, diaNovo: string | null, motivo: string) =>
    `Corrigido ${registro}${diaNovo ? `, que passou para ${diaNovo}` : ''}. Motivo: ${motivo.trim()}`
} as const;
