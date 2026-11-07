// Saídas: lançar o que o escritório paga e ver as saídas do mês, de todas as contas. Só para administradores.
import { useEffect, useState } from 'react';
import { Navigate } from 'react-router';
import { SD, type ContaFinanceira, type Lancamento } from '../../dados';
import { diasDoMes, fmtCentavos, mesDe, mesValido, nomeDaCategoria } from '../../regras/caixa';
import { contaNoResultado, totaisDoExtrato } from '../../regras/painelFinanceiro';
import { fmtData } from '../../regras/pessoa';
import { Aviso, Carregando, TituloSecao, Vazio } from '../../ui/base';
import { PaginaModulo } from '../../ui/PaginaModulo';
import { useCtx } from '../../ui/sessao';
import { hojeISO, useTitulo } from '../../ui/util';
import { AbasDoFinanceiro } from './AbasDoFinanceiro';
import { FormDoCaixa } from './Entradas';
import '../Financeiro.css';

type Lido = { chave: string; contas: ContaFinanceira[]; saidas: Lancamento[] } | { chave: string; erro: string };

export default function Saidas() {
  useTitulo('Saídas');
  const ctx = useCtx();
  const [mes, setMes] = useState(mesDe(hojeISO()));
  const [lido, setLido] = useState<Lido | null>(null);
  const [versao, setVersao] = useState(0);
  const pode = ctx.ehAdmin && !!ctx.escritorio?.modulos?.financeiro;
  const chave = mes + '/' + versao;

  useEffect(() => {
    if (!pode) return;
    let vivo = true;
    const { de, ate } = diasDoMes(mes);
    const esta = mes + '/' + versao;
    (async () => {
      const contas = await SD.financeiroContas();
      const listas = await Promise.all(contas.map(c => SD.financeiroLancamentos(c.id, de, ate)));
      const saidas = listas.flat().filter(l => l.tipo === 'saida' && contaNoResultado(l)).toSorted((a, b) => b.data.localeCompare(a.data) || b.criado_em.localeCompare(a.criado_em));
      return { chave: esta, contas, saidas };
    })().then(x => { if (vivo) setLido(x); }).catch(e => { if (vivo) setLido({ chave: esta, erro: (e as Error).message }); });
    return () => { vivo = false; };
  }, [mes, versao, pode]);

  if (!pode) return <Navigate to="/financeiro/entradas/" replace />;
  const atual = lido?.chave === chave ? lido : null;
  const nomeDaConta = new Map(atual && 'contas' in atual ? atual.contas.map(c => [c.id, c.nome]) : []);
  return <PaginaModulo titulo="Saídas" visoes={[]}>
    <AbasDoFinanceiro />
    <FormDoCaixa tipo="saida" titulo="Nova saída" rotulo="Registrar saída" aoRegistrar={() => setVersao(v => v + 1)} />

    <section className="painel-secao" aria-labelledby="tSaidas">
      <TituloSecao id="tSaidas">Saídas do mês</TituloSecao>
      <div className="financeiro-filtros">
        <label className="financeiro-filtro">Mês
          <input type="month" className="campo" value={mes} onChange={e => { if (mesValido(e.target.value)) setMes(e.target.value); }} />
        </label>
      </div>
      {!atual ? <Carregando /> : 'erro' in atual ? <Aviso tipo="erro">{atual.erro}</Aviso> : atual.saidas.length ? <div className="tabela"><table className="extrato" aria-label="Saídas do mês">
        <thead><tr><th scope="col">Data</th><th scope="col">Conta</th><th scope="col">Descrição</th><th scope="col">Tipo</th><th scope="col" className="financeiro-num">Valor</th></tr></thead>
        <tbody>{atual.saidas.map(l => <tr key={l.id}>
          <td>{fmtData(l.data)}</td><td>{nomeDaConta.get(l.conta_id)}</td><td>{l.descricao}</td><td>{nomeDaCategoria(l.categoria)}</td>
          <td className="financeiro-num tom-saida">{fmtCentavos(l.valor)}</td>
        </tr>)}</tbody>
        <tfoot><tr><th scope="row" colSpan={4}>Total</th><td className="financeiro-num"><b>{fmtCentavos(totaisDoExtrato(atual.saidas).saidas)}</b></td></tr></tfoot>
      </table></div> : <Vazio>Nenhuma saída neste mês.</Vazio>}
    </section>
  </PaginaModulo>;
}
