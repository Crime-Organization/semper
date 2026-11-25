// A demanda que nasce de cada data do compromisso que se repete (#307, parte B). Tudo puro, sem tela nem banco.
//
// N dias corridos antes da data do compromisso nasce uma demanda para o trabalho daquela vez. Se esse dia cair num fim de semana, num
// feriado nacional ou num dia sem expediente que o escritório lançou no Calendário para todos os órgãos, ela nasce no dia útil anterior.
// É a mesma conta do banco (privado.dia_da_demanda, em supabase/migrations/20261123000750_demandas_dos_compromissos.sql): os dois testes
// conferem os mesmos casos. O responsável da demanda é avisado na caixa de Mensagens quando ela nasce, quando a data do compromisso muda
// (o prazo acompanha) e quando o compromisso é cancelado (a demanda fica).
import type { AvisoDaDemandaDoCompromisso, DemandaDoCompromissoDaMensagem, DiaLancado } from '../dados/tipos';
import { DEMANDA_DO_COMPROMISSO, TAMANHO_DEMANDA } from '../dados/limites';
import { fmtData } from './pessoa';
import { somarDias } from './prazos';
import { diaUtil, diaUtilAteODia } from '../../../supabase/functions/_compartilhado/diaUtilAnterior';

/**
 * O dia útil do escritório: nem fim de semana, nem feriado nacional, nem um dia sem expediente lançado para todos os órgãos (o
 * lançado para um órgão só vale nos prazos dos processos dele; a suspensão só de prazos tem expediente). A conta fica em
 * supabase/functions/_compartilhado/diaUtilAnterior.ts, a mesma da agenda do Google (#439).
 */
export const diaUtilDoEscritorio = (iso: string, lancados: readonly DiaLancado[]) => diaUtil(iso, lancados);

/** O dia em que a demanda nasce: `dias` corridos antes de `data`, recuando ao dia útil anterior (ou ficando nele, se for útil). */
export const diaDaDemanda = (data: string, dias: number, lancados: readonly DiaLancado[] = []) => diaUtilAteODia(somarDias(data, -dias), lancados);

/** O título da demanda: o do compromisso com a data, cortado para caber no da demanda. "Reunião mensal (10/12/2026)". */
export function tituloDaDemanda(titulo: string | null, data: string) {
  const sufixo = ` (${fmtData(data)})`;
  return (titulo?.trim() || 'Compromisso').slice(0, TAMANHO_DEMANDA.titulo - sufixo.length) + sufixo;
}

// ---------- cadastro ----------
/** O campo "Gerar demanda" no cadastro do compromisso que se repete, como digitado: vazio, não gera. */
export interface CamposDemandaDoCompromisso { demandaDiasAntes: string }
const inteiro = (t: string) => /^\d+$/.test(t.trim()) ? Number(t.trim()) : NaN;
/** A conferência do campo: de 1 a DEMANDA_DO_COMPROMISSO.diasMaximos dias, ou vazio (não gera). */
export function erroDosDiasAntes(t: string): string | null {
  if (!t.trim()) return null;
  const n = inteiro(t);
  return n >= 1 && n <= DEMANDA_DO_COMPROMISSO.diasMaximos ? null : `Informe de 1 a ${DEMANDA_DO_COMPROMISSO.diasMaximos} dias, ou deixe em branco.`;
}
/** Os dias que vão para o banco (só depois de conferido), ou null: não gera demanda. */
export const diasAntesDosCampos = (c: CamposDemandaDoCompromisso) => c.demandaDiasAntes.trim() ? inteiro(c.demandaDiasAntes) : null;

