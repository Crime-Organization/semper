// Os gráficos do topo do Financeiro, só com o que já entrou (#268):
//   - por mês: as entradas e as saídas do caixa (o escritório todo) ou a receita bruta e a líquida (de um advogado, ou a
//     sua, para quem não é administrador);
//   - por objeto/demanda: quanto cada um rendeu no período, a bruta e, dentro dela, a líquida do responsável.
// Nada de valor a receber ou contratado: projeção não entra.
import type { ContaFinanceira, ContratoDaCarteira, Lancamento, ParcelaDoEscritorio, RecebimentoDoPeriodo } from '../../dados';
import { fmtCentavos } from '../../regras/caixa';
import { fmtCompacto, mesesDoCaixa, mesesRealizados, receitaPorObjeto, type Mes, type MesRealizado } from '../../regras/graficosFinanceiros';
import { Nota, TituloSecao } from '../../ui/base';
import { BarrasEmpilhadas, BarrasPorMes, type Serie } from '../../ui/Graficos';

const ENTRADA: Serie = { chave: 'entradas', nome: 'Entradas', cor: 'var(--grafico-entrada)' };
const SAIDA: Serie = { chave: 'saidas', nome: 'Saídas', cor: 'var(--grafico-saida)' };
const BRUTA: Serie = { chave: 'bruta', nome: 'Receita bruta', cor: 'var(--grafico-saida)' };
const LIQUIDA: Serie = { chave: 'liquida', nome: 'Receita líquida', cor: 'var(--grafico-entrada)' };
const LIQUIDA_NA_BARRA: Serie = { chave: 'liquida', nome: 'Líquida do responsável', cor: 'var(--grafico-entrada)' };
const RESTO_DA_BRUTA: Serie = { chave: 'resto', nome: 'Resto da bruta (escritório, repasses, impostos)', cor: 'var(--grafico-aberto)', contorno: 'var(--grafico-entrada)' };
/** Quantos objetos aparecem com nome; os demais somam numa barra "Outros". */
const OBJETOS_COM_NOME = 9;

export function GraficosDoFinanceiro({ ano, periodo, nomeDoPeriodo, caixa, parcelas, recebimentos, contratos, responsavel }: {
  ano: number; periodo: string; nomeDoPeriodo: string; caixa: { contas: ContaFinanceira[]; lancamentos: Lancamento[] } | null;
  parcelas: ParcelaDoEscritorio[]; recebimentos: RecebimentoDoPeriodo[]; contratos: ContratoDaCarteira[];
  /** De quem: o perfil de um advogado, ou vazio para o escritório todo. */
  responsavel: string;
}) {
  const doCaixa = !!caixa && !responsavel;
  const objetos = receitaPorObjeto(parcelas, recebimentos, contratos, periodo, responsavel);
  const comNome = objetos.slice(0, OBJETOS_COM_NOME), resto = objetos.slice(OBJETOS_COM_NOME);
  const grupos = [...comNome.map(o => ({ chave: o.objeto, rotulo: o.objeto, detalhe: `${o.contratos} ${o.contratos === 1 ? 'contrato' : 'contratos'} · líquida ${fmtCentavos(o.liquida)}`, bruta: o.bruta, liquida: o.liquida })),
    ...(resto.length ? [{ chave: 'outros', rotulo: `Outros (${resto.length} objetos)`, detalhe: `líquida ${fmtCentavos(resto.reduce((s, o) => s + o.liquida, 0))}`,
      bruta: resto.reduce((s, o) => s + o.bruta, 0), liquida: resto.reduce((s, o) => s + o.liquida, 0) }] : [])];

  return <div className="financeiro-graficos">
    <section className="financeiro-grafico" aria-labelledby="grafico-meses">
      <TituloSecao id="grafico-meses">{doCaixa ? `Entradas e saídas do caixa · ${ano}` : `Receita bruta e líquida · ${ano}`}</TituloSecao>
      {doCaixa
        ? <BarrasPorMes<Mes> rotulo={`Entradas e saídas do caixa em cada mês de ${ano}`} itens={mesesDoCaixa(caixa.lancamentos, ano)} series={[ENTRADA, SAIDA]}
          valor={(m, s) => s === 'entradas' ? m.entradas : m.saidas} formatar={fmtCentavos} formatarCurto={fmtCompacto} />
        : <BarrasPorMes<MesRealizado> rotulo={`Receita bruta e líquida em cada mês de ${ano}`} itens={mesesRealizados(parcelas, recebimentos, ano, responsavel)} series={[BRUTA, LIQUIDA]}
          valor={(m, s) => s === 'bruta' ? m.bruta : m.liquida} formatar={fmtCentavos} formatarCurto={fmtCompacto} />}
    </section>
    <section className="financeiro-grafico" aria-labelledby="grafico-objetos">
      <TituloSecao id="grafico-objetos">{`Receita por objeto/demanda · ${nomeDoPeriodo}`}</TituloSecao>
      {grupos.length
        ? <BarrasEmpilhadas rotulo={`Receita por objeto/demanda em ${nomeDoPeriodo}`} series={[LIQUIDA_NA_BARRA, RESTO_DA_BRUTA]} formatar={fmtCentavos}
          grupos={grupos.map(g => ({ chave: g.chave, rotulo: g.rotulo, detalhe: g.detalhe, partes: [Math.min(g.liquida, g.bruta), Math.max(0, g.bruta - g.liquida)], total: g.bruta }))} />
        : <Nota>Nenhuma receita neste período.</Nota>}
      <Nota>O valor total de cada barra é a receita bruta. Num contrato com mais de um objeto, o valor se divide igualmente entre eles.</Nota>
    </section>
  </div>;
}
