// O painel do alto do Financeiro (#403), no padrão do painel de Processos (#401): os números grandes do período escolhido, cada um
// comparado com o período de antes, e os cartões com os gráficos e o desempenho. As contas são as de sempre (regras/), e o que entra
// como receita é só o que já entrou (#268); o que falta receber fica à parte, com o nome dele.
//   - Escritório todo (só o administrador): entradas, saídas, resultado, saldo nas contas, a receber e em atraso; o gráfico das
//     entradas e saídas do caixa.
//   - Um advogado (ou quem não é administrador, com os seus contratos): receita bruta e líquida, a receber e em atraso; o gráfico da
//     receita bruta e líquida.
// Em todos: o que falta receber nas próximas semanas (as atrasadas em destaque), a receita por área e o desempenho do período.
import type { ReactNode } from 'react';
import type { ContaFinanceira, ContratoDaCarteira, Lancamento, ParcelaDoEscritorio, RecebimentoDoPeriodo } from '../../dados';
import { fmtCentavos } from '../../regras/caixa';
import { fmtData } from '../../regras/pessoa';
import { fmtCompacto, indicadoresRealizados, receitaPorObjeto, type Realizado } from '../../regras/graficosFinanceiros';
import {
  aReceberNoPeriodo, aReceberPorSemana, caixaPorMes, comparar, corteDoSaldo, emAtraso, mesesDoGrafico, nomeDoPeriodo, numerosDoCaixa, periodoAnterior, receitaPorMes,
  saldoAntesDe, SEMANAS_A_RECEBER, type MesDaReceita, type MesDoCaixaNoGrafico, type SemanaAReceber, type SentidoDoNumero
} from '../../regras/numerosDoFinanceiro';
import { somarDias } from '../../regras/prazos';
import { BotaoLink, Indicador, Indicadores, Nota } from '../../ui/base';
import { BarrasEmpilhadas, BarrasPorMes, type Serie } from '../../ui/Graficos';
import { CartaoDoPainel, NumeroDoPainel, NumerosDoPainel, Painel, ValorEmReais } from '../../ui/painel/Painel';

/** O caixa lido: as contas, os lançamentos dos dois anos e o saldo de cada conta ativa no começo deles ("base") e hoje. */
export interface CaixaDoPainel {
  contas: ContaFinanceira[]; lancamentos: Lancamento[];
  base: string; saldosNaBase: Map<string, number>; saldosDeHoje: Map<string, number>;
}
export interface DadosDoPainel { parcelas: ParcelaDoEscritorio[]; contratos: ContratoDaCarteira[]; recebimentos: RecebimentoDoPeriodo[]; caixa: CaixaDoPainel | null }

const ENTRADA: Serie = { chave: 'entradas', nome: 'Entradas', cor: 'var(--grafico-entrada)' };
const SAIDA: Serie = { chave: 'saidas', nome: 'Saídas', cor: 'var(--grafico-saida)' };
const BRUTA: Serie = { chave: 'bruta', nome: 'Receita bruta', cor: 'var(--grafico-saida)' };
const LIQUIDA: Serie = { chave: 'liquida', nome: 'Receita líquida', cor: 'var(--grafico-entrada)' };
const A_RECEBER: Serie = { chave: 'valor', nome: 'A receber', cor: 'var(--grafico-principal)' };
const LIQUIDA_NA_BARRA: Serie = { chave: 'liquida', nome: 'Líquida do responsável', cor: 'var(--grafico-entrada)' };
const RESTO_DA_BRUTA: Serie = { chave: 'resto', nome: 'Resto da bruta (escritório, repasses, impostos)', cor: 'var(--grafico-aberto)', contorno: 'var(--grafico-entrada)' };
/** Quantas áreas aparecem com nome; as demais somam numa barra "Outras". */
const AREAS_COM_NOME = 9;
/** Os lugares da página aonde os números levam: as abas com as listas e o gráfico do que falta receber. */
export const LUGAR_DAS_LISTAS = 'financeiro-listas';
const LUGAR_DO_A_RECEBER = 'painel-a-receber';
/** O endereço de uma aba com a página já descendo até as listas. */
const naLista = (aba: string) => `${aba}#${LUGAR_DAS_LISTAS}`;

