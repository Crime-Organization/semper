// O Financeiro numa página só, no padrão dos painéis (#401, #403): no alto, o título, de quem são os números e o período; depois, os
// números do período, cada um comparado com o de antes, e os gráficos (PainelDoFinanceiro, em Graficos.tsx); embaixo, as quatro
// abas. Entradas e Saídas são o que já entrou e saiu das contas; Direitos e Obrigações, o que ainda vai entrar e sair. Clicar em
// qualquer linha abre a janela flutuante com tudo o que se sabe dela (DetalheFinanceiro.tsx); lançar também abre ali.
// Quem não é administrador vê só o que é dos contratos de que é responsável (o banco filtra), e não vê Saídas nem o caixa.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { SD, type ContaFinanceira, type DespesaDoEscritorio, type Lancamento, type ParcelaDoEscritorio, type Repasse, type ValorAPassar } from '../../dados';
import { dicaComAtalho, ATALHOS } from '../../regras/atalhos';
import { diasDoMes, fmtCentavos, mesPedido, PARAMETROS_DO_LANCAMENTO } from '../../regras/caixa';
import {
  FILTRO_VAZIO, MESES_DO_ANO, linhaDoCaixa, SITUACOES_NA_CARTEIRA, advogadosDaEquipe, carteiraDeContratos, contaNoResultado, entradasDoMes, filtrarCarteira, filtrarExtrato, mesDoAno, mesesComLancamento,
  totaisDaCarteira, totalRecebido, type SituacaoNaCarteira
} from '../../regras/painelFinanceiro';
import { maiorParcelaPorContrato, numeroDaParcela } from '../../regras/parcelas';
import { fmtData } from '../../regras/pessoa';
import { somarDias } from '../../regras/prazos';
import type { TelaComAjuda } from '../../regras/ajuda';
import { useAtalhosLigados } from '../../ui/atalhos';
import { useMudancas } from '../../ui/avisos';
import { useAjudaDaTela } from '../../ui/BotaoDeAjuda';
import { Aviso, BotaoLink, Carregando, estiloBotao, Segmentos, Selo, TituloSecao, Vazio } from '../../ui/base';
import { Icone } from '../../ui/Icone';
import { CabecaDoPainel } from '../../ui/painel/Painel';
import { PainelCartao } from '../../ui/PainelCartao';
import { useCtx } from '../../ui/sessao';
import { useParametroLido } from '../../ui/useParametroLido';
import { hojeISO, useTitulo } from '../../ui/util';
import { AbasDoFinanceiro, abaDoCaminho, type AbaDoFinanceiro } from './AbasDoFinanceiro';
import { ValoresAPassar } from './APassar';
import { Repasses } from './Repasses';
import { DespesasDoEscritorio } from './Despesas';
import { PARAMETROS_DA_DESPESA } from '../../../../supabase/functions/_compartilhado/enderecoDaDespesa';
import { FormDoCaixa, NovaEntrada } from './NovoLancamento';
import { ContratoNoFinanceiro, DetalheDaParcela, DetalheDoLancamento } from './DetalheFinanceiro';
import { LUGAR_DAS_LISTAS, PainelDoFinanceiro, type CaixaDoPainel, type DadosDoPainel } from './Graficos';
import '../Financeiro.css';

/** As parcelas de todos os tempos: a carteira olha o contrato inteiro, não só um mês. */
const TODAS_AS_DATAS = { de: '2000-01-01', ate: '2200-12-31' };
/** Quantas linhas cada lista mostra de cada vez: o ano inteiro pode ter milhares. */
const LINHAS_POR_VEZ = 100;
/** O tamanho do "+" do botão "Nova entrada", como o da ação principal das páginas de módulo. */
const ICONE_DA_ACAO = 18;
const ANO_TODO = 'ano';
const TODAS = 'todas';
type Aberto = { o: 'entrada'; parcela?: string } | { o: 'saida' } | { o: 'avulsa' } | { o: 'mudar'; lancamento: Lancamento }
  | { o: 'parcela'; parcela: ParcelaDoEscritorio } | { o: 'contrato'; contratoId: string } | null;
/** O que as listas do caixa usam: as contas e os lançamentos. */
type Caixa = Pick<CaixaDoPainel, 'contas' | 'lancamentos'>;
type Lido = ({ ano: number } & DadosDoPainel) | { ano: number; erro: string };

