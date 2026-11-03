// O lucro dos sócios: quanto cada um acumulou, quanto já retirou e quanto está em aberto. Tudo puro, sem tela nem banco. Os valores são em
// centavos; as datas, "aaaa-mm-dd". A conta é a da aba Lucros do Caixa, confirmada pelo escritório em 02/11/2026:
// - como responsável: a parte do responsável em cada recebimento com tudo na conta da empresa. Abaixo disso, o sócio já ficou com a dele;
// - o que o escritório fica (30%, ou 20% com terceiro) continua dele, para as despesas: não é lucro do sócio;
// - como indicador: os 10% do que o cliente pagou. Nunca se soma com o de responsável;
// - só a retirada conta como pagamento do lucro: o repasse entre contas (da PJ para a PF) é transferência, não lucro.
import type { MovimentoDoLucro, Socio } from '../dados/tipos';
import { TAMANHO_FINANCEIRO } from '../dados/limites';
import { anoAceito, dataExiste } from './calendario';
import { centavosNoCampo, fmtCentavos, lerValor } from './caixa';
import { parte, PERCENTUAL_DO_ESCRITORIO } from './financeiro';

export const MESES_DO_ANO = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

/** A parte do sócio responsável num recebimento: o líquido, menos o escritório e os terceiros. É o mesmo que caberia a quem não é sócio. */
export function parteDoSocio(r: { liquido: number; terceiros: { valor: number }[] }): number {
  const percentual = r.terceiros.length ? PERCENTUAL_DO_ESCRITORIO.reduzido : PERCENTUAL_DO_ESCRITORIO.normal;
  return Math.max(r.liquido - parte(r.liquido, percentual) - r.terceiros.reduce((s, t) => s + t.valor, 0), 0);
}

export interface LinhaDoLucro {
  pessoaId: string;
  nome: string;
  /** O que ficou em aberto dos anos anteriores. */
  anterior: number;
  /** O que acumulou em cada mês do ano. */
  meses: number[];
  /** O que foi pago no ano. */
  pago: number;
  /** O anterior, mais o que acumulou no ano, menos o que foi pago no ano. Negativo: retirou mais do que acumulou. */
  emAberto: number;
}
interface Acumulado { pessoaId: string; nome: string; data: string; valor: number }
interface Pago { pessoaId: string; nome: string; data: string; valor: number }

const anoDe = (iso: string) => Number(iso.slice(0, 4));
const mesDe = (iso: string) => Number(iso.slice(5, 7)) - 1;
const socioNoAno = (s: Pick<Socio, 'desde' | 'ate'>, ano: number) => anoDe(s.desde) <= ano && (s.ate === null || anoDe(s.ate) >= ano);