const emReais = (centavos: number): ReactNode => <ValorEmReais centavos={centavos} />;
const contagem = (n: number) => n.toLocaleString('pt-BR');
const plural = (n: number, um: string, varios: string) => `${contagem(n)} ${n === 1 ? um : varios}`;

/** O que o desempenho mostra (só o que já entrou). Cada um sabe o rótulo, o valor e, se houver, a linha de apoio. */
type ChaveDoDesempenho = 'bruta' | 'liquida' | 'contratos' | 'escritorio' | 'indicadores' | 'participantes';
const DESEMPENHO: Record<ChaveDoDesempenho, { rotulo: (periodo: string) => string; valor: (r: Realizado) => string; detalhe?: (deUmaPessoa: boolean) => string }> = {
  bruta: { rotulo: p => `Receita bruta · ${p}`, valor: r => fmtCentavos(r.bruta), detalhe: () => 'O que os clientes pagaram' },
  liquida: { rotulo: p => `Receita líquida · ${p}`, valor: r => fmtCentavos(r.liquida), detalhe: pessoa => pessoa ? 'O que ficou com o responsável' : 'O que ficou com os responsáveis' },
  contratos: { rotulo: p => `Contratos assinados · ${p}`, valor: r => contagem(r.contratosAssinados) },
  escritorio: { rotulo: () => 'Ao escritório', valor: r => fmtCentavos(r.escritorio) },
  indicadores: { rotulo: () => 'Aos indicadores', valor: r => fmtCentavos(r.indicadores) },
  participantes: { rotulo: () => 'Aos participantes', valor: r => fmtCentavos(r.participantes) }
};
/** O que já aparece nos números do alto, na visão de uma pessoa, não se repete no desempenho. */
const NO_ALTO_DA_PESSOA: ReadonlySet<ChaveDoDesempenho> = new Set(['bruta', 'liquida']);

/** Uma comparação com o período de antes, no formato do número do painel. */
const variacao = (atual: number, anterior: number, periodo: string, sentido: SentidoDoNumero) => comparar(atual, anterior, periodoAnterior(periodo), sentido);

/** O saldo de todas as contas ativas antes de um dia: o de hoje, como o banco dá, ou o de um dia que já passou, pelos lançamentos. */
function saldoNasContas(caixa: CaixaDoPainel, dia: string, hoje: string) {
  if (dia >= somarDias(hoje, 1)) return { total: [...caixa.saldosDeHoje.values()].reduce((s, v) => s + v, 0), porConta: caixa.saldosDeHoje };
  const porConta = new Map([...caixa.saldosNaBase].map(([id, saldo]) =>
    [id, saldoAntesDe(dia, { dia: caixa.base, saldo }, caixa.lancamentos.filter(l => l.conta_id === id))] as const));
  return { total: [...porConta.values()].reduce((s, v) => s + v, 0), porConta };
}

/**
 * O alto do Financeiro: os números, os gráficos e o desempenho do período. "quem": o responsável (o perfil) cujos contratos se
 * mostram, ou vazio para o escritório todo (que tem o caixa).
 */