/**
 * As outras telas do Financeiro, com um botão cada no alto da página (#331). A Conferência da importação sai quando a conferência do
 * caixa antigo terminar (#49). Uma tela nova é uma linha nova aqui.
 */
const OUTRAS_TELAS: { para: string; rotulo: string; soAdmin: boolean }[] = [
  { para: '/meus-valores/', rotulo: 'Meus valores', soAdmin: false },
  { para: '/conferencia/', rotulo: 'Conferência', soAdmin: false },
  { para: '/lucros/', rotulo: 'Lucro dos sócios', soAdmin: true }
];

/** A ajuda de cada aba (#411): o "?" explica o painel e a aba aberta. Aba nova = uma linha nova aqui e a ajuda dela em regras/ajuda.ts. */
const AJUDA_DA_ABA: Record<AbaDoFinanceiro, TelaComAjuda> = {
  entradas: 'financeiroEntradas', saidas: 'financeiroSaidas', direitos: 'financeiroDireitos', obrigacoes: 'financeiroObrigacoes'
};

/** De quem são os números: o escritório todo (o administrador, com o caixa), um advogado escolhido por ele, ou quem está logado. */
type DeQuem = 'escritorio' | 'advogado' | 'eu';
const FRASE_DE_QUEM: Record<DeQuem, (nome: string) => string> = {
  escritorio: () => 'O caixa e os contratos do escritório todo.',
  advogado: nome => `Os contratos de ${nome}.`,
  eu: () => 'Os contratos de que você é responsável.'
};

/**
 * Lê o período: as parcelas de todos os tempos, os contratos e, desde o começo do ano anterior (para comparar janeiro com dezembro e
 * mostrar os últimos 12 meses), os recebimentos e, para o administrador, os lançamentos de cada conta e o saldo de cada conta
 * ativa no começo desse tempo e hoje.
 */
async function lerFinanceiro(ano: number, admin: boolean, hoje: string): Promise<DadosDoPainel> {
  const base = `${ano - 1}-01-01`, fim = `${ano}-12-31`;
  const parcelas = SD.parcelasDoPeriodo(TODAS_AS_DATAS.de, TODAS_AS_DATAS.ate, hoje);
  const contratos = SD.financeiroContratosDaCarteira();
  const recebimentos = SD.financeiroRecebimentosDoPeriodo(base, fim);
  if (!admin) return { parcelas: await parcelas, contratos: await contratos, recebimentos: await recebimentos, caixa: null };
  const contas = await SD.financeiroContas();
  const ativas = contas.filter(c => !c.arquivada_em);
  const saldosEm = (dia: string) => Promise.all(ativas.map(async c => [c.id, await SD.financeiroSaldoAntes(c.id, dia)] as const)).then(pares => new Map(pares));
  const [listas, saldosNaBase, saldosDeHoje] = await Promise.all([
    Promise.all(contas.map(c => SD.financeiroLancamentos(c.id, base, fim))), saldosEm(base), saldosEm(somarDias(hoje, 1))
  ]);
  return { parcelas: await parcelas, contratos: await contratos, recebimentos: await recebimentos, caixa: { contas, lancamentos: listas.flat(), base, saldosNaBase, saldosDeHoje } };
}

