// Calendário do escritório: junta os dias sem expediente prontos (regras/prazos.ts) com os órgãos e os dias que o
// escritório lançou. Serve para duas coisas: mostrar o ano, período a período, e contar os prazos de um órgão.
// Tudo puro, sem tela nem banco. As datas entram e saem como "aaaa-mm-dd".
import type { DadosOrgao, DiaLancado, LinhaDeLancamento, Orgao } from '../dados/tipos';
import { ANOS_DO_CALENDARIO, DIAS_POR_LANCAMENTO, TAMANHO_DIA } from '../dados/limites';
import { UFS } from './pessoa';
import { CONTAGEM_PADRAO, feriadosDaJusticaFederal, feriadosDePraxe, feriadosNacionais, recessoForense, somarDias, type DiaSemExpediente, type TipoSemExpediente } from './prazos';

/** O que um órgão pode seguir além dos feriados nacionais. */
export type Segue = 'recesso' | 'praxe' | 'justica_federal';
/** De onde vem um dia do calendário. */
export type Origem = 'lei' | Segue | 'escritorio';

const noAno = (ano: number) => (d: DiaSemExpediente) => d.data.startsWith(`${ano}-`);

/** Os calendários prontos que cada órgão segue ou não: o nome na tela, a explicação e os dias de um ano. */
export const CALENDARIOS_PRONTOS: Record<Segue, { nome: string; explicacao: string; dias: (ano: number) => DiaSemExpediente[] }> = {
  recesso: {
    nome: 'Recesso forense',
    explicacao: 'Prazos processuais suspensos de 20/12 a 20/01 (CPC, art. 220); fórum fechado até 06/01. Não suspende réu preso, Lei Maria da Penha e medidas urgentes (CPP, art. 798-A), nem prazos de direito material, como os decadenciais.',
    // O recesso começa num ano e termina no seguinte: o ano tem o fim de um e o começo do outro.
    dias: ano => [...recessoForense(ano - 1), ...recessoForense(ano)].filter(noAno(ano))
  },
  praxe: {
    nome: 'Carnaval, Sexta-feira Santa e Corpus Christi', explicacao: 'Não são feriados nacionais por lei: marque só nos órgãos que não abrem nesses dias.',
    dias: feriadosDePraxe
  },
  justica_federal: {
    nome: 'Feriados da Justiça Federal', explicacao: 'Os da Lei 5.010/1966, art. 62, na Justiça Federal e nos tribunais superiores: Carnaval, Semana Santa, 11/08, 01/11, 08/12 e de 20/12 a 06/01.',
    dias: feriadosDaJusticaFederal
  }
};
export const SEGUE = Object.keys(CALENDARIOS_PRONTOS) as Segue[];

export const ORIGENS: Record<Origem, string> = {
  lei: 'Feriado nacional', recesso: 'Recesso forense', praxe: 'De praxe', justica_federal: 'Justiça Federal', escritorio: 'Lançado pelo escritório'
};

// ---------- órgãos ----------
/** O que um órgão novo segue, pela sigla (vale a primeira que casar). Os tribunais seguem o recesso (CPC, art. 220);
 *  a Justiça Federal e os tribunais superiores, também os feriados da Lei 5.010 (art. 62). Os de praxe começam
 *  desligados: na dúvida, o prazo calculado fica mais curto, nunca mais longo. */
const PADROES: { sigla: RegExp; segue: Segue[] }[] = [
  { sigla: /^(TRF\d|STF|STJ|TST|TSE|STM)/, segue: ['recesso', 'justica_federal'] },
  { sigla: /^(TJ|TRT|TRE)/, segue: ['recesso'] }
];
/** Os campos de um órgão novo com essa sigla, já com o que ele costuma seguir. */
export function padraoDoOrgao(sigla: string): DadosOrgao {
  const s = sigla.trim().toUpperCase();
  const segue = PADROES.find(p => p.sigla.test(s))?.segue ?? [];
  return { sigla: s, nome: null, contagem_padrao: CONTAGEM_PADRAO, recesso: segue.includes('recesso'), praxe: false, justica_federal: segue.includes('justica_federal') };
}

