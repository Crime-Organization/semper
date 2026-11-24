// O compromisso que se repete (#307): por semana, mês ou ano, a cada N (a renovação de marca é "a cada 10 anos"), até uma data,
// depois de um número de vezes ou sem fim. Cada data é um cartão próprio na agenda. Tudo puro, sem tela nem banco.
//
// Cada data é contada a partir da primeira, e não da anterior, para não "escorregar": a repetição mensal do dia 31 cai no último
// dia dos meses mais curtos (28/02, 30/04) e volta ao dia 31 nos meses que o têm; a anual de 29/02 cai em 28/02 nos anos que não são
// bissextos. É a mesma conta do banco (privado.data_da_vez, em 20261122232804_compromissos_que_se_repetem.sql, que soma um
// "interval" à primeira data): os dois testes conferem os mesmos casos.
import type { CamposDasSeguintes, DadosCompromisso, FrequenciaRepeticao, RegraDeRepeticao, RepeticaoCompromisso, RepeticaoCriada } from '../dados/tipos';
import { REPETICAO } from '../dados/limites';
import { fmtData, lerData } from './pessoa';
import { DIAS_NA_SEMANA, somarDias } from './prazos';
import { avisoDaDemandaMudada, erroDosDiasAntes, type CamposDemandaDoCompromisso } from './demandaDoCompromisso';

/** Meses num ano. */
const MESES_NO_ANO = 12;
const partes = (iso: string) => iso.split('-').map(Number) as [number, number, number];
const doisDigitos = (n: number) => String(n).padStart(2, '0');
/** O último dia do mês (o mês contado de 0 a 11). */
const ultimoDiaDoMes = (ano: number, mes: number) => new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
/** Soma meses à data; o dia que não existe no mês de chegada vira o último dia dele (31/01 + 1 mês = 28/02 ou 29/02). */
export function somarMeses(iso: string, meses: number) {
  const [a, m, d] = partes(iso);
  const total = m - 1 + meses, ano = a + Math.floor(total / MESES_NO_ANO), mes = ((total % MESES_NO_ANO) + MESES_NO_ANO) % MESES_NO_ANO;
  return `${ano}-${doisDigitos(mes + 1)}-${doisDigitos(Math.min(d, ultimoDiaDoMes(ano, mes)))}`;
}

/** O que cada frequência tem de próprio: como aparece na escolha, o nome da unidade (uma e várias) e como soma N delas a uma data. */
export const FREQUENCIAS: Record<FrequenciaRepeticao, { nome: string; unidade: [string, string]; somar: (iso: string, n: number) => string }> = {
  semana: { nome: 'Toda semana', unidade: ['semana', 'semanas'], somar: (iso, n) => somarDias(iso, n * DIAS_NA_SEMANA) },
  mes: { nome: 'Todo mês', unidade: ['mês', 'meses'], somar: somarMeses },
  ano: { nome: 'Todo ano', unidade: ['ano', 'anos'], somar: (iso, n) => somarMeses(iso, n * MESES_NO_ANO) }
};
export const FREQUENCIAS_DA_REPETICAO = Object.keys(FREQUENCIAS) as FrequenciaRepeticao[];

/** A regra cabe nos limites do banco (as regras check da série): o N de 1 a intervaloMaximo, as vezes de 2 a vezesMaximas e um fim só. */
export const regraNoLimite = (r: RegraDeRepeticao) => Object.hasOwn(FREQUENCIAS, r.frequencia)
  && Number.isInteger(r.intervalo) && r.intervalo >= 1 && r.intervalo <= REPETICAO.intervaloMaximo
  && (r.vezes === null || (Number.isInteger(r.vezes) && r.vezes >= 2 && r.vezes <= REPETICAO.vezesMaximas)) && (r.ate === null || r.vezes === null);