export default function Hub() {
  useTitulo('Financeiro');
  const ctx = useCtx();
  const local = useLocation();
  const aba = abaDoCaminho(local.pathname);
  const admin = ctx.ehAdmin;
  const hoje = hojeISO();
  // O "Mudar em Entradas/Saídas" da página das contas pede o mês do lançamento e qual linha mostrar (#419); sem pedido, o mês de hoje.
  const mesDoEndereco = mesPedido(useParametroLido(PARAMETROS_DO_LANCAMENTO.mes));
  const lancamentoPedido = useParametroLido(PARAMETROS_DO_LANCAMENTO.lancamento);
  // O endereço da despesa (enderecoDaDespesa, #439: o link da agenda Administrativo do Google) abre a despesa uma vez só.
  const despesaNoEndereco = useParametroLido(PARAMETROS_DA_DESPESA.despesa);
  const [despesaPedida, setDespesaPedida] = useState(despesaNoEndereco);
  const [ano, setAno] = useState(Number((mesDoEndereco ?? hoje).slice(0, 4)));
  const [mes, setMes] = useState<string | null>(mesDoEndereco ?? hoje.slice(0, 7));
  // De quem são os números e as listas: o escritório todo (vazio) ou um advogado. Só o administrador escolhe.
  const [advogado, setAdvogado] = useState('');
  const [lido, setLido] = useState<Lido | null>(null);
  const [aberto, setAberto] = useState<Aberto>(null);
  const [versao, setVersao] = useState(0);
  const recarregar = () => setVersao(v => v + 1);
  const pode = !!ctx.escritorio?.modulos?.financeiro;
  const novaEntrada = () => setAberto({ o: 'entrada' });
  // "Nova entrada" é a ação principal da página: o botão no alto e a tecla N (#86), como o "Novo" dos outros módulos. O "?" do
  // título e a tecla "?" abrem a ajuda da aba aberta (#411).
  const abrirAjuda = useAjudaDaTela(AJUDA_DA_ABA[aba], pode ? { rotulo: TITULOS.entrada, abrir: novaEntrada } : undefined);
  const atalhosLigados = useAtalhosLigados();

  useEffect(() => {
    if (!pode) return;
    let vivo = true;
    lerFinanceiro(ano, admin, hoje).then(x => { if (vivo) setLido({ ano, ...x }); }).catch(e => { if (vivo) setLido({ ano, erro: (e as Error).message }); });
    return () => { vivo = false; };
  }, [ano, admin, pode, hoje, versao]);
  useMudancas(recarregar);

  // Um número do alto que leva a uma lista ("…#financeiro-listas") troca a aba e desce até ela; trocar de aba pelas abas, não.
  const listas = useRef<HTMLDivElement>(null);
  const carregado = !!lido;
  useEffect(() => {
    if (carregado && local.hash === '#' + LUGAR_DAS_LISTAS) listas.current?.scrollIntoView({ block: 'start' });
  }, [local.key, local.hash, carregado]);

  if (!pode) return <Navigate to="/inicio/" replace />;
  if (aba === 'saidas' && !admin) return <Navigate to="/financeiro/" replace />;
  const atual = lido?.ano === ano ? lido : null;
  const fechar = () => setAberto(null);
  const registrou = () => { recarregar(); };
  const periodo = mes ?? String(ano);
  const nomeDoAdvogado = ctx.equipe.find(m => m.id === advogado)?.nome ?? '';
  const deQuem: DeQuem = !admin ? 'eu' : advogado ? 'advogado' : 'escritorio';
  // De quem são os números: o advogado escolhido pelo administrador (ou o escritório todo); para os outros, só os seus.
  const quem = admin ? advogado : ctx.perfil.id;

  const cabeca = <CabecaDoPainel titulo="Financeiro" frase={FRASE_DE_QUEM[deQuem](nomeDoAdvogado)} aoAbrirAjuda={abrirAjuda}>
    <div className="financeiro-topo-acoes">
      <nav className="financeiro-topo-acoes" aria-label="Outras telas do Financeiro">
        {OUTRAS_TELAS.filter(t => admin || !t.soAdmin).map(t => <BotaoLink key={t.para} to={t.para}>{t.rotulo}</BotaoLink>)}
      </nav>
      {admin && <label className="filtro-do-painel">
        <span>De quem</span>
        <select className="filtro" value={advogado} onChange={e => setAdvogado(e.target.value)}>
          <option value="">Escritório todo</option>
          {advogadosDaEquipe(ctx.equipe).map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
        </select>
      </label>}
      <button type="button" className={estiloBotao({ variante: 'principal' })} onClick={novaEntrada}
        title={atalhosLigados ? dicaComAtalho(TITULOS.entrada, 'novo') : TITULOS.entrada} aria-keyshortcuts={atalhosLigados ? ATALHOS.novo.nome : undefined}>
        <Icone nome="mais" tam={ICONE_DA_ACAO} />{TITULOS.entrada}
      </button>
    </div>
  </CabecaDoPainel>;

  const barra = <div className="painel-barra financeiro-periodo">
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
  </div>;

  // A saída e as contas ficam ao lado das abas.
  const botoes = <div className="financeiro-acoes">
    {admin && <button type="button" className={estiloBotao()} onClick={() => setAberto({ o: 'saida' })}><Icone nome="mais" tam={15} /> Nova saída</button>}
    {/* A página "Contas, DAS e sócios" (saldo inicial, DAS, sócios, ajustes e o extrato de cada conta): também quando ainda não há nenhuma. */}
    {admin && <BotaoLink forma="link" to="/financeiro/contas/">Contas e DAS</BotaoLink>}
  </div>;

  let corpo;
  if (!atual) corpo = <Carregando />;
  else if ('erro' in atual) corpo = <Aviso tipo="erro">{atual.erro}</Aviso>;
  else {
    const { parcelas, caixa } = atual;
    const conteudo: Record<AbaDoFinanceiro, () => ReactNode> = {
      entradas: () => <Entradas caixa={caixa} parcelas={parcelas} periodo={periodo} usuario={advogado} destaque={lancamentoPedido} aoMudar={l => setAberto({ o: 'mudar', lancamento: l })} aoAbrirParcela={p => setAberto({ o: 'parcela', parcela: p })} />,
      saidas: () => <ListaDoCaixa caixa={caixa!} tipo="saida" periodo={periodo} destaque={lancamentoPedido} aoMudar={l => setAberto({ o: 'mudar', lancamento: l })} />,
      direitos: () => <Direitos parcelas={parcelas} usuario={advogado} aoReceber={id => setAberto({ o: 'entrada', parcela: id })} aoAbrir={id => setAberto({ o: 'contrato', contratoId: id })} />,
      obrigacoes: () => <Obrigacoes periodo={periodo} contas={caixa?.contas ?? []} versao={versao} aoMudar={recarregar}
        despesaPedida={despesaPedida} aoAbrirPedida={() => setDespesaPedida(null)} />
    };
    const deQuemFor = (p: { responsavel_id: string | null }) => !quem || p.responsavel_id === quem;
    const semNada = !atual.parcelas.some(deQuemFor) && !atual.recebimentos.some(deQuemFor) && (deQuem !== 'escritorio' || !caixa?.contas.length);
    corpo = <>
      {semNada ? <Vazio>
        <p className="painel-vazio-titulo">{deQuem === 'escritorio' ? 'O Financeiro ainda está vazio.' : 'Nenhum contrato com parcelas por aqui.'}</p>
        <p>Quando houver {deQuem === 'escritorio' ? 'contas, lançamentos e parcelas' : 'parcelas nos contratos'}, o painel mostra as entradas e saídas de cada mês, o que falta receber e a receita por área.</p>
        {deQuem === 'escritorio' && <BotaoLink to="/financeiro/contas/" variante="principal">Criar as contas do escritório</BotaoLink>}
      </Vazio> : <PainelDoFinanceiro dados={atual} periodo={periodo} hoje={hoje} quem={quem} nomeDeQuem={deQuem === 'advogado' ? nomeDoAdvogado : ''} />}
      <div className="financeiro-abas-linha" id={LUGAR_DAS_LISTAS} ref={listas}>
        <AbasDoFinanceiro />
        {botoes}
      </div>
      {conteudo[aba]()}
    </>;
  }

  return <div className="miolo do-painel">
    {cabeca}
    {barra}
    {corpo}
    {aberto && <PainelCartao aoFechar={fechar} soNoCentro ajustado={aberto.o !== 'entrada'} rotulo={TITULOS[aberto.o]}>
      <header className="cartao-cabeca"><h2>{TITULOS[aberto.o]}</h2></header>
      {/* O botão do alto já aparece enquanto as parcelas carregam. */}
      {aberto.o === 'entrada' && !atual && <Carregando />}
      {aberto.o === 'entrada' && atual && 'parcelas' in atual && <>
        <NovaEntrada parcelas={atual.parcelas} parcelaInicial={aberto.parcela} aoRegistrar={registrou} />
        {admin && <button type="button" className={estiloBotao({ forma: 'link' })} onClick={() => setAberto({ o: 'avulsa' })}>Entrada sem contrato</button>}
      </>}
      {aberto.o === 'avulsa' && <FormDoCaixa tipo="entrada" titulo="Entrada sem contrato" rotulo="Registrar entrada" aoRegistrar={registrou} />}
      {aberto.o === 'saida' && <FormDoCaixa tipo="saida" titulo="Nova saída" rotulo="Registrar saída" aoRegistrar={registrou} />}
      {aberto.o === 'mudar' && atual && 'caixa' in atual && atual.caixa && <DetalheDoLancamento key={aberto.lancamento.id} lancamento={aberto.lancamento} contas={atual.caixa.contas} aoTerminar={() => { fechar(); recarregar(); }} />}
      {aberto.o === 'parcela' && <DetalheDaParcela key={aberto.parcela.id} parcela={aberto.parcela} />}
      {aberto.o === 'contrato' && <ContratoNoFinanceiro key={aberto.contratoId} contratoId={aberto.contratoId} aoMudar={recarregar} />}
    </PainelCartao>}
  </div>;
}

const TITULOS: Record<NonNullable<Aberto>['o'], string> = { entrada: 'Nova entrada', avulsa: 'Entrada sem contrato', saida: 'Nova saída', mudar: 'Lançamento', parcela: 'Parcela recebida', contrato: 'Contrato' };

/**
 * O extrato do caixa de um tipo no período. Clicar numa linha abre o lançamento. O lançamento em destaque (o que a página das contas
 * pediu, #419) fica marcado, e o foco vai para ele, que rola até ficar à vista.
 */
function ListaDoCaixa({ caixa, tipo, periodo, destaque, aoMudar }: { caixa: Caixa; tipo: 'entrada' | 'saida'; periodo: string; destaque?: string | null; aoMudar: (l: Lancamento) => void }) {
  const [busca, setBusca] = useState('');
  const [quantas, setQuantas] = useState(LINHAS_POR_VEZ);
  const lista = filtrarExtrato(caixa.lancamentos, { ...FILTRO_VAZIO, mes: periodo, tipo, busca }).filter(contaNoResultado);
  // O destaque aparece mesmo se estiver depois das primeiras linhas.
  const posicao = destaque ? lista.findIndex(l => l.id === destaque) : -1;
  const mostradas = Math.max(quantas, posicao + 1);
  const emDestaque = useRef<HTMLButtonElement>(null);
  const achou = posicao >= 0;
  useEffect(() => { if (achou) emDestaque.current?.focus(); }, [achou]);
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
        <tbody>{lista.slice(0, mostradas).map(l => {
          const linha = linhaDoCaixa(l);
          const marcada = l.id === destaque;
          return <tr key={l.id} className={marcada ? 'clicavel marcada' : 'clicavel'} aria-current={marcada || undefined} onClick={() => aoMudar(l)}>
          <td>{fmtData(l.data)}</td>
          <td><button type="button" ref={marcada ? emDestaque : undefined} className="financeiro-abrir" aria-label={`Abrir o lançamento: ${l.descricao}`} onClick={e => { e.stopPropagation(); aoMudar(l); }}>{linha.quem}</button>
            {linha.oQue && <span className="sub">{linha.oQue}</span>}</td>
          <td><span className="sub">{linha.categoria}</span></td>
          {caixa.contas.length > 1 && <td>{nomeDaConta.get(l.conta_id)}</td>}
          <td className={'financeiro-num ' + (tipo === 'entrada' ? 'tom-entrada' : 'tom-saida')}>{fmtCentavos(l.valor)}</td>
        </tr>;
        })}</tbody>
        <tfoot><tr><th scope="row" colSpan={caixa.contas.length > 1 ? 4 : 3}>Total</th>
          <td className="financeiro-num"><b>{fmtCentavos(lista.reduce((s, l) => s + l.valor, 0))}</b></td></tr></tfoot>
      </table></div>
      {lista.length > mostradas && <button type="button" className={estiloBotao()} onClick={() => setQuantas(mostradas + LINHAS_POR_VEZ)}>Mostrar mais</button>}
    </> : <Vazio>Nenhuma {tipo === 'entrada' ? 'entrada' : 'saída'} neste período.</Vazio>}
  </section>;
}

