// Propriedade intelectual (#317): o tipo de proteção do processo da área "Propriedade intelectual", os campos de cada tipo, os papéis
// que só existem nele (titular, inventor, autor da criação) e os prazos do INPI calculados a partir das datas do processo: a
// validade, as anuidades da patente, o quinquênio do desenho, as prorrogações da marca e do desenho e o pedido de exame. Tudo puro,
// sem tela nem banco: as datas calculadas não são gravadas.
//
// De onde vêm os prazos (Lei 9.279/96, a LPI, e Lei 9.609/98), conferidos nos guias do INPI quando eles tratam do assunto:
// - Marca: 10 anos contados da CONCESSÃO, prorrogáveis sem limite por 10 anos; a prorrogação se pede no último ano de vigência ou
//   nos 6 meses seguintes, com taxa extra (art. 133; Manual de Marcas, cap. 6). Não tem anuidade.
// - Patente de invenção: 20 anos do depósito; modelo de utilidade: 15 anos do depósito (art. 40; cartilha de patentes). A anuidade é
//   devida a partir do início do 3º ano do depósito, nos 3 primeiros meses de cada ano, ou nos 6 meses seguintes com taxa extra
//   (art. 84). O pedido de exame vai até 36 meses do depósito (art. 33).
// - Desenho industrial: 10 anos do depósito, prorrogáveis por 3 períodos de 5 anos, até 25 anos (art. 108; cartilha de desenhos).
//   A prorrogação se pede no último ano ou nos 180 dias seguintes com taxa extra (art. 108, §2º); o 2º quinquênio se paga durante
//   o 5º ano (art. 120, §1º).
// - Programa de computador: 50 anos contados de 1º de janeiro do ano seguinte ao da publicação ou, sem ela, ao da criação
//   (Lei 9.609, art. 2º, §2º; cartilha de direito de autor). Não depende do registro no INPI.
// - Prazo após o deferimento da marca (#418): 60 dias úteis contados da publicação do deferimento na RPI, mais 30 dias úteis
//   extras. O dono avisou que não há mais taxa de concessão; o prazo continua sendo acompanhado, até a concessão ser informada.
// Prazos de propriedade intelectual em DIAS são sempre em dias ÚTEIS (decisão do dono, #418): a contagem pula os dias sem
// expediente no INPI (os do órgão INPI em Feriados e prazos, se existir; sem ele, os feriados nacionais e os dias lançados para
// todos os órgãos), como a calculadora de prazos (regras/prazos.ts). Os prazos em meses e anos continuam como estão, e os que ainda
// não foram conferidos por alguém da área (a lista abaixo, como os 180 dias do desenho) também.
// Os prazos de meses e anos terminam no dia de mesmo número do dia do início (Código Civil, art. 132, §3º); o dia que não existe no
// mês de chegada vira o último dia dele (29/02 + 1 ano = 28/02). Prazo que vence em dia sem expediente no INPI vai para o próximo
// dia útil (Manual de Marcas, cap. 1): a conta mostra a data da lei, e o cartão avisa para conferir.
//
// O que os guias do INPI instalados (inpi-manual-de-marcas, inpi-inventando-futuro-patentes, inpi-desenhos-industriais-pme,
// inpi-expressao-criativa-direito-autor) confirmam e o que NÃO confirmam (vem só da leitura da lei, e precisa da conferência de
// alguém da área; esta lista é a que vai para o comentário da tarefa #317):
// - Confirmados: a vigência da marca (10 anos da concessão) e a prorrogação no último ano ou nos 6 meses seguintes, com taxa (Manual
//   de Marcas, cap. 6); a vigência da patente (20 anos) e do modelo (15 anos), do depósito (cartilha de patentes); os 10 + 5 + 5 + 5 =
//   25 anos do desenho (cartilha de desenhos, cap. 2); os 50 anos do programa, de 1º de janeiro do ano seguinte (cartilha de direito de
//   autor); o dia útil seguinte quando o prazo vence em dia sem expediente (Manual de Marcas, cap. 1, que trata das marcas).
// - Não confirmados nos guias (nenhum deles trata do assunto): a anuidade da patente (o início no 3º ano, os 3 meses do prazo normal,
//   os 6 meses do extra e a contagem pelo aniversário do depósito); os 36 meses do pedido de exame; os 180 dias do prazo extra da
//   prorrogação do desenho; o 2º quinquênio pago no 5º ano; e o dia útil seguinte nos prazos de patente e de desenho.
import type { ApresentacaoMarca, CompromissoLigado, DiaLancado, Historico, NaturezaMarca, Orgao, PapelDaParte, Processo, RegraDeRepeticao, TipoProcesso, TipoProtecao } from '../dados/tipos';
import { CLASSE_NICE_MAIOR, DEMANDA_DO_COMPROMISSO, TAMANHO_COMPROMISSO, TAMANHO_PROTECAO, VARIACOES_DO_DESENHO } from '../dados/limites';
import type { CamposCompromisso } from './compromisso';
import { descreverRepeticao, somarMeses } from './repeticao';
import { contarPrazo, diasEntre, somarDias, type Contagem, type DiaSemExpediente } from './prazos';
import { anosDoPrazo, diasDoOrgao } from './calendario';
import { fmtData, lerData } from './pessoa';
import { normal } from './texto';

/** A área do direito que abre os campos de propriedade intelectual (a da lista pronta de regras/processo.ts). */
export const AREA_DA_PI = 'Propriedade intelectual';
/** Se o processo é de propriedade intelectual: pela área, sem contar maiúsculas nem acentos. */
export const ehDePropriedadeIntelectual = (area: string | null | undefined) => !!area && normal(area.trim()) === normal(AREA_DA_PI);
/**
 * Os tipos de processo que têm os campos de PI e a validade (#425): só o administrativo (o pedido no INPI). O judicial da área (a ação
 * de nulidade, a de infração...) liga-se ao administrativo inteiro, em "Processos relacionados", e não repete os campos.
 */
export const TIPOS_COM_PROTECAO: readonly TipoProcesso[] = ['administrativo'];
/** O que decide se o processo tem os campos de PI: o tipo e a área. */
export interface OndeHaProtecao { tipo: TipoProcesso; area?: string | null }
/** Se o processo tem os campos de PI (o tipo de proteção, os campos de cada tipo e a validade): administrativo da área de PI. */
export const temProtecao = (p: OndeHaProtecao) => TIPOS_COM_PROTECAO.includes(p.tipo) && ehDePropriedadeIntelectual(p.area);

/** Meses num ano. */
const MESES_NO_ANO = 12;
const somarAnos = (iso: string, anos: number) => somarMeses(iso, anos * MESES_NO_ANO);