export function PainelDoFinanceiro({ dados, periodo, hoje, quem, nomeDeQuem }: { dados: DadosDoPainel; periodo: string; hoje: string; quem: string; nomeDeQuem: string }) {
  const { parcelas, contratos, recebimentos, caixa } = dados;
  const doEscritorio = !!caixa && !quem;
  const nome = nomeDoPeriodo(periodo), antes = periodoAnterior(periodo);
  const real = indicadoresRealizados(parcelas, recebimentos, contratos, periodo, quem);
  const realAntes = indicadoresRealizados(parcelas, recebimentos, contratos, antes, quem);
  const aReceber = aReceberNoPeriodo(parcelas, periodo, hoje, quem);
  const atraso = emAtraso(parcelas, hoje, quem);
  const meses = mesesDoGrafico(periodo);

  const numeroAReceber = <NumeroDoPainel key="a-receber" rotulo={`A receber · ${nome}`} valor={aReceber.valor} formatar={emReais} para={'#' + LUGAR_DO_A_RECEBER}
    variacao={variacao(aReceber.valor, aReceberNoPeriodo(parcelas, antes, hoje, quem).valor, periodo, 'neutro')}
    detalhe={aReceber.parcelas ? `${plural(aReceber.parcelas, 'parcela vence', 'parcelas vencem')} no período e ${aReceber.parcelas === 1 ? 'falta' : 'faltam'} receber` : 'nenhuma parcela em aberto no período'} />;
  const numeroEmAtraso = <NumeroDoPainel key="em-atraso" rotulo="Em atraso hoje" valor={atraso.valor} formatar={emReais} tom={atraso.valor ? 'erro' : 'neutro'} para={naLista('/financeiro/direitos/')}
    detalhe={atraso.contratos ? `${plural(atraso.contratos, 'contrato', 'contratos')} com parcela vencida` : 'nenhuma parcela vencida'} />;

  let numeros: ReactNode;
  if (doEscritorio) {
    const t = numerosDoCaixa(caixa.lancamentos, periodo), tAntes = numerosDoCaixa(caixa.lancamentos, antes);
    const corte = corteDoSaldo(periodo, hoje);
    const saldo = saldoNasContas(caixa, corte, hoje), saldoAntes = saldoNasContas(caixa, corteDoSaldo(antes, hoje), hoje);
    const nomeDaConta = new Map(caixa.contas.map(c => [c.id, c.nome]));
    const quando = corte > hoje ? 'hoje' : `em ${fmtData(somarDias(corte, -1))}`;
    numeros = <>
      <NumeroDoPainel rotulo={`Entradas · ${nome}`} valor={t.entradas} formatar={emReais} para={naLista('/financeiro/')} variacao={variacao(t.entradas, tAntes.entradas, periodo, 'mais-e-bom')} />
      <NumeroDoPainel rotulo={`Saídas · ${nome}`} valor={t.saidas} formatar={emReais} para={naLista('/financeiro/saidas/')} variacao={variacao(t.saidas, tAntes.saidas, periodo, 'mais-e-ruim')} />
      <NumeroDoPainel rotulo={`Resultado · ${nome}`} valor={t.resultado} formatar={emReais} tom={t.resultado < 0 ? 'erro' : 'neutro'} detalhe="entradas menos saídas"
        variacao={variacao(t.resultado, tAntes.resultado, periodo, 'mais-e-bom')} />
      <NumeroDoPainel rotulo="Saldo nas contas" valor={saldo.total} formatar={emReais} tom={saldo.total < 0 ? 'erro' : 'neutro'} para="/financeiro/contas/"
        detalhe={<>{quando}{[...saldo.porConta].map(([id, v]) => <span key={id}> · <span className="numero-do-painel-parte">{nomeDaConta.get(id)} {fmtCentavos(v)}</span></span>)}</>}
        variacao={variacao(saldo.total, saldoAntes.total, periodo, 'mais-e-bom')} />
      {numeroAReceber}
      {numeroEmAtraso}
    </>;
  } else {
    numeros = <>
      <NumeroDoPainel rotulo={`Receita bruta · ${nome}`} valor={real.bruta} formatar={emReais} para={naLista('/financeiro/')} detalhe="o que os clientes pagaram"
        variacao={variacao(real.bruta, realAntes.bruta, periodo, 'mais-e-bom')} />
      <NumeroDoPainel rotulo={`Receita líquida · ${nome}`} valor={real.liquida} formatar={emReais} detalhe="o que ficou com o responsável"
        variacao={variacao(real.liquida, realAntes.liquida, periodo, 'mais-e-bom')} />
      {numeroAReceber}
      {numeroEmAtraso}
    </>;
  }

  const grupos = gruposPorArea(parcelas, recebimentos, contratos, periodo, quem);
  const semanas = aReceberPorSemana(parcelas, hoje, quem);
  const desempenho = (Object.keys(DESEMPENHO) as ChaveDoDesempenho[]).filter(c => doEscritorio || !NO_ALTO_DA_PESSOA.has(c));

  return <>
    <NumerosDoPainel rotulo={`Números de ${nome}`}>{numeros}</NumerosDoPainel>
    {real.temHistoricoSemDivisao && <Nota>Parte da receita deste período veio das planilhas, sem a divisão gravada: ela entra na receita bruta, mas não na líquida nem nos repasses.</Nota>}
    <Painel>
      {doEscritorio ? <GraficoDoCaixa itens={caixaPorMes(caixa.lancamentos, meses)} /> : <GraficoDaReceita itens={receitaPorMes(parcelas, recebimentos, meses, quem)} nomeDeQuem={nomeDeQuem} />}

      <CartaoDoPainel titulo="A receber nas próximas semanas" id={LUGAR_DO_A_RECEBER} largura="terco"
        nota={`As parcelas em aberto de cada uma das próximas ${SEMANAS_A_RECEBER} semanas, a partir de hoje, e as já atrasadas.`}
        acao={<BotaoLink forma="link" to="/financeiro/direitos/">Ver em Direitos</BotaoLink>}>
        <BarrasPorMes<SemanaAReceber> rotulo={`O que falta receber: as parcelas atrasadas e as de cada uma das próximas ${SEMANAS_A_RECEBER} semanas`} itens={semanas} series={[A_RECEBER]}
          valor={s => s.valor} formatar={fmtCentavos} formatarCurto={fmtCompacto} corDoItem={s => s.atrasadas && s.valor ? 'var(--grafico-vencido)' : undefined} tabelaVisivel />
      </CartaoDoPainel>

      <CartaoDoPainel titulo={`Receita por área · ${nome}`} largura="metade"
        nota="Cada área é um objeto/demanda dos contratos. Num contrato com mais de um, o valor se divide igualmente entre eles; a barra inteira é a receita bruta.">
        {grupos.length
          ? <BarrasEmpilhadas rotulo={`Receita por área em ${nome}`} series={[LIQUIDA_NA_BARRA, RESTO_DA_BRUTA]} formatar={fmtCentavos} grupos={grupos} tabelaVisivel />
          : <Nota>Nenhuma receita neste período.</Nota>}
      </CartaoDoPainel>

      <CartaoDoPainel titulo={`Desempenho · ${nome}`} largura="metade" nota="Só o que já entrou: as parcelas recebidas e a divisão de cada recebimento.">
        <Indicadores rotulo={`Desempenho de ${nome}`}>
          {desempenho.map(c => <Indicador key={c} rotulo={DESEMPENHO[c].rotulo(nome)} valor={DESEMPENHO[c].valor(real)} detalhe={DESEMPENHO[c].detalhe?.(!!quem)} />)}
        </Indicadores>
      </CartaoDoPainel>
    </Painel>
  </>;
}

