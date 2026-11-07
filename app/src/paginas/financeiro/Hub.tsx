// O Financeiro numa página só: o período e os totais no alto e quatro abas. Entradas e Saídas são o que já entrou e saiu das contas;
// Direitos e Obrigações, o que ainda vai entrar e sair. Clicar em qualquer linha abre a janela flutuante com tudo o que se sabe dela
// (DetalheFinanceiro.tsx); lançar também abre ali.
// Quem não é administrador vê só o que é dos contratos de que é responsável (o banco filtra), e não vê Saídas.
import { useEffect, useState, type ReactNode } from 'react';
import { Link, Navigate, useLocation } from 'react-router';
import { SD, type ContaFinanceira, type ContratoDaCarteira, type Lancamento, type ParcelaDoEscritorio, type Repasse, type ValorAPassar } from '../../dados';
import { diasDoMes, fmtCentavos } from '../../regras/caixa';
import {
  FILTRO_VAZIO, MESES_DO_ANO, linhaDoCaixa, SITUACOES_NA_CARTEIRA, advogadosDaEquipe, carteiraDeContratos, contaNoResultado, entradasDoMes, filtrarCarteira, indicadoresDoAdvogado, filtrarExtrato, mesDoAno, mesesComLancamento,
  totaisDaCarteira, totaisDoExtrato, totalRecebido, type SituacaoNaCarteira
} from '../../regras/painelFinanceiro';
import { maiorParcelaPorContrato, numeroDaParcela } from '../../regras/parcelas';
import { fmtData } from '../../regras/pessoa';
import { somarDias } from '../../regras/prazos';
import { useMudancas } from '../../ui/avisos';
import { Aviso, BotaoLink, Carregando, estiloBotao, Indicador, Indicadores, Nota, Segmentos, Selo, TituloSecao, Vazio } from '../../ui/base';
import { Icone } from '../../ui/Icone';
import { PaginaModulo } from '../../ui/PaginaModulo';
import { PainelCartao } from '../../ui/PainelCartao';
import { useCtx } from '../../ui/sessao';
import { hojeISO, useTitulo } from '../../ui/util';
import { Repasses } from '../Parcelas';
import { AbasDoFinanceiro, abaDoCaminho, type AbaDoFinanceiro } from './AbasDoFinanceiro';
import { ValoresAPassar } from './APassar';
import { FormDoCaixa, NovaEntrada } from './NovoLancamento';
import { ContratoNoFinanceiro, DetalheDaParcela, DetalheDoLancamento } from './DetalheFinanceiro';
import { GraficosDoFinanceiro } from './Graficos';
import '../Financeiro.css';

/** As parcelas de todos os tempos: a carteira olha o contrato inteiro, não só um mês. */
const TODAS_AS_DATAS = { de: '2000-01-01', ate: '2200-12-31' };
/** Quantas linhas cada lista mostra de cada vez: o ano inteiro pode ter milhares. */
const LINHAS_POR_VEZ = 100;
const ANO_TODO = 'ano';
const TODAS = 'todas';
type Aberto = { o: 'entrada'; parcela?: string } | { o: 'saida' } | { o: 'avulsa' } | { o: 'mudar'; lancamento: Lancamento }
  | { o: 'parcela'; parcela: ParcelaDoEscritorio } | { o: 'contrato'; contratoId: string } | null;
type Caixa = { contas: ContaFinanceira[]; lancamentos: Lancamento[]; saldos: Map<string, number> };
type Lido = { ano: number; parcelas: ParcelaDoEscritorio[]; contratos: ContratoDaCarteira[]; caixa: Caixa | null } | { ano: number; erro: string };