/** Os prazos da lei, cada um com o artigo (veja o começo do arquivo). */
export const PRAZOS_DO_INPI = {
  /** Anos de vigência da patente de invenção e do modelo de utilidade, do depósito (LPI, art. 40). */
  vigenciaDaPatente: 20, vigenciaDoModelo: 15,
  /** A anuidade é devida a partir do início deste ano, contado do depósito (art. 84). */
  primeiraAnuidade: 3,
  /** Meses do prazo normal de cada anuidade e do prazo extra, com taxa adicional (art. 84, §2º). */
  anuidadeMeses: 3, anuidadeExtraMeses: 6,
  /** Meses, do depósito, para pedir o exame da patente (art. 33). */
  exameMeses: 36,
  /** Anos de cada período da marca, da concessão (art. 133). */
  periodoDaMarca: 10,
  /** Meses do prazo extra da prorrogação da marca (art. 133, §2º). */
  prorrogacaoDaMarcaExtraMeses: 6,
  /** Quantas prorrogações por vir o cartão mostra na marca, que prorroga sem limite: a do período que está correndo e a seguinte. */
  prorrogacoesDaMarcaAMostrar: 2,
  /** Anos do primeiro período do desenho, de cada prorrogação e quantas prorrogações cabem (art. 108: até 25 anos). */
  periodoDoDesenho: 10, prorrogacaoDoDesenho: 5, prorrogacoesDoDesenho: 3,
  /** Dias do prazo extra da prorrogação do desenho (art. 108, §2º). */
  prorrogacaoDoDesenhoExtraDias: 180,
  /** O 2º quinquênio do desenho se paga durante este ano da vigência (art. 120, §1º); o prazo extra (meses) é o mesmo da anuidade. */
  anoDoQuinquenio: 5, quinquenioExtraMeses: 6,
  /** A prorrogação (marca e desenho) se pede no último ano de vigência: anos antes do fim. */
  janelaDaProrrogacao: 1,
  /** Anos de proteção do programa de computador, de 1º de janeiro do ano seguinte (Lei 9.609, art. 2º, §2º). */
  vigenciaDoPrograma: 50,
  /** Dias úteis do prazo após a publicação do deferimento da marca na RPI, e do prazo extra que vem depois dele (#418). */
  deferimentoDiasUteis: 60, deferimentoExtraDiasUteis: 30
};

// ---------- dias úteis no INPI ----------
/** Os dias sem expediente no INPI que a contagem em dias úteis pula, nos anos pedidos. */
export type CalendarioDoInpi = (anos: number[]) => DiaSemExpediente[];
/** A sigla do órgão de Feriados e prazos cujos dias sem expediente valem para os prazos de propriedade intelectual. */
export const SIGLA_DO_INPI = 'INPI';
/**
 * O calendário do INPI: o do órgão INPI cadastrado em Feriados e prazos (os feriados nacionais, os prontos que ele segue e os dias
 * lançados para ele ou para todos); sem ele, os feriados nacionais e os dias lançados para todos os órgãos.
 */
export const calendarioDoInpi = (orgaos: readonly Orgao[], lancados: readonly DiaLancado[]): CalendarioDoInpi =>
  anos => diasDoOrgao(orgaos.find(o => o.sigla === SIGLA_DO_INPI) ?? null, [...lancados], anos);
/** Só os feriados nacionais: o calendário enquanto o do escritório não chegou. */
export const SO_FERIADOS_NACIONAIS: CalendarioDoInpi = calendarioDoInpi([], []);
/** O último dia de um prazo de `dias` dias úteis no INPI contado de `de` (o dia `de` não conta, como na intimação). */
export const somarDiasUteisNoInpi = (de: string, dias: number, calendario: CalendarioDoInpi) =>
  contarPrazo({ intimacao: de, dias, contagem: 'uteis', semExpediente: calendario(anosDoPrazo(de, dias)) }).final;
/** Os prazos do processo de propriedade intelectual contam em dias úteis (#418); os dos outros seguem o órgão. */
export const contagemDoProcesso = (p: { area?: string | null }, orgao: Pick<Orgao, 'contagem_padrao'> | null): Contagem | undefined =>
  ehDePropriedadeIntelectual(p.area) ? 'uteis' : orgao?.contagem_padrao;
/** A sigla do órgão de que vêm os dias sem expediente dos prazos do processo: a dele; sem ela, no processo com proteção, o INPI. */
export const siglaDoCalendario = (p: OndeHaProtecao & { orgao?: string | null }) => p.orgao || (temProtecao(p) ? SIGLA_DO_INPI : null);

// ---------- os tipos de proteção ----------
/** Os campos de cada tipo, como digitados no cadastro (as datas em dd/mm/aaaa; as classes separadas por vírgula). */
export interface CamposProtecao {
  protecao: TipoProtecao | '';
  deposito: string;
  /** A publicação do deferimento da marca na RPI (#418). */
  deferimento: string;
  concessao: string;
  publicacao: string;
  criacao: string;
  apresentacaoMarca: ApresentacaoMarca | '';
  naturezaMarca: NaturezaMarca | '';
  classesNice: string;
  especificacao: string;
  variacoes: string;
  linguagem: string;
}
export type CampoDaProtecao = Exclude<keyof CamposProtecao, 'protecao'>;
export const PROTECAO_VAZIA: CamposProtecao = {
  protecao: '', deposito: '', deferimento: '', concessao: '', publicacao: '', criacao: '', apresentacaoMarca: '', naturezaMarca: '', classesNice: '', especificacao: '', variacoes: '', linguagem: ''
};

/** As datas de que os prazos partem. */
export type DatasDaProtecao = Pick<Processo, 'protecao' | 'deposito' | 'concessao' | 'publicacao' | 'criacao'> & Partial<Pick<Processo, 'deferimento'>>;

/** Que prazo é: a anuidade da patente, o pedido de exame, a prorrogação (marca e desenho), o quinquênio do desenho ou o prazo após o deferimento da marca. */
export type TipoDoPrazo = 'anuidade' | 'exame' | 'prorrogacao' | 'quinquenio' | 'deferimento';
/** Se o prazo extra de cada tipo de prazo é pago (com taxa extra) ou só mais tempo (o prazo após o deferimento, #418, não fala em taxa). */
const EXTRA_COM_TAXA: Record<TipoDoPrazo, boolean> = { anuidade: true, exame: true, prorrogacao: true, quinquenio: true, deferimento: false };
/** O nome do prazo após a publicação do deferimento da marca (#418), no cartão e na agenda. */
export const PRAZO_APOS_O_DEFERIMENTO = 'Prazo após o deferimento';
/** Um prazo calculado (aaaa-mm-dd): de quando pode ser feito, o último dia do prazo normal e o do prazo extra, com taxa (se houver). */
export interface PrazoDaProtecao { tipo: TipoDoPrazo; nome: string; inicio: string; fim: string; fimExtra: string | null }
/** O que a conta dá: a validade (com o nome dela), a lista dos prazos e, se faltar uma data para calcular, o que falta. */
export interface PrazosDaProtecao { validade: { rotulo: string; data: string } | null; datas: PrazoDaProtecao[]; falta: string | null }