/** O primeiro e o último mês do gráfico, para o rótulo ("de dez/2025 a nov/2026"). */
const doPrimeiroAoUltimo = (itens: readonly { detalhe: string }[]) => `de ${itens[0].detalhe} a ${itens[itens.length - 1].detalhe}`;
/** A soma de um número em todos os meses do gráfico, para o resumo ao lado do título. */
const somaDos = <T,>(itens: readonly T[], valor: (item: T) => number) => itens.reduce((s, i) => s + valor(i), 0);

/** As entradas e as saídas do caixa em cada um dos últimos meses; o resultado de cada mês vai na dica e na tabela. */
function GraficoDoCaixa({ itens }: { itens: MesDoCaixaNoGrafico[] }) {
  const resultado = somaDos(itens, m => m.resultado);
  return <CartaoDoPainel titulo={`Entradas e saídas · ${itens.length} meses`} largura="dois-tercos"
    acao={<span className="painel-cartao-resumo">Resultado no período <b className="num">{fmtCentavos(resultado)}</b></span>}
    nota="Sem os repasses entre contas e sem os ajustes de saldo. Passe o mouse ou toque num mês para ver o resultado dele.">
    <BarrasPorMes<MesDoCaixaNoGrafico> rotulo={`Entradas e saídas do caixa em cada mês, ${doPrimeiroAoUltimo(itens)}`} itens={itens} series={[ENTRADA, SAIDA]}
      valor={(m, s) => s === ENTRADA.chave ? m.entradas : m.saidas} extras={[{ chave: 'resultado', nome: 'Resultado', valor: m => m.resultado }]}
      formatar={fmtCentavos} formatarCurto={fmtCompacto} tabelaVisivel />
  </CartaoDoPainel>;
}