/** A série com a primeira data, de onde todas as contas partem. */
export type SerieDeRepeticao = Pick<RepeticaoCompromisso, 'frequencia' | 'intervalo' | 'inicio' | 'ate' | 'vezes'>;
/** A data da vez n (a primeira é a vez 0), contada a partir da primeira. */
export const dataDaVez = (r: Pick<SerieDeRepeticao, 'frequencia' | 'intervalo' | 'inicio'>, n: number) => FREQUENCIAS[r.frequencia].somar(r.inicio, n * r.intervalo);

/** Uma data da série: a vez (a primeira é 0) e a data. */
export interface VezDaRepeticao { n: number; data: string }
/**
 * As datas que viram cartão, depois de `geradaAte` (a última que já virou) e a partir de hoje: as que caem até o horizonte (hoje mais
 * REPETICAO.horizonteMeses) e, sempre, pelo menos a próxima depois de hoje (a renovação daqui a 10 anos também aparece). Nunca passa do
 * fim da série (a data final ou o número de vezes, contando a primeira).
 */
export function vezesParaGerar(r: SerieDeRepeticao, geradaAte: string, hoje: string, horizonteMeses = REPETICAO.horizonteMeses): VezDaRepeticao[] {
  const limite = somarMeses(hoje, horizonteMeses), vezes: VezDaRepeticao[] = [];
  let temProxima = false;
  for (let n = 0; r.vezes === null || n < r.vezes; n++) {
    const data = dataDaVez(r, n);
    if ((r.ate !== null && data > r.ate) || (data > limite && temProxima)) break;
    temProxima ||= data > hoje;
    if (data > geradaAte && data >= hoje) vezes.push({ n, data });
  }
  return vezes;
}
/** A vez de uma data da série (a primeira vez cuja data chega a ela). */
export function vezDaData(r: Pick<SerieDeRepeticao, 'frequencia' | 'intervalo' | 'inicio'>, data: string) {
  let n = 0;
  while (dataDaVez(r, n) < data) n++;
  return n;
}

// ---------- quadro e tabela ----------
/** Uma data da série como a lista a conhece: aberta é a que não foi arquivada, realizada nem cancelada. */
export interface VezNaLista { id: string; data: string; hora: string | null; aberta: boolean }
const ordemDaVez = (a: VezNaLista, b: VezNaLista) => a.data.localeCompare(b.data) || (a.hora ?? '').localeCompare(b.hora ?? '') || a.id.localeCompare(b.id);
/**
 * O quadro e a tabela mostram só uma data de cada série: a próxima em aberto (a de hoje em diante que vem primeiro); sem nenhuma
 * adiante, a última em aberto que já passou (para não sumir o que ficou sem marcar). Sem nenhuma aberta, nenhuma (null). A agenda e o
 * calendário mostram todas. É a mesma escolha de public.no_quadro, no banco.
 */
export function vezNaLista(vezes: readonly VezNaLista[], hoje: string): string | null {
  const abertas = vezes.filter(v => v.aberta).toSorted(ordemDaVez);
  return (abertas.find(v => v.data >= hoje) ?? abertas.at(-1))?.id ?? null;
}

// ---------- cadastro ----------
/** Como a repetição termina: sem fim, numa data ou depois de um número de vezes. */
export type FimDaRepeticao = 'nunca' | 'data' | 'vezes';
export const FINS_DA_REPETICAO: Record<FimDaRepeticao, string> = { nunca: 'Sem fim', data: 'Até uma data', vezes: 'Depois de algumas vezes' };
/**
 * Os campos da repetição no cadastro do compromisso, como digitados. Sem `repetir`, o compromisso não se repete. A demanda de cada data
 * (`demandaDiasAntes`, #307 parte B) só vale com a repetição: a escolhida agora (`repetir`) ou a que o compromisso já tem (`seRepete`, no
 * lápis do cartão, #417, onde a demanda se liga, muda ou desliga).
 */
