// Lançar: receber a parcela de um contrato ou lançar uma entrada ou saída no caixa, com o resultado ao lado enquanto se digita.
// O recebimento de cliente entra só pela parcela, para não contar duas vezes. Quem não é administrador só recebe parcelas dos
// contratos de que é responsável.
import { useEffect, useId, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import { SD, type ContaFinanceira, type Lancamento, type ParaReceber, type ParcelaDoEscritorio, type TipoDeLancamento } from '../../dados';
import {
  dadosDoLancamento, diasDoMes, ehAjuste, errosDoLancamento, fmtCentavos, lerValor, mesDe, nomeDaCategoria, type FormDoLancamento
} from '../../regras/caixa';
import { CATEGORIAS_DO_LANCAR, carteiraDeContratos } from '../../regras/painelFinanceiro';
import { dadosDoRecebimento, errosDoFormDeRecebimento, linhasDaDivisao, previaDoRecebimento, recebimentoNovo, situacaoDaParcela, type FormDoRecebimento } from '../../regras/parcelas';
import { fmtData } from '../../regras/pessoa';
import { somarDias } from '../../regras/prazos';
import { normal } from '../../regras/texto';
import { falha, feito } from '../../ui/avisos';
import { Aviso, Campo, Carregando, estiloBotao, Indicador, Indicadores, Nota, propsDoCampo, Segmentos, TituloSecao, Vazio, type TomDoIndicador } from '../../ui/base';
import { PaginaModulo } from '../../ui/PaginaModulo';
import { useCtx } from '../../ui/sessao';
import { hojeISO, useTitulo } from '../../ui/util';
import { AbasDoFinanceiro } from './AbasDoFinanceiro';
import { TODAS_AS_DATAS } from './Carteira';
import '../Financeiro.css';

type Modo = 'parcela' | TipoDeLancamento;
const MODOS: Record<Modo, { rotulo: string; soAdmin: boolean }> = {
  parcela: { rotulo: 'Receber parcela', soAdmin: false },
  entrada: { rotulo: 'Outra entrada', soAdmin: true },
  saida: { rotulo: 'Saída', soAdmin: true }
};
/** Quantos contratos a lista de escolha mostra de cada vez: o resto aparece ao buscar. */
const CONTRATOS_NA_ESCOLHA = 80;
/** Os últimos lançamentos ao lado do formulário. */
const ULTIMOS = 6;

export default function Lancar() {
  useTitulo('Financeiro');
  const ctx = useCtx();
  const [params] = useSearchParams();
  const parcelaInicial = params.get('parcela') ?? '';
  const [modo, setModo] = useState<Modo>('parcela');
  const modos = (Object.keys(MODOS) as Modo[]).filter(m => ctx.ehAdmin || !MODOS[m].soAdmin);
  const cabecalho = { titulo: 'Financeiro', visoes: [] };
  if (!ctx.escritorio?.modulos?.financeiro) return <PaginaModulo {...cabecalho}><Aviso tipo="info">O financeiro não está ligado para este escritório.</Aviso></PaginaModulo>;
  return <PaginaModulo {...cabecalho} contador="Lançar">
    <AbasDoFinanceiro />
    {modos.length > 1 && <Segmentos rotulo="O que lançar" atual={modo} aoEscolher={setModo} opcoes={modos.map(m => ({ id: m, rotulo: MODOS[m].rotulo }))} />}
    {modo === 'parcela' ? <ReceberParcela parcelaInicial={parcelaInicial} /> : <LancarNoCaixa key={modo} tipo={modo} />}
  </PaginaModulo>;
}

/** O tom de cada linha da divisão: o que entra em verde, o imposto e a taxa em vermelho. */
const tomDaLinha = (i: number, rotulo: string): TomDoIndicador => i === 0 ? 'entrada' : /^(DAS|Taxa)/.test(rotulo) ? 'saida' : 'neutro';

type Preparo = { chave: string; prep: ParaReceber } | { chave: string; erro: string };

function ReceberParcela({ parcelaInicial }: { parcelaInicial: string }) {
  const { ehAdmin } = useCtx();
  const id = useId();
  const hoje = hojeISO();
  const [abertas, setAbertas] = useState<ParcelaDoEscritorio[] | string | null>(null);
  const [busca, setBusca] = useState('');
  const [contratoId, setContratoId] = useState('');
  const [parcelaId, setParcelaId] = useState(parcelaInicial);
  const [f, setF] = useState<FormDoRecebimento>({ data: hoje, valor: '', contaId: '', taxa: '' });
  const [lido, setLido] = useState<Preparo | null>(null);
  const [conferido, setConferido] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    let vivo = true;
    SD.parcelasDoPeriodo(TODAS_AS_DATAS.de, TODAS_AS_DATAS.ate, hoje)
      .then(x => { if (vivo) setAbertas(x.filter(p => situacaoDaParcela(p, hoje) !== 'recebida')); })
      .catch(e => { if (vivo) setAbertas((e as Error).message); });
    return () => { vivo = false; };
  }, [hoje, versao]);

  const lista = typeof abertas === 'object' && abertas ? abertas : [];
  const parcela = lista.find(p => p.id === parcelaId) ?? null;
  const contratoAtual = parcela?.contrato_id ?? contratoId;
  const dataBoa = !errosDoFormDeRecebimento({ ...f, valor: '1', contaId: 'qualquer' }, false).data;
  const chave = parcela ? parcela.id + '/' + f.data : '';

  // A divisão depende da data: quem era sócio e o DAS do mês. Só vale a leitura mais recente.
  useEffect(() => {
    if (!parcela || !dataBoa) return;
    let vivo = true;
    const esta = parcela.id + '/' + f.data;
    SD.financeiroParaReceber(parcela.id, f.data)
      .then(prep => { if (vivo) setLido({ chave: esta, prep }); })
      .catch(e => { if (vivo) setLido({ chave: esta, erro: (e as Error).message }); });
    return () => { vivo = false; };
  }, [parcela, f.data, dataBoa]);

  if (abertas === null) return <Carregando />;
  if (typeof abertas === 'string') return <Aviso tipo="erro">{abertas}</Aviso>;

  const contratos = carteiraDeContratos(lista, hoje);
  const termo = normal(busca);
  const achados = contratos.filter(c => !termo || normal(`${c.codigo} ${c.cliente}`).includes(termo));
  const doContrato = lista.filter(p => p.contrato_id === contratoAtual).toSorted((a, b) => a.vencimento.localeCompare(b.vencimento) || a.numero - b.numero);
  const atual = lido?.chave === chave ? lido : null;
  const prep = atual && 'prep' in atual ? atual.prep : null;
  // Até a pessoa escolher, vem o valor da parcela e a conta que recolhe DAS.
  const sugerido = parcela && prep ? recebimentoNovo(parcela, f.data, prep.contas) : null;
  const form: FormDoRecebimento = { ...f, valor: f.valor || (sugerido?.valor ?? ''), contaId: f.contaId || (sugerido?.contaId ?? '') };
  const conta = prep?.contas.find(c => c.id === form.contaId);
  const erros = conferido ? errosDoFormDeRecebimento(form, !!conta?.tem_das) : {};
  const previa = prep ? previaDoRecebimento(form, prep) : null;
  const nomes = new Map([...(prep?.terceiros ?? []), ...(prep?.socio_indicador ? [prep.socio_indicador] : [])].map(x => [x.id, x.nome]));
  const linhas = previa && 'divisao' in previa ? linhasDaDivisao(previa.divisao, previa.aliquota, x => nomes.get(x) ?? '', prep!.responsavel_socio, ehAdmin) : [];

  const escolherContrato = (cid: string) => {
    setContratoId(cid); setConferido(false);
    setParcelaId(lista.filter(p => p.contrato_id === cid).toSorted((a, b) => a.vencimento.localeCompare(b.vencimento))[0]?.id ?? '');
    setF(x => ({ ...x, valor: '', contaId: '', taxa: '' }));
  };
  const escolherParcela = (pid: string) => { setParcelaId(pid); setConferido(false); setF(x => ({ ...x, valor: '', taxa: '' })); };
  const mudar = (m: Partial<FormDoRecebimento>) => setF(x => ({ ...x, ...m }));

  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    setConferido(true);
    if (ocupado || !parcela || !prep || !conta || Object.keys(errosDoFormDeRecebimento(form, conta.tem_das)).length || !previa || 'erro' in previa) return;
    setOcupado(true);
    try {
      const { data, valor, contaId, taxa } = dadosDoRecebimento(form, conta.tem_das);
      const novo = await SD.financeiroReceber({ parcela: parcela.id, data, valor, conta: contaId, taxa });
      feito(`Parcela ${parcela.numero} de ${parcela.contrato_codigo} recebida.`, 'recebimento', async () => { await SD.financeiroEstornar(novo); setVersao(v => v + 1); });
      // Fica no mesmo contrato, na próxima parcela, com a mesma data e a mesma conta: dá para lançar várias em seguida.
      const proxima = doContrato.find(p => p.id !== parcela.id);
      setContratoId(parcela.contrato_id); setParcelaId(proxima?.id ?? ''); setConferido(false);
      setF(x => ({ ...x, valor: '', taxa: '', contaId: form.contaId }));
      setVersao(v => v + 1);
    } catch (e) { falha(e); }
    setOcupado(false);
  }

  return <div className="lancar-grade">
    <form className="cartao financeiro-form" noValidate aria-label="Receber parcela" onSubmit={enviar}>
      <TituloSecao>Receber parcela</TituloSecao>
      <Nota>Escolha o contrato e a parcela. A divisão aparece ao lado enquanto você digita, e o caixa recebe a entrada ao registrar.</Nota>
      {!contratos.length ? <Vazio>Nenhuma parcela a receber{ehAdmin ? '' : ' nos contratos de que você é responsável'}.</Vazio> : <>
        <div className="financeiro-form-linha">
          <Campo rotulo="Buscar contrato" para={id + 'busca'}>
            <input type="search" placeholder="Código ou cliente" {...propsDoCampo(id + 'busca')} value={busca} onChange={e => setBusca(e.target.value)} />
          </Campo>
          <Campo rotulo="Contrato" para={id + 'contrato'}>
            <select {...propsDoCampo(id + 'contrato')} value={contratoAtual} onChange={e => escolherContrato(e.target.value)}>
              <option value="">Escolha ({achados.length.toLocaleString('pt-BR')})</option>
              {achados.slice(0, CONTRATOS_NA_ESCOLHA).map(c => <option key={c.contratoId} value={c.contratoId}>{c.codigo} · {c.cliente}{c.atrasado ? ' · com atraso' : ''}</option>)}
              {parcela && !achados.slice(0, CONTRATOS_NA_ESCOLHA).some(c => c.contratoId === parcela.contrato_id) &&
                <option value={parcela.contrato_id}>{parcela.contrato_codigo} · {parcela.cliente_nome}</option>}
            </select>
          </Campo>
          <Campo rotulo="Parcela" para={id + 'parcela'}>
            <select {...propsDoCampo(id + 'parcela')} value={parcela?.id ?? ''} disabled={!doContrato.length} onChange={e => escolherParcela(e.target.value)}>
              {!doContrato.length && <option value="">Escolha o contrato</option>}
              {doContrato.map(p => <option key={p.id} value={p.id}>
                {p.numero}ª · vence {fmtData(p.vencimento)} · {fmtCentavos(p.valor)}{situacaoDaParcela(p, hoje) === 'atrasada' ? ' · atrasada' : ''}
              </option>)}
            </select>
          </Campo>
        </div>
        {parcela && <div className="financeiro-form-linha">
          <Campo rotulo="Data do recebimento" para={id + 'data'} obrigatorio erro={erros.data}>
            <input type="date" {...propsDoCampo(id + 'data', { erro: erros.data })} value={f.data} onChange={e => mudar({ data: e.target.value })} />
          </Campo>
          <Campo rotulo="Valor recebido" para={id + 'valor'} obrigatorio erro={erros.valor}>
            <input type="text" inputMode="decimal" {...propsDoCampo(id + 'valor', { erro: erros.valor })} value={form.valor} onChange={e => mudar({ valor: e.target.value })} />
          </Campo>
          <Campo rotulo="Conta" para={id + 'conta'} erro={erros.contaId}>
            <select {...propsDoCampo(id + 'conta', { erro: erros.contaId })} value={form.contaId} onChange={e => mudar({ contaId: e.target.value })}>
              {prep?.contas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </Campo>
          {conta?.tem_das && <Campo rotulo="Taxa da máquina" para={id + 'taxa'} erro={erros.taxa}>
            <input type="text" inputMode="decimal" placeholder="0,00" {...propsDoCampo(id + 'taxa', { erro: erros.taxa })} value={f.taxa} onChange={e => mudar({ taxa: e.target.value })} />
          </Campo>}
        </div>}
        {atual && 'erro' in atual && <Aviso tipo="erro">{atual.erro}</Aviso>}
        {prep && !prep.contas.length && <Aviso tipo="info">Nenhuma conta ativa. Um administrador cria as contas em Caixa.</Aviso>}
        <button type="submit" className={estiloBotao({ variante: 'principal' })} disabled={ocupado || !prep}>
          {ocupado ? 'Registrando…' : parcela ? `Registrar o recebimento da ${parcela.numero}ª parcela` : 'Registrar recebimento'}
        </button>
      </>}
    </form>

    <aside className="lancar-lado" aria-label="Como fica">
      <section className="cartao lancar-previa" aria-labelledby={id + 'tPrevia'}>
        <TituloSecao id={id + 'tPrevia'}>Como fica a divisão</TituloSecao>
        {!parcela ? <Nota>Escolha uma parcela para ver a divisão.</Nota>
          : previa && 'erro' in previa && previa.erro ? <Aviso tipo="erro">{previa.erro}</Aviso>
          : linhas.length ? <>
            {previa && 'divisao' in previa && previa.aviso && <Aviso tipo="info">{previa.aviso}</Aviso>}
            <Indicadores rotulo="Divisão do recebimento">
              {linhas.map((l, i) => <Indicador key={l.rotulo} tom={tomDaLinha(i, l.rotulo)} rotulo={l.rotulo} valor={fmtCentavos(l.valor)} />)}
            </Indicadores>
          </> : <Nota>Informe a data e o valor para ver a divisão.</Nota>}
      </section>
      {parcela && <Nota>{parcela.contrato_codigo} · {parcela.cliente_nome} · {parcela.numero}ª parcela de {fmtCentavos(parcela.valor)}, vence em {fmtData(parcela.vencimento)}.</Nota>}
    </aside>
  </div>;
}