/** Quantos tribunais regionais há em cada ramo (TRF1 a TRF6, TRT1 a TRT24). */
const REGIOES = { trf: 6, trt: 24 };
const numerados = (prefixo: string, n: number) => Array.from({ length: n }, (_, i) => `${prefixo}${i + 1}`);
/** Siglas para sugerir ao cadastrar um órgão: os tribunais (como saem do número do CNJ) e os órgãos administrativos mais comuns. */
export const SIGLAS_SUGERIDAS = [
  'STF', 'STJ', 'TST', 'TSE', 'STM',
  ...UFS.map(uf => uf === 'DF' ? 'TJDFT' : 'TJ' + uf), ...numerados('TRF', REGIOES.trf), ...numerados('TRT', REGIOES.trt),
  ...UFS.map(uf => 'TRE-' + uf), 'TJMMG', 'TJMRS', 'TJMSP',
  'INPI', 'INSS', 'CARF', 'RFB'
];

// ---------- dias para contar o prazo ----------
/** Os dias sem expediente de um órgão nos anos dados: os nacionais, os prontos que ele segue e os que o escritório
 *  lançou para ele ou para todos. Sem órgão: só os nacionais e os lançados para todos (nada de recesso, para não
 *  dar um prazo mais longo do que é). semRecesso: o prazo não se suspende no recesso (réu preso, Lei Maria da Penha,
 *  medida urgente, direito material), que então fica de fora por inteiro: o prazo corre e pode vencer nesses dias,
 *  no plantão. */
export function diasDoOrgao(orgao: Orgao | null, lancados: DiaLancado[], anos: number[], { semRecesso = false } = {}): DiaSemExpediente[] {
  const segue = SEGUE.filter(s => orgao?.[s] && !(semRecesso && s === 'recesso'));
  const prontos = anos.flatMap(ano => [
    ...feriadosNacionais(ano),
    ...segue.flatMap(s => CALENDARIOS_PRONTOS[s].dias(ano))
  ]);
  const doEscritorio = lancados.filter(d => d.orgao_id === null || d.orgao_id === orgao?.id).map(({ data, motivo, tipo }) => ({ data, motivo, tipo }));
  return [...prontos, ...doEscritorio];
}

/** Quantos dias de prazo cabem num ano, no mínimo (dias úteis, com folga para suspensões e recesso). */
const DIAS_CONTADOS_POR_ANO = 200;
/** Os anos que um prazo pode atravessar: do ano da intimação até onde ele pode chegar (sempre pelo menos o seguinte). */
export function anosDoPrazo(intimacao: string, dias: number): number[] {
  const ano = Number(intimacao.slice(0, 4));
  const ultimo = ano + Math.ceil(dias / DIAS_CONTADOS_POR_ANO);
  return Array.from({ length: ultimo - ano + 1 }, (_, i) => ano + i);
}

// ---------- o ano, período a período ----------
/** Um período do calendário: os dias seguidos com o mesmo motivo, tipo, origem e órgãos. */
export interface PeriodoDoAno {
  de: string; ate: string; motivo: string; tipo: TipoSemExpediente; origem: Origem;
  /** Para que órgãos vale, em palavras ("Todos os órgãos", "TJMG, TRF6"). */
  valePara: string;
  /** Os dias lançados pelo escritório que formam o período (para excluir); vazio nos prontos. */
  ids: string[];
}
export const TODOS_OS_ORGAOS = 'Todos os órgãos';
export const NENHUM_ORGAO = 'Nenhum órgão ainda';

interface DiaDoAno extends DiaSemExpediente { origem: Origem; valePara: string; id?: string }

/** Quanto pesa cada tipo na ordem da tela: no mesmo dia, o que para o prazo e fecha o fórum vem antes. */
const ORDEM_DO_TIPO: Record<TipoSemExpediente, number> = { suspensao: 0, suspensao_com_expediente: 1, feriado: 2 };

