// A janela das datas do cartão (#422): as datas de um item (o início e a entrega da tarefa e da demanda, a data e o horário do
// compromisso, a assinatura do contrato) abrem numa janela pequena que flutua sobre o cartão, como a das etiquetas. Nela ficam o
// calendário do mês, cada data com a caixa de marcar (a que pode ficar sem data), a hora, o lembrete, Salvar e Remover. O
// calendário escreve na data ativa (a última em que a pessoa clicou). No cartão, só um resumo curto.
// Aqui, o rascunho da janela e o que cada clique faz nele. Tudo puro, sem tela nem banco: o que cada módulo grava fica em
// regras/datasNoCartao.ts.
import type { Lembrete } from '../dados/tipos';
import { DIA, MINUTO } from '../ui/tempos';
import { fmtData } from './pessoa';

/** As duas datas que a janela pode ter: o início e a entrega (no compromisso, a data dele; no contrato, a assinatura). */
export type QualData = 'inicio' | 'entrega';

/** O rascunho da janela: as datas como a pessoa escreve (dd/mm/aaaa), se estão marcadas, a hora, o fim e o lembrete. */
export interface CamposDasDatas {
  inicio: string;
  temInicio: boolean;
  entrega: string;
  temEntrega: boolean;
  /** A hora da entrega (hh:mm), ou vazio. */
  hora: string;
  /** O fim do horário (o "Até" do compromisso), ou vazio. */
  horaFim: string;
  lembrete: Lembrete | null;
  /** Como o item passa a se repetir (#431; no compromisso: 'semana', 'mes', 'ano'), ou vazio: "Nunca" (não muda nada). */
  repetir: string;
}
/** Os campos que podem ter erro na janela. */
export type CampoDasDatas = 'inicio' | 'entrega' | 'hora' | 'horaFim' | 'lembrete';

/** A janela sem data nenhuma. */
export const DATAS_VAZIAS: CamposDasDatas = { inicio: '', temInicio: false, entrega: '', temEntrega: false, hora: '', horaFim: '', lembrete: null, repetir: '' };

/** O que a janela de um item tem: as datas que existem nele e se cada uma pode ficar sem data (a caixa de marcar). */
export interface PartesDasDatas { inicio?: { opcional: boolean }; entrega?: { opcional: boolean } }

/** A caixa de marcar de cada data e o texto dela, no rascunho (uma tabela, para o início e a entrega se tratarem igual). */
const CAMPOS_DA_DATA: Record<QualData, { texto: 'inicio' | 'entrega'; marcada: 'temInicio' | 'temEntrega' }> = {
  inicio: { texto: 'inicio', marcada: 'temInicio' },
  entrega: { texto: 'entrega', marcada: 'temEntrega' }
};

/** O texto da data no rascunho. */
export const textoDaData = (c: CamposDasDatas, qual: QualData) => c[CAMPOS_DA_DATA[qual].texto];
/** A data está marcada no rascunho? */
export const dataMarcada = (c: CamposDasDatas, qual: QualData) => c[CAMPOS_DA_DATA[qual].marcada];

/**
 * A data que o calendário preenche quando a janela abre: a entrega, se o item tem uma; senão, o início. A entrega desmarcada, numa
 * janela que também tem o início (a tarefa sem prazo), não é a ativa (#431): o calendário mostra o início, que tem data; para dar
 * um prazo, a pessoa marca a entrega, e ela passa a ser a ativa.
 */
export const dataAtivaAoAbrir = (partes: PartesDasDatas, c?: CamposDasDatas): QualData =>
  !partes.entrega || (partes.inicio && partes.entrega.opcional && c && !dataMarcada(c, 'entrega')) ? 'inicio' : 'entrega';

/** A outra data da janela (a entrega, para o início; o início, para a entrega). */
const OUTRA_DATA: Record<QualData, QualData> = { inicio: 'entrega', entrega: 'inicio' };
/**
 * A data que o calendário preenche depois que a pessoa desmarca uma data (#431): se era a ativa, passa a ser a outra (a entrega
 * desmarcada leva o calendário, e a borda verde, ao início); se a janela não tem outra, ou a desmarcada não era a ativa, nada muda.
 */
export const dataAtivaAoDesmarcar = (partes: PartesDasDatas, ativa: QualData, desmarcada: QualData): QualData =>
  ativa === desmarcada && partes[OUTRA_DATA[desmarcada]] ? OUTRA_DATA[desmarcada] : ativa;

/** A pessoa escolheu um dia no calendário (aaaa-mm-dd): ele vai para a data ativa, que fica marcada. */
export function escolherDia(c: CamposDasDatas, qual: QualData, iso: string): CamposDasDatas {
  const { texto, marcada } = CAMPOS_DA_DATA[qual];
  return { ...c, [texto]: fmtData(iso), [marcada]: true };
}
/** A pessoa escreveu na data: o texto muda e a data fica marcada (escrever é querer a data). */
export function escreverData(c: CamposDasDatas, qual: QualData, texto: string): CamposDasDatas {
  const campos = CAMPOS_DA_DATA[qual];
  return { ...c, [campos.texto]: texto, [campos.marcada]: true };
}
/**
 * A pessoa marcou ou desmarcou a caixa da data. Marcada sem data escrita, a data começa no dia de hoje (aaaa-mm-dd, no horário de
 * Brasília, que a tela passa); desmarcada, o texto fica (para voltar se ela mudar de ideia), mas não vale ao salvar.
 */
