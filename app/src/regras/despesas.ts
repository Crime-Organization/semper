// As despesas do escritório a pagar (#439), na aba Obrigações do Financeiro: o formulário (descrição, valor, vencimento e repetição),
// a conferência, o que vai para o banco, o período, os totais, os avisos e o histórico. Tudo puro, sem tela nem banco.
//
// A repetição usa as mesmas contas dos compromissos (regras/repeticao.ts): por semana, mês ou ano, a cada N, até uma data, por um
// número de vezes ou sem fim; as datas nascem sozinhas até 12 meses adiante. Marcar como paga só registra o fato (não cria lançamento
// no caixa), e a próxima da repetição continua a pagar.
import type { DadosDespesa, DespesaDoEscritorio, FrequenciaRepeticao, RegraDeRepeticao } from '../dados/tipos';
import { REPETICAO, TAMANHO_FINANCEIRO, VALOR_MAXIMO_DO_LANCAMENTO } from '../dados/limites';
import { anoAceito, dataExiste } from './calendario';
import { centavosNoCampo, fmtCentavos, lerValor } from './caixa';
import { fmtData } from './pessoa';
import { FREQUENCIAS, type FimDaRepeticao } from './repeticao';

// ---------- as mensagens (as mesmas do banco, 20261125104500_despesas_do_escritorio.sql, e do banco fictício) ----------
export const SO_ADMINISTRADOR_NAS_DESPESAS = 'Só um administrador mexe nas despesas do escritório.';
export const DESPESA_NAO_ENCONTRADA = 'Despesa não encontrada neste escritório.';
export const DESPESA_JA_PAGA = 'Esta despesa já foi paga.';
export const FIM_ANTES_DO_VENCIMENTO = 'A data final precisa ser depois do vencimento.';

// ---------- o formulário ----------
/** Os campos do cadastro, como digitados. Sem `repetir`, a despesa não se repete. As datas em aaaa-mm-dd. */
export interface FormDaDespesa {
  descricao: string;
  valor: string;
  vencimento: string;
  repetir: FrequenciaRepeticao | '';
  /** O N de "a cada N". */
  aCada: string;
  termina: FimDaRepeticao;
  repetirAte: string;
  repetirVezes: string;
}
export const despesaNova = (hoje: string): FormDaDespesa =>
  ({ descricao: '', valor: '', vencimento: hoje, repetir: '', aCada: '1', termina: 'nunca', repetirAte: '', repetirVezes: '' });
/** A despesa que já existe, no formulário de mudar (a repetição não se escolhe de novo). */
export const formDaDespesa = (d: Pick<DespesaDoEscritorio, 'descricao' | 'valor' | 'vencimento'>): FormDaDespesa =>
  ({ ...despesaNova(d.vencimento), descricao: d.descricao, valor: centavosNoCampo(d.valor) });

export type CampoDaDespesa = 'descricao' | 'valor' | 'vencimento' | 'aCada' | 'repetirAte' | 'repetirVezes';
export type ErrosDaDespesa = Partial<Record<CampoDaDespesa, string>>;

const dataBoa = (iso: string) => dataExiste(iso) && anoAceito(iso);
const inteiro = (t: string) => /^\d+$/.test(t.trim()) ? Number(t.trim()) : NaN;
const entre = (n: number, de: number, ate: number) => n >= de && n <= ate;
type Conferencia = (f: FormDaDespesa) => string | null;
/** As conferências de cada campo (a primeira que falhar dá a mensagem). As da repetição só valem quando ela foi escolhida. */
const CONFERENCIAS: Record<CampoDaDespesa, Conferencia[]> = {
  descricao: [
    f => f.descricao.trim() ? null : 'Diga do que se trata.',
    f => f.descricao.trim().length <= TAMANHO_FINANCEIRO.descricao ? null : `Use até ${TAMANHO_FINANCEIRO.descricao} caracteres.`
  ],
  valor: [f => { const v = lerValor(f.valor); return 'erro' in v ? v.erro : null; }],
  vencimento: [f => dataBoa(f.vencimento) ? null : 'Informe uma data válida.'],
  aCada: [f => !f.repetir || entre(inteiro(f.aCada), 1, REPETICAO.intervaloMaximo) ? null : `Informe de 1 a ${REPETICAO.intervaloMaximo}.`],
  repetirAte: [
    f => !f.repetir || f.termina !== 'data' || dataBoa(f.repetirAte) ? null : 'Informe até quando a despesa se repete.',
    f => !f.repetir || f.termina !== 'data' || !dataBoa(f.vencimento) || f.repetirAte > f.vencimento ? null : FIM_ANTES_DO_VENCIMENTO
  ],
  repetirVezes: [f => !f.repetir || f.termina !== 'vezes' || entre(inteiro(f.repetirVezes), 2, REPETICAO.vezesMaximas)
    ? null : `Informe de 2 a ${REPETICAO.vezesMaximas} vezes, contando a primeira.`]
};
/** O que há de errado em cada campo; vazio: pode gravar. */
export function errosDaDespesa(f: FormDaDespesa): ErrosDaDespesa {
  const erros: ErrosDaDespesa = {};
  for (const campo of Object.keys(CONFERENCIAS) as CampoDaDespesa[]) {
    const erro = CONFERENCIAS[campo].map(c => c(f)).find(e => e !== null);
    if (erro) erros[campo] = erro;
  }
  return erros;
}
/** O que vai para o banco (só depois de conferido). */
export function dadosDaDespesa(f: FormDaDespesa): DadosDespesa {
  const valor = lerValor(f.valor);
  if ('erro' in valor) throw new Error(valor.erro);
  return { descricao: f.descricao.trim(), valor: valor.centavos, vencimento: f.vencimento };
}
/** A repetição que vai para o banco (só depois de conferida), ou null se a despesa não se repete. */
export const repeticaoDaDespesa = (f: FormDaDespesa): RegraDeRepeticao | null => !f.repetir ? null : {
  frequencia: f.repetir, intervalo: inteiro(f.aCada),
  ate: f.termina === 'data' ? f.repetirAte : null, vezes: f.termina === 'vezes' ? inteiro(f.repetirVezes) : null
};
/** A conferência do banco (as regras check e a da data final), para o banco fictício recusar o mesmo. */
export const despesaNoLimite = (d: DadosDespesa) => Number.isInteger(d.valor) && d.valor > 0 && d.valor <= VALOR_MAXIMO_DO_LANCAMENTO
  && !!d.descricao.trim() && d.descricao.trim().length <= TAMANHO_FINANCEIRO.descricao && dataBoa(d.vencimento);