export interface CamposRepeticao extends CamposDemandaDoCompromisso {
  repetir: FrequenciaRepeticao | '';
  /** O N de "a cada N". */
  aCada: string;
  termina: FimDaRepeticao;
  /** dd/mm/aaaa. */
  repetirAte: string;
  repetirVezes: string;
  /** O compromisso já se repete (no lápis do cartão, #417): a repetição não se escolhe de novo, mas a demanda de cada data muda. */
  seRepete: boolean;
}
export const REPETICAO_VAZIA: CamposRepeticao = { repetir: '', aCada: '1', termina: 'nunca', repetirAte: '', repetirVezes: '', demandaDiasAntes: '', seRepete: false };

const inteiro = (t: string) => /^\d+$/.test(t.trim()) ? Number(t.trim()) : NaN;
const dataOuNada = (t: string) => { try { return lerData(t); } catch { return null; } };
type Conferencia = (c: CamposRepeticao & { data: string }) => string | null;
/** As conferências da repetição, por campo (a primeira que falhar dá a mensagem). Sem repetir, nada é conferido. */
export const CONFERENCIAS_DA_REPETICAO: Record<'aCada' | 'repetirAte' | 'repetirVezes' | 'demandaDiasAntes', Conferencia[]> = {
  aCada: [c => !c.repetir || (inteiro(c.aCada) >= 1 && inteiro(c.aCada) <= REPETICAO.intervaloMaximo) ? null : `Informe de 1 a ${REPETICAO.intervaloMaximo}.`],
  repetirAte: [
    c => !c.repetir || c.termina !== 'data' || c.repetirAte.trim() ? null : 'Informe até quando o compromisso se repete.',
    c => { if (!c.repetir || c.termina !== 'data') return null; try { lerData(c.repetirAte); return null; } catch (e) { return (e as Error).message; } },
    c => {
      const ate = c.repetir && c.termina === 'data' ? dataOuNada(c.repetirAte) : null, inicio = dataOuNada(c.data);
      return ate && inicio && ate <= inicio ? 'A data final precisa ser depois da data do compromisso.' : null;
    }
  ],
  repetirVezes: [c => !c.repetir || c.termina !== 'vezes' || (inteiro(c.repetirVezes) >= 2 && inteiro(c.repetirVezes) <= REPETICAO.vezesMaximas)
    ? null : `Informe de 2 a ${REPETICAO.vezesMaximas} vezes, contando a primeira.`],
  demandaDiasAntes: [c => c.repetir || c.seRepete ? erroDosDiasAntes(c.demandaDiasAntes) : null]
};

/** A regra que vai para o banco (só depois de conferida), ou null se o compromisso não se repete. */
export const regraDosCampos = (c: CamposRepeticao): RegraDeRepeticao | null => !c.repetir ? null : {
  frequencia: c.repetir, intervalo: inteiro(c.aCada),
  ate: c.termina === 'data' ? lerData(c.repetirAte) : null, vezes: c.termina === 'vezes' ? inteiro(c.repetirVezes) : null
};

const quantas = (n: number, uma: string, varias: string) => `${n} ${n === 1 ? uma : varias}`;
/** O que se soma ao aviso quando a sala estava ocupada em algumas das datas novas (nelas, o compromisso ficou sem sala). Nenhuma: nada. */
const avisoDaSalaOcupada = (semSala: readonly string[]) => semSala.length
  ? ` Em ${quantas(semSala.length, 'data', 'datas')} (${semSala.map(fmtData).join(', ')}), a sala estava ocupada, e o compromisso ficou sem sala.`
  : '';
/** O começo do aviso da repetição: no cadastro e no cartão (#431: o compromisso que passa a se repetir na janela das datas). */
const CADASTRADO_COM_REPETICAO = 'cadastrado, com';
export const REPETIDO_NO_CARTAO = 'passa a se repetir, com';
/**
 * O aviso depois de cadastrar o compromisso que se repete (ou de fazê-lo se repetir no cartão: `feito` = REPETIDO_NO_CARTAO):
 * quantas datas a mais e, se houver, em quantas a sala estava ocupada.
 */
