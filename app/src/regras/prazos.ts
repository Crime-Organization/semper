// Contagem de prazos: em dias corridos ou em dias úteis, pulando feriados e suspensões. Tudo puro, sem tela nem banco.
// As datas entram e saem como "aaaa-mm-dd". Os dias sem expediente chegam prontos (os daqui e os que o escritório
// cadastrou para o órgão do processo); a regra não sabe de onde vieram.
//
// Regras seguidas (CPC, arts. 216, 219, 220 e 224; Lei 11.419/2006, arts. 4º e 5º; Súmula 310 do STF):
// - dia útil é o dia com expediente forense;
// - a intimação feita em dia sem expediente vale como feita no primeiro dia útil seguinte;
// - na publicação pelo Diário eletrônico, a publicação é o primeiro dia útil depois da disponibilização;
// - o dia da intimação (ou da publicação) não conta: o prazo começa no primeiro dia útil seguinte em que ele corre;
// - em dias úteis, só contam os dias úteis em que o prazo corre; em dias corridos, contam todos em que o prazo corre;
// - o prazo que termina num dia sem expediente passa para o primeiro dia útil seguinte em que ele corre.
// A suspensão (como o recesso do art. 220) para o prazo, mas nem sempre fecha o fórum: de 07/01 a 20/01 há
// expediente, e uma intimação nesses dias é feita nesses dias; só a contagem espera o fim da suspensão.
import { lerData } from './pessoa';

export type Contagem = 'corridos' | 'uteis';
/** Como o prazo conta quando ninguém escolheu (decisão de 01/11/2026: dias corridos). */
export const CONTAGEM_PADRAO: Contagem = 'corridos';
export const CONTAGENS: Record<Contagem, string> = { corridos: 'Dias corridos', uteis: 'Dias úteis' };

/** O que acontece num dia do calendário: se o fórum abre e se o prazo corre. */
export type TipoSemExpediente = 'feriado' | 'suspensao' | 'suspensao_com_expediente';
export const TIPOS_SEM_EXPEDIENTE: Record<TipoSemExpediente, { nome: string; expediente: boolean; prazoCorre: boolean }> = {
  /** Fórum fechado; o prazo em dias corridos continua correndo. */
  feriado: { nome: 'Feriado', expediente: false, prazoCorre: true },
  /** Fórum fechado e prazo parado (ex.: recesso de 20/12 a 06/01, portaria que fecha o fórum). */
  suspensao: { nome: 'Suspensão sem expediente', expediente: false, prazoCorre: false },
  /** Fórum aberto, mas o prazo parado (ex.: recesso de 07/01 a 20/01). */
  suspensao_com_expediente: { nome: 'Suspensão de prazos com expediente', expediente: true, prazoCorre: false }
};
export interface DiaSemExpediente {
  /** aaaa-mm-dd */
  data: string;
  motivo: string;
  tipo: TipoSemExpediente;
}

/** Prazo mais longo aceito, em dias (cinco anos). */
export const PRAZO_MAXIMO_DIAS = 5 * 366;
/** Até quantos dias seguidos sem contar a contagem procura, antes de desistir (um ano). */
const DIAS_SEM_CONTAR_SEGUIDOS = 366;

export interface PedidoDePrazo {
  /** Data da intimação, da publicação ou da disponibilização (aaaa-mm-dd). */
  intimacao: string;
  dias: number;
  contagem: Contagem;
  /** Os feriados e as suspensões que valem para o órgão do processo. */
  semExpediente: DiaSemExpediente[];
  /** A data é a da disponibilização no Diário eletrônico (a publicação é o dia útil seguinte). */
  disponibilizacao?: boolean;
}

/** Um dia que não contou, ou que empurrou o começo ou o fim do prazo, e por quê. */
export interface DiaPulado { data: string; motivo: string }

export interface PrazoContado {
  /** O dia que vale como publicação (a intimação, ou o dia útil seguinte quando ela caiu sem expediente ou é a disponibilização). */
  publicacao: string;
  /** O primeiro dia contado. */
  inicio: string;
  /** O último dia do prazo. */
  final: string;
  /** Os dias pulados, em ordem, com o motivo. */
  pulados: DiaPulado[];
}

// ---------- datas (em UTC, para o fuso não mudar o dia) ----------
const paraData = (iso: string) => { const [a, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(a, m - 1, d)); };
const paraISO = (d: Date) => d.toISOString().slice(0, 10);
const somarDias = (iso: string, n: number) => { const d = paraData(iso); d.setUTCDate(d.getUTCDate() + n); return paraISO(d); };
const proximo = (iso: string) => somarDias(iso, 1);
/** Nome do dia da semana que nunca tem expediente (0 = domingo, 6 = sábado). */
const FIM_DE_SEMANA: Record<number, string> = { 0: 'domingo', 6: 'sábado' };

/** Quanto pesa cada tipo quando dois caem na mesma data: o que para o prazo e fecha o fórum vale mais. */
const PESO: Record<TipoSemExpediente, number> = { suspensao: 3, suspensao_com_expediente: 2, feriado: 1 };

