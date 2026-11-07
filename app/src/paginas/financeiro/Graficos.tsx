// Os gráficos do topo do Financeiro, logo abaixo dos indicadores:
//   - Entradas e saídas de cada mês do ano (do caixa, para o escritório todo) ou o recebido de cada mês (de um advogado,
//     ou o seu, para quem não é administrador).
//   - Os contratos separados por categoria, responsável ou ano de assinatura: o recebido e o que falta de cada grupo,
//     como as colunas PAGO e EM ABERTO da planilha de Contratos.
import { useState } from 'react';
import type { ContaFinanceira, ContratoDaCarteira, Lancamento, ParcelaDoEscritorio } from '../../dados';
import { fmtCentavos } from '../../regras/caixa';
import { fmtCompacto, mesesDoCaixa, mesesRecebidos, segregarContratos, SEPARAR, type Mes, type SepararPor } from '../../regras/graficosFinanceiros';
import { Segmentos, TituloSecao } from '../../ui/base';
import { BarrasEmpilhadas, BarrasPorMes, type Serie } from '../../ui/Graficos';
import { useCtx } from '../../ui/sessao';

const ENTRADA: Serie = { chave: 'entradas', nome: 'Entradas', cor: 'var(--grafico-entrada)' };
const SAIDA: Serie = { chave: 'saidas', nome: 'Saídas', cor: 'var(--grafico-saida)' };
const RECEBIDO: Serie = { chave: 'recebido', nome: 'Recebido', cor: 'var(--grafico-entrada)' };
const EM_ABERTO: Serie = { chave: 'emAberto', nome: 'Em aberto', cor: 'var(--grafico-aberto)' };

export function GraficosDoFinanceiro({ ano, caixa, parcelas, contratos, advogado }: {
  ano: number; caixa: { contas: ContaFinanceira[]; lancamentos: Lancamento[] } | null; parcelas: ParcelaDoEscritorio[];
  contratos: ContratoDaCarteira[]; advogado: string;
}) {
  const ctx = useCtx();
  // Quem não é administrador só vê os seus contratos: separar por responsável não diria nada.
  const jeitos = (Object.keys(SEPARAR) as SepararPor[]).filter(j => j !== 'responsavel' || (ctx.ehAdmin && !advogado));
  const [por, setPor] = useState<SepararPor>('categoria');
  const separar = jeitos.includes(por) ? por : 'categoria';
  const nomeDe = (id: string) => ctx.equipe.find(m => m.id === id)?.nome ?? 'Usuário removido';

  const doCaixa = !!caixa && !advogado;
  const meses: Mes[] = doCaixa ? mesesDoCaixa(caixa.lancamentos, ano) : mesesRecebidos(parcelas, ano, advogado);
  const grupos = segregarContratos(contratos, parcelas, separar, nomeDe, advogado);
  const total = grupos.reduce((t, g) => ({ contratado: t.contratado + g.contratado, recebido: t.recebido + g.recebido, emAberto: t.emAberto + g.emAberto }), { contratado: 0, recebido: 0, emAberto: 0 });

  return <div className="financeiro-graficos">
    <section className="financeiro-grafico" aria-labelledby="grafico-meses">
      <TituloSecao id="grafico-meses">{doCaixa ? `Entradas e saídas · ${ano}` : `Recebido por mês · ${ano}`}</TituloSecao>
      <BarrasPorMes rotulo={doCaixa ? `Entradas e saídas de cada mês de ${ano}` : `Recebido em cada mês de ${ano}`} itens={meses}
        series={doCaixa ? [ENTRADA, SAIDA] : [RECEBIDO]} valor={(m, s) => m[s as 'entradas' | 'saidas'] ?? 0}
        formatar={fmtCentavos} formatarCurto={fmtCompacto} />
    </section>
    <section className="financeiro-grafico" aria-labelledby="grafico-contratos">
      <TituloSecao id="grafico-contratos">Contratos: recebido e em aberto</TituloSecao>
      <p className="financeiro-grafico-total">
        <span><b className="num">{fmtCentavos(total.contratado)}</b> contratados</span>
        <span><b className="num">{fmtCentavos(total.recebido)}</b> recebidos</span>
        <span><b className="num">{fmtCentavos(total.emAberto)}</b> em aberto</span>
      </p>
      {jeitos.length > 1 && <Segmentos rotulo="Separar os contratos" atual={separar} aoEscolher={j => setPor(j as SepararPor)}
        opcoes={jeitos.map(j => ({ id: j, rotulo: SEPARAR[j].nome }))} />}
      <BarrasEmpilhadas rotulo={`Contratos ${SEPARAR[separar].nome.toLowerCase()}: recebido e em aberto`} series={[RECEBIDO, EM_ABERTO]} formatar={fmtCentavos}
        grupos={grupos.map(g => ({ chave: g.chave, rotulo: g.rotulo, detalhe: `${g.contratos} ${g.contratos === 1 ? 'contrato' : 'contratos'}`, partes: [g.recebido, g.emAberto], total: g.recebido + g.emAberto }))} />
    </section>
  </div>;
}
