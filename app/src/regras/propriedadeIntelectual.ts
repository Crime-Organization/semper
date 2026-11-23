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
// Os prazos de meses e anos terminam no dia de mesmo número do dia do início (Código Civil, art. 132, §3º); o dia que não existe no
// mês de chegada vira o último dia dele (29/02 + 1 ano = 28/02). Prazo que vence em dia sem expediente no INPI vai para o próximo
// dia útil (Manual de Marcas, cap. 1): a conta mostra a data da lei, e o cartão avisa para conferir.
import type { ApresentacaoMarca, NaturezaMarca, PapelDaParte, Processo, TipoProtecao } from '../dados/tipos';
import { CLASSE_NICE_MAIOR, TAMANHO_PROTECAO, VARIACOES_DO_DESENHO } from '../dados/limites';
import { somarMeses } from './repeticao';
import { somarDias } from './prazos';
import { fmtData, lerData } from './pessoa';
import { normal } from './texto';

/** A área do direito que abre os campos de propriedade intelectual (a da lista pronta de regras/processo.ts). */
export const AREA_DA_PI = 'Propriedade intelectual';
/** Se o processo é de propriedade intelectual: pela área, sem contar maiúsculas nem acentos. */
export const ehDePropriedadeIntelectual = (area: string | null | undefined) => !!area && normal(area.trim()) === normal(AREA_DA_PI);

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
  vigenciaDoPrograma: 50
};

// ---------- os tipos de proteção ----------
/** Os campos de cada tipo, como digitados no cadastro (as datas em dd/mm/aaaa; as classes separadas por vírgula). */
export interface CamposProtecao {
  protecao: TipoProtecao | '';
  deposito: string;
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
  protecao: '', deposito: '', concessao: '', publicacao: '', criacao: '', apresentacaoMarca: '', naturezaMarca: '', classesNice: '', especificacao: '', variacoes: '', linguagem: ''
};

/** As datas de que os prazos partem. */
export type DatasDaProtecao = Pick<Processo, 'protecao' | 'deposito' | 'concessao' | 'publicacao' | 'criacao'>;

/** Que prazo é: a anuidade da patente, o pedido de exame, a prorrogação (marca e desenho) ou o quinquênio do desenho. */
export type TipoDoPrazo = 'anuidade' | 'exame' | 'prorrogacao' | 'quinquenio';
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
  prazos: (d: DatasDaProtecao, hoje: string) => PrazosDaProtecao;
}

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