export const avisoDaRepeticao = (codigo: string, criada: Pick<RepeticaoCriada, 'ids' | 'semSala'>, feito = CADASTRADO_COM_REPETICAO) =>
  `Compromisso ${codigo} ${feito} mais ${quantas(criada.ids.length, 'data', 'datas')} na agenda.` + avisoDaSalaOcupada(criada.semSala);

/** A repetição por extenso, como o cartão mostra: "Todo ano", "A cada 10 anos, até 31/12/2050", "Toda semana, 12 vezes". */
export function descreverRepeticao(r: Pick<RegraDeRepeticao, 'frequencia' | 'intervalo' | 'ate' | 'vezes'>) {
  const f = FREQUENCIAS[r.frequencia];
  const cada = r.intervalo === 1 ? f.nome : `A cada ${r.intervalo} ${f.unidade[1]}`;
  const fim = r.ate ? `, até ${fmtData(r.ate)}` : r.vezes ? `, ${r.vezes} vezes` : ', sem data para terminar';
  return cada + fim;
}

/** O que a mudança "esta e as seguintes" fez: muda as datas ou o horário, ou arquiva (e a repetição para). */
export type MudancaDasSeguintes = 'mudados' | 'arquivados';
const AVISOS_DAS_SEGUINTES: Record<MudancaDasSeguintes, (n: number) => string> = {
  mudados: n => `${quantas(n, 'compromisso mudado', 'compromissos mudados')} na repetição.`,
  arquivados: n => `${quantas(n, 'compromisso arquivado', 'compromissos arquivados')}. A repetição parou.`
};
/** O aviso depois de mudar ou arquivar "esta e as seguintes". */
export const avisoDasSeguintes = (mudanca: MudancaDasSeguintes, n: number) => AVISOS_DAS_SEGUINTES[mudanca](n);

/**
 * As recusas a quem não muda todas as datas em aberto da série (#307): "esta e as seguintes" e a demanda valem para a série inteira.
 * As mesmas mensagens do banco (20261123011949_repeticao_so_quem_muda_as_datas.sql) e do banco fictício.
 */
export const SEGUINTES_DE_OUTROS = 'Há datas seguintes desta repetição que você não pode mudar. Mude só esta data ou peça a quem cuida da repetição.';
export const DEMANDA_NA_SERIE_DE_OUTROS = 'Há datas desta repetição que você não pode mudar. Peça a quem cuida da repetição para marcar a demanda.';

// ---------- o lápis do cartão (#417) ----------
/** Os campos que o lápis muda "nesta e nas seguintes": o título, o local, a equipe e as pessoas. O banco aceita só estes. */
export const CAMPOS_DAS_SEGUINTES: readonly (keyof CamposDasSeguintes)[] = ['titulo', 'local', 'responsavel_id', 'participantes', 'pessoas'];
/** A recusa a outro campo, a mesma do banco (20261124135119_campos_das_seguintes.sql) e do banco fictício. */
export const SO_ESTES_CAMPOS_NAS_SEGUINTES = 'Só o título, o local, a equipe e as pessoas mudam nas datas seguintes.';
/** Os campos das seguintes que a gravação muda: os que \`depois\` traz e estão diferentes de \`antes\`. Nenhum: nada a perguntar. */
export function camposQueMudamNasSeguintes(antes: DadosCompromisso, depois: DadosCompromisso): CamposDasSeguintes {
  const iguais = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  return Object.fromEntries(CAMPOS_DAS_SEGUINTES.filter(campo => campo in depois && !iguais(antes[campo], depois[campo])).map(campo => [campo, depois[campo]]));
}