// ---------- a lista ----------
/** A despesa entra no período: vence nele (paga ou não), ou está a pagar e venceu antes dele. Como public.financeiro_despesas_do_periodo. */
export const despesaNoPeriodo = (d: Pick<DespesaDoEscritorio, 'vencimento' | 'paga_em'>, de: string, ate: string) =>
  (d.vencimento >= de && d.vencimento <= ate) || (d.vencimento < de && !d.paga_em);
/** A ordem da lista: por vencimento. */
export const porVencimento = (a: Pick<DespesaDoEscritorio, 'vencimento'>, b: Pick<DespesaDoEscritorio, 'vencimento'>) => a.vencimento.localeCompare(b.vencimento);
/** Quanto falta pagar na lista. */
export const totalAPagar = (lista: readonly Pick<DespesaDoEscritorio, 'valor' | 'paga_em'>[]) => lista.reduce((s, d) => s + (d.paga_em ? 0 : d.valor), 0);
/** Como a despesa aparece nos rótulos dos botões: "Conta de luz, vence em 10/12/2026". */
export const rotuloDaDespesa = (d: Pick<DespesaDoEscritorio, 'descricao' | 'vencimento'>) => `${d.descricao}, vence em ${fmtData(d.vencimento)}`;

// ---------- a dica da repetição ----------
/** Até onde as datas nascem sozinhas, contado de REPETICAO.horizonteMeses (o mesmo de privado.horizonte_da_repeticao, no banco). */
export const dicaDaRepeticao = (horizonteMeses = REPETICAO.horizonteMeses) =>
  `As próximas datas nascem sozinhas, até ${horizonteMeses} ${horizonteMeses === 1 ? 'mês' : 'meses'} adiante.`;

// ---------- os avisos ----------
const quantas = (n: number, uma: string, varias: string) => `${n} ${n === 1 ? uma : varias}`;
/** Depois de cadastrar: com a repetição, quantas datas a mais nasceram. */
export const avisoDaDespesaCriada = (seguintes: number) => seguintes
  ? `Despesa cadastrada, com mais ${quantas(seguintes, 'data', 'datas')} da repetição.` : 'Despesa cadastrada.';
/** Depois de mudar: só esta, ou esta e as seguintes. */
export const avisoDaDespesaMudada = (mudadas: number) => mudadas > 1 ? `${quantas(mudadas, 'despesa mudada', 'despesas mudadas')} na repetição.` : 'Despesa atualizada.';
/** Depois de excluir: só esta, ou esta e as seguintes (e a repetição parou). */
export const avisoDaDespesaExcluida = (excluidas: number, seguintes: boolean) => seguintes
  ? `${quantas(excluidas, 'despesa excluída', 'despesas excluídas')}. A repetição parou.` : 'Despesa excluída.';

// ---------- o histórico ----------
export const CAMPOS_DA_DESPESA: Record<string, string> = { descricao: 'Descrição', valor: 'Valor', vencimento: 'Vencimento', paga_em: 'Paga em', excluida_em: 'Exclusão' };
const FORMATOS: Record<string, (v: unknown) => string> = {
  valor: v => fmtCentavos(Number(v)),
  vencimento: v => fmtData(String(v)),
  paga_em: v => fmtData(String(v)),
  excluida_em: () => 'Excluída'
};
export const valorNaDespesa = (campo: string, v: unknown) => v === null || v === undefined ? '—' : (FORMATOS[campo] ?? String)(v);

/** O nome de cada frequência, para a escolha do formulário. */
export const ESCOLHAS_DA_REPETICAO = (Object.keys(FREQUENCIAS) as FrequenciaRepeticao[]).map(f => ({ id: f, nome: FREQUENCIAS[f].nome }));