/** Uma linha para cada sócio do ano e para quem tem valores: quem saiu continua aparecendo enquanto houver o que mostrar. */
function linhasDoAno(acumulados: Acumulado[], pagos: Pago[], socios: Pick<Socio, 'pessoa_id' | 'nome' | 'desde' | 'ate'>[], ano: number): LinhaDoLucro[] {
  const linhas = new Map<string, LinhaDoLucro>();
  const linha = (pessoaId: string, nome: string) => {
    const achada = linhas.get(pessoaId);
    if (achada) return achada;
    const nova: LinhaDoLucro = { pessoaId, nome, anterior: 0, meses: MESES_DO_ANO.map(() => 0), pago: 0, emAberto: 0 };
    linhas.set(pessoaId, nova);
    return nova;
  };
  socios.filter(s => socioNoAno(s, ano)).forEach(s => linha(s.pessoa_id, s.nome));
  acumulados.filter(a => anoDe(a.data) <= ano).forEach(a => {
    const l = linha(a.pessoaId, a.nome);
    if (anoDe(a.data) === ano) l.meses[mesDe(a.data)] += a.valor; else l.anterior += a.valor;
  });
  pagos.filter(p => anoDe(p.data) <= ano).forEach(p => {
    const l = linha(p.pessoaId, p.nome);
    if (anoDe(p.data) === ano) l.pago += p.valor; else l.anterior -= p.valor;
  });
  linhas.forEach(l => { l.emAberto = l.anterior + l.meses.reduce((s, v) => s + v, 0) - l.pago; });
  return [...linhas.values()].toSorted((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

const comoResponsavel = (m: MovimentoDoLucro): Acumulado[] => m.recebimentos.map(r => ({ pessoaId: r.pessoa_id, nome: r.nome, data: r.data, valor: parteDoSocio(r) }));
const retiradas = (m: MovimentoDoLucro): Pago[] => m.retiradas.map(r => ({ pessoaId: r.pessoa_id, nome: r.nome, data: r.data, valor: r.valor }));

/** As duas contas do ano, sempre separadas. */
export function lucroDoAno(m: MovimentoDoLucro, socios: Pick<Socio, 'pessoa_id' | 'nome' | 'desde' | 'ate'>[], ano: number) {
  return {
    responsavel: linhasDoAno(comoResponsavel(m), retiradas(m), socios, ano),
    indicador: linhasDoAno(
      m.indicacoes.map(i => ({ pessoaId: i.pessoa_id, nome: i.nome, data: i.data, valor: i.valor })),
      m.indicacoes.flatMap(i => i.pago_em ? [{ pessoaId: i.pessoa_id, nome: i.nome, data: i.pago_em, valor: i.valor }] : []),
      socios, ano)
  };
}

/** A soma de cada coluna. */
export function totalDasLinhas(linhas: LinhaDoLucro[]): Omit<LinhaDoLucro, 'pessoaId' | 'nome'> {
  return {
    anterior: linhas.reduce((s, l) => s + l.anterior, 0),
    meses: MESES_DO_ANO.map((_, i) => linhas.reduce((s, l) => s + l.meses[i], 0)),
    pago: linhas.reduce((s, l) => s + l.pago, 0),
    emAberto: linhas.reduce((s, l) => s + l.emAberto, 0)
  };
}

/** Os anos para escolher: do primeiro com movimento até o ano de hoje, do mais novo ao mais antigo. O escolhido sempre está na lista, mesmo que o movimento dele tenha sido desfeito. */
export function anosDoLucro(m: MovimentoDoLucro, hoje: string, escolhido: number): number[] {
  const anos = [anoDe(hoje), escolhido, ...m.recebimentos.map(r => anoDe(r.data)), ...m.indicacoes.map(i => anoDe(i.data)), ...m.retiradas.map(r => anoDe(r.data))];
  const ultimo = Math.max(...anos), primeiro = Math.min(...anos);
  return Array.from({ length: ultimo - primeiro + 1 }, (_, i) => ultimo - i);
}

/** O nome da coluna: num ano que já passou, ela mostra como ficou no fim dele, e não o que se deve hoje. */
export const rotuloDoEmAberto = (ano: number, hoje: string) => ano < anoDe(hoje) ? `Em aberto no fim de ${ano}` : 'Em aberto';

/** Quanto do que o sócio acumulou como responsável ainda não foi pago, até hoje. */
export function emAbertoComoResponsavel(m: MovimentoDoLucro, pessoaId: string): number {
  return comoResponsavel(m).filter(a => a.pessoaId === pessoaId).reduce((s, a) => s + a.valor, 0) - m.retiradas.filter(r => r.pessoa_id === pessoaId).reduce((s, r) => s + r.valor, 0);
}

// ---------- pagar o lucro ----------
export interface FormDaRetirada { pessoaId: string; contaId: string; data: string; valor: string; descricao: string }
/** O formulário já vem com o que está em aberto, quando há. */
export const retiradaNova = (pessoaId: string, contaId: string, hoje: string, emAberto: number): FormDaRetirada =>
  ({ pessoaId, contaId, data: hoje, valor: emAberto > 0 ? centavosNoCampo(emAberto) : '', descricao: '' });

type ErrosDaRetirada = Partial<Record<keyof FormDaRetirada, string>>;
export function errosDaRetirada(f: FormDaRetirada, conta: { saldo_inicial_em: string } | undefined): ErrosDaRetirada {
  const erros: ErrosDaRetirada = {};
  if (!f.pessoaId) erros.pessoaId = 'Escolha o sócio.';
  if (!f.contaId) erros.contaId = 'Escolha a conta.';
  if (!dataExiste(f.data) || !anoAceito(f.data)) erros.data = 'Informe uma data válida.';
  else if (conta && f.data < conta.saldo_inicial_em) erros.data = 'A conta começa depois dessa data.';
  const valor = lerValor(f.valor);
  if ('erro' in valor) erros.valor = valor.erro;
  if (f.descricao.trim().length > TAMANHO_FINANCEIRO.descricao) erros.descricao = `Use até ${TAMANHO_FINANCEIRO.descricao} caracteres.`;
  return erros;
}
/** Pagar mais do que está em aberto é permitido (adiantamento), mas merece um aviso: pode ser erro de digitação. */
export function avisoDaRetirada(f: FormDaRetirada, emAberto: number): string | null {
  const valor = lerValor(f.valor);
  return 'centavos' in valor && valor.centavos > emAberto ? `Isso passa do que está em aberto (${fmtCentavos(emAberto)}). Confira o valor: o sócio ficará com saldo negativo.` : null;
}
export function dadosDaRetirada(f: FormDaRetirada) {
  const valor = lerValor(f.valor);
  if ('erro' in valor) throw new Error(valor.erro);
  return { pessoa: f.pessoaId, conta: f.contaId, data: f.data, valor: valor.centavos, descricao: f.descricao.trim() };
}
