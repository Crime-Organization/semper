// A carteira de contratos: cada contrato com o que já entrou, o que falta e a próxima parcela, para receber com um clique. Quem não é
// administrador vê só os contratos de que é responsável (o banco filtra).
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { SD, type ParcelaDoEscritorio } from '../../dados';
import { fmtCentavos } from '../../regras/caixa';
import { SITUACOES_NA_CARTEIRA, carteiraDeContratos, filtrarCarteira, totaisDaCarteira, type FiltroDaCarteira, type SituacaoNaCarteira } from '../../regras/painelFinanceiro';
import { fmtData } from '../../regras/pessoa';
import { Aviso, BotaoLink, Carregando, Indicador, Indicadores, Segmentos, Selo, Vazio, estiloBotao } from '../../ui/base';
import { Icone } from '../../ui/Icone';
import { PaginaModulo } from '../../ui/PaginaModulo';
import { useCtx } from '../../ui/sessao';
import { hojeISO, useTitulo } from '../../ui/util';
import { AbasDoFinanceiro } from './AbasDoFinanceiro';
import '../Financeiro.css';

/** Quantos contratos aparecem de cada vez. */
const CONTRATOS_POR_VEZ = 100;
/** As parcelas de todos os tempos: a carteira olha o contrato inteiro, não só um mês. */
export const TODAS_AS_DATAS = { de: '2000-01-01', ate: '2200-12-31' };
const TODAS = 'todas';

