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
import { feriadosNacionais, somarDias, TIPOS_SEM_EXPEDIENTE } from './prazos';

/** Até quantos dias para trás se procura um dia útil (um ano, como a contagem dos prazos). Sem nenhum, fica o dia contado. */
const DIAS_PARA_TRAS = 366;
/** Os dias da semana sem expediente (0 = domingo, 6 = sábado). */
const FIM_DE_SEMANA = new Set([0, 6]);
const diaDaSemana = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay();

/**
 * O dia útil do escritório: nem fim de semana, nem feriado nacional, nem um dia sem expediente lançado para todos os órgãos (o
 * lançado para um órgão só vale nos prazos dos processos dele; a suspensão só de prazos tem expediente).
 */
export function diaUtilDoEscritorio(iso: string, lancados: readonly DiaLancado[]) {
  if (FIM_DE_SEMANA.has(diaDaSemana(iso))) return false;
  if (feriadosNacionais(Number(iso.slice(0, 4))).some(f => f.data === iso)) return false;
  return !lancados.some(d => d.data === iso && d.orgao_id === null && !TIPOS_SEM_EXPEDIENTE[d.tipo].expediente);
}

/** O dia em que a demanda nasce: `dias` corridos antes de `data`, recuando ao dia útil anterior. */
export function diaDaDemanda(data: string, dias: number, lancados: readonly DiaLancado[] = []) {
  const contado = somarDias(data, -dias);
  for (let i = 0; i <= DIAS_PARA_TRAS; i++) {
    const dia = somarDias(contado, -i);
    if (diaUtilDoEscritorio(dia, lancados)) return dia;
  }
  return contado;
}

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