interface TipoDeProtecao {
  nome: string;
  /** Os campos que aparecem no cadastro, na ordem. */
  campos: CampoDaProtecao[];
  /** Os papéis próprios do tipo, além dos de qualquer processo. */
  papeis: PapelDaParte[];
  /** O que o cadastro explica sobre o tipo. */
  nota: string;
  prazos: (d: DatasDaProtecao, hoje: string, calendario: CalendarioDoInpi) => PrazosDaProtecao;
  /** Como os prazos viram um compromisso que se repete na agenda (parte C, com a #307); null: o tipo não tem prazo a acompanhar. */
  acompanhar: ComoAcompanhar | null;
}
/**
 * Os prazos que entram no compromisso que se repete: de que tipos, de quantos em quantos anos e se a série não tem fim (a marca prorroga
 * sem limite). O título é o do compromisso na agenda (e o da demanda de cada data).
 */
interface ComoAcompanhar { titulo: string; tipos: TipoDoPrazo[]; aCadaAnos: number; semFim: boolean }

const semData = (falta: string): PrazosDaProtecao => ({ validade: null, datas: [], falta });

/** Patente e modelo de utilidade: a validade do depósito, o pedido de exame (até a concessão) e as anuidades até o fim. */
const prazosDaPatente = (anos: number) => (d: DatasDaProtecao): PrazosDaProtecao => {
  if (!d.deposito) return semData('Informe a data do depósito: a validade e as anuidades contam dela.');
  const P = PRAZOS_DO_INPI, datas: PrazoDaProtecao[] = [];
  if (!d.concessao) datas.push({ tipo: 'exame', nome: 'Pedido de exame', inicio: d.deposito, fim: somarMeses(d.deposito, P.exameMeses), fimExtra: null });
  for (let ano = P.primeiraAnuidade; ano <= anos; ano++) {
    const inicio = somarAnos(d.deposito, ano - 1), fim = somarMeses(inicio, P.anuidadeMeses);
    datas.push({ tipo: 'anuidade', nome: `${ano}ª anuidade`, inicio, fim, fimExtra: somarMeses(fim, P.anuidadeExtraMeses) });
  }
  return { validade: { rotulo: 'Validade', data: somarAnos(d.deposito, anos) }, datas: ordenar(datas), falta: null };
};

/** A prorrogação que termina no fim do período: pede-se no último ano dele, ou no prazo extra. */
const prorrogacao = (nome: string, fimDoPeriodo: string, extra: (fim: string) => string): PrazoDaProtecao =>
  ({ tipo: 'prorrogacao', nome, inicio: somarAnos(fimDoPeriodo, -PRAZOS_DO_INPI.janelaDaProrrogacao), fim: fimDoPeriodo, fimExtra: extra(fimDoPeriodo) });

/** O fim do período que está correndo: o primeiro que não passou (ou o último, se todos passaram). */
const periodoAtual = (fins: readonly string[], hoje: string) => fins.find(f => f >= hoje) ?? fins[fins.length - 1];

/** O prazo após o deferimento conta enquanto a marca tem a publicação do deferimento e ainda não tem a concessão. */
const prazoAposODeferimentoConta = (d: Pick<DatasDaProtecao, 'protecao' | 'deferimento' | 'concessao'>) => d.protecao === 'marca' && !!d.deferimento && !d.concessao;
/** Os anos que os prazos em dias úteis do processo atravessam (a tela busca os dias lançados neles); vazio quando não há nenhum. */
export const anosDosPrazosEmDiasUteis = (d: Pick<DatasDaProtecao, 'protecao' | 'deferimento' | 'concessao'>): number[] =>
  prazoAposODeferimentoConta(d) ? anosDoPrazo(d.deferimento!, PRAZOS_DO_INPI.deferimentoDiasUteis + PRAZOS_DO_INPI.deferimentoExtraDiasUteis) : [];
/** O prazo após a publicação do deferimento da marca (#418): 60 dias úteis e mais 30 extras, no calendário do INPI; some com a concessão. */
function prazoAposODeferimento(d: DatasDaProtecao, calendario: CalendarioDoInpi): PrazoDaProtecao | null {
  if (!prazoAposODeferimentoConta(d)) return null;
  const P = PRAZOS_DO_INPI, fim = somarDiasUteisNoInpi(d.deferimento!, P.deferimentoDiasUteis, calendario);
  return { tipo: 'deferimento', nome: PRAZO_APOS_O_DEFERIMENTO, inicio: d.deferimento!, fim, fimExtra: somarDiasUteisNoInpi(fim, P.deferimentoExtraDiasUteis, calendario) };
}

/**
 * Marca: da concessão, um período de 10 anos atrás do outro, sem fim. Mostra as prorrogações até a que está correndo e mais algumas.
 * Antes da concessão, só o prazo após o deferimento (se a publicação dele foi informada).
 */
function prazosDaMarca(d: DatasDaProtecao, hoje: string, calendario: CalendarioDoInpi): PrazosDaProtecao {
  const aposODeferimento = prazoAposODeferimento(d, calendario);
  if (!d.concessao) return { ...semData('A validade da marca conta da concessão: informe a data da concessão.'), datas: aposODeferimento ? [aposODeferimento] : [] };
  const P = PRAZOS_DO_INPI, fins: string[] = [];
  for (let n = 1; ; n++) {
    fins.push(somarAnos(d.concessao, n * P.periodoDaMarca));
    if (fins.filter(f => f >= hoje).length >= P.prorrogacoesDaMarcaAMostrar) break;
  }
  return {
    validade: { rotulo: 'Vigência atual até', data: periodoAtual(fins, hoje) },
    datas: fins.map((fim, i) => prorrogacao(`${i + 1}ª prorrogação`, fim, f => somarMeses(f, P.prorrogacaoDaMarcaExtraMeses))),
    falta: null
  };
}