/** Entradas: o caixa inteiro para o administrador; as parcelas recebidas de um usuário (ou as suas, para quem não é administrador). */
function Entradas({ caixa, parcelas, periodo, usuario, destaque, aoMudar, aoAbrirParcela }: { caixa: Caixa | null; parcelas: ParcelaDoEscritorio[]; periodo: string; usuario: string; destaque?: string | null; aoMudar: (l: Lancamento) => void; aoAbrirParcela: (p: ParcelaDoEscritorio) => void }) {
  if (caixa && !usuario) return <><ListaDoCaixa caixa={caixa} tipo="entrada" periodo={periodo} destaque={destaque} aoMudar={aoMudar} /></>;
  const lista = entradasDoMes(parcelas, periodo, usuario);
  const maior = maiorParcelaPorContrato(parcelas);
  return <>
    {lista.length ? <div className="tabela"><table className="carteira" aria-label="Parcelas recebidas">
      <thead><tr><th scope="col">Data</th><th scope="col">Contrato</th><th scope="col">Cliente</th><th scope="col">Parcela</th><th scope="col" className="financeiro-num">Valor</th></tr></thead>
      <tbody>{lista.map(p => <tr key={p.id} className="clicavel" onClick={() => aoAbrirParcela(p)}>
        <td><button type="button" className="financeiro-abrir" aria-label={`Abrir a parcela ${numeroDaParcela(p.numero, p.total_parcelas, maior.get(p.contrato_id))} de ${p.contrato_codigo}, recebida em ${fmtData(p.recebida_em!)}`} onClick={e => { e.stopPropagation(); aoAbrirParcela(p); }}>{fmtData(p.recebida_em!)}</button></td><td>{p.contrato_codigo}</td><td className="nome">{p.cliente_nome}</td>
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
  </section>;
}

type Pagar = { chave: string; repasses: Repasse[]; aPassar: ValorAPassar[]; despesas: DespesaDoEscritorio[] } | { chave: string; erro: string };

/**
 * Obrigações: o que ainda vai sair. As despesas do escritório (só o administrador, #439), os repasses que o escritório paga e o que o
 * responsável passa a participantes e indicadores.
 */
function Obrigacoes({ periodo, contas, versao, aoMudar, despesaPedida, aoAbrirPedida }: {
  periodo: string; contas: ContaFinanceira[]; versao: number; aoMudar: () => void; despesaPedida: string | null; aoAbrirPedida: () => void;
}) {
  const ctx = useCtx();
  const admin = ctx.ehAdmin;
  const hoje = hojeISO();
  const [lido, setLido] = useState<Pagar | null>(null);
  const { de, ate } = periodo.length === 4 ? { de: `${periodo}-01-01`, ate: `${periodo}-12-31` } : diasDoMes(periodo);
  const chave = de + '/' + versao;
  useEffect(() => {
    let vivo = true;
    const esta = de + '/' + versao;
    Promise.all([SD.financeiroRepasses(de, ate), SD.financeiroAPassar(de, ate), admin ? SD.financeiroDespesas(de, ate) : []])
      .then(([repasses, aPassar, despesas]) => { if (vivo) setLido({ chave: esta, repasses, aPassar, despesas }); })
      .catch(e => { if (vivo) setLido({ chave: esta, erro: (e as Error).message }); });
    return () => { vivo = false; };
  }, [de, ate, versao, admin]);
  const atual = lido?.chave === chave ? lido : null;
  if (!atual) return <Carregando />;
  if ('erro' in atual) return <Aviso tipo="erro">{atual.erro}</Aviso>;
  return <section className="painel-secao" aria-label="Obrigações">
    {admin && <section aria-label="Despesas do escritório">
      <TituloSecao>Despesas do escritório</TituloSecao>
      <DespesasDoEscritorio lista={atual.despesas} periodo={periodo} hoje={hoje} aoMudar={aoMudar} pedida={despesaPedida} aoAbrirPedida={aoAbrirPedida} />
    </section>}
    <section aria-label="Repasses">
      <TituloSecao>{ctx.ehAdmin ? 'Repasses a advogados e sócios' : 'Seus repasses'}</TituloSecao>
      <Repasses lista={atual.repasses} periodo={periodo} admin={ctx.ehAdmin} contas={contas.filter(c => !c.arquivada_em)} hoje={hoje} aoMudar={aoMudar} />
    </section>
    <section aria-label="A passar a participantes e indicadores">
      <TituloSecao>A passar a participantes e indicadores</TituloSecao>
      <ValoresAPassar lista={atual.aPassar} periodo={periodo} hoje={hoje} aoMudar={aoMudar} />
    </section>
  </section>;
}
