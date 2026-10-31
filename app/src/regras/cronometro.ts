// O cronômetro das tarefas, sem tela nem banco: o estado de um período que está sendo contado e o que cada acontecimento
// faz com ele (começar, pausar, a pessoa mexer, o relógio andar, responder "Você ainda está aqui?").
// Regras combinadas com o Mateus (24/10): cada um conta o próprio tempo; depois de um tempo sem mexer, aparece o aviso,
// e o tempo a partir dele fica separado: "Ainda estou" soma; "Não estava" descarta o tempo desde o aviso e a contagem
// recomeça. Os instantes são em milissegundos (Date.now()); o que vai para o banco é em segundos.
import { AJUSTE_MAXIMO, TAMANHO_MOTIVO } from '../dados/limites';

export interface Cronometro {
  contando: boolean;
  /** Quando começou o trecho que está sendo contado agora (desde o começo, a retomada ou a resposta ao aviso). */
  trecho: number;
  /** Milissegundos já confirmados no período, antes do trecho atual. */
  confirmados: number;
  /** A última vez que a pessoa mexeu. */
  ultimoMovimento: number;
  /** Quando apareceu "Você ainda está aqui?" (null: sem aviso). O tempo daí em diante espera a resposta. */
  aviso: number | null;
}

export type Evento =
  | { tipo: 'iniciar'; agora: number }
  | { tipo: 'pausar'; agora: number }
  | { tipo: 'mexeu'; agora: number }
  | { tipo: 'tique'; agora: number; inatividade: number }
  | { tipo: 'responder'; agora: number; aindaEstou: boolean };

export const PARADO: Cronometro = { contando: false, trecho: 0, confirmados: 0, ultimoMovimento: 0, aviso: null };

/** Cada acontecimento e o que ele faz com o cronômetro (padrão State: um caso novo é uma entrada nova). */
const ACONTECIMENTOS: { [T in Evento['tipo']]: (c: Cronometro, e: Extract<Evento, { tipo: T }>) => Cronometro } = {
  iniciar: (c, { agora }) => c.contando ? c : { contando: true, trecho: agora, confirmados: c.confirmados, ultimoMovimento: agora, aviso: null },
  // Pausar com o aviso na tela descarta o tempo desde o aviso (ninguém confirmou que estava ali).
  pausar: (c, { agora }) => !c.contando ? c
    : { ...c, contando: false, confirmados: c.confirmados + (c.aviso ?? agora) - c.trecho, trecho: agora, aviso: null },
  // Enquanto o aviso está na tela, mexer não conta: quem decide é a resposta.
  mexeu: (c, { agora }) => c.aviso === null ? { ...c, ultimoMovimento: agora } : c,
  tique: (c, { agora, inatividade }) => c.contando && c.aviso === null && agora - c.ultimoMovimento >= inatividade ? { ...c, aviso: agora } : c,
  responder: (c, { agora, aindaEstou }) => c.aviso === null ? c
    : aindaEstou ? { ...c, aviso: null, ultimoMovimento: agora }
    : { ...c, confirmados: c.confirmados + c.aviso - c.trecho, trecho: agora, aviso: null, ultimoMovimento: agora }
};

export function cronometro(c: Cronometro, e: Evento): Cronometro {
  return (ACONTECIMENTOS[e.tipo] as (c: Cronometro, e: Evento) => Cronometro)(c, e);
}

/** Os segundos do período que já podem ser gravados (com o aviso na tela, só até o aviso). Só crescem. */
export const segundosDoPeriodo = (c: Cronometro, agora: number) =>
  Math.floor((c.confirmados + (c.contando ? (c.aviso ?? agora) - c.trecho : 0)) / 1000);

// ---------- mostrar e ajustar ----------
const MINUTO_EM_SEGUNDOS = 60, HORA_EM_SEGUNDOS = 60 * MINUTO_EM_SEGUNDOS;

/** Duração por extenso, curta: "0 min", "45 min", "1 h 05 min", "12 h". Negativo vira zero (um total nunca é negativo). */
export function fmtDuracao(segundos: number) {
  const s = Math.max(0, Math.round(segundos));
  const h = Math.floor(s / HORA_EM_SEGUNDOS), m = Math.floor((s % HORA_EM_SEGUNDOS) / MINUTO_EM_SEGUNDOS);
  if (!h) return `${m} min`;
  return m ? `${h} h ${String(m).padStart(2, '0')} min` : `${h} h`;
}

