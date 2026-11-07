// O que a janela flutuante do Financeiro mostra ao clicar numa linha. Primeiro tudo o que se sabe, como numa linha da
// planilha (contrato, cliente, objetos, categoria, responsável, participantes, indicador, parcela "1/10", conta, data,
// valor, taxa da máquina, DAS, a divisão de cada parte e, no que veio de uma planilha, as colunas dela); só depois, e
// só no que pode mudar, o formulário de editar.
//   - DetalheDoLancamento: uma entrada ou saída do caixa.
//   - DetalheDaParcela: uma parcela recebida (a lista de quem não é administrador).
//   - ContratoNoFinanceiro: um contrato da aba Receitas, com as parcelas para receber ou corrigir.
import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { SD, type ContaFinanceira, type Contrato, type Lancamento, type Parcela, type RecebimentoGravado } from '../../dados';
import { fmtCentavos, formDoLancamento, nomeDaCategoria } from '../../regras/caixa';
import { CATEGORIAS, fmtDinheiro, fmtPercentual } from '../../regras/contrato';
import { divisaoGravada, linhasDaDivisao, maiorParcelaPorContrato, nomesDoRecebimento, numeroDaParcela } from '../../regras/parcelas';
import { fmtData } from '../../regras/pessoa';
import { falha, feito } from '../../ui/avisos';
import { Aviso, Carregando, estiloBotao, Nota } from '../../ui/base';
import { BotaoDuplo } from '../../ui/Botoes';
import { Icone } from '../../ui/Icone';
import { useCtx } from '../../ui/sessao';
import { FormLancamento } from './Formularios';
import { Divisao, ParcelasDoContrato } from './Parcelas';

/** O lançamento que nasce de uma parcela, de um repasse ou do lucro só muda por lá. */
const ORIGEM: Record<NonNullable<Lancamento['origem']>, string> = {
  recebimento: 'Este lançamento veio do recebimento de uma parcela: para mudar, estorne a parcela no contrato.',
  repasse: 'Este lançamento veio do pagamento de um repasse: para mudar, desfaça o pagamento em Despesas.',
  lucro: 'Este lançamento veio do pagamento de lucro: para mudar, desfaça o pagamento em Lucro dos sócios.'
};

type Linha = [string, ReactNode];
/** Um grupo de dados, com o nome em cima (como no cartão do contrato). Linhas sem valor não aparecem. */
function Grupo({ titulo, linhas }: { titulo: string; linhas: Linha[] }) {
  const cheias = linhas.filter(([, v]) => v !== null && v !== undefined && v !== '' && v !== false);
  if (!cheias.length) return null;
  return <section className="financeiro-grupo" aria-label={titulo}>
    <span className="rotulo-caps">{titulo}</span>
    <dl className="dados">{cheias.map(([r, v]) => <Fragment key={r}><dt>{r}</dt><dd>{v}</dd></Fragment>)}</dl>
  </section>;
}

/** O contrato e a parcela: quem, o quê, quem cuida, quanto foi contratado. */
export function DadosDoContrato({ k, parcela, parcelas }: { k: Contrato; parcela?: Parcela | null; parcelas?: Parcela[] }) {
  const ctx = useCtx();
  const nomeDe = (id: string) => ctx.equipe.find(m => m.id === id)?.nome ?? 'Usuário removido';
  const maior = parcelas ? maiorParcelaPorContrato(parcelas).get(k.id) : undefined;
  return <Grupo titulo="Contrato" linhas={[
    ['Contrato', <Link key="k" to={'/contratos/?id=' + k.id}>{k.codigo}</Link>],
    [k.clientes.length > 1 ? 'Clientes' : 'Cliente', <span key="c" className="financeiro-links">{k.clientes.map(c => <Link key={c.id} to={'/pessoas/?id=' + c.id}>{c.nome}</Link>)}</span>],
    [k.objetos.length > 1 ? 'Objetos / demandas' : 'Objeto / demanda', k.objetos.join('; ')],
    ['Categoria', CATEGORIAS[k.categoria]],
    ['Responsável', nomeDe(k.responsavel_id)],
    [k.participantes.length > 1 ? 'Participantes' : 'Participante', k.participantes.map(p => `${p.pessoa.nome}${p.percentual === null ? '' : ` (${fmtPercentual(p.percentual)})`}`).join(', ')],
    ['Indicador', k.indicador ? `${k.indicador.nome}${k.indicador_percentual === null ? '' : ` (${fmtPercentual(k.indicador_percentual)})`}` : ''],
    ['Parte enviada à conta da empresa', fmtPercentual(k.percentual_escritorio)],
    ['Valor do contrato', k.valor === null ? '' : fmtDinheiro(k.valor)],
    ['Parcela', parcela ? numeroDaParcela(parcela.numero, k.parcelas, maior) : '']
  ]} />;
}

