// Hora e lembrete nos prazos de tarefas e demandas (#286): as opções de lembrete, como o prazo aparece com a hora e quando o
// lembrete chega. Tudo puro, sem tela nem banco. Quem cria os lembretes é o banco (privado.gerar_lembretes, em
// supabase/migrations/20261110022014_lembretes_dos_prazos.sql); o banco fictício faz a mesma conta com estas funções.
import type { Lembrete } from '../dados/tipos';
import { MINUTO } from '../ui/tempos';
import { fmtHora } from './compromisso';
import { fmtData } from './pessoa';

/**
 * A hora em que o lembrete conta o prazo que não tem hora (no relógio de Brasília). É a mesma de
 * privado.hora_padrao_do_lembrete(), em supabase/migrations/20261110022014_lembretes_dos_prazos.sql: mudou aqui, muda lá também.
 */
export const HORA_PADRAO_DO_LEMBRETE = '09:00';
/**
 * O fuso de Brasília em relação ao UTC. O Brasil não tem horário de verão, então é fixo (como as rotinas do banco,
 * que contam o prazo "at time zone 'America/Sao_Paulo'").
 */
export const FUSO_DE_BRASILIA = '-03:00';
/**
 * Até quantos minutos depois do prazo o lembrete ainda é criado, se a rotina de um minuto perdeu a vez. Depois disso, o
 * prazo já passou e o lembrete não chega mais. O mesmo número de privado.tolerancia_do_lembrete(), em 20261110022014_lembretes_dos_prazos.sql.
 */
export const TOLERANCIA_DO_LEMBRETE_EM_MINUTOS = 15;

/**
 * Os lembretes que se pode marcar (os minutos de antecedência são a chave, como o banco guarda) e como cada um aparece:
 * "nome" na escolha do formulário, "texto" no cartão, no histórico e na caixa de Mensagens. Opção nova = uma entrada
 * nova aqui e na regra da coluna "lembrete" do banco.
 */
export const LEMBRETES: Record<Lembrete, { nome: string; texto: string }> = {
  0: { nome: 'Na hora do prazo', texto: 'na hora do prazo' },
  30: { nome: '30 minutos antes', texto: '30 minutos antes' },
  60: { nome: '1 hora antes', texto: '1 hora antes' },
  1440: { nome: '1 dia antes', texto: '1 dia antes' }
};
/** As opções na ordem da escolha: da mais perto do prazo à mais longe. */
export const OPCOES_DE_LEMBRETE = (Object.keys(LEMBRETES).map(Number) as Lembrete[]).sort((a, b) => a - b);
/** A escolha de quando não há lembrete. */
export const SEM_LEMBRETE = 'Sem lembrete';

/** O lembrete escolhido no formulário (o valor da opção), ou null sem lembrete ou com um valor que não é opção. */
export const lerLembrete = (valor: string): Lembrete | null =>
  valor !== '' && Object.hasOwn(LEMBRETES, valor) ? Number(valor) as Lembrete : null;
/** Como o lembrete aparece no cartão e no histórico: "1 hora antes", "Na hora do prazo", "Sem lembrete". */
export const textoDoLembrete = (l: Lembrete | null | undefined) => l === null || l === undefined || !LEMBRETES[l] ? SEM_LEMBRETE : LEMBRETES[l].nome;
/** O título do lembrete na caixa de Mensagens: "Lembrete: 1 hora antes" (sem a antecedência, só "Lembrete"). */
export const rotuloDoLembrete = (l: Lembrete | null | undefined) => l === null || l === undefined || !LEMBRETES[l] ? 'Lembrete' : `Lembrete: ${LEMBRETES[l].texto}`;

/** A hora curta, como se fala: "09:00" → "9h", "14:30" → "14h30". */
export const horaCurta = (hora: string) => {
  const [h, m] = fmtHora(hora).split(':');
  return `${Number(h)}h${m && m !== '00' ? m : ''}`;
};
/** A dica do formulário: quem recebe e como conta o prazo sem hora. */
export const DICA_DO_LEMBRETE = `Opcional. Chega na caixa de Mensagens (e por e-mail) do responsável e de quem está junto. Sem hora, o lembrete conta o prazo às ${horaCurta(HORA_PADRAO_DO_LEMBRETE)}.`;

/** O prazo com a hora, quando há: "15/11/2030 às 14:00" (sem hora, só a data). */
export const prazoComHora = (data: string | null | undefined, hora: string | null | undefined) =>
  data ? fmtData(data) + (hora ? ` às ${fmtHora(hora)}` : '') : '';

/** O instante do prazo, para o lembrete: a data e a hora em Brasília; sem hora, às 9h (HORA_PADRAO_DO_LEMBRETE). */
export const momentoDoPrazo = (data: string, hora: string | null | undefined) =>
  new Date(`${data.slice(0, 10)}T${fmtHora(hora) || HORA_PADRAO_DO_LEMBRETE}:00${FUSO_DE_BRASILIA}`);
/** Quando o lembrete chega: o instante do prazo menos a antecedência escolhida. */
export const instanteDoLembrete = (data: string, hora: string | null | undefined, lembrete: Lembrete) =>
  new Date(momentoDoPrazo(data, hora).getTime() - lembrete * MINUTO);
/**
 * O lembrete chega agora? Depois do instante dele e até a tolerância depois do prazo (o prazo que já passou não lembra).
 * É a conta de privado.gerar_lembretes.
 */
export const lembreteChegou = (data: string, hora: string | null | undefined, lembrete: Lembrete, agora: Date) =>
  instanteDoLembrete(data, hora, lembrete).getTime() <= agora.getTime()
  && agora.getTime() <= momentoDoPrazo(data, hora).getTime() + TOLERANCIA_DO_LEMBRETE_EM_MINUTOS * MINUTO;

/** Os campos do formulário que a hora e o lembrete pedem (a tarefa e a demanda têm os mesmos nomes). */
export interface CamposDoLembrete { prazo: string; hora: string; lembrete: Lembrete | null }
/** Hora e lembrete só valem com o prazo: as conferências do formulário de tarefa e de demanda. */
export const CONFERENCIAS_DO_LEMBRETE = {
  hora: [(c: CamposDoLembrete) => c.hora && !c.prazo.trim() ? 'Informe o prazo para pôr a hora' : null],
  lembrete: [(c: CamposDoLembrete) => c.lembrete !== null && !c.prazo.trim() ? 'Informe o prazo para marcar o lembrete' : null]
};
/**
 * A hora e o lembrete do cartão salvo, para o formulário: sem prazo, os dois vêm vazios. O site antigo, que não conhece as
 * colunas novas, pode ter tirado o prazo deixando os dois no banco; assim a edição não trava em campos que a pessoa não vê.
 */
export const horaELembreteDoCartao = (c: { prazo: string | null; prazo_hora?: string | null; lembrete?: Lembrete | null }): Pick<CamposDoLembrete, 'hora' | 'lembrete'> =>
  c.prazo ? { hora: fmtHora(c.prazo_hora), lembrete: c.lembrete ?? null } : { hora: '', lembrete: null };
/** O que vai para o banco: sem prazo, a hora e o lembrete ficam vazios. */
export const horaELembreteAoGravar = (prazo: string | null, c: Pick<CamposDoLembrete, 'hora' | 'lembrete'>) =>
  ({ prazo_hora: prazo ? c.hora || null : null, lembrete: prazo ? c.lembrete : null });