type Saldo = { chave: string; saldo: number; ultimos: Lancamento[] } | { chave: string; erro: string };

function LancarNoCaixa({ tipo }: { tipo: TipoDeLancamento }) {
  const id = useId();
  const hoje = hojeISO();
  const categorias = CATEGORIAS_DO_LANCAR[tipo];
  const [contas, setContas] = useState<ContaFinanceira[] | string | null>(null);
  const [f, setF] = useState<FormDoLancamento>({ contaId: '', data: hoje, categoria: categorias[0] as FormDoLancamento['categoria'], valor: '', descricao: '' });
  const [lido, setLido] = useState<Saldo | null>(null);
  const [conferido, setConferido] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    let vivo = true;
    SD.financeiroContas().then(c => { if (vivo) setContas(c.filter(x => !x.arquivada_em)); }).catch(e => { if (vivo) setContas((e as Error).message); });
    return () => { vivo = false; };
  }, []);
  const ativas = typeof contas === 'object' && contas ? contas : [];
  const contaId = f.contaId || ativas[0]?.id || '';
  const chave = contaId + '/' + versao;

  // O saldo de hoje e os últimos lançamentos da conta escolhida.
  useEffect(() => {
    if (!contaId) return;
    let vivo = true;
    const { de } = diasDoMes(mesDe(somarDias(hoje, -60)));
    Promise.all([SD.financeiroSaldoAntes(contaId, somarDias(hoje, 1)), SD.financeiroLancamentos(contaId, de, somarDias(hoje, 365))])
      .then(([saldo, l]) => { if (vivo) setLido({ chave: contaId + '/' + versao, saldo, ultimos: l.toSorted((a, b) => b.criado_em.localeCompare(a.criado_em)).slice(0, ULTIMOS) }); })
      .catch(e => { if (vivo) setLido({ chave: contaId + '/' + versao, erro: (e as Error).message }); });
    return () => { vivo = false; };
  }, [contaId, hoje, versao]);

  if (contas === null) return <Carregando />;
  if (typeof contas === 'string') return <Aviso tipo="erro">{contas}</Aviso>;
  if (!ativas.length) return <Vazio>Nenhuma conta ativa. Crie as contas do escritório em Caixa, na seção "Contas".</Vazio>;

  const form = { ...f, contaId };
  const conta = ativas.find(c => c.id === contaId);
  const erros = conferido ? errosDoLancamento(form, conta) : {};
  const valor = lerValor(form.valor);
  const atual = lido?.chave === chave ? lido : null;
  const ajuste = ehAjuste(form.categoria);
  const sinal = tipo === 'entrada' ? 1 : -1;
  const mudar = (m: Partial<FormDoLancamento>) => setF(x => ({ ...x, ...m }));

  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    setConferido(true);
    if (ocupado || Object.keys(errosDoLancamento(form, conta)).length) return;
    setOcupado(true);
    try {
      const novo = await SD.financeiroLancamentoCriar(dadosDoLancamento(form));
      feito(`${tipo === 'entrada' ? 'Entrada' : 'Saída'} lançada em ${conta?.nome}.`, 'lançamento', async () => { await SD.financeiroLancamentoExcluir(novo.id); setVersao(v => v + 1); });
      // Mantém a conta, a data e a categoria: dá para lançar várias em seguida.
      setF(x => ({ ...x, contaId, valor: '', descricao: '' })); setConferido(false); setVersao(v => v + 1);
    } catch (e) { falha(e); }
    setOcupado(false);
  }

  const rotulo = tipo === 'entrada' ? 'Lançar entrada' : 'Lançar saída';
  return <div className="lancar-grade">
    <form className="cartao financeiro-form" noValidate aria-label={rotulo} onSubmit={enviar}>
      <TituloSecao>{tipo === 'entrada' ? 'Outra entrada' : 'Saída'}</TituloSecao>
      <Nota>{tipo === 'entrada' ? 'Dinheiro que entra sem ser parcela de contrato. Recebimento de cliente se lança em "Receber parcela".'
        : 'Despesa, DAS, repasse ou indicação paga pelo escritório.'}</Nota>
      <div className="financeiro-form-linha">
        <Campo rotulo="Conta" para={id + 'conta'} erro={erros.contaId}>
          <select {...propsDoCampo(id + 'conta', { erro: erros.contaId })} value={contaId} onChange={e => mudar({ contaId: e.target.value })}>
            {ativas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Data" para={id + 'data'} obrigatorio erro={erros.data}>
          <input type="date" {...propsDoCampo(id + 'data', { erro: erros.data })} value={f.data} onChange={e => mudar({ data: e.target.value })} />
        </Campo>
        <Campo rotulo="Categoria" para={id + 'cat'}>
          <select {...propsDoCampo(id + 'cat')} value={f.categoria} onChange={e => mudar({ categoria: e.target.value as FormDoLancamento['categoria'] })}>
            {categorias.map(c => <option key={c} value={c}>{nomeDaCategoria(c)}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Valor" para={id + 'valor'} obrigatorio erro={erros.valor}>
          <input type="text" inputMode="decimal" placeholder="0,00" {...propsDoCampo(id + 'valor', { erro: erros.valor })} value={f.valor} onChange={e => mudar({ valor: e.target.value })} />
        </Campo>
      </div>
      <Campo rotulo={ajuste ? 'Motivo do ajuste' : 'Descrição'} para={id + 'desc'} obrigatorio erro={erros.descricao}>
        <input type="text" {...propsDoCampo(id + 'desc', { erro: erros.descricao })} value={f.descricao} onChange={e => mudar({ descricao: e.target.value })} />
      </Campo>
      <button type="submit" className={estiloBotao({ variante: 'principal' })} disabled={ocupado}>{ocupado ? 'Lançando…' : rotulo}</button>
    </form>

    <aside className="lancar-lado" aria-label="Como fica">
      <section className="cartao lancar-previa" aria-labelledby={id + 'tSaldo'}>
        <TituloSecao id={id + 'tSaldo'}>Saldo de {conta?.nome}</TituloSecao>
        {!atual ? <Carregando /> : 'erro' in atual ? <Aviso tipo="erro">{atual.erro}</Aviso> : <Indicadores rotulo="Saldo da conta">
          <Indicador rotulo="Hoje" valor={fmtCentavos(atual.saldo)} />
          <Indicador tom={tipo === 'entrada' ? 'entrada' : 'saida'} rotulo={tipo === 'entrada' ? 'Entra' : 'Sai'} valor={'centavos' in valor ? fmtCentavos(valor.centavos) : '–'} />
          <Indicador tom="destaque" rotulo="Depois deste lançamento" valor={fmtCentavos(atual.saldo + sinal * ('centavos' in valor ? valor.centavos : 0))} />
        </Indicadores>}
      </section>
      {atual && 'ultimos' in atual && atual.ultimos.length > 0 && <section className="cartao" aria-labelledby={id + 'tUlt'}>
        <TituloSecao id={id + 'tUlt'}>Últimos lançamentos</TituloSecao>
        <ul className="lancar-ultimos">{atual.ultimos.map(l => <li key={l.id}>
          <span><b>{l.descricao}</b><span className="sub">{fmtData(l.data)} · {nomeDaCategoria(l.categoria)}</span></span>
          <b className={'num ' + (l.tipo === 'entrada' ? 'tom-entrada' : 'tom-saida')}>{l.tipo === 'entrada' ? '+' : '−'}{' '}{fmtCentavos(l.valor)}</b>
        </li>)}</ul>
      </section>}
    </aside>
  </div>;
}