/** O calendário do processo: para cada dia, se tem expediente, se o prazo corre e o motivo. */
function calendario(dias: DiaSemExpediente[]) {
  const porData = new Map<string, DiaSemExpediente>();
  for (const d of dias) {
    const ja = porData.get(d.data);
    // Feriado numa suspensão com expediente: o fórum fecha e o prazo para (vira suspensão sem expediente).
    if (ja && ja.tipo !== d.tipo && PESO[ja.tipo] + PESO[d.tipo] === PESO.suspensao) {
      porData.set(d.data, { ...(ja.tipo === 'feriado' ? ja : d), tipo: 'suspensao' });
    } else if (!ja || PESO[d.tipo] > PESO[ja.tipo]) porData.set(d.data, d);
  }
  const fimDeSemana = (iso: string) => FIM_DE_SEMANA[paraData(iso).getUTCDay()] ?? null;
  const tipo = (iso: string) => { const t = porData.get(iso)?.tipo; return t ? TIPOS_SEM_EXPEDIENTE[t] : null; };
  return {
    /** Por que o fórum está fechado nesse dia, ou null se há expediente. */
    fechado: (iso: string) => tipo(iso)?.expediente === false ? porData.get(iso)!.motivo : fimDeSemana(iso),
    /** Por que o prazo não corre nesse dia, ou null se corre. */
    parado: (iso: string) => tipo(iso)?.prazoCorre === false ? porData.get(iso)!.motivo : null,
    /** Por que o dia não é útil para o prazo (fechado ou parado), ou null. */
    naoConta: (iso: string) => (tipo(iso)?.prazoCorre === false ? porData.get(iso)!.motivo : null)
      ?? (tipo(iso)?.expediente === false ? porData.get(iso)!.motivo : fimDeSemana(iso))
  };
}
type Calendario = ReturnType<typeof calendario>;
type Motivo = (iso: string) => string | null;

/** O primeiro dia depois de `iso` em que `motivo` não vale, anotando os que pulou. */
function proximoSem(motivo: Motivo, iso: string, pulados: DiaPulado[]) {
  let dia = proximo(iso);
  for (let i = 0; i < DIAS_SEM_CONTAR_SEGUIDOS; i++, dia = proximo(dia)) {
    const m = motivo(dia);
    if (!m) return dia;
    pulados.push({ data: dia, motivo: m });
  }
  throw new Error('Não há nenhum dia útil num ano inteiro depois dessa data: confira o calendário de feriados.');
}

/** O que há de errado no pedido, ou null se dá para contar. */
export function erroDoPrazo(p: Pick<PedidoDePrazo, 'intimacao' | 'dias'>): string | null {
  if (!Number.isInteger(p.dias) || p.dias < 1) return 'O prazo precisa ter pelo menos 1 dia, em número inteiro.';
  if (p.dias > PRAZO_MAXIMO_DIAS) return `O prazo pode ter até ${PRAZO_MAXIMO_DIAS} dias.`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.intimacao)) return 'Informe a data da intimação.';
  const [a, m, d] = p.intimacao.split('-');
  try { lerData(`${d}/${m}/${a}`); } catch { return 'A data da intimação não existe.'; }
  return null;
}

/** Por que um dia do meio do prazo não conta, em cada contagem. Contagem nova = entrada nova aqui. */
const NAO_CONTA_NO_MEIO: Record<Contagem, (cal: Calendario) => Motivo> = {
  uteis: cal => cal.naoConta,
  corridos: cal => cal.parado
};

/** Conta o prazo. Lança erro se o pedido não servir (veja erroDoPrazo). */
export function contarPrazo(p: PedidoDePrazo): PrazoContado {
  const erro = erroDoPrazo(p);
  if (erro) throw new Error(erro);
  const cal = calendario(p.semExpediente);
  const pulados: DiaPulado[] = [];

  // A intimação em dia sem expediente, ou a disponibilização, vale no primeiro dia com expediente seguinte.
  const intimacaoFechada = cal.fechado(p.intimacao);
  if (intimacaoFechada) pulados.push({ data: p.intimacao, motivo: intimacaoFechada });
  const publicacao = p.disponibilizacao || intimacaoFechada ? proximoSem(cal.fechado, p.intimacao, pulados) : p.intimacao;
  const inicio = proximoSem(cal.naoConta, publicacao, pulados);

  const naoConta = NAO_CONTA_NO_MEIO[p.contagem](cal);
  let dia = inicio;
  for (let contados = 1, seguidos = 0; contados < p.dias;) {
    dia = proximo(dia);
    const motivo = naoConta(dia);
    if (!motivo) { contados++; seguidos = 0; continue; }
    pulados.push({ data: dia, motivo });
    if (++seguidos >= DIAS_SEM_CONTAR_SEGUIDOS) throw new Error('Não há nenhum dia útil num ano inteiro depois dessa data: confira o calendário de feriados.');
  }
  // O último dia contado caiu sem expediente (só acontece em dias corridos): o fim passa para o dia útil seguinte.
  const fechadoNoFim = cal.fechado(dia);
  if (fechadoNoFim) pulados.push({ data: dia, motivo: fechadoNoFim });
  const final = fechadoNoFim ? proximoSem(cal.naoConta, dia, pulados) : dia;
  return { publicacao, inicio, final, pulados };
}