/** Junta os dias seguidos com o mesmo motivo, tipo, origem e órgãos num período só. */
function emPeriodos(dias: DiaDoAno[]): PeriodoDoAno[] {
  const grupos = new Map<string, DiaDoAno[]>();
  for (const d of dias) {
    const chave = JSON.stringify([d.motivo, d.tipo, d.origem, d.valePara]);
    grupos.set(chave, [...(grupos.get(chave) ?? []), d]);
  }
  const periodos: PeriodoDoAno[] = [];
  for (const grupo of grupos.values()) {
    const doGrupo: PeriodoDoAno[] = [];
    for (const d of [...grupo].sort((x, y) => x.data.localeCompare(y.data))) {
      const atual = doGrupo.at(-1);
      // O mesmo dia de novo fica no período; o dia seguinte o estica; depois de um intervalo, começa outro.
      if (atual && d.data <= somarDias(atual.ate, 1)) atual.ate = d.data > atual.ate ? d.data : atual.ate;
      else doGrupo.push({ de: d.data, ate: d.data, motivo: d.motivo, tipo: d.tipo, origem: d.origem, valePara: d.valePara, ids: [] });
      if (d.id) doGrupo.at(-1)!.ids.push(d.id);
    }
    periodos.push(...doGrupo);
  }
  return periodos.sort((x, y) => x.de.localeCompare(y.de) || ORDEM_DO_TIPO[x.tipo] - ORDEM_DO_TIPO[y.tipo] || x.motivo.localeCompare(y.motivo, 'pt-BR'));
}

/** O calendário do ano, período a período. Com um órgão: só o que vale para ele. Sem (orgaoId null): tudo, dizendo
 *  para que órgãos vale cada período. `lancados` são os dias do escritório no ano. */
export function periodosDoAno(ano: number, orgaos: Orgao[], lancados: DiaLancado[], orgaoId: string | null): PeriodoDoAno[] {
  const sigla = (id: string | null) => id === null ? TODOS_OS_ORGAOS : orgaos.find(o => o.id === id)?.sigla ?? '';
  const escolhido = orgaoId === null ? null : orgaos.find(o => o.id === orgaoId) ?? null;
  const prontos = (s: Segue) => {
    const quem = escolhido ? (escolhido[s] ? [escolhido] : []) : orgaos.filter(o => o[s]);
    if (escolhido && !quem.length) return [];
    const valePara = quem.map(o => o.sigla).join(', ') || NENHUM_ORGAO;
    return CALENDARIOS_PRONTOS[s].dias(ano).map(d => ({ ...d, origem: s, valePara }));
  };
  const doEscritorio = lancados
    .filter(d => d.data.startsWith(`${ano}-`) && (!escolhido || d.orgao_id === null || d.orgao_id === escolhido.id))
    .map(d => ({ data: d.data, motivo: d.motivo, tipo: d.tipo, origem: 'escritorio' as const, valePara: sigla(d.orgao_id), id: d.id }));
  return emPeriodos([
    ...feriadosNacionais(ano).map(d => ({ ...d, origem: 'lei' as const, valePara: TODOS_OS_ORGAOS })),
    ...SEGUE.flatMap(prontos),
    ...doEscritorio
  ]);
}

// ---------- lançar dias ----------
/** O que o administrador lança: o motivo e o tipo, de um dia a outro (ou num dia só), para os órgãos escolhidos
 *  (null: todos os órgãos). */
export interface PedidoDeLancamento { motivo: string; tipo: TipoSemExpediente; de: string; ate: string; orgaos: (string | null)[] }

/** "aaaa-mm-dd" de um dia que existe (31/02 não existe). */
export const dataExiste = (iso: string) => /^\d{4}-\d{2}-\d{2}$/.test(iso) && somarDias(iso, 0) === iso;
export const anoAceito = (iso: string) => { const a = Number(iso.slice(0, 4)); return a >= ANOS_DO_CALENDARIO.de && a <= ANOS_DO_CALENDARIO.ate; };
/** O último dia do lançamento: sem "até", é um dia só. */
const ateDo = (p: Pick<PedidoDeLancamento, 'de' | 'ate'>) => p.ate.trim() || p.de;

