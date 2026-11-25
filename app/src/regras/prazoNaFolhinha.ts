// O prazo como a folhinha do cartão da tarefa o mostra (#442, opção 9 aprovada pelo dono em 25/11), sem tela nem banco: a
// folhinha (o mês curto, o dia e o dia da semana), a frase principal ao lado ("Faltam 2 dias", "Vence hoje", "Venceu há 2 dias",
// "Sem prazo", "Concluída") e o detalhe embaixo dela (a hora e o lembrete: "Às 18:00 · lembrete 1 h antes"; na concluída, quanto
// antes ou depois do prazo ela terminou). Na tarefa concluída, a folhinha mostra o dia da conclusão. O dia de hoje vem por
// parâmetro (a tela passa hojeISO(), o mesmo do selo do prazo), nunca de um new Date() solto.
import type { Lembrete } from '../dados/tipos';
import { DIAS_DA_SEMANA, MESES } from './calendario';
import { fmtHora } from './compromisso';
import { situacaoDoPrazo } from './demanda';
import { isoNoEscritorio } from './fuso';
import { CURTO_DO_LEMBRETE } from './lembrete';
import { fmtData } from './pessoa';
import { diasEntre } from './prazos';

/** Quantas letras do mês a folhinha mostra ("nov"). */
const LETRAS_DO_MES = 3;
/** O que sai do dia da semana na folhinha, para caber nela ("sexta-feira" vira "sexta"). */
const FEIRA = '-feira';

/** A folhinha de um dia: o mês curto, o dia, o dia da semana curto e, para o leitor de tela, o dia por extenso. */
export interface FolhaDoDia { mes: string; dia: string; semana: string; porExtenso: string }

/** A folhinha do dia aaaa-mm-dd: "nov", "27", "sexta" e "sexta-feira, 27/11/2026". */
export function folhaDoDia(iso: string): FolhaDoDia {
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
  const semana = DIAS_DA_SEMANA[new Date(Date.UTC(a, m - 1, d)).getUTCDay()];
  return { mes: MESES[m - 1].slice(0, LETRAS_DO_MES), dia: String(d), semana: semana.replace(FEIRA, ''), porExtenso: `${semana}, ${fmtData(iso)}` };
}

/** "1 dia" ou "N dias". */
export const quantosDias = (n: number) => n === 1 ? '1 dia' : `${n} dias`;

/** A primeira letra em maiúscula ("lembrete 1 h antes" sozinho vira "Lembrete 1 h antes"). */
const comMaiuscula = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1);

/**
 * A linha da hora e do lembrete, embaixo da frase do prazo: "Às 18:00 · lembrete 1 h antes"; sem hora, "Lembrete 1 h antes"; sem
 * lembrete, "Às 18:00"; sem nenhum dos dois, nada (null).
 */
export function detalheDoPrazo(hora: string | null | undefined, lembrete: Lembrete | null | undefined) {
  const pedacos = [hora ? `às ${fmtHora(hora)}` : '', lembrete !== null && lembrete !== undefined && CURTO_DO_LEMBRETE[lembrete] ? `lembrete ${CURTO_DO_LEMBRETE[lembrete]}` : '']
    .filter(Boolean);
  return pedacos.length ? comMaiuscula(pedacos.join(' · ')) : null;
}

/** Quanto antes ou depois do prazo a tarefa foi concluída: "1 dia antes do prazo", "No dia do prazo", "2 dias depois do prazo". */
export function antesOuDepoisDoPrazo(diaDaConclusao: string, prazo: string) {
  const n = diasEntre(diaDaConclusao, prazo);
  if (!n) return 'No dia do prazo';
  return n > 0 ? `${quantosDias(n)} antes do prazo` : `${quantosDias(-n)} depois do prazo`;
}

/** O tom da frase principal: o de sempre, calmo (sem prazo, em cinza) ou vencido (em vermelho). */
export type TomDoPrazo = 'normal' | 'calmo' | 'vencido';
/** O que o bloco do prazo mostra. */
export interface PrazoNaFolhinha {
  /** O dia da folhinha (aaaa-mm-dd): o do prazo ou, na concluída, o da conclusão. Sem ele (sem prazo), não há folhinha. */
  dia: string | null;
  principal: string;
  tom: TomDoPrazo;
  detalhe: string | null;
  /** Clicar na folhinha abre a janela das datas (na concluída, a folhinha é o dia da conclusão, e não abre nada). */
  folhinhaAbre: boolean;
}
/** O que a regra precisa da tarefa. */
export interface PrazoDoItem {
  prazo: string | null;
  prazo_hora?: string | null;
  lembrete?: Lembrete | null;
  /** O instante da conclusão (com fuso), ou null na tarefa aberta. */
  concluida_em?: string | null;
}

/** Em que pé está o prazo, do jeito que a folhinha o mostra. */
export type SituacaoDaFolhinha = 'sem-prazo' | 'em_dia' | 'hoje' | 'vencido' | 'concluida';
// A situação do selo do prazo (situacaoDoPrazo, só pela data), sem o "concluído", que aqui vem da conclusão da própria tarefa.
const situacaoDaFolhinha = (v: PrazoDoItem, hoje: string): SituacaoDaFolhinha =>
  v.concluida_em ? 'concluida' : (situacaoDoPrazo(v.prazo, hoje) ?? 'sem-prazo') as SituacaoDaFolhinha;

/** O que cada situação mostra (padrão State: uma situação nova é uma entrada nova). */
const NA_FOLHINHA: Record<SituacaoDaFolhinha, (v: PrazoDoItem, hoje: string) => PrazoNaFolhinha> = {
  'sem-prazo': () => ({ dia: null, principal: 'Sem prazo', tom: 'calmo', detalhe: null, folhinhaAbre: false }),
  'em_dia': (v, hoje) => {
    const n = diasEntre(hoje, v.prazo!);
    return { dia: v.prazo, principal: n === 1 ? 'Falta 1 dia' : `Faltam ${n} dias`, tom: 'normal', detalhe: detalheDoPrazo(v.prazo_hora, v.lembrete), folhinhaAbre: true };
  },
  'hoje': v => ({ dia: v.prazo, principal: 'Vence hoje', tom: 'normal', detalhe: detalheDoPrazo(v.prazo_hora, v.lembrete), folhinhaAbre: true }),
  'vencido': (v, hoje) => ({ dia: v.prazo, principal: `Venceu há ${quantosDias(diasEntre(v.prazo!, hoje))}`, tom: 'vencido',
    detalhe: detalheDoPrazo(v.prazo_hora, v.lembrete), folhinhaAbre: true }),
  'concluida': v => {
    const dia = isoNoEscritorio(v.concluida_em!);
    return { dia, principal: 'Concluída', tom: 'normal', detalhe: v.prazo ? antesOuDepoisDoPrazo(dia, v.prazo) : 'Sem prazo', folhinhaAbre: false };
  }
};

/** O bloco do prazo da tarefa: a folhinha, a frase principal e o detalhe. */
export const prazoNaFolhinha = (v: PrazoDoItem, hoje: string): PrazoNaFolhinha => NA_FOLHINHA[situacaoDaFolhinha(v, hoje)](v, hoje);
