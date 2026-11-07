// "Meus valores": a parte de cada pessoa da equipe em cada recebimento, por papel, e se já recebeu. Quem filtra é o banco: cada um recebe só as
// próprias linhas, sem saldo, despesas, lucro nem a parte dos colegas. A página de módulo dá o cabeçalho.
import { useEffect, useState } from 'react';
import { Navigate } from 'react-router';
import { SD, type MeuValor, type SituacaoDoValor } from '../dados';
import { diasDoMes, fmtCentavos, mesDe, mesValido } from '../regras/caixa';
import { deQuemVem, papeisComValor, PAPEIS_DO_VALOR, SITUACOES_DO_VALOR, totaisPorPapel } from '../regras/meusValores';
import { fmtData } from '../regras/pessoa';
import { useMudancas } from '../ui/avisos';
import { Aviso, Carregando, Nota, Selo, TituloSecao, Vazio } from '../ui/base';
import { PaginaModulo } from '../ui/PaginaModulo';
import { useCtx } from '../ui/sessao';
import { hojeISO, useTitulo } from '../ui/util';
import './Financeiro.css';
import { AbasDoFinanceiro } from './financeiro/AbasDoFinanceiro';

type Lido = { chave: string; linhas: MeuValor[] } | { chave: string; erro: string };

function Totais({ linhas }: { linhas: MeuValor[] }) {
  const totais = totaisPorPapel(linhas);
  return <dl className="financeiro-resumo" aria-label="Totais por papel">
    {papeisComValor(totais).flatMap(p => (Object.keys(SITUACOES_DO_VALOR) as SituacaoDoValor[]).map(s => <div key={p + s}>
      <dt>{PAPEIS_DO_VALOR[p]}: {SITUACOES_DO_VALOR[s].nome.toLowerCase()}</dt><dd>{fmtCentavos(totais[p][s])}</dd>
    </div>))}
  </dl>;
}

function Linhas({ linhas }: { linhas: MeuValor[] }) {
  return <div className="tabela"><table aria-label="Valores de cada recebimento">
    <thead><tr>
      <th scope="col">Papel</th><th scope="col">Contrato</th><th scope="col">Cliente</th><th scope="col">Parcela</th><th scope="col">Cliente pagou em</th><th scope="col">Quem paga</th>
      <th scope="col" className="financeiro-num">Valor</th><th scope="col">Situação</th>
    </tr></thead>
    <tbody>{linhas.map(l => {
      const situacao = SITUACOES_DO_VALOR[l.situacao];
      return <tr key={l.recebimento_id + l.papel}>
        <td>{PAPEIS_DO_VALOR[l.papel]}</td><td>{l.contrato_codigo}</td><td>{l.cliente_nome}</td><td>{l.parcela_numero}</td><td>{fmtData(l.recebido_em)}</td><td>{deQuemVem(l)}</td>
        <td className="financeiro-num">{fmtCentavos(l.valor)}</td>
        <td><Selo tipo={situacao.selo}>{situacao.nome}</Selo>{l.pago_em && <> em {fmtData(l.pago_em)}</>}</td>
      </tr>;
    })}</tbody>
  </table></div>;
}

export default function MeusValores() {
  useTitulo('Meus valores');
  const ctx = useCtx();
  const [mes, setMes] = useState(mesDe(hojeISO()));
  const [lido, setLido] = useState<Lido | null>(null);
  const [versao, setVersao] = useState(0);
  const pode = !!ctx.escritorio?.modulos?.financeiro;

  // Só vale a leitura mais recente: trocar de mês não pode trazer de volta a lista anterior.
  useEffect(() => {
    if (!pode) return;
    let vivo = true;
    const { de, ate } = diasDoMes(mes);
    SD.financeiroMeusValores(de, ate)
      .then(linhas => { if (vivo) setLido({ chave: mes, linhas }); })
      .catch(e => { if (vivo) setLido({ chave: mes, erro: (e as Error).message }); });
    return () => { vivo = false; };
  }, [mes, versao, pode]);
  useMudancas(() => setVersao(v => v + 1));

  if (!pode) return <Navigate to="/inicio/" replace />;
  const atual = lido?.chave === mes ? lido : null;

  return <PaginaModulo titulo="Meus valores" visoes={[]}>
    <AbasDoFinanceiro />
    <div className="financeiro-barra">
      <label>Mês
        {/* Apagar o campo não muda nada: fica o último mês válido. */}
        <input type="month" className="campo" value={mes} onChange={e => { if (mesValido(e.target.value)) setMes(e.target.value); }} />
      </label>
    </div>
    {!atual ? <Carregando /> : 'erro' in atual ? <Aviso tipo="erro">{atual.erro}</Aviso> : !atual.linhas.length
      ? <Vazio>Nenhum valor para você neste mês. Só aparecem as parcelas que o cliente já pagou.</Vazio>
      : <>
        <Totais linhas={atual.linhas} />
        <section className="financeiro-ajustes" aria-label="Cada recebimento">
          <TituloSecao>Cada recebimento</TituloSecao>
          <div className="financeiro-form">
            <Linhas linhas={atual.linhas} />
            <Nota>Só aparecem as parcelas que o cliente já pagou. Além dos recebimentos do mês, aparecem os valores ainda a receber de antes dele. O que o responsável passa aos participantes e ao indicador não entra na parte dele: fica em "A passar", nas Parcelas.</Nota>
          </div>
        </section>
      </>}
  </PaginaModulo>;
}