/** O pagamento e a divisão gravados no recebimento. */
function DadosDoRecebimento({ r, conta }: { r: RecebimentoGravado; conta?: string }) {
  const { ehAdmin } = useCtx();
  const nomes = nomesDoRecebimento(r);
  return <>
    <Grupo titulo="Pagamento" linhas={[
      ['Data', fmtData(r.data)],
      ['Valor pago', fmtCentavos(r.valor)],
      ['Conta', conta ?? ''],
      ['Taxa da máquina (juros)', r.taxa_maquina ? fmtCentavos(r.taxa_maquina) : ''],
      ['Parte na conta da empresa', fmtPercentual(r.parte_na_conta)],
      ['DAS', r.aliquota_das ? fmtPercentual(r.aliquota_das) : '']
    ]} />
    <section className="financeiro-grupo" aria-label="Divisão">
      <span className="rotulo-caps">Divisão</span>
      <Divisao rotulo="Como ficou a divisão" linhas={linhasDaDivisao(divisaoGravada(r), r.aliquota_das, x => nomes.get(x) ?? '', r.responsavel_socio, ehAdmin)} />
    </section>
  </>;
}

type Ligado = { k: Contrato | null; parcelas: Parcela[]; r: RecebimentoGravado | null };
/** O contrato e as parcelas dele, junto do recebimento (quando há). */
async function comContrato(r: RecebimentoGravado | null, contratoId?: string): Promise<Ligado> {
  const id = r?.contrato_id ?? contratoId;
  if (!id) return { k: null, parcelas: [], r };
  const [k, parcelas] = await Promise.all([SD.contratoObter(id), SD.parcelasDoContrato(id)]);
  return { k, parcelas, r };
}
/** Lê o que a janela mostra; "chave" diz quando ler de novo (outra linha, ou algo mudou). */
function useLigado(ler: () => Promise<Ligado>, chave: string): Ligado | string | null {
  const [lido, setLido] = useState<{ chave: string; valor: Ligado | string } | null>(null);
  const leitura = useRef(ler);
  leitura.current = ler;
  useEffect(() => {
    let vivo = true;
    leitura.current().then(x => { if (vivo) setLido({ chave, valor: x }); }).catch(e => { if (vivo) setLido({ chave, valor: (e as Error).message }); });
    return () => { vivo = false; };
  }, [chave]);
  return lido?.chave === chave ? lido.valor : null;
}