/** O que há de errado no lançamento, ou null se dá para gravar. */
export function erroDoLancamento(p: PedidoDeLancamento): string | null {
  const ate = ateDo(p);
  if (!p.motivo.trim()) return 'Diga o motivo (ex.: feriado municipal, Portaria 12/2026).';
  if (p.motivo.trim().length > TAMANHO_DIA.motivo) return `O motivo pode ter até ${TAMANHO_DIA.motivo} caracteres.`;
  if (!dataExiste(p.de)) return 'Informe o primeiro dia.';
  if (!dataExiste(ate)) return 'O último dia não existe.';
  if (ate < p.de) return 'O último dia precisa ser depois do primeiro.';
  if (!anoAceito(p.de) || !anoAceito(ate)) return `O calendário vai de ${ANOS_DO_CALENDARIO.de} a ${ANOS_DO_CALENDARIO.ate}.`;
  if (somarDias(p.de, DIAS_POR_LANCAMENTO) <= ate) return `Um lançamento pode ter até ${DIAS_POR_LANCAMENTO} dias seguidos.`;
  if (!p.orgaos.length) return 'Escolha para que órgãos o dia vale.';
  return null;
}

/** As linhas a gravar: cada dia, para cada órgão. "Todos os órgãos" vale sozinho (não repete o dia por órgão). */
export function linhasDoLancamento(p: PedidoDeLancamento): LinhaDeLancamento[] {
  const orgaos = p.orgaos.includes(null) ? [null] : [...new Set(p.orgaos)];
  const motivo = p.motivo.trim(), ate = ateDo(p), linhas: LinhaDeLancamento[] = [];
  for (let data = p.de; data <= ate; data = somarDias(data, 1)) {
    for (const orgao_id of orgaos) linhas.push({ data, motivo, tipo: p.tipo, orgao_id });
  }
  return linhas;
}

// ---------- para mostrar ----------
/** Como cada tipo de dia aparece na tela: o nome curto (no selo) e o que acontece com o fórum e o prazo. */
export const TIPOS_NA_TELA: Record<TipoSemExpediente, { curto: string; explicacao: string }> = {
  feriado: { curto: 'Feriado', explicacao: 'O fórum fecha. Em dias corridos, o prazo continua correndo; o fim que cai nele passa para o dia útil seguinte (ex.: ponto facultativo, portaria que só fecha o fórum).' },
  suspensao: { curto: 'Suspensão', explicacao: 'O fórum fecha e o prazo para (ex.: portaria que fecha o fórum e diz que os prazos ficam suspensos).' },
  suspensao_com_expediente: { curto: 'Prazos suspensos', explicacao: 'O fórum abre, mas o prazo para (ex.: suspensão de prazos por portaria, com atendimento normal).' }
};

export const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const DIAS_DA_SEMANA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
/** O dia da semana de "aaaa-mm-dd", por extenso. */
export function diaDaSemana(iso: string) {
  const [a, m, d] = iso.split('-').map(Number);
  return DIAS_DA_SEMANA[new Date(Date.UTC(a, m - 1, d)).getUTCDay()];
}
/** "aaaa-mm-dd" → "dd/mm" (no calendário do ano, o ano já está no título). */
export const fmtDiaMes = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
/** O período em palavras: "25/12" ou "20/12 a 31/12". */
export const fmtPeriodo = (de: string, ate: string) => de === ate ? fmtDiaMes(de) : `${fmtDiaMes(de)} a ${fmtDiaMes(ate)}`;

/** Os motivos que viram um só na lista dos dias pulados (sábado e domingo são o fim de semana). */
const MESMO_MOTIVO: Record<string, string> = { sábado: 'fim de semana', domingo: 'fim de semana' };
/** Os dias pulados de um prazo, com os dias seguidos de mesmo motivo juntos (o recesso inteiro numa linha só). */
export function pulosEmPeriodos(pulados: { data: string; motivo: string }[]): { de: string; ate: string; motivo: string }[] {
  const periodos: { de: string; ate: string; motivo: string }[] = [];
  for (const p of pulados) {
    const motivo = MESMO_MOTIVO[p.motivo] ?? p.motivo, ultimo = periodos.at(-1);
    if (ultimo && ultimo.motivo === motivo && somarDias(ultimo.ate, 1) === p.data) ultimo.ate = p.data;
    else periodos.push({ de: p.data, ate: p.data, motivo });
  }
  return periodos;
}