export function marcarData(c: CamposDasDatas, qual: QualData, marcada: boolean, hoje: string): CamposDasDatas {
  const campos = CAMPOS_DA_DATA[qual];
  const texto = marcada && !c[campos.texto].trim() ? fmtData(hoje) : c[campos.texto];
  return { ...c, [campos.texto]: texto, [campos.marcada]: marcada };
}

/**
 * O rascunho como ele vale: a data desmarcada não conta (fica vazia) e, sem a entrega, a hora, o fim e o lembrete vão junto. A
 * data que não pode ficar vazia (sem caixa de marcar) conta sempre.
 */
export function datasQueValem(c: CamposDasDatas, partes: PartesDasDatas): CamposDasDatas {
  const temInicio = !!partes.inicio && (!partes.inicio.opcional || c.temInicio);
  const temEntrega = !!partes.entrega && (!partes.entrega.opcional || c.temEntrega);
  const entrega = temEntrega ? c.entrega : '';
  const semEntrega = !entrega.trim();
  return {
    inicio: temInicio ? c.inicio : '', temInicio, entrega, temEntrega,
    hora: semEntrega ? '' : c.hora, horaFim: semEntrega ? '' : c.horaFim, lembrete: semEntrega ? null : c.lembrete, repetir: c.repetir
  };
}

/** Há alguma data que o Remover pode tirar? Só as que podem ficar sem data e estão marcadas. */
export const podeRemover = (c: CamposDasDatas, partes: PartesDasDatas) =>
  (Object.keys(CAMPOS_DA_DATA) as QualData[]).some(qual => partes[qual]?.opcional && dataMarcada(c, qual) && textoDaData(c, qual).trim() !== '');

/** O Remover: tira as datas que podem ficar sem data (e, sem a entrega, a hora e o lembrete); as obrigatórias ficam. */
export function removerDatas(c: CamposDasDatas, partes: PartesDasDatas): CamposDasDatas {
  const sem = { ...c };
  if (partes.inicio?.opcional) sem.temInicio = false;
  if (partes.entrega?.opcional) sem.temEntrega = false;
  return datasQueValem(sem, partes);
}

/** O rascunho mudou alguma coisa que vale, em relação ao que estava gravado? (Sem mudança, Salvar só fecha a janela.) */
export const datasMudaram = (rascunho: CamposDasDatas, gravado: CamposDasDatas, partes: PartesDasDatas) =>
  JSON.stringify(datasQueValem(rascunho, partes)) !== JSON.stringify(datasQueValem(gravado, partes));

/** Um pedaço do resumo do cartão: o nome curto da data ("Início") e o valor ("20/11/2026"). */
export interface PedacoDoResumo { rotulo: string; valor: string }
/** O separador entre os pedaços do resumo curto. */
export const SEPARADOR_DO_RESUMO = ' · ';
/** O resumo curto das datas, para o cartão e o leitor de tela: "Início 20/11/2026 · Entrega 15/12/2030 às 14:00". */
export const resumoDasDatas = (pedacos: readonly PedacoDoResumo[]) => pedacos.map(p => p.rotulo ? `${p.rotulo} ${p.valor}` : p.valor).join(SEPARADOR_DO_RESUMO);

/** A escolha de quem não se repete, no começo da lista da repetição (#431). */
export const NUNCA_SE_REPETE = 'Nunca';

/** De quantos em quantos minutos vem a lista de horários da janela (#431): 09:00, 09:15, 09:30… (a audiência das 14:15 cabe). */
export const PASSO_DA_LISTA_DE_HORARIOS = 15;
/** O último minuto do dia, no fim da lista: o prazo eletrônico vale até as 23:59. */
export const FIM_DO_DIA = '23:59';
/** Quantos minutos tem o dia. */
const MINUTOS_DO_DIA = DIA / MINUTO;
/** Quantos minutos tem a hora. */
const MINUTOS_DA_HORA = 60;

/** Os minutos do dia em hh:mm ("09:05"). */
const horaDosMinutos = (minutos: number) =>
  `${String(Math.floor(minutos / MINUTOS_DA_HORA)).padStart(2, '0')}:${String(minutos % MINUTOS_DA_HORA).padStart(2, '0')}`;

/**
 * Os horários da lista da hora (#431): do 00:00 ao 23:45, de 15 em 15 minutos, e o 23:59. A hora gravada que não está na lista
 * (ex.: 20:38, de antes da lista) entra no lugar dela, para continuar escolhida.
 */
export function horariosDaLista(atual = ''): string[] {
  const lista = Array.from({ length: MINUTOS_DO_DIA / PASSO_DA_LISTA_DE_HORARIOS }, (_, i) => horaDosMinutos(i * PASSO_DA_LISTA_DE_HORARIOS));
  lista.push(FIM_DO_DIA);
  return atual && !lista.includes(atual) ? [...lista, atual].sort() : lista;
}
