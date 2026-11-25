// Regras das salas do escritório (#308): o cadastro nas Configurações, as opções do cadastro de compromisso e o conflito de horário,
// puras, sem tela nem banco. O banco confere o mesmo conflito ao gravar (privado.conferir_sala_do_compromisso, na migração
// 20261122132438_salas_do_escritorio.sql), com as mesmas contas de minutos: mudou aqui, muda lá.
import type { Compromisso, DadosSala, OcupacaoDaSala, Sala } from '../dados/tipos';
import { TAMANHO_SALA } from '../dados/limites';
import { normal } from './texto';

/** Por quanto tempo, em minutos, o compromisso sem hora de fim ocupa a sala. */
export const MINUTOS_SEM_FIM = 60;
/** Os minutos de um dia: o compromisso sem hora (o dia inteiro) ocupa a sala do começo ao fim do dia. */
export const MINUTOS_NO_DIA = 24 * 60;
const MINUTOS_NA_HORA = 60;

// ---------- o conflito de horário ----------
/** "14:30" ou "14:30:00" em minutos do dia. */
const emMinutos = (hora: string) => { const [h, m] = hora.split(':').map(Number); return h * MINUTOS_NA_HORA + m; };
/** Os minutos do dia que o compromisso ocupa na sala, [início, fim): sem hora de fim, MINUTOS_SEM_FIM; sem hora, o dia todo. */
export function minutosNaSala(hora: string | null | undefined, horaFim: string | null | undefined): [inicio: number, fim: number] {
  if (!hora) return [0, MINUTOS_NO_DIA];
  const inicio = emMinutos(hora);
  return [inicio, horaFim ? emMinutos(horaFim) : Math.min(inicio + MINUTOS_SEM_FIM, MINUTOS_NO_DIA)];
}
/** Os minutos como hora do relógio: 870 → "14:30" (o fim do dia é "24:00"). */
export const comoHora = (minutos: number) =>
  `${String(Math.floor(minutos / MINUTOS_NA_HORA)).padStart(2, '0')}:${String(minutos % MINUTOS_NA_HORA).padStart(2, '0')}`;

/**
 * O compromisso que já ocupa a sala no horário pedido, ou null se ela está livre. Começar quando o outro termina não é conflito.
 * `ocupacoes` são os compromissos da sala no mesmo dia; o próprio compromisso (ao mudar um) já vem de fora.
 */
export function conflitoNaSala(pedido: { hora: string | null | undefined; horaFim: string | null | undefined }, ocupacoes: readonly OcupacaoDaSala[]) {
  const [inicio, fim] = minutosNaSala(pedido.hora, pedido.horaFim);
  return ocupacoes.find(o => { const [i, f] = minutosNaSala(o.hora, o.hora_fim); return i < fim && inicio < f; }) ?? null;
}
/** O horário em que o compromisso ocupa a sala, por extenso: "das 14:00 às 15:00" ou "o dia inteiro". */
export const horarioNaSala = (o: Pick<OcupacaoDaSala, 'hora' | 'hora_fim'>) => {
  if (!o.hora) return 'o dia inteiro';
  const [inicio, fim] = minutosNaSala(o.hora, o.hora_fim);
  return `das ${comoHora(inicio)} às ${comoHora(fim)}`;
};
/** O aviso do conflito: com qual compromisso a sala está ocupada (o título só de quem a pessoa vê) e o que fazer. */
export const avisoDoConflito = (sala: string, o: OcupacaoDaSala) =>
  `A sala ${sala} já está ocupada ${horarioNaSala(o)} ${o.titulo ? `por "${o.titulo}" (${o.codigo})` : `pelo compromisso ${o.codigo}`}. Escolha outro horário ou outra sala.`;

// ---------- as opções do compromisso ----------
/** As salas que o cadastro de compromisso oferece: as ativas e, se o compromisso já está numa desativada, também ela. */
export const salasParaEscolher = (salas: readonly Sala[], atual: string | null | undefined) => salas.filter(s => s.ativa || s.id === atual);
/** Quantas pessoas cabem, por extenso: "1 pessoa", "6 pessoas". */
export const capacidadeDaSala = (n: number) => n === 1 ? '1 pessoa' : `${n} pessoas`;
/** O nome da sala como aparece no cartão e na escolha: "Sala 1 (6 pessoas)"; a desativada diz que está desativada. */
export const nomeDaSala = (s: Pick<Sala, 'nome' | 'capacidade' | 'ativa'>) => `${s.nome} (${capacidadeDaSala(s.capacidade)})${s.ativa ? '' : ' · desativada'}`;
/** A sala do compromisso, pelo id, entre as do escritório (null sem sala, ou se ela não está na lista). */
export const salaDoCompromisso = (salas: readonly Sala[], c: Pick<Compromisso, 'sala_id'>) => salas.find(s => s.id === c.sala_id) ?? null;

// ---------- o cadastro nas Configurações ----------
/** Duas salas do escritório com o mesmo nome (maiúsculas e acentos não contam): a mesma mensagem do banco (dados/erros.ts). */
export const SALA_REPETIDA = 'Já existe uma sala com esse nome.';
/** O formulário da sala, como digitado. */
export interface FormDaSala { nome: string; capacidade: string }
export const SALA_NOVA: FormDaSala = { nome: '', capacidade: '' };
export const formDaSala = (s: Pick<Sala, 'nome' | 'capacidade'>): FormDaSala => ({ nome: s.nome, capacidade: String(s.capacidade) });

type ConferenciaDaSala = (f: FormDaSala, salas: readonly Sala[], id?: string) => string | null;
/** As regras de cada campo, na ordem (a primeira que falhar dá a mensagem). Regra nova = entrada nova aqui. */
const CONFERENCIAS_DA_SALA: Record<keyof FormDaSala, ConferenciaDaSala[]> = {
  nome: [
    f => f.nome.trim() ? null : 'Dê um nome à sala.',
    f => f.nome.trim().length > TAMANHO_SALA.nome ? `O nome pode ter até ${TAMANHO_SALA.nome} caracteres.` : null,
    // Como o banco: maiúsculas e acentos não contam, e as desativadas também.
    (f, salas, id) => salas.some(s => s.id !== id && normal(s.nome.trim()) === normal(f.nome.trim())) ? SALA_REPETIDA : null
  ],
  capacidade: [
    f => f.capacidade.trim() ? null : 'Informe quantas pessoas cabem.',
    f => /^\d+$/.test(f.capacidade.trim()) && Number(f.capacidade) >= 1 && Number(f.capacidade) <= TAMANHO_SALA.capacidadeMaxima
      ? null : `A capacidade é um número de 1 a ${TAMANHO_SALA.capacidadeMaxima}.`
  ]
};
/** Os erros do formulário da sala, por campo (vazio: pode salvar). `id`: a sala sendo mudada, que não conta como repetida. */
export function errosDaSala(f: FormDaSala, salas: readonly Sala[], id?: string): Partial<Record<keyof FormDaSala, string>> {
  const erros: Partial<Record<keyof FormDaSala, string>> = {};
  for (const campo of Object.keys(CONFERENCIAS_DA_SALA) as (keyof FormDaSala)[]) {
    const erro = CONFERENCIAS_DA_SALA[campo].map(r => r(f, salas, id)).find(Boolean);
    if (erro) erros[campo] = erro;
  }
  return erros;
}
/** O que vai para o banco (só depois de errosDaSala vazio). */
export const dadosDaSala = (f: FormDaSala): DadosSala => ({ nome: f.nome.trim(), capacidade: Number(f.capacidade.trim()) });