export default function Hub() {
  useTitulo('Financeiro');
  const ctx = useCtx();
  const aba = abaDoCaminho(useLocation().pathname);
  const admin = ctx.ehAdmin;
  const hoje = hojeISO();
  const [ano, setAno] = useState(Number(hoje.slice(0, 4)));
  const [mes, setMes] = useState<string | null>(hoje.slice(0, 7));
  // De quem são os indicadores e as listas: o escritório todo (vazio) ou um advogado. Só o administrador escolhe.
  const [advogado, setAdvogado] = useState('');
  const [lido, setLido] = useState<Lido | null>(null);
  const [aberto, setAberto] = useState<Aberto>(null);
  const [versao, setVersao] = useState(0);
  const recarregar = () => setVersao(v => v + 1);
  const pode = !!ctx.escritorio?.modulos?.financeiro;

  useEffect(() => {
    if (!pode) return;
    let vivo = true;
    (async () => {
      const parcelas = SD.parcelasDoPeriodo(TODAS_AS_DATAS.de, TODAS_AS_DATAS.ate, hoje);
      const contratos = SD.financeiroContratosDaCarteira();
      if (!admin) return { ano, parcelas: await parcelas, contratos: await contratos, caixa: null };
      const contas = await SD.financeiroContas();
      const [listas, saldos] = await Promise.all([
        Promise.all(contas.map(c => SD.financeiroLancamentos(c.id, `${ano}-01-01`, `${ano}-12-31`))),
        Promise.all(contas.filter(c => !c.arquivada_em).map(async c => [c.id, await SD.financeiroSaldoAntes(c.id, somarDias(hoje, 1))] as const))
      ]);
      return { ano, parcelas: await parcelas, contratos: await contratos, caixa: { contas, lancamentos: listas.flat(), saldos: new Map(saldos) } };
    })().then(x => { if (vivo) setLido(x); }).catch(e => { if (vivo) setLido({ ano, erro: (e as Error).message }); });
    return () => { vivo = false; };
  }, [ano, admin, pode, hoje, versao]);
  useMudancas(recarregar);

  if (!pode) return <Navigate to="/inicio/" replace />;
  if (aba === 'saidas' && !admin) return <Navigate to="/financeiro/" replace />;
  const cabecalho = { titulo: 'Financeiro', visoes: [] };
  const atual = lido?.ano === ano ? lido : null;
  const fechar = () => setAberto(null);
  const registrou = () => { recarregar(); };
  const periodo = mes ?? String(ano);
  const nomeDoPeriodo = mes ? `${MESES_DO_ANO[Number(mes.slice(5)) - 1]}/${ano}` : String(ano);

  const barra = <div className="painel-barra">
    <div className="painel-ano" role="group" aria-label="Ano">
      <button type="button" className="icone-btn" aria-label="Ano anterior" onClick={() => { setAno(ano - 1); setMes(null); }}><Icone nome="voltar" tam={16} /></button>
      <b className="num">{ano}</b>
      <button type="button" className="icone-btn" aria-label="Próximo ano" onClick={() => { setAno(ano + 1); setMes(null); }}><Icone nome="seta" tam={16} /></button>
    </div>
    <Segmentos rotulo="Mês" atual={mes ?? ANO_TODO} aoEscolher={m => setMes(m === ANO_TODO ? null : m)}
      opcoes={[{ id: ANO_TODO, rotulo: 'Ano todo' }, ...MESES_DO_ANO.map((nome, i) => {
        const m = mesDoAno(ano, i);
        return { id: m, rotulo: nome, marcado: !!atual && 'caixa' in atual && !!atual.caixa && mesesComLancamento(atual.caixa.lancamentos, ano).has(m) };
      })]} />
    {admin && <select className="campo financeiro-quem" aria-label="De quem" value={advogado} onChange={e => setAdvogado(e.target.value)}>
      <option value="">Escritório todo</option>
      {advogadosDaEquipe(ctx.equipe).map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
    </select>}
  </div>;

  const botoes = <div className="financeiro-acoes">
    <button type="button" className={estiloBotao({ variante: 'principal' })} onClick={() => setAberto({ o: 'entrada' })}><Icone nome="mais" tam={15} /> Nova entrada</button>
    {admin && <button type="button" className={estiloBotao()} onClick={() => setAberto({ o: 'saida' })}><Icone nome="mais" tam={15} /> Nova saída</button>}
    {/* As contas do escritório (saldo inicial, DAS, ajustes): também quando ainda não há nenhuma. */}
    {admin && <BotaoLink forma="link" to="/financeiro/contas/">Contas e DAS</BotaoLink>}
  </div>;

  let corpo;
  if (!atual) corpo = <Carregando />;
  else if ('erro' in atual) corpo = <Aviso tipo="erro">{atual.erro}</Aviso>;
  else {
    const { parcelas, contratos, caixa } = atual;
    const doPeriodo = caixa ? filtrarExtrato(caixa.lancamentos, { ...FILTRO_VAZIO, mes: periodo }) : [];
    const t = totaisDoExtrato(doPeriodo);
    const ind = indicadoresDoAdvogado(parcelas, periodo, hoje, advogado);
    const conteudo: Record<AbaDoFinanceiro, () => ReactNode> = {
      entradas: () => <Entradas caixa={caixa} parcelas={parcelas} periodo={periodo} usuario={advogado} aoMudar={l => setAberto({ o: 'mudar', lancamento: l })} aoAbrirParcela={p => setAberto({ o: 'parcela', parcela: p })} />,
      saidas: () => <ListaDoCaixa caixa={caixa!} tipo="saida" periodo={periodo} aoMudar={l => setAberto({ o: 'mudar', lancamento: l })} />,
      direitos: () => <Direitos parcelas={parcelas} usuario={advogado} aoReceber={id => setAberto({ o: 'entrada', parcela: id })} aoAbrir={id => setAberto({ o: 'contrato', contratoId: id })} />,
      obrigacoes: () => <Obrigacoes periodo={periodo} contas={caixa?.contas ?? []} versao={versao} aoMudar={recarregar} />
    };
    corpo = <>
      <Indicadores rotulo={`Totais de ${nomeDoPeriodo}`}>
        {caixa && !advogado ? <>
          <Indicador tom="entrada" rotulo={`Entradas · ${nomeDoPeriodo}`} valor={fmtCentavos(t.entradas)} />
          <Indicador tom="saida" rotulo={`Saídas · ${nomeDoPeriodo}`} valor={fmtCentavos(t.saidas)} />
          <Indicador tom={t.resultado < 0 ? 'saida' : 'entrada'} rotulo={`Resultado · ${nomeDoPeriodo}`} valor={fmtCentavos(t.resultado)} />
          <Indicador tom="destaque" rotulo="Saldo hoje nas contas" valor={fmtCentavos([...caixa.saldos.values()].reduce((s, v) => s + v, 0))}
            detalhe={<Link className="financeiro-link-escuro" to="/financeiro/contas/">{caixa.contas.filter(c => caixa.saldos.has(c.id)).map(c => `${c.nome} ${fmtCentavos(caixa.saldos.get(c.id)!)}`).join(' · ')}</Link>} />
        </> : <>
          <Indicador tom="entrada" rotulo={`Recebido · ${nomeDoPeriodo}`} valor={fmtCentavos(ind.recebido)} />
          <Indicador tom="alerta" rotulo="A receber" valor={fmtCentavos(ind.aReceber)} />
          <Indicador tom="saida" rotulo="Em atraso" valor={fmtCentavos(ind.atrasado)} />
          <Indicador tom="destaque" rotulo="Contratos em aberto" valor={ind.emAberto.toLocaleString('pt-BR')} />
        </>}
      </Indicadores>
      <GraficosDoFinanceiro ano={ano} caixa={caixa} parcelas={parcelas} contratos={contratos} advogado={advogado} />
      <div className="financeiro-abas-linha">
        <AbasDoFinanceiro />
        {botoes}
      </div>
      {conteudo[aba]()}
    </>;
  }

  return <PaginaModulo {...cabecalho} contador={nomeDoPeriodo}>
    {barra}
    {corpo}
    {aberto && <PainelCartao aoFechar={fechar} soNoCentro ajustado rotulo={TITULOS[aberto.o]}>
      <header className="cartao-cabeca"><h2>{TITULOS[aberto.o]}</h2></header>
      {aberto.o === 'entrada' && atual && 'parcelas' in atual && <>
        <NovaEntrada parcelas={atual.parcelas} parcelaInicial={aberto.parcela} aoRegistrar={registrou} />
        {admin && <button type="button" className={estiloBotao({ forma: 'link' })} onClick={() => setAberto({ o: 'avulsa' })}>Entrada sem contrato</button>}
      </>}
      {aberto.o === 'avulsa' && <FormDoCaixa tipo="entrada" titulo="Entrada sem contrato" rotulo="Registrar entrada" aoRegistrar={registrou} />}
      {aberto.o === 'saida' && <FormDoCaixa tipo="saida" titulo="Nova saída" rotulo="Registrar saída" aoRegistrar={registrou} />}
      {aberto.o === 'mudar' && atual && 'caixa' in atual && atual.caixa && <DetalheDoLancamento key={aberto.lancamento.id} lancamento={aberto.lancamento} contas={atual.caixa.contas} aoTerminar={() => { fechar(); recarregar(); }} />}
      {aberto.o === 'parcela' && <DetalheDaParcela key={aberto.parcela.id} parcela={aberto.parcela} />}
      {aberto.o === 'contrato' && <ContratoNoFinanceiro key={aberto.contratoId} contratoId={aberto.contratoId} />}
    </PainelCartao>}
  </PaginaModulo>;
}

const TITULOS: Record<NonNullable<Aberto>['o'], string> = { entrada: 'Nova entrada', avulsa: 'Entrada sem contrato', saida: 'Nova saída', mudar: 'Lançamento', parcela: 'Parcela recebida', contrato: 'Contrato' };

/** O extrato do caixa de um tipo no período. Clicar numa linha abre o lançamento. */
function ListaDoCaixa({ caixa, tipo, periodo, aoMudar }: { caixa: Caixa; tipo: 'entrada' | 'saida'; periodo: string; aoMudar: (l: Lancamento) => void }) {
  const [busca, setBusca] = useState('');
  const [quantas, setQuantas] = useState(LINHAS_POR_VEZ);
  const lista = filtrarExtrato(caixa.lancamentos, { ...FILTRO_VAZIO, mes: periodo, tipo, busca }).filter(contaNoResultado);
  const nomeDaConta = new Map(caixa.contas.map(c => [c.id, c.nome]));
  const rotulo = tipo === 'entrada' ? 'Entradas' : 'Saídas';
  return <section className="painel-secao" aria-label={rotulo}>
    <div className="financeiro-filtros">
      <label className="busca-campo"><Icone nome="buscar" tam={18} /><span className="sr">Buscar</span>
        <input type="search" placeholder="Buscar descrição" value={busca} onChange={e => { setBusca(e.target.value); setQuantas(LINHAS_POR_VEZ); }} />
      </label>
    </div>
    {lista.length ? <>
      <div className="tabela"><table className="extrato" aria-label={rotulo}>
        <thead><tr><th scope="col">Data</th><th scope="col">{tipo === 'entrada' ? 'Cliente ou origem' : 'Para quem'}</th><th scope="col">Categoria</th>{caixa.contas.length > 1 && <th scope="col">Conta</th>}<th scope="col" className="financeiro-num">Valor</th></tr></thead>
        <tbody>{lista.slice(0, quantas).map(l => {
          const linha = linhaDoCaixa(l);
          return <tr key={l.id} className="clicavel" onClick={() => aoMudar(l)}>
          <td>{fmtData(l.data)}</td>
          <td><button type="button" className="financeiro-abrir" aria-label={`Abrir o lançamento: ${l.descricao}`} onClick={e => { e.stopPropagation(); aoMudar(l); }}>{linha.quem}</button>
            {linha.oQue && <span className="sub">{linha.oQue}</span>}</td>
          <td><span className="sub">{linha.categoria}</span></td>
          {caixa.contas.length > 1 && <td>{nomeDaConta.get(l.conta_id)}</td>}
          <td className={'financeiro-num ' + (tipo === 'entrada' ? 'tom-entrada' : 'tom-saida')}>{fmtCentavos(l.valor)}</td>
        </tr>;
        })}</tbody>
        <tfoot><tr><th scope="row" colSpan={caixa.contas.length > 1 ? 4 : 3}>Total</th>
          <td className="financeiro-num"><b>{fmtCentavos(lista.reduce((s, l) => s + l.valor, 0))}</b></td></tr></tfoot>
      </table></div>
      {lista.length > quantas && <button type="button" className={estiloBotao()} onClick={() => setQuantas(q => q + LINHAS_POR_VEZ)}>Mostrar mais</button>}
    </> : <Vazio>Nenhuma {tipo === 'entrada' ? 'entrada' : 'saída'} neste período.</Vazio>}
  </section>;
}

/** Entradas: o caixa inteiro para o administrador; as parcelas recebidas de um usuário (ou as suas, para quem não é administrador). */
function Entradas({ caixa, parcelas, periodo, usuario, aoMudar, aoAbrirParcela }: { caixa: Caixa | null; parcelas: ParcelaDoEscritorio[]; periodo: string; usuario: string; aoMudar: (l: Lancamento) => void; aoAbrirParcela: (p: ParcelaDoEscritorio) => void }) {
  if (caixa && !usuario) return <><ListaDoCaixa caixa={caixa} tipo="entrada" periodo={periodo} aoMudar={aoMudar} /></>;
  const lista = entradasDoMes(parcelas, periodo, usuario);
  const maior = maiorParcelaPorContrato(parcelas);
  return <>
    {lista.length ? <div className="tabela"><table className="carteira" aria-label="Parcelas recebidas">
      <thead><tr><th scope="col">Data</th><th scope="col">Contrato</th><th scope="col">Cliente</th><th scope="col">Parcela</th><th scope="col" className="financeiro-num">Valor</th></tr></thead>
      <tbody>{lista.map(p => <tr key={p.id} className="clicavel" onClick={() => aoAbrirParcela(p)}>
        <td><button type="button" className="financeiro-abrir" aria-label={`Abrir a parcela de ${p.contrato_codigo}`} onClick={e => { e.stopPropagation(); aoAbrirParcela(p); }}>{fmtData(p.recebida_em!)}</button></td><td>{p.contrato_codigo}</td><td className="nome">{p.cliente_nome}</td>
        <td className="num">{numeroDaParcela(p.numero, p.total_parcelas, maior.get(p.contrato_id))}</td><td className="financeiro-num tom-entrada">{fmtCentavos(p.recebido ?? p.valor)}</td>
      </tr>)}</tbody>
      <tfoot><tr><th scope="row" colSpan={4}>Total</th><td className="financeiro-num"><b>{fmtCentavos(totalRecebido(lista))}</b></td></tr></tfoot>
    </table></div> : <Vazio>Nenhuma parcela recebida neste período.</Vazio>}
  </>;
}

/** Direitos: o que ainda vai entrar, contrato por contrato. Clicar na linha abre o contrato na janela, com as parcelas. */
function Direitos({ parcelas, usuario, aoReceber, aoAbrir }: { parcelas: ParcelaDoEscritorio[]; usuario: string; aoReceber: (parcela: string) => void; aoAbrir: (contratoId: string) => void }) {
  const hoje = hojeISO();
  const [busca, setBusca] = useState('');
  const [situacao, setSituacao] = useState<SituacaoNaCarteira | ''>('');
  const [quantos, setQuantos] = useState(LINHAS_POR_VEZ);
  const carteira = carteiraDeContratos(parcelas, hoje);
  const lista = filtrarCarteira(carteira, { situacao, busca, responsavel: usuario }).filter(c => situacao || c.situacao !== 'quitado');
  const t = totaisDaCarteira(lista);
  return <section className="painel-secao" aria-label="Direitos">
    <div className="financeiro-filtros">
      <label className="busca-campo"><Icone nome="buscar" tam={18} /><span className="sr">Buscar contrato ou cliente</span>
        <input type="search" placeholder="Buscar contrato ou cliente" value={busca} onChange={e => setBusca(e.target.value)} />
      </label>
      <Segmentos rotulo="Situação" atual={situacao || TODAS} aoEscolher={s => setSituacao(s === TODAS ? '' : s as SituacaoNaCarteira)}
        opcoes={[{ id: TODAS, rotulo: 'A receber' }, ...(['atrasado', 'em_dia', 'quitado'] as SituacaoNaCarteira[]).map(s => ({ id: s, rotulo: SITUACOES_NA_CARTEIRA[s].nome }))]} />
    </div>
    {lista.length ? <>
      <div className="tabela"><table className="carteira" aria-label="Direitos">
        <thead><tr><th scope="col">Contrato</th><th scope="col">Cliente</th><th scope="col">Próxima</th><th scope="col" className="financeiro-num">Falta</th><th scope="col">Situação</th><th scope="col"><span className="sr">Ações</span></th></tr></thead>
        <tbody>{lista.slice(0, quantos).map(c => <tr key={c.contratoId} className="clicavel" onClick={() => aoAbrir(c.contratoId)}>
          <td><button type="button" className="financeiro-abrir" aria-label={`Abrir o contrato ${c.codigo}`} onClick={e => { e.stopPropagation(); aoAbrir(c.contratoId); }}>{c.codigo}</button></td>
          <td className="nome">{c.cliente}</td>
          <td>{c.proxima ? <>{fmtData(c.proxima.vencimento)}<span className="sub"> · {fmtCentavos(c.proxima.valor)}</span></> : '–'}</td>
          <td className="financeiro-num"><b>{c.falta ? fmtCentavos(c.falta) : '–'}</b></td>
          <td><Selo tipo={SITUACOES_NA_CARTEIRA[c.situacao].selo}>{SITUACOES_NA_CARTEIRA[c.situacao].nome}</Selo></td>
          <td>{c.proxima && <button type="button" className={estiloBotao({ forma: 'mini', variante: 'principal' })} aria-label={`Receber a parcela ${c.proxima.numero} de ${c.codigo}`}
            onClick={e => { e.stopPropagation(); aoReceber(c.proxima!.id); }}>Receber</button>}</td>
        </tr>)}</tbody>
        <tfoot><tr><th scope="row" colSpan={3}>Total a receber</th><td className="financeiro-num"><b>{fmtCentavos(t.falta)}</b></td><td colSpan={2} /></tr></tfoot>
      </table></div>
      {lista.length > quantos && <button type="button" className={estiloBotao()} onClick={() => setQuantos(q => q + LINHAS_POR_VEZ)}>Mostrar mais</button>}
    </> : <Vazio>Nenhum contrato com esses filtros.</Vazio>}
    <Nota>Também em Direitos: <Link to="/meus-valores/">Meus valores</Link> · <Link to="/conferencia/">Conferência da importação</Link></Nota>
  </section>;
}

type Pagar = { chave: string; repasses: Repasse[]; aPassar: ValorAPassar[] } | { chave: string; erro: string };

/** Obrigações: o que ainda vai sair. Os repasses que o escritório paga e o que o responsável passa a participantes e indicadores. */
function Obrigacoes({ periodo, contas, versao, aoMudar }: { periodo: string; contas: ContaFinanceira[]; versao: number; aoMudar: () => void }) {
  const ctx = useCtx();
  const hoje = hojeISO();
  const [lido, setLido] = useState<Pagar | null>(null);
  const { de, ate } = periodo.length === 4 ? { de: `${periodo}-01-01`, ate: `${periodo}-12-31` } : diasDoMes(periodo);
  const chave = de + '/' + versao;
  useEffect(() => {
    let vivo = true;
    const esta = de + '/' + versao;
    Promise.all([SD.financeiroRepasses(de, ate), SD.financeiroAPassar(de, ate)])
      .then(([repasses, aPassar]) => { if (vivo) setLido({ chave: esta, repasses, aPassar }); })
      .catch(e => { if (vivo) setLido({ chave: esta, erro: (e as Error).message }); });
    return () => { vivo = false; };
  }, [de, ate, versao]);
  const atual = lido?.chave === chave ? lido : null;
  if (!atual) return <Carregando />;
  if ('erro' in atual) return <Aviso tipo="erro">{atual.erro}</Aviso>;
  return <section className="painel-secao" aria-label="Obrigações">
    <TituloSecao>{ctx.ehAdmin ? 'Repasses a advogados e sócios' : 'Seus repasses'}</TituloSecao>
    <Repasses lista={atual.repasses} admin={ctx.ehAdmin} contas={contas.filter(c => !c.arquivada_em)} hoje={hoje} aoMudar={aoMudar} />
    <TituloSecao>A passar a participantes e indicadores</TituloSecao>
    <ValoresAPassar lista={atual.aPassar} hoje={hoje} aoMudar={aoMudar} />
    {ctx.ehAdmin && <Nota>Também em Obrigações: <Link to="/lucros/">Lucro dos sócios</Link></Nota>}
  </section>;
}