/** Desenho industrial: 10 anos do depósito e até 3 prorrogações de 5 anos; o 2º quinquênio no 5º ano. */
function prazosDoDesenho(d: DatasDaProtecao, hoje: string): PrazosDaProtecao {
  if (!d.deposito) return semData('Informe a data do depósito: a validade e as prorrogações contam dela.');
  const P = PRAZOS_DO_INPI, deposito = d.deposito;
  const fins = Array.from({ length: P.prorrogacoesDoDesenho + 1 }, (_, i) => somarAnos(deposito, P.periodoDoDesenho + i * P.prorrogacaoDoDesenho));
  const fimDoQuinquenio = somarAnos(deposito, P.anoDoQuinquenio);
  const quinquenio: PrazoDaProtecao = { tipo: 'quinquenio', nome: '2º quinquênio', inicio: somarAnos(deposito, P.anoDoQuinquenio - 1), fim: fimDoQuinquenio,
    fimExtra: somarMeses(fimDoQuinquenio, P.quinquenioExtraMeses) };
  // A última data dos fins é o limite de 25 anos: não se prorroga.
  const prorrogacoes = fins.slice(0, -1).map((fim, i) => prorrogacao(`${i + 1}ª prorrogação`, fim, f => somarDias(f, P.prorrogacaoDoDesenhoExtraDias)));
  return {
    validade: { rotulo: 'Vigência atual até', data: periodoAtual(fins, hoje) },
    datas: ordenar([quinquenio, ...prorrogacoes]),
    falta: null
  };
}

/** Programa de computador: 50 anos de 1º de janeiro do ano seguinte ao da publicação (ou, sem ela, ao da criação). Sem prazos a pagar. */
function prazosDoPrograma(d: DatasDaProtecao): PrazosDaProtecao {
  const base = d.publicacao || d.criacao;
  if (!base) return semData('Informe a data da criação ou da publicação: a proteção conta dela.');
  const ultimoAno = Number(base.slice(0, 4)) + PRAZOS_DO_INPI.vigenciaDoPrograma;
  return { validade: { rotulo: 'Proteção até', data: `${ultimoAno}-12-31` }, datas: [], falta: null };
}

const ordenar = (datas: PrazoDaProtecao[]) => datas.toSorted((a, b) => a.fim.localeCompare(b.fim));

/** Cada tipo de proteção: o nome, os campos do cadastro, os papéis próprios, a explicação e a conta dos prazos. Tipo novo = entrada nova. */
export const TIPOS_DE_PROTECAO: Record<TipoProtecao, TipoDeProtecao> = {
  marca: {
    nome: 'Marca', campos: ['deposito', 'deferimento', 'concessao', 'apresentacaoMarca', 'naturezaMarca', 'classesNice', 'especificacao'], papeis: ['titular'],
    nota: 'A validade da marca conta da concessão; antes dela, o cartão acompanha o prazo após a publicação do deferimento. O titular entra no cartão, em "Pessoas do processo".',
    prazos: prazosDaMarca,
    acompanhar: { titulo: 'Prorrogação da marca', tipos: ['prorrogacao'], aCadaAnos: PRAZOS_DO_INPI.periodoDaMarca, semFim: true }
  },
  patente_invencao: {
    nome: 'Patente de invenção', campos: ['deposito', 'publicacao', 'concessao'], papeis: ['titular', 'inventor'],
    nota: 'A validade e as anuidades contam do depósito. O titular e os inventores entram no cartão, em "Pessoas do processo".',
    prazos: prazosDaPatente(PRAZOS_DO_INPI.vigenciaDaPatente),
    acompanhar: { titulo: 'Anuidade da patente', tipos: ['anuidade'], aCadaAnos: 1, semFim: false }
  },
  modelo_utilidade: {
    nome: 'Modelo de utilidade', campos: ['deposito', 'publicacao', 'concessao'], papeis: ['titular', 'inventor'],
    nota: 'A validade e as anuidades contam do depósito. O titular e os inventores entram no cartão, em "Pessoas do processo".',
    prazos: prazosDaPatente(PRAZOS_DO_INPI.vigenciaDoModelo),
    acompanhar: { titulo: 'Anuidade do modelo de utilidade', tipos: ['anuidade'], aCadaAnos: 1, semFim: false }
  },
  desenho_industrial: {
    nome: 'Desenho industrial', campos: ['deposito', 'concessao', 'variacoes'], papeis: ['titular', 'autor_da_criacao'],
    nota: 'A validade e as prorrogações contam do depósito. O titular e o autor entram no cartão, em "Pessoas do processo".', prazos: prazosDoDesenho,
    // O 2º quinquênio (no 5º ano) e as prorrogações (aos 10, 15 e 20 anos) caem de 5 em 5 anos: cabem numa série só.
    acompanhar: { titulo: 'Quinquênio ou prorrogação do desenho', tipos: ['quinquenio', 'prorrogacao'], aCadaAnos: PRAZOS_DO_INPI.prorrogacaoDoDesenho, semFim: false }
  },
  programa_computador: {
    nome: 'Programa de computador', campos: ['criacao', 'publicacao', 'linguagem'], papeis: ['titular', 'autor_da_criacao'],
    nota: 'A proteção não depende do registro e conta da publicação (ou, sem ela, da criação). O titular e o autor entram no cartão, em "Pessoas do processo".',
    prazos: prazosDoPrograma,
    acompanhar: null
  }
};
export const TIPOS_DE_PROTECAO_EM_ORDEM = Object.keys(TIPOS_DE_PROTECAO) as TipoProtecao[];

export const APRESENTACOES_DA_MARCA: Record<ApresentacaoMarca, string> = {
  nominativa: 'Nominativa', mista: 'Mista', figurativa: 'Figurativa', tridimensional: 'Tridimensional', posicao: 'De posição'
};
export const NATUREZAS_DA_MARCA: Record<NaturezaMarca, string> = {
  produto: 'De produto', servico: 'De serviço', coletiva: 'Coletiva', certificacao: 'De certificação'
};

/** O rótulo e a dica de cada campo no cadastro. */
export const CAMPOS_DA_PROTECAO: Record<CampoDaProtecao, { rotulo: string; dica?: string }> = {
  deposito: { rotulo: 'Data do depósito' },
  deferimento: { rotulo: 'Publicação do deferimento (RPI)', dica: 'A data da Revista da Propriedade Industrial que publicou o deferimento: dela contam 60 dias úteis, mais 30 extras, até a concessão.' },
  concessao: { rotulo: 'Data da concessão' },
  publicacao: { rotulo: 'Data da publicação' },
  criacao: { rotulo: 'Data da criação' },
  apresentacaoMarca: { rotulo: 'Apresentação da marca' },
  naturezaMarca: { rotulo: 'Natureza da marca' },
  classesNice: { rotulo: 'Classes de Nice', dica: `Os números das classes, de 1 a ${CLASSE_NICE_MAIOR}, separados por vírgula. Ex.: 9, 35, 42.` },
  especificacao: { rotulo: 'Especificação dos produtos ou serviços' },
  variacoes: { rotulo: 'Número de variações', dica: `De 1 a ${VARIACOES_DO_DESENHO}.` },
  linguagem: { rotulo: 'Linguagem de programação' }
};