/** Quanto tempo passou entre duas datas (ex.: da criação à conclusão): "3 h 20 min" no mesmo dia, senão "5 dias". */
export function fmtDecorrido(desde: string, ate: string) {
  const segundos = Math.max(0, (new Date(ate).getTime() - new Date(desde).getTime()) / 1000);
  const dias = Math.floor(segundos / (24 * HORA_EM_SEGUNDOS));
  return dias < 1 ? fmtDuracao(segundos) : dias === 1 ? '1 dia' : `${dias} dias`;
}

/** O relógio do cartão: "0:04:09", com as horas sem limite. */
export function fmtRelogio(segundos: number) {
  const s = Math.max(0, Math.floor(segundos));
  const h = Math.floor(s / HORA_EM_SEGUNDOS), m = Math.floor((s % HORA_EM_SEGUNDOS) / MINUTO_EM_SEGUNDOS), x = s % MINUTO_EM_SEGUNDOS;
  return `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}`;
}

/**
 * Lê o tanto do ajuste, como a pessoa escreve: "30" ou "30min" (minutos), "1h", "1h30", "1:30", com "-" para tirar
 * ("-20min"). Devolve os segundos, ou lança a mensagem do que está errado.
 */
export function lerAjuste(texto: string) {
  const t = texto.trim().toLowerCase().replace(/\s+/g, '');
  const m = /^([+-]?)(?:(\d+)h(?:(\d{1,2})(?:min|m)?)?|(\d+):(\d{2})|(\d+)(?:min|m)?)$/.exec(t);
  if (!m) throw new Error('Escreva o tempo como 30min, 1h, 1h30 ou 1:30 (com "-" na frente para tirar).');
  const [, sinal, h1, m1, h2, m2, so] = m;
  const minutos = h1 !== undefined ? +h1 * 60 + +(m1 || 0) : h2 !== undefined ? +h2 * 60 + +m2 : +so;
  const segundos = (sinal === '-' ? -1 : 1) * minutos * MINUTO_EM_SEGUNDOS;
  if (!segundos) throw new Error('O ajuste não pode ser zero.');
  if (Math.abs(segundos) > AJUSTE_MAXIMO) throw new Error(`Um ajuste vai até ${AJUSTE_MAXIMO / HORA_EM_SEGUNDOS} horas, para mais ou para menos.`);
  return segundos;
}

/** Confere o ajuste: o tanto (lerAjuste) e o motivo, que é obrigatório. Devolve os erros por campo (vazio: pode salvar). */
export function errosDoAjuste(tanto: string, motivo: string) {
  const erros: { tanto?: string; motivo?: string } = {};
  try { lerAjuste(tanto); } catch (e) { erros.tanto = (e as Error).message; }
  if (!motivo.trim()) erros.motivo = 'Diga o motivo do ajuste (ele fica registrado).';
  else if (motivo.trim().length > TAMANHO_MOTIVO) erros.motivo = `O motivo pode ter até ${TAMANHO_MOTIVO} caracteres.`;
  return erros;
}

type Registro = { perfil_id: string | null; segundos: number };
/** O tempo de cada pessoa: a soma dos registros dela (contados e ajustes), nunca negativa. */
export function tempoPorPessoa(registros: Registro[]) {
  const soma = new Map<string | null, number>();
  registros.forEach(r => soma.set(r.perfil_id, (soma.get(r.perfil_id) ?? 0) + r.segundos));
  return new Map([...soma].map(([p, s]) => [p, Math.max(0, s)]));
}
/** O tempo de uma pessoa, ou o total da equipe (a soma do de cada um, como no banco). */
export const somaDoTempo = (registros: Registro[], perfilId?: string) => {
  const porPessoa = tempoPorPessoa(registros);
  return perfilId === undefined ? [...porPessoa.values()].reduce((s, x) => s + x, 0) : porPessoa.get(perfilId) ?? 0;
};