const quantas = (n: number, uma: string, varias: string) => `${n} ${n === 1 ? uma : varias}`;
/** Como o cartão mostra: "Nasce 7 dias antes de cada data". */
export const descreverDemandaDoCompromisso = (dias: number) => `Nasce ${quantas(dias, 'dia', 'dias')} antes de cada data`;
/** O que se soma ao aviso do cadastro: as demandas que já nasceram (as datas que já estavam no prazo). Nenhuma: nada. */
export const avisoDasDemandasNascidas = (n: number) => n ? ` ${quantas(n, 'demanda já nasceu', 'demandas já nasceram')} para as datas mais próximas.` : '';
/**
 * O aviso do lápis do cartão que liga, muda ou desliga a demanda de uma repetição que já existe (#417): vale para as datas em aberto. As
 * demandas que já nasceram ficam (são trabalho de verdade); desligada, não nasce mais nenhuma.
 */
export const avisoDaDemandaMudada = (dias: number | null, nascidas: number) => dias === null
  ? 'As datas em aberto não geram mais demanda. As que já nasceram continuam.'
  : `A demanda passa a nascer ${quantas(dias, 'dia', 'dias')} antes de cada data em aberto.${avisoDasDemandasNascidas(nascidas)}`;

// ---------- caixa de Mensagens ----------
/** O que o aviso tem para montar o texto (a demanda vem à parte: sem ela, a caixa só diz que a pessoa não a vê mais). */
type ParaOAvisoDaDemanda = Pick<DemandaDoCompromissoDaMensagem, 'data_antes' | 'data_nova'>;
/** Cada aviso: o que diz e o rótulo da linha (para quem não enxerga a tela). Aviso novo = uma entrada nova. */
export const AVISOS_DA_DEMANDA_DO_COMPROMISSO: Record<AvisoDaDemandaDoCompromisso, { nome: string; trecho: (m: ParaOAvisoDaDemanda) => string }> = {
  demanda_nova: {
    nome: 'Demanda nova do compromisso',
    trecho: m => `Nasceu do compromisso de ${fmtData(m.data_nova)}, que se repete. Você é o responsável.`
  },
  data_mudou: {
    nome: 'Compromisso com data mudada',
    trecho: m => `O compromisso de que ela nasceu passou de ${fmtData(m.data_antes)} para ${fmtData(m.data_nova)}. O prazo da demanda acompanhou, se ainda era a data antiga.`
  },
  cancelado: {
    nome: 'Compromisso cancelado',
    trecho: m => `O compromisso de ${fmtData(m.data_nova)}, de que ela nasceu, foi cancelado. A demanda continua: veja se ainda é preciso.`
  }
};
/** O texto quando a pessoa não vê mais a demanda. */
export const DEMANDA_QUE_NAO_VE = 'Este aviso é de uma demanda que você não vê mais.';
/** O endereço do cartão da demanda. */
export const enderecoDaDemanda = (id: string) => `/demandas/?${new URLSearchParams({ id })}`;

// ---------- o lápis do cartão (#417) ----------
/** O que o lápis sabe para decidir a demanda de cada data. */
export interface DemandaNoLapis {
  /** O módulo Demandas está ligado no escritório. */
  modulo: boolean;
  /** Os dias do campo "Gerar demanda" (diasAntesDosCampos); null: em branco. */
  dias: number | null;
  /** Os dias que a repetição já tem; null: não gera. */
  atual: number | null;
  /** O lápis acabou de dar repetição ao compromisso. */
  repetiuAgora: boolean;
  /** O compromisso já se repetia ao abrir o lápis. */
  seRepete: boolean;
}
/**
 * O que o lápis grava na demanda de cada data (#417), como o cadastro: undefined, não mexe; null, desliga; um número, os dias. Com o
 * módulo Demandas desligado, não mexe. Na repetição dada agora, só liga, e só se houver dias. Na que já se repete, liga, muda ou
 * desliga, só se os dias mudaram.
 */
export function demandaAGravar(d: DemandaNoLapis): number | null | undefined {
  if (!d.modulo) return undefined;
  if (d.repetiuAgora) return d.dias ?? undefined;
  return d.seRepete && d.dias !== d.atual ? d.dias : undefined;
}