/** O que o lápis fez, além de gravar esta data: as seguintes que mudaram, as datas que nasceram e a demanda ligada, mudada ou desligada. */
export interface FeitoNoLapis {
  codigo: string;
  /** Quantas datas seguintes mudaram ("esta e as seguintes"); null: só esta. */
  seguintes: number | null;
  /** A repetição dada agora ao compromisso; null: nenhuma. */
  repetidos: Pick<RepeticaoCriada, 'ids' | 'semSala'> | null;
  /** A demanda de cada data, se mudou: os dias (null: desligada) e quantas já nasceram. */
  demanda: { dias: number | null; nascidas: number } | null;
}
/**
 * O aviso do lápis que mexe na repetição (sem Desfazer, como o "esta e as seguintes" da data), ou null se ele só gravou esta data (aí
 * vale o aviso de sempre, com Desfazer).
 */
export function avisoDoLapis(f: FeitoNoLapis): string | null {
  if (f.seguintes === null && !f.repetidos && !f.demanda) return null;
  const partes = [
    f.seguintes === null ? `Compromisso ${f.codigo} atualizado.` : avisoDasSeguintes('mudados', f.seguintes + 1),
    f.repetidos && `Ele agora se repete, com mais ${quantas(f.repetidos.ids.length, 'data', 'datas')} na agenda.${avisoDaSalaOcupada(f.repetidos.semSala)}`,
    f.demanda && avisoDaDemandaMudada(f.demanda.dias, f.demanda.nascidas)
  ];
  return partes.filter(Boolean).join(' ');
}
/** Como cada campo das seguintes aparece na pergunta. O responsável e os participantes são "a equipe". */
const NOMES_DOS_CAMPOS_DAS_SEGUINTES: Record<keyof CamposDasSeguintes, string> = {
  titulo: 'o título', local: 'o local', responsavel_id: 'a equipe', participantes: 'a equipe', pessoas: 'as pessoas'
};
/** Os campos por extenso, sem repetir, na ordem de CAMPOS_DAS_SEGUINTES: "o título", "o local e a equipe", "o título, o local e as pessoas". */
export function camposPorExtenso(campos: CamposDasSeguintes) {
  const nomes = [...new Set(CAMPOS_DAS_SEGUINTES.filter(c => c in campos).map(c => NOMES_DOS_CAMPOS_DAS_SEGUINTES[c]))];
  return nomes.length > 1 ? `${nomes.slice(0, -1).join(', ')} e ${nomes.at(-1)}` : nomes[0] ?? '';
}
/** A pergunta "só esta / esta e as seguintes" ao mudar os campos das seguintes (#417). */
export const perguntaDosCampos = (campos: CamposDasSeguintes) =>
  `Este compromisso se repete. Mudar ${camposPorExtenso(campos)} só nesta data, ou nesta e nas seguintes ainda em aberto?`;

/** Os passos do lápis na repetição, depois de gravar esta data (#417): as seguintes, a repetição nova e a demanda de cada data. */
export type PassoDoLapis = 'seguintes' | 'repetir' | 'demanda';
/**
 * A ordem dos passos. No compromisso que já se repete, a demanda vem antes das seguintes: quem se tira das seguintes ou passa a
 * responsabilidade delas a outro deixa de mudar as datas em aberto, e o banco recusaria a demanda (DEMANDA_NA_SERIE_DE_OUTROS). No que
 * ainda não se repete, a repetição nasce antes da demanda (não há seguintes a mudar).
 */
export const passosDoLapis = (seRepete: boolean): readonly PassoDoLapis[] => seRepete ? ['demanda', 'seguintes'] : ['repetir', 'demanda'];
/** O que não deu em cada passo, para a mensagem. */
const O_QUE_NAO_DEU: Record<PassoDoLapis, string> = {
  seguintes: 'mudar as seguintes', repetir: 'repeti-lo', demanda: 'mudar a demanda de cada data'
};
/** A mensagem de quando esta data ficou gravada e um passo da repetição não deu (os passos seguintes não rodam). */
export const falhaNoLapis = (codigo: string, passo: PassoDoLapis, motivo: string) =>
  `O compromisso ${codigo} foi atualizado, mas não foi possível ${O_QUE_NAO_DEU[passo]}: ${motivo}`;