export default function Carteira() {
  useTitulo('Financeiro');
  const ctx = useCtx();
  const hoje = hojeISO();
  const [parcelas, setParcelas] = useState<ParcelaDoEscritorio[] | string | null>(null);
  const [filtro, setFiltro] = useState<FiltroDaCarteira>({ situacao: '', busca: '', responsavel: '' });
  const [quantos, setQuantos] = useState(CONTRATOS_POR_VEZ);
  const pode = !!ctx.escritorio?.modulos?.financeiro;

  useEffect(() => {
    if (!pode) return;
    let vivo = true;
    SD.parcelasDoPeriodo(TODAS_AS_DATAS.de, TODAS_AS_DATAS.ate, hoje)
      .then(x => { if (vivo) setParcelas(x); }).catch(e => { if (vivo) setParcelas((e as Error).message); });
    return () => { vivo = false; };
  }, [pode, hoje]);

  const cabecalho = { titulo: 'Financeiro', visoes: [], acao: { rotulo: 'Nova entrada', para: '/financeiro/entradas/' } };
  if (!pode) return <PaginaModulo {...cabecalho}><Aviso tipo="info">O financeiro não está ligado para este escritório.</Aviso></PaginaModulo>;
  if (parcelas === null) return <PaginaModulo {...cabecalho}><AbasDoFinanceiro /><Carregando /></PaginaModulo>;
  if (typeof parcelas === 'string') return <PaginaModulo {...cabecalho}><AbasDoFinanceiro /><Aviso tipo="erro">{parcelas}</Aviso></PaginaModulo>;

  const carteira = carteiraDeContratos(parcelas, hoje);
  const lista = filtrarCarteira(carteira, filtro);
  const t = totaisDaCarteira(lista);
  const quantosNa = (s: SituacaoNaCarteira) => carteira.filter(c => c.situacao === s).length;
  const mudar = (m: Partial<FiltroDaCarteira>) => { setFiltro(f => ({ ...f, ...m })); setQuantos(CONTRATOS_POR_VEZ); };

  return <PaginaModulo {...cabecalho} contador={`${carteira.length.toLocaleString('pt-BR')} contratos com parcelas`}>
    <AbasDoFinanceiro />
    <Indicadores rotulo="Totais da carteira">
      <Indicador rotulo="Contratado" valor={fmtCentavos(t.total)} />
      <Indicador tom="entrada" rotulo="Já recebido" valor={fmtCentavos(t.recebido)} />
      <Indicador tom="alerta" rotulo="Falta receber" valor={fmtCentavos(t.falta)} />
      <Indicador tom="destaque" rotulo="Em atraso" valor={fmtCentavos(t.atrasado)} />
    </Indicadores>

    <div className="financeiro-filtros" role="search" aria-label="Filtros da carteira">
      <label className="busca-campo"><Icone nome="buscar" tam={18} /><span className="sr">Buscar contrato ou cliente</span>
        <input type="search" placeholder="Buscar contrato ou cliente" value={filtro.busca} onChange={e => mudar({ busca: e.target.value })} />
      </label>
      {ctx.ehAdmin && <select className="campo" aria-label="Usuário" value={filtro.responsavel} onChange={e => mudar({ responsavel: e.target.value })}>
        <option value="">Todos os usuários</option>
        {ctx.equipe.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
      </select>}
      <Segmentos rotulo="Situação" atual={filtro.situacao || TODAS} aoEscolher={s => mudar({ situacao: s === TODAS ? '' : s as SituacaoNaCarteira })}
        opcoes={[{ id: TODAS, rotulo: 'Todos' }, ...(Object.keys(SITUACOES_NA_CARTEIRA) as SituacaoNaCarteira[]).map(s => ({ id: s, rotulo: `${SITUACOES_NA_CARTEIRA[s].nome} (${quantosNa(s)})` }))]} />
    </div>

    {lista.length ? <>
      <div className="tabela"><table className="carteira" aria-label="Carteira de contratos">
        <thead><tr>
          <th scope="col">Contrato</th><th scope="col">Cliente</th><th scope="col">Parcelas</th>
          <th scope="col" className="financeiro-num">Total</th><th scope="col" className="financeiro-num">Recebido</th><th scope="col" className="financeiro-num">Falta</th>
          <th scope="col">Próxima</th><th scope="col">Situação</th><th scope="col"><span className="sr">Ações</span></th>
        </tr></thead>
        <tbody>{lista.slice(0, quantos).map(c => {
          const s = SITUACOES_NA_CARTEIRA[c.situacao];
          return <tr key={c.contratoId}>
            <td><Link to={'/contratos/?id=' + c.contratoId}>{c.codigo}</Link></td>
            <td className="nome">{c.cliente}</td>
            <td className="num">{c.recebidas} de {c.parcelas}</td>
            <td className="financeiro-num">{fmtCentavos(c.total)}</td>
            <td className="financeiro-num tom-entrada">{c.recebido ? fmtCentavos(c.recebido) : '–'}</td>
            <td className="financeiro-num"><b>{c.falta ? fmtCentavos(c.falta) : '–'}</b></td>
            <td>{c.proxima ? <>{fmtData(c.proxima.vencimento)}<span className="sub"> · {fmtCentavos(c.proxima.valor)}</span></> : '–'}</td>
            <td><Selo tipo={s.selo}>{s.nome}</Selo></td>
            <td>{c.proxima && <BotaoLink forma="mini" variante="principal" to={'/financeiro/entradas/?parcela=' + c.proxima.id}
              aria-label={`Receber a parcela ${c.proxima.numero} de ${c.codigo}`}>Receber</BotaoLink>}</td>
          </tr>;
        })}</tbody>
      </table></div>
      {lista.length > quantos && <button type="button" className={estiloBotao()} onClick={() => setQuantos(q => q + CONTRATOS_POR_VEZ)}>
        Mostrar mais {Math.min(CONTRATOS_POR_VEZ, lista.length - quantos).toLocaleString('pt-BR')} de {(lista.length - quantos).toLocaleString('pt-BR')}
      </button>}
    </> : <Vazio>{carteira.length ? 'Nenhum contrato com esses filtros.' : 'Nenhum contrato com parcelas ainda. As parcelas nascem quando o contrato é assinado.'}</Vazio>}
  </PaginaModulo>;
}