/** Marca: da concessão, um período de 10 anos atrás do outro, sem fim. Mostra as prorrogações até a que está correndo e mais algumas. */
function prazosDaMarca(d: DatasDaProtecao, hoje: string): PrazosDaProtecao {
  if (!d.concessao) return semData('A validade da marca conta da concessão: informe a data da concessão.');
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
    nome: 'Marca', campos: ['deposito', 'concessao', 'apresentacaoMarca', 'naturezaMarca', 'classesNice', 'especificacao'], papeis: ['titular'],
    nota: 'A validade da marca conta da concessão. O titular entra no cartão, em "Pessoas do processo".', prazos: prazosDaMarca
  },
  patente_invencao: {
    nome: 'Patente de invenção', campos: ['deposito', 'publicacao', 'concessao'], papeis: ['titular', 'inventor'],
    nota: 'A validade e as anuidades contam do depósito. O titular e os inventores entram no cartão, em "Pessoas do processo".',
    prazos: prazosDaPatente(PRAZOS_DO_INPI.vigenciaDaPatente)
  },
  modelo_utilidade: {
    nome: 'Modelo de utilidade', campos: ['deposito', 'publicacao', 'concessao'], papeis: ['titular', 'inventor'],
    nota: 'A validade e as anuidades contam do depósito. O titular e os inventores entram no cartão, em "Pessoas do processo".',
    prazos: prazosDaPatente(PRAZOS_DO_INPI.vigenciaDoModelo)
  },
  desenho_industrial: {
    nome: 'Desenho industrial', campos: ['deposito', 'concessao', 'variacoes'], papeis: ['titular', 'autor_da_criacao'],
    nota: 'A validade e as prorrogações contam do depósito. O titular e o autor entram no cartão, em "Pessoas do processo".', prazos: prazosDoDesenho
  },
  programa_computador: {
    nome: 'Programa de computador', campos: ['criacao', 'publicacao', 'linguagem'], papeis: ['titular', 'autor_da_criacao'],
    nota: 'A proteção não depende do registro e conta da publicação (ou, sem ela, da criação). O titular e o autor entram no cartão, em "Pessoas do processo".',
    prazos: prazosDoPrograma
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
type ComArea = CamposProtecao & { area: string };
/** O campo conta só no processo de PI, com um tipo que o tenha (os outros estão fora da tela e não são gravados). */
export const campoDaProtecaoNaTela = (c: ComArea, campo: CampoDaProtecao) =>
  ehDePropriedadeIntelectual(c.area) && !!c.protecao && TIPOS_DE_PROTECAO[c.protecao].campos.includes(campo);

const lerSemErro = (ler: () => unknown) => { try { ler(); return null; } catch (e) { return (e as Error).message; } };
const DATAS: CampoDaProtecao[] = ['deposito', 'concessao', 'publicacao', 'criacao'];
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
export function dadosDaProtecao(c: ComArea): Required<Pick<Processo, 'protecao' | 'deposito' | 'concessao' | 'publicacao' | 'criacao' | 'apresentacao_marca'
  | 'natureza_marca' | 'classes_nice' | 'especificacao' | 'variacoes' | 'linguagem'>> {
  const tem = (campo: CampoDaProtecao) => campoDaProtecaoNaTela(c, campo);
  const data = (campo: CampoDaProtecao) => tem(campo) ? lerData(c[campo]) : null;
  return {
    protecao: ehDePropriedadeIntelectual(c.area) && c.protecao ? c.protecao : null,
    deposito: data('deposito'), concessao: data('concessao'), publicacao: data('publicacao'), criacao: data('criacao'),
    apresentacao_marca: tem('apresentacaoMarca') && c.apresentacaoMarca ? c.apresentacaoMarca : null,
    natureza_marca: tem('naturezaMarca') && c.naturezaMarca ? c.naturezaMarca : null,
    classes_nice: tem('classesNice') ? lerClassesNice(c.classesNice) : [],
    especificacao: tem('especificacao') ? textoOuNulo(c.especificacao) : null,
    variacoes: tem('variacoes') && c.variacoes.trim() ? Number(c.variacoes.trim()) : null,
    linguagem: tem('linguagem') ? textoOuNulo(c.linguagem) : null
  };
}

/** Os campos do formulário a partir do processo salvo (os de antes da migração vêm vazios). */
export const camposDaProtecao = (p: Partial<Pick<Processo, 'protecao' | 'deposito' | 'concessao' | 'publicacao' | 'criacao' | 'apresentacao_marca' | 'natureza_marca'
  | 'classes_nice' | 'especificacao' | 'variacoes' | 'linguagem'>>): CamposProtecao => ({
  protecao: p.protecao ?? '', deposito: fmtData(p.deposito), concessao: fmtData(p.concessao), publicacao: fmtData(p.publicacao), criacao: fmtData(p.criacao),
  apresentacaoMarca: p.apresentacao_marca ?? '', naturezaMarca: p.natureza_marca ?? '', classesNice: fmtClassesNice(p.classes_nice),
  especificacao: p.especificacao ?? '', variacoes: p.variacoes ? String(p.variacoes) : '', linguagem: p.linguagem ?? ''
});

// ---------- prazos no cartão ----------
/** Os prazos do processo (null quando ele não é de PI ou não tem o tipo de proteção). */
export const prazosDaProtecao = (p: DatasDaProtecao & { area?: string | null }, hoje: string): PrazosDaProtecao | null =>
  ehDePropriedadeIntelectual(p.area) && p.protecao ? TIPOS_DE_PROTECAO[p.protecao].prazos(p, hoje) : null;

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
/** Como o prazo aparece no cartão: "de 10/03/2022 a 10/06/2022 (com taxa extra até 10/12/2022)". */
export const prazoPorExtenso = (x: PrazoDaProtecao) =>
  `de ${fmtData(x.inicio)} a ${fmtData(x.fim)}${x.fimExtra ? ` (com taxa extra até ${fmtData(x.fimExtra)})` : ''}`;