/** A receita bruta e a líquida de cada um dos últimos meses (de um advogado, ou a sua). */
function GraficoDaReceita({ itens, nomeDeQuem }: { itens: MesDaReceita[]; nomeDeQuem: string }) {
  return <CartaoDoPainel titulo={`Receita bruta e líquida · ${itens.length} meses`} largura="dois-tercos"
    acao={<span className="painel-cartao-resumo">Bruta no período <b className="num">{fmtCentavos(somaDos(itens, m => m.bruta))}</b></span>}
    nota={`Só o que já entrou${nomeDeQuem ? `, dos contratos de ${nomeDeQuem}` : ''}. A líquida é o que ficou com o responsável.`}>
    <BarrasPorMes<MesDaReceita> rotulo={`Receita bruta e líquida em cada mês, ${doPrimeiroAoUltimo(itens)}`} itens={itens} series={[BRUTA, LIQUIDA]}
      valor={(m, s) => s === BRUTA.chave ? m.bruta : m.liquida} formatar={fmtCentavos} formatarCurto={fmtCompacto} tabelaVisivel />
  </CartaoDoPainel>;
}

/** As áreas do período, das que mais renderam às que menos; depois das primeiras, as demais somam numa barra só. */
function gruposPorArea(parcelas: ParcelaDoEscritorio[], recebimentos: RecebimentoDoPeriodo[], contratos: ContratoDaCarteira[], periodo: string, quem: string) {
  const areas = receitaPorObjeto(parcelas, recebimentos, contratos, periodo, quem);
  const comNome = areas.slice(0, AREAS_COM_NOME), resto = areas.slice(AREAS_COM_NOME);
  const linhas = [...comNome.map(o => ({ chave: o.objeto, rotulo: o.objeto, detalhe: `${plural(o.contratos, 'contrato', 'contratos')} · líquida ${fmtCentavos(o.liquida)}`, bruta: o.bruta, liquida: o.liquida })),
    ...(resto.length ? [{ chave: 'outras', rotulo: `Outras (${plural(resto.length, 'área', 'áreas')})`, detalhe: `líquida ${fmtCentavos(somaDos(resto, o => o.liquida))}`,
      bruta: somaDos(resto, o => o.bruta), liquida: somaDos(resto, o => o.liquida) }] : [])];
  return linhas.map(g => ({ chave: g.chave, rotulo: g.rotulo, detalhe: g.detalhe, partes: [Math.min(g.liquida, g.bruta), Math.max(0, g.bruta - g.liquida)], total: g.bruta }));
}