// ---------- papéis ----------
/** Os papéis que só existem nos processos de propriedade intelectual (a lista do banco é a mesma: processo_partes). */
export const PAPEIS_DA_PI: PapelDaParte[] = ['titular', 'inventor', 'autor_da_criacao'];
/** A recusa do papel de PI num processo de outra área (#418): a mesma no banco (gatilho papel_so_da_pi) e no fictício. */
export const PAPEL_SO_DA_PI = 'Titular, inventor e autor da criação só existem nos processos de propriedade intelectual.';
/** Se o papel pode entrar no processo: os de PI, só nos processos da área (#418). */
export const papelCabeNoProcesso = (papel: PapelDaParte, p: { area?: string | null }) => !PAPEIS_DA_PI.includes(papel) || ehDePropriedadeIntelectual(p.area);
/**
 * Os papéis de PI que o processo oferece: nenhum fora da área; com o tipo de proteção, os dele (ex.: inventor só em patente);
 * sem o tipo, os três.
 */
export const papeisDaProtecao = (p: { area?: string | null; protecao?: TipoProtecao | null }): PapelDaParte[] =>
  !ehDePropriedadeIntelectual(p.area) ? [] : p.protecao ? TIPOS_DE_PROTECAO[p.protecao].papeis : PAPEIS_DA_PI;

// ---------- classes de Nice ----------
/** As classes digitadas ("9, 35 42"), em ordem e sem repetir. Número fora de 1 a 45 dá erro com a mensagem para a tela. */
export function lerClassesNice(texto: string): number[] {
  const partes = texto.split(/[\s,;]+/).filter(Boolean);
  const classes = partes.map(Number);
  if (classes.some(n => !Number.isInteger(n) || n < 1 || n > CLASSE_NICE_MAIOR)) throw new Error(`As classes de Nice são números de 1 a ${CLASSE_NICE_MAIOR}, separados por vírgula.`);
  return [...new Set(classes)].toSorted((a, b) => a - b);
}
export const fmtClassesNice = (classes: readonly number[] | null | undefined) => (classes ?? []).join(', ');

// ---------- cadastro ----------
/** A recusa da concessão antes do depósito (a mesma no cadastro, no banco e no fictício). */
export const CONCESSAO_ANTES_DO_DEPOSITO = 'A concessão não pode ser antes do depósito.';
type ComArea = CamposProtecao & { area: string; tipo: TipoProcesso };
/** O campo conta só no processo de PI, com um tipo que o tenha (os outros estão fora da tela e não são gravados). */
export const campoDaProtecaoNaTela = (c: ComArea, campo: CampoDaProtecao) =>
  temProtecao(c) && !!c.protecao && TIPOS_DE_PROTECAO[c.protecao].campos.includes(campo);

const lerSemErro = (ler: () => unknown) => { try { ler(); return null; } catch (e) { return (e as Error).message; } };
const DATAS: CampoDaProtecao[] = ['deposito', 'deferimento', 'concessao', 'publicacao', 'criacao'];
/** A conferência de cada campo (a primeira mensagem que aparecer). Só vale para o campo que está na tela. */
const CONFERENCIAS_DA_PROTECAO: Partial<Record<CampoDaProtecao, ((c: ComArea) => string | null)[]>> = {
  ...Object.fromEntries(DATAS.map(campo => [campo, [(c: ComArea) => lerSemErro(() => lerData(c[campo]))]])),
  concessao: [
    c => lerSemErro(() => lerData(c.concessao)),
    c => {
      try {
        const dep = lerData(c.deposito), con = lerData(c.concessao);
        return campoDaProtecaoNaTela(c, 'deposito') && dep && con && con < dep ? CONCESSAO_ANTES_DO_DEPOSITO : null;
      } catch { return null; }
    }
  ],
  classesNice: [c => lerSemErro(() => lerClassesNice(c.classesNice))],
  especificacao: [c => c.especificacao.trim().length > TAMANHO_PROTECAO.especificacao ? `A especificação pode ter até ${TAMANHO_PROTECAO.especificacao} caracteres.` : null],
  linguagem: [c => c.linguagem.trim().length > TAMANHO_PROTECAO.linguagem ? `A linguagem pode ter até ${TAMANHO_PROTECAO.linguagem} caracteres.` : null],
  variacoes: [c => {
    const t = c.variacoes.trim(), n = Number(t);
    return t && (!Number.isInteger(n) || n < 1 || n > VARIACOES_DO_DESENHO) ? `O número de variações vai de 1 a ${VARIACOES_DO_DESENHO}.` : null;
  }]
};
/** O erro do campo, ou null (fora da tela, nunca há erro). */
export function erroDaProtecao(c: ComArea, campo: CampoDaProtecao): string | null {
  if (!campoDaProtecaoNaTela(c, campo)) return null;
  return (CONFERENCIAS_DA_PROTECAO[campo] ?? []).map(r => r(c)).find(Boolean) ?? null;
}

const textoOuNulo = (t: string) => t.trim() || null;
/** O que vai para o banco (só depois de conferido): fora da PI, tudo vazio; com um tipo, só os campos dele. */
export function dadosDaProtecao(c: ComArea): Required<Pick<Processo, 'protecao' | 'deposito' | 'deferimento' | 'concessao' | 'publicacao' | 'criacao' | 'apresentacao_marca'
  | 'natureza_marca' | 'classes_nice' | 'especificacao' | 'variacoes' | 'linguagem'>> {
  const tem = (campo: CampoDaProtecao) => campoDaProtecaoNaTela(c, campo);
  const data = (campo: CampoDaProtecao) => tem(campo) ? lerData(c[campo]) : null;
  return {
    protecao: temProtecao(c) && c.protecao ? c.protecao : null,
    deposito: data('deposito'), deferimento: data('deferimento'), concessao: data('concessao'), publicacao: data('publicacao'), criacao: data('criacao'),
    apresentacao_marca: tem('apresentacaoMarca') && c.apresentacaoMarca ? c.apresentacaoMarca : null,
    natureza_marca: tem('naturezaMarca') && c.naturezaMarca ? c.naturezaMarca : null,
    classes_nice: tem('classesNice') ? lerClassesNice(c.classesNice) : [],
    especificacao: tem('especificacao') ? textoOuNulo(c.especificacao) : null,
    variacoes: tem('variacoes') && c.variacoes.trim() ? Number(c.variacoes.trim()) : null,
    linguagem: tem('linguagem') ? textoOuNulo(c.linguagem) : null
  };
}