// ---------- feriados e suspensões prontos ----------
/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher, calendário gregoriano). */
export function pascoa(ano: number) {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}
const porData = (x: DiaSemExpediente, y: DiaSemExpediente) => x.data.localeCompare(y.data);
const feriados = (lista: { data: string; motivo: string }[]) => lista.map(d => ({ ...d, tipo: 'feriado' as const })).sort(porData);
/** Os dias de `de` a `ate` (inclusive), todos com o mesmo motivo e tipo. */
function periodo(de: string, ate: string, motivo: string, tipo: TipoSemExpediente): DiaSemExpediente[] {
  const dias: DiaSemExpediente[] = [];
  for (let d = de; d <= ate; d = proximo(d)) dias.push({ data: d, motivo, tipo });
  return dias;
}

/** Feriados nacionais de data fixa, em mês-dia (Leis 662/1949, 6.802/1980, 10.607/2002 e 14.759/2023). */
const NACIONAIS: [string, string][] = [
  ['01-01', 'Confraternização Universal'], ['04-21', 'Tiradentes'], ['05-01', 'Dia do Trabalho'], ['09-07', 'Independência do Brasil'],
  ['10-12', 'Nossa Senhora Aparecida'], ['11-02', 'Finados'], ['11-15', 'Proclamação da República'],
  ['11-20', 'Dia Nacional de Zumbi e da Consciência Negra'], ['12-25', 'Natal']
];
/** Os feriados nacionais do ano, os que a lei federal fixa para todo o país. */
export function feriadosNacionais(ano: number): DiaSemExpediente[] {
  return feriados(NACIONAIS.map(([md, motivo]) => ({ data: `${ano}-${md}`, motivo })));
}

/** Dias que mudam com a Páscoa, comuns no forense mas que não são feriados nacionais por lei (o escritório escolhe para que órgãos valem). */
const DE_PRAXE: [number, string][] = [[-48, 'Carnaval'], [-47, 'Carnaval'], [-2, 'Sexta-feira Santa'], [60, 'Corpus Christi']];
export function feriadosDePraxe(ano: number): DiaSemExpediente[] {
  const p = pascoa(ano);
  return feriados(DE_PRAXE.map(([n, motivo]) => ({ data: somarDias(p, n), motivo })));
}

/** Dias da Semana Santa na Justiça Federal: de quarta-feira a Domingo de Páscoa (antes da Páscoa). */
const SEMANA_SANTA = { de: -4, ate: 0 };
/** Os feriados da Justiça Federal além dos nacionais (Lei 5.010/1966, art. 62). */
export function feriadosDaJusticaFederal(ano: number): DiaSemExpediente[] {
  const p = pascoa(ano);
  return [
    ...periodo(`${ano}-01-01`, `${ano}-01-06`, 'Feriado da Justiça Federal (20/12 a 06/01)', 'feriado'),
    ...feriados([
      { data: somarDias(p, -48), motivo: 'Carnaval' }, { data: somarDias(p, -47), motivo: 'Carnaval' },
      ...periodo(somarDias(p, SEMANA_SANTA.de), somarDias(p, SEMANA_SANTA.ate), 'Semana Santa', 'feriado'),
      { data: `${ano}-08-11`, motivo: 'Dia da criação dos cursos jurídicos' }, { data: `${ano}-11-01`, motivo: 'Dia de Todos os Santos' },
      { data: `${ano}-12-08`, motivo: 'Dia da Imaculada Conceição' }
    ]),
    ...periodo(`${ano}-12-20`, `${ano}-12-31`, 'Feriado da Justiça Federal (20/12 a 06/01)', 'feriado')
  ].sort(porData);
}

/** O recesso forense (CPC, art. 220: prazos suspensos de 20/12 a 20/01, inclusive), em mês-dia. Até 06/01 o fórum fecha (Res. CNJ 244/2016). */
const RECESSO = { de: '12-20', fechadoAte: '01-06', ate: '01-20' };
/** O recesso que começa em dezembro do ano e termina em janeiro do ano seguinte. */
export function recessoForense(ano: number): DiaSemExpediente[] {
  const seguinte = ano + 1;
  return [
    ...periodo(`${ano}-${RECESSO.de}`, `${seguinte}-${RECESSO.fechadoAte}`, 'Recesso forense', 'suspensao'),
    ...periodo(proximo(`${seguinte}-${RECESSO.fechadoAte}`), `${seguinte}-${RECESSO.ate}`, 'Recesso forense (prazos suspensos)', 'suspensao_com_expediente')
  ];
}