/** Uma entrada ou saída do caixa: tudo o que se sabe dela e, se puder mudar, o botão de editar e o de excluir. */
export function DetalheDoLancamento({ lancamento: l, contas, aoTerminar }: { lancamento: Lancamento; contas: ContaFinanceira[]; aoTerminar: () => void }) {
  const [editando, setEditando] = useState(false);
  const ligado = useLigado(async () => comContrato(l.origem === 'recebimento' ? await SD.financeiroRecebimentoDoLancamento(l.id) : null), l.id);
  const conta = contas.find(c => c.id === l.conta_id)?.nome;
  const podeMudar = !l.origem;

  async function excluir() {
    try {
      await SD.financeiroLancamentoExcluir(l.id);
      feito('Lançamento excluído.', 'exclusão do lançamento', async () => { await SD.financeiroLancamentoRestaurar(l.id); });
      aoTerminar();
    } catch (e) { falha(e); }
  }

  if (editando && podeMudar && !l.par_id) {
    return <FormLancamento alvo={l} inicial={formDoLancamento(l)} contas={contas.filter(c => !c.arquivada_em || c.id === l.conta_id)} aoTerminar={aoTerminar} aoCancelar={() => setEditando(false)} />;
  }
  return <div className="financeiro-detalhe">
    <p className={'financeiro-detalhe-valor ' + (l.tipo === 'entrada' ? 'tom-entrada' : 'tom-saida')}>
      <b className="num">{l.tipo === 'entrada' ? '+' : '−'} {fmtCentavos(l.valor)}</b>
      <span>{l.tipo === 'entrada' ? 'Entrada' : 'Saída'} em {fmtData(l.data)}{conta ? ` · ${conta}` : ''}</span>
    </p>
    {ligado === null ? <Carregando /> : typeof ligado === 'string' ? <Aviso tipo="erro">{ligado}</Aviso> : <>
      {ligado.k && <DadosDoContrato k={ligado.k} parcela={ligado.parcelas.find(p => p.id === ligado.r?.parcela_id)} parcelas={ligado.parcelas} />}
      {ligado.r && <DadosDoRecebimento r={ligado.r} conta={conta} />}
    </>}
    <Grupo titulo="No caixa" linhas={[['Categoria', nomeDaCategoria(l.categoria)], ['Conta', conta ?? ''], ['Descrição', l.descricao]]} />
    {!!l.planilha?.length && <Grupo titulo="Da planilha de origem" linhas={l.planilha.map(([coluna, valor]) => [coluna, valor])} />}
    {l.origem && <Nota>{ORIGEM[l.origem]}</Nota>}
    {l.par_id && <Nota>Este é um repasse entre contas: só dá para excluir, e as duas pontas saem juntas.</Nota>}
    {podeMudar && <div className="financeiro-acoes">
      {!l.par_id && <button type="button" className={estiloBotao({ variante: 'principal' })} onClick={() => setEditando(true)}><Icone nome="editar" tam={14} /> Editar lançamento</button>}
      <BotaoDuplo variante="perigo" confirmar={l.par_id ? 'Confirmar: excluir as duas pontas' : 'Confirmar: excluir'} aoConfirmar={excluir}><Icone nome="lixeira" tam={14} /> Excluir</BotaoDuplo>
    </div>}
  </div>;
}

/** Uma parcela recebida: o contrato, o pagamento e a divisão. */
export function DetalheDaParcela({ parcela }: { parcela: Parcela }) {
  const ligado = useLigado(async () => comContrato(parcela.recebimento_id ? await SD.financeiroRecebimento(parcela.recebimento_id) : null, parcela.contrato_id), parcela.id);
  if (ligado === null) return <Carregando />;
  if (typeof ligado === 'string') return <Aviso tipo="erro">{ligado}</Aviso>;
  return <div className="financeiro-detalhe">
    <p className="financeiro-detalhe-valor tom-entrada">
      <b className="num">{fmtCentavos(parcela.recebido ?? parcela.valor)}</b>
      <span>{parcela.recebida_em ? `Recebida em ${fmtData(parcela.recebida_em)}` : `Vence em ${fmtData(parcela.vencimento)}`}</span>
    </p>
    {ligado.k && <DadosDoContrato k={ligado.k} parcela={parcela} parcelas={ligado.parcelas} />}
    {ligado.r ? <DadosDoRecebimento r={ligado.r} /> : parcela.recebida_em && <Nota>Recebida antes do caixa do SEMPER (histórico importado): não há divisão gravada.</Nota>}
  </div>;
}

/** Um contrato da carteira (aba Receitas): os dados dele e as parcelas, para receber ou corrigir cada uma. */
export function ContratoNoFinanceiro({ contratoId }: { contratoId: string }) {
  const [versao, setVersao] = useState(0);
  const ligado = useLigado(() => comContrato(null, contratoId), `${contratoId}:${versao}`);
  if (ligado === null) return <Carregando />;
  if (typeof ligado === 'string') return <Aviso tipo="erro">{ligado}</Aviso>;
  if (!ligado.k) return <Aviso tipo="erro">Este contrato não foi encontrado.</Aviso>;
  return <div className="financeiro-detalhe">
    <DadosDoContrato k={ligado.k} parcelas={ligado.parcelas} />
    <section className="financeiro-grupo" aria-label="Parcelas">
      <span className="rotulo-caps">Parcelas</span>
      <ParcelasDoContrato k={ligado.k} versao={versao} aoMudar={() => setVersao(v => v + 1)} />
    </section>
  </div>;
}