/** Os campos do formulário a partir do processo salvo (os de antes da migração vêm vazios). */
export const camposDaProtecao = (p: Partial<Pick<Processo, 'protecao' | 'deposito' | 'deferimento' | 'concessao' | 'publicacao' | 'criacao' | 'apresentacao_marca' | 'natureza_marca'
  | 'classes_nice' | 'especificacao' | 'variacoes' | 'linguagem'>>): CamposProtecao => ({
  protecao: p.protecao ?? '', deposito: fmtData(p.deposito), deferimento: fmtData(p.deferimento), concessao: fmtData(p.concessao), publicacao: fmtData(p.publicacao), criacao: fmtData(p.criacao),
  apresentacaoMarca: p.apresentacao_marca ?? '', naturezaMarca: p.natureza_marca ?? '', classesNice: fmtClassesNice(p.classes_nice),
  especificacao: p.especificacao ?? '', variacoes: p.variacoes ? String(p.variacoes) : '', linguagem: p.linguagem ?? ''
});

// ---------- prazos no cartão ----------
/** Os prazos do processo (null quando ele não é de PI ou não tem o tipo de proteção). */
export const prazosDaProtecao = (p: DatasDaProtecao & OndeHaProtecao, hoje: string, calendario: CalendarioDoInpi = SO_FERIADOS_NACIONAIS): PrazosDaProtecao | null =>
  temProtecao(p) && p.protecao ? TIPOS_DE_PROTECAO[p.protecao].prazos(p, hoje, calendario) : null;

/** Onde o prazo está hoje: já passou (nem o extra cabe mais), no prazo extra, aberto ou ainda por vir. */
export type SituacaoDoPrazo = 'passou' | 'extra' | 'aberto' | 'futuro';
export const SITUACOES_DO_PRAZO: Record<SituacaoDoPrazo, { nome: string; selo: 'ok' | 'erro' | 'pend' | 'arq' }> = {
  passou: { nome: 'Passou', selo: 'arq' },
  extra: { nome: 'No prazo extra', selo: 'erro' },
  aberto: { nome: 'Aberto', selo: 'pend' },
  futuro: { nome: 'A vencer', selo: 'ok' }
};
export function situacaoDoPrazo(x: PrazoDaProtecao, hoje: string): SituacaoDoPrazo {
  if (hoje < x.inicio) return 'futuro';
  if (hoje <= x.fim) return 'aberto';
  return x.fimExtra && hoje <= x.fimExtra ? 'extra' : 'passou';
}
/** O próximo prazo a cumprir: o primeiro, por data, que ainda não passou. */
export const proximoPrazo = (datas: readonly PrazoDaProtecao[], hoje: string) => datas.find(x => situacaoDoPrazo(x, hoje) !== 'passou') ?? null;
/** Quantos prazos ainda não passaram (o número ao lado do título da seção). */
export const prazosPorVir = (datas: readonly PrazoDaProtecao[], hoje: string) => datas.filter(x => situacaoDoPrazo(x, hoje) !== 'passou').length;
/** Como o prazo extra aparece no cartão: "com taxa extra até 10/12/2022" ou, no que não tem taxa, "prazo extra até 18/02/2027". */
export const extraPorExtenso = (x: Pick<PrazoDaProtecao, 'tipo' | 'fimExtra'>) =>
  x.fimExtra ? `${EXTRA_COM_TAXA[x.tipo] ? 'com taxa extra' : 'prazo extra'} até ${fmtData(x.fimExtra)}` : null;
/**
 * A célula "Prazo extra até" da tabela dos prazos: a data e, no prazo extra que é pago (anuidade, prorrogação, quinquênio), "com taxa":
 * "10/12/2022, com taxa". O prazo após o deferimento (#418) só mostra a data, sem falar em taxa. Sem prazo extra, um traço.
 */
export const extraNaTabela = (x: Pick<PrazoDaProtecao, 'tipo' | 'fimExtra'>) =>
  x.fimExtra ? `${fmtData(x.fimExtra)}${EXTRA_COM_TAXA[x.tipo] ? ', com taxa' : ''}` : '—';
/** Como o prazo aparece no cartão: "de 10/03/2022 a 10/06/2022 (com taxa extra até 10/12/2022)". */
export const prazoPorExtenso = (x: PrazoDaProtecao) => {
  const extra = extraPorExtenso(x);
  return `de ${fmtData(x.inicio)} a ${fmtData(x.fim)}${extra ? ` (${extra})` : ''}`;
};

// ---------- acompanhar na agenda (parte C, com os compromissos que se repetem da #307) ----------
/**
 * O compromisso que se repete com os prazos do processo de PI, como o cadastro do compromisso recebe: cada data é o último dia do prazo
 * normal; a primeira é a do primeiro prazo que ainda não acabou, e as seguintes vêm a cada N anos (a anuidade todo ano, o desenho de 5
 * em 5, a marca de 10 em 10 e sem fim). A demanda de cada data nasce quando o prazo abre (os dias do prazo normal, até o máximo aceito).
 */
export interface AcompanhamentoDaProtecao {
  titulo: string;
  /** A primeira data (aaaa-mm-dd). */
  data: string;
  /** Como as datas seguintes se repetem; null quando só resta um prazo (o compromisso não se repete). */
  regra: RegraDeRepeticao | null;
  /** Dias corridos antes de cada data em que nasce a demanda. */
  diasAntes: number;
  observacoes: string;
}
/** Os prazos que o compromisso acompanha (os do tipo que ainda não acabaram), ou null se o processo não tem o que acompanhar. */
export function acompanhamentoDaProtecao(p: DatasDaProtecao & OndeHaProtecao & { numero?: string | null }, hoje: string,
  calendario: CalendarioDoInpi = SO_FERIADOS_NACIONAIS): AcompanhamentoDaProtecao | null {
  const prazos = prazosDaProtecao(p, hoje, calendario), como = p.protecao ? TIPOS_DE_PROTECAO[p.protecao].acompanhar : null;
  if (!prazos || !como) return null;
  const porVir = prazos.datas.filter(x => como.tipos.includes(x.tipo) && x.fim >= hoje);
  const primeiro = porVir[0];
  if (!primeiro) return null;
  const vezes = como.semFim ? null : porVir.length;
  const regra: RegraDeRepeticao | null = vezes === 1 ? null : { frequencia: 'ano', intervalo: como.aCadaAnos, ate: null, vezes };
  return {
    titulo: [como.titulo, p.numero?.trim()].filter(Boolean).join(' ').slice(0, TAMANHO_COMPROMISSO.titulo),
    data: primeiro.fim, regra,
    diasAntes: Math.min(diasEntre(primeiro.inicio, primeiro.fim), DEMANDA_DO_COMPROMISSO.diasMaximos),
    observacoes: `Prazos do INPI calculados a partir das datas do processo, de ${primeiro.nome.toLowerCase()} em diante: cada data é o último dia do prazo `
      + `normal (há ainda o prazo extra, com taxa). ${AVISO_DO_ACOMPANHAMENTO}`
  };
}
/** O aviso que vai nas observações do compromisso: as datas são da lei. */
export const AVISO_DO_ACOMPANHAMENTO = 'Datas calculadas pela lei: confira sempre na Revista da Propriedade Industrial (RPI).';

const minuscula = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);
/** O que o botão do cartão vai criar: "Anuidade da patente a partir de 10/06/2027 (todo ano, 13 vezes), com a demanda 92 dias antes de cada data." */
export function descreverAcompanhamento(a: AcompanhamentoDaProtecao, comDemanda: boolean) {
  const repete = a.regra ? ` (${minuscula(descreverRepeticao(a.regra))})` : '';
  const demanda = comDemanda && a.regra ? `, com a demanda ${a.diasAntes} dias antes de cada data, quando o prazo abre` : '';
  return `Cria na agenda "${a.titulo}" a partir de ${fmtData(a.data)}${repete}${demanda}.`;
}

/** Os campos do cadastro do compromisso já preenchidos com o acompanhamento (tipo "Outro", o dia todo). */
export const camposDoAcompanhamento = (a: AcompanhamentoDaProtecao): Partial<CamposCompromisso> => ({
  tipo: 'outro', titulo: a.titulo, data: fmtData(a.data), hora: '', horaFim: '', observacoes: a.observacoes,
  ...(a.regra
    ? { repetir: a.regra.frequencia, aCada: String(a.regra.intervalo), termina: a.regra.vezes ? 'vezes' : 'nunca', repetirVezes: a.regra.vezes ? String(a.regra.vezes) : '',
      demandaDiasAntes: String(a.diasAntes) }
    : { repetir: '' })
});

/**
 * O prazo que já passou do fim normal e ainda está no prazo extra, com taxa (a anuidade nos 6 meses seguintes, a prorrogação da marca
 * ou do desenho): é o mais urgente, porque perdê-lo arquiva a patente ou extingue o registro. A série começa no prazo seguinte, então
 * ele vira um compromisso só, no último dia do prazo extra.
 */
export interface PrazoExtraDaProtecao {
  /** O nome do prazo ("7ª anuidade"). */
  nome: string;
  titulo: string;
  /** O último dia do prazo extra (aaaa-mm-dd). */
  data: string;
  observacoes: string;
}
/** O primeiro prazo dos que o compromisso acompanha que está hoje no prazo extra, ou null. */
export function prazoExtraDaProtecao(p: DatasDaProtecao & OndeHaProtecao & { numero?: string | null }, hoje: string,
  calendario: CalendarioDoInpi = SO_FERIADOS_NACIONAIS): PrazoExtraDaProtecao | null {
  const prazos = prazosDaProtecao(p, hoje, calendario), como = p.protecao ? TIPOS_DE_PROTECAO[p.protecao].acompanhar : null;
  const x = prazos && como ? prazos.datas.find(d => como.tipos.includes(d.tipo) && situacaoDoPrazo(d, hoje) === 'extra') : undefined;
  if (!x?.fimExtra) return null;
  return {
    nome: x.nome, data: x.fimExtra,
    titulo: [`${x.nome} no prazo extra`, p.numero?.trim()].filter(Boolean).join(' ').slice(0, TAMANHO_COMPROMISSO.titulo),
    observacoes: `Prazo do INPI calculado a partir das datas do processo. ${x.nome}: o prazo normal acabou em ${fmtData(x.fim)}; `
      + `com a taxa extra, vai até ${fmtData(x.fimExtra)}. ${AVISO_DO_ACOMPANHAMENTO}`
  };
}
/** O que o botão do prazo extra vai criar: "7ª anuidade está no prazo extra, com taxa, até 10/04/2027. Cria na agenda "…" nesse dia." */
export const descreverPrazoExtra = (x: PrazoExtraDaProtecao) =>
  `${x.nome} está no prazo extra, com taxa, até ${fmtData(x.data)}. Cria na agenda "${x.titulo}" nesse dia.`;
/** Os campos do cadastro do compromisso do prazo extra: tipo "Outro", o dia todo, sem repetir. */
export const camposDoPrazoExtra = (x: PrazoExtraDaProtecao): Partial<CamposCompromisso> => ({
  tipo: 'outro', titulo: x.titulo, data: fmtData(x.data), hora: '', horaFim: '', observacoes: x.observacoes, repetir: ''
});

// ---------- o prazo após o deferimento na agenda (#418) ----------
/** O título do compromisso do prazo após o deferimento: "Prazo após o deferimento 912345678". */
export const tituloDoPrazoAposODeferimento = (numero?: string | null) =>
  [PRAZO_APOS_O_DEFERIMENTO, numero?.trim()].filter(Boolean).join(' ').slice(0, TAMANHO_COMPROMISSO.titulo);
/**
 * O compromisso do prazo após o deferimento: um só, no último dia do prazo (ou, se ele já acabou, no último dia do prazo extra). Como
 * os outros prazos do INPI, nasce só quando a pessoa pede (um clique no cartão). Sem taxa: o dono avisou que ela não existe mais.
 */
export function prazoAposODeferimentoNaAgenda(p: DatasDaProtecao & OndeHaProtecao & { numero?: string | null }, hoje: string,
  calendario: CalendarioDoInpi = SO_FERIADOS_NACIONAIS): PrazoExtraDaProtecao | null {
  const x = prazosDaProtecao(p, hoje, calendario)?.datas.find(d => d.tipo === 'deferimento');
  const situacao = x && situacaoDoPrazo(x, hoje);
  if (!x?.fimExtra || situacao === 'passou') return null;
  const P = PRAZOS_DO_INPI;
  return {
    nome: x.nome, titulo: tituloDoPrazoAposODeferimento(p.numero), data: situacao === 'extra' ? x.fimExtra : x.fim,
    observacoes: `Prazo do INPI contado da publicação do deferimento na RPI, em ${fmtData(x.inicio)}: ${P.deferimentoDiasUteis} dias úteis, até `
      + `${fmtData(x.fim)}, e mais ${P.deferimentoExtraDiasUteis} dias úteis de prazo extra, até ${fmtData(x.fimExtra)}. ${AVISO_DO_ACOMPANHAMENTO}`
  };
}
/** O que o botão do prazo após o deferimento vai criar: "Cria na agenda "Prazo após o deferimento …" em 05/01/2027." */
export const descreverPrazoAposODeferimento = (x: PrazoExtraDaProtecao) => `Cria na agenda "${x.titulo}" em ${fmtData(x.data)}.`;
/** Com a concessão da marca informada, o título do compromisso do prazo após o deferimento que o cartão oferece concluir (null: não há o que concluir). */
export const tituloDoDeferimentoAConcluir = (p: Pick<DatasDaProtecao, 'protecao' | 'concessao'> & { numero?: string | null }) =>
  p.protecao === 'marca' && p.concessao ? tituloDoPrazoAposODeferimento(p.numero) : null;
/** O compromisso do prazo após o deferimento que ainda não foi concluído nem arquivado (null: nenhum, ou o quadro não tem a coluna de concluído). */
export const compromissoAConcluir = <T extends Pick<CompromissoLigado, 'titulo' | 'etapa_id' | 'arquivado_em'>>(ligados: readonly T[], titulo: string, concluida: string | null) =>
  concluida ? ligados.find(c => !c.arquivado_em && c.titulo === titulo && c.etapa_id !== concluida) ?? null : null;

// ---------- os compromissos já criados acompanham as datas (#418) ----------
/** O compromisso ativo do processo que já acompanha esses prazos (o de mesmo título), para o cartão não oferecer criar outro. */
export const compromissoDoAcompanhamento = <T extends Pick<CompromissoLigado, 'titulo' | 'arquivado_em'>>(ligados: readonly T[], a: Pick<AcompanhamentoDaProtecao, 'titulo'>) =>
  ligados.find(c => !c.arquivado_em && c.titulo === a.titulo) ?? null;
/** A data de um compromisso dos prazos do INPI que ficou diferente da conta: o compromisso (a próxima data dele), a data que ele tem e a da conta. */
export interface DataParaAtualizar { id: string; titulo: string; de: string; para: string }
/** As datas do processo de que partem os prazos que vão para a agenda (os nomes das colunas, como o histórico do processo os grava). */
export const DATAS_DOS_PRAZOS_NA_AGENDA: readonly string[] = ['deposito', 'deferimento', 'concessao'];
/** Uma linha do histórico do processo: o que mudou e quando. */
type MudancaDoProcesso = Pick<Historico, 'alteracoes' | 'em'>;
/** Se o histórico do processo tem uma mudança do depósito, do deferimento ou da concessão depois do instante dado. */
export const datasMudaramDepois = (historico: readonly MudancaDoProcesso[], desde: string) =>
  historico.some(h => Date.parse(h.em) > Date.parse(desde) && DATAS_DOS_PRAZOS_NA_AGENDA.some(campo => Object.hasOwn(h.alteracoes, campo)));
/**
 * Quando o depósito, a concessão ou o deferimento mudam, a conta dá outra data: a próxima data do compromisso (a primeira de hoje em
 * diante, das que não foram arquivadas) fica diferente da primeira data da conta, e o cartão oferece atualizar esta e as seguintes.
 * Só oferece se uma dessas datas do processo mudou DEPOIS da última mudança do compromisso (o histórico do processo diz): o compromisso
 * que a pessoa levou ao próximo dia útil, ou acertou pela RPI, fica como ela deixou. null: o compromisso está em dia, ou não há data dele
 * por vir, ou as datas do processo não mudaram desde que ele foi mexido.
 */
export function dataParaAtualizar<T extends Pick<CompromissoLigado, 'id' | 'titulo' | 'data' | 'arquivado_em' | 'atualizado_em'>>(ligados: readonly T[],
  a: Pick<AcompanhamentoDaProtecao, 'titulo' | 'data'>, hoje: string, historico: readonly MudancaDoProcesso[]): DataParaAtualizar | null {
  const proxima = ligados.filter(c => !c.arquivado_em && c.titulo === a.titulo && c.data >= hoje).toSorted((x, y) => x.data.localeCompare(y.data))[0];
  return proxima && proxima.data !== a.data && datasMudaramDepois(historico, proxima.atualizado_em)
    ? { id: proxima.id, titulo: a.titulo, de: proxima.data, para: a.data } : null;
}
/** O que o cartão diz da data a atualizar: "As datas do processo mudaram: "…" está na agenda em 10/06/2027, e a conta de agora dá 10/09/2027." */
export const descreverDataParaAtualizar = (x: DataParaAtualizar) =>
  `As datas do processo mudaram: "${x.titulo}" está na agenda em ${fmtData(x.de)}, e a conta de agora dá ${fmtData(x.para)}.`;
/**
 * No endereço do cadastro do compromisso (?acompanhar=…, com ?processo=): abre já preenchido com os prazos do processo. "protecao": a
 * série dos prazos; "prazo-extra": o prazo que está no prazo extra; "deferimento": o prazo após o deferimento da marca (#418).
 */
export const PARAMETRO_ACOMPANHAR = 'acompanhar';
export const ACOMPANHAR_PROTECAO = 'protecao';
export const ACOMPANHAR_PRAZO_EXTRA = 'prazo-extra';
export const ACOMPANHAR_DEFERIMENTO = 'deferimento';
type ProcessoParaAcompanhar = DatasDaProtecao & OndeHaProtecao & { numero?: string | null };
type CamposDoPrazo = (p: ProcessoParaAcompanhar, hoje: string, calendario: CalendarioDoInpi) => Partial<CamposCompromisso> | null;
/** O que cada valor de ?acompanhar= preenche no cadastro do compromisso (null: o processo não tem esse prazo). Valor novo = entrada nova. */
const CAMPOS_PARA_ACOMPANHAR: Record<string, CamposDoPrazo> = {
  [ACOMPANHAR_PROTECAO]: (p, hoje, cal) => { const a = acompanhamentoDaProtecao(p, hoje, cal); return a && camposDoAcompanhamento(a); },
  [ACOMPANHAR_PRAZO_EXTRA]: (p, hoje, cal) => { const x = prazoExtraDaProtecao(p, hoje, cal); return x && camposDoPrazoExtra(x); },
  [ACOMPANHAR_DEFERIMENTO]: (p, hoje, cal) => { const x = prazoAposODeferimentoNaAgenda(p, hoje, cal); return x && camposDoPrazoExtra(x); }
};
/** Se o valor de ?acompanhar= é um dos que o cadastro conhece. */
export const ehAcompanhamento = (qual: string | null): qual is string => !!qual && Object.hasOwn(CAMPOS_PARA_ACOMPANHAR, qual);
/** Os campos do cadastro para o valor de ?acompanhar= e o processo, ou null. */
export const camposParaAcompanhar = (qual: string | null, p: ProcessoParaAcompanhar, hoje: string, calendario: CalendarioDoInpi = SO_FERIADOS_NACIONAIS) =>
  ehAcompanhamento(qual) ? CAMPOS_PARA_ACOMPANHAR[qual](p, hoje, calendario) : null;
