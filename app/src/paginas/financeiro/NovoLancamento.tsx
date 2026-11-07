// Os formulários de lançar, abertos na janela flutuante do Financeiro: a entrada de uma parcela de contrato e o lançamento direto no caixa
// (a entrada sem contrato e a saída). Só o formulário: a janela, o título e o fechar ficam com quem abre.
// A entrada (#266) segue a ordem do que acontece: o contrato (com os dados dele, para conferir); o que o cliente pagou (parcela, tipo
// do recebimento, data, valor, forma de pagamento, banco onde o advogado recebeu, juros da máquina); o envio ao escritório (conta PF ou PJ,
// banco de onde sai, parte na conta) e os percentuais de cada um, que vêm do contrato e podem ser ajustados só aqui. A divisão e as
// receitas vão sendo calculadas enquanto se digita; registrado, aparecem os textos de cada um para copiar.
import { useEffect, useId, useState, type FormEvent } from 'react';
import { SD, type CategoriaHonorario, type ContaFinanceira, type Contrato, type FormaDePagamento, type ParaReceber, type ParcelaDoEscritorio, type RecebimentoGravado } from '../../dados';
import { dadosDoLancamento, errosDoLancamento, fmtCentavos, nomeDaCategoria, type FormDoLancamento } from '../../regras/caixa';
import { CATEGORIAS } from '../../regras/contrato';
import { carteiraDeContratos } from '../../regras/painelFinanceiro';
import { dadosDoRecebimento, errosDoFormDeRecebimento, linhasDaDivisao, maiorParcelaPorContrato, numeroDaParcela, previaDoRecebimento, recebimentoNovo, situacaoDaParcela, type FormDoRecebimento } from '../../regras/parcelas';
import { fmtData } from '../../regras/pessoa';
import { BANCOS, codigoDeBancoValido, FORMAS_DE_PAGAMENTO } from '../../regras/recebimento';
import { falha, feito } from '../../ui/avisos';
import { Aviso, Campo, Carregando, estiloBotao, Nota, propsDoCampo, Segmentos, Vazio } from '../../ui/base';
import { useCtx } from '../../ui/sessao';
import { hojeISO } from '../../ui/util';
import { DadosDoContrato, ReceitasETextos } from './DetalheFinanceiro';
import { Divisao } from './Parcelas';

type Preparo = { chave: string; prep: ParaReceber } | { chave: string; erro: string };
/** As partes na conta da empresa que o banco aceita. */
const PARTES: ParaReceber['parte_na_conta'][] = [20, 30, 100];
/** "Outro banco": o código é digitado. */
const OUTRO_BANCO = 'outro';

/** Um banco: escolhido na lista ou, em "Outro", pelo código do Banco Central. */
export function CampoDoBanco({ rotulo, valor, aoMudar }: { rotulo: string; valor: string; aoMudar: (codigo: string) => void }) {
  const id = useId();
  const naLista = !valor || BANCOS.some(b => b.codigo === valor);
  const [outro, setOutro] = useState(!naLista);
  return <Campo rotulo={rotulo} para={id} erro={outro && valor && !codigoDeBancoValido(valor) ? 'O código tem 3 dígitos (ex.: 077).' : undefined}>
    <div className="banco-campo">
      <select {...propsDoCampo(id)} value={outro ? OUTRO_BANCO : valor} onChange={e => { const v = e.target.value; setOutro(v === OUTRO_BANCO); aoMudar(v === OUTRO_BANCO ? '' : v); }}>
        <option value="">—</option>
        {BANCOS.map(b => <option key={b.codigo} value={b.codigo}>{b.codigo} · {b.nome}</option>)}
        <option value={OUTRO_BANCO}>Outro (digitar o código)</option>
      </select>
      {outro && <input type="text" inputMode="numeric" maxLength={3} placeholder="000" aria-label={`${rotulo}: código do banco`} value={valor} onChange={e => aoMudar(e.target.value.replace(/\D/g, ''))} />}
    </div>
  </Campo>;
}

/** A entrada de uma parcela de contrato, completa. */
export function NovaEntrada({ parcelas, parcelaInicial, aoRegistrar }: { parcelas: ParcelaDoEscritorio[]; parcelaInicial?: string; aoRegistrar: () => void }) {
  const id = useId();
  const hoje = hojeISO();
  const { ehAdmin } = useCtx();
  const abertas = parcelas.filter(p => situacaoDaParcela(p, hoje) !== 'recebida');
  const maior = maiorParcelaPorContrato(parcelas);
  const inicial = abertas.find(p => p.id === parcelaInicial);
  const [contrato, setContrato] = useState(inicial ? `${inicial.contrato_codigo} · ${inicial.cliente_nome}` : '');
  const [parcelaId, setParcelaId] = useState(inicial?.id ?? '');
  const [f, setF] = useState<FormDoRecebimento>({ data: hoje, valor: '', contaId: '', taxa: '' });
  const [tipo, setTipo] = useState<CategoriaHonorario | ''>('');
  const [forma, setForma] = useState<FormaDePagamento | ''>('');
  const [bancoRecebido, setBancoRecebido] = useState('');
  const [bancoEnvio, setBancoEnvio] = useState('');
  const [parte, setParte] = useState<ParaReceber['parte_na_conta'] | null>(null);
  const [percentuais, setPercentuais] = useState<Record<string, string>>({});
  const [lido, setLido] = useState<Preparo | null>(null);
  const [conferido, setConferido] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const [k, setK] = useState<Contrato | null>(null);
  const [registrado, setRegistrado] = useState<{ r: RecebimentoGravado; k: Contrato; parcela: string } | null>(null);

  const contratos = carteiraDeContratos(abertas, hoje);
  const escolhido = contratos.find(c => `${c.codigo} · ${c.cliente}` === contrato);
  const doContrato = escolhido ? abertas.filter(p => p.contrato_id === escolhido.contratoId).toSorted((a, b) => a.vencimento.localeCompare(b.vencimento) || a.numero - b.numero) : [];
  const parcela = doContrato.find(p => p.id === parcelaId) ?? doContrato[0] ?? null;
  const dataBoa = !errosDoFormDeRecebimento({ ...f, valor: '1', contaId: 'x' }, false).data;
  const chave = parcela ? parcela.id + '/' + f.data : '';

  // As contas e a divisão dependem da parcela e da data (quem era sócio e o DAS do mês). Só vale a leitura mais recente.
  useEffect(() => {
    if (!parcela || !dataBoa) return;
    let vivo = true;
    const esta = parcela.id + '/' + f.data;
    SD.financeiroParaReceber(parcela.id, f.data)
      .then(prep => { if (vivo) setLido({ chave: esta, prep }); })
      .catch(e => { if (vivo) setLido({ chave: esta, erro: (e as Error).message }); });
    return () => { vivo = false; };
  }, [parcela, f.data, dataBoa]);

  // Os dados do contrato escolhido, para conferir.
  const contratoId = escolhido?.contratoId ?? '';
  useEffect(() => {
    if (!contratoId) return;
    let vivo = true;
    SD.contratoObter(contratoId).then(x => { if (vivo) setK(x); }).catch(() => { if (vivo) setK(null); });
    return () => { vivo = false; };
  }, [contratoId]);

  const atual = lido?.chave === chave ? lido : null;
  const prepDoContrato = atual && 'prep' in atual ? atual.prep : null;
  // O preparo com os percentuais deste recebimento: a parte na conta e os de cada um, ajustados aqui (0 tira a pessoa).
  const pctDe = (t: { id: string; percentual: number }) => { const v = percentuais[t.id]; return v === undefined || v.trim() === '' ? t.percentual : Number(v.replace(',', '.')); };
  const prep: ParaReceber | null = prepDoContrato && {
    ...prepDoContrato, parte_na_conta: parte ?? prepDoContrato.parte_na_conta,
    terceiros: prepDoContrato.terceiros.map(t => ({ ...t, percentual: pctDe(t) })).filter(t => Number.isFinite(t.percentual) && t.percentual > 0)
  };
  const percentualRuim = prepDoContrato?.terceiros.some(t => { const v = pctDe(t); return !Number.isFinite(v) || v < 0 || v > 100; }) ?? false;
  const sugerido = parcela && prep ? recebimentoNovo(parcela, f.data, prep.contas) : null;
  const form: FormDoRecebimento = { ...f, valor: f.valor || (sugerido?.valor ?? ''), contaId: f.contaId || (sugerido?.contaId ?? '') };
  const conta = prep?.contas.find(c => c.id === form.contaId);
  const erros = conferido ? errosDoFormDeRecebimento(form, !!conta?.tem_das) : {};
  const mudar = (m: Partial<FormDoRecebimento>) => { setF(x => ({ ...x, ...m })); setErro(''); };
  // A divisão enquanto se digita: só com o valor e a conta certos.
  const previa = prep && conta && !percentualRuim && !Object.keys(errosDoFormDeRecebimento(form, conta.tem_das)).length ? previaDoRecebimento(form, prep) : null;
  const nomes = new Map([...(prep?.terceiros ?? []), ...(prep?.socio_indicador ? [prep.socio_indicador] : [])].map(x => [x.id, x.nome]));
  const bancoRuim = [bancoRecebido, bancoEnvio].some(b => b && !codigoDeBancoValido(b));
  const nParcela = (p: ParcelaDoEscritorio) => numeroDaParcela(p.numero, p.total_parcelas, maior.get(p.contrato_id));

  function limparContrato() {
    setParcelaId(''); setF(x => ({ ...x, valor: '', contaId: '', taxa: '' })); setTipo(''); setParte(null); setPercentuais({}); setErro('');
  }

  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    setConferido(true);
    if (ocupado || !parcela || !prep || !prepDoContrato || !conta || !k || percentualRuim || bancoRuim || Object.keys(errosDoFormDeRecebimento(form, conta.tem_das)).length) return;
    const previa = previaDoRecebimento(form, prep);
    if ('erro' in previa) { setErro(previa.erro); return; }
    setOcupado(true);
    try {
      const { data, valor, contaId, taxa } = dadosDoRecebimento(form, conta.tem_das);
      const novo = await SD.financeiroReceber({
        parcela: parcela.id, data, valor, conta: contaId, taxa, categoria: tipo || k.categoria, forma: forma || undefined,
        bancoRecebido: bancoRecebido || undefined, bancoEnvio: bancoEnvio || undefined, parte: prep.parte_na_conta,
        percentuais: prepDoContrato.terceiros.map(t => ({ id: t.id, percentual: pctDe(t) }))
      });
      feito(`Entrada registrada: parcela ${nParcela(parcela)} de ${parcela.contrato_codigo}.`, 'entrada', async () => { await SD.financeiroEstornar(novo); setRegistrado(null); aoRegistrar(); });
      const r = await SD.financeiroRecebimento(novo);
      if (r) setRegistrado({ r, k, parcela: nParcela(parcela) });
      setContrato(''); limparContrato(); setForma(''); setBancoRecebido(''); setBancoEnvio(''); setConferido(false);
      aoRegistrar();
    } catch (e) { falha(e); }
    setOcupado(false);
  }

  if (registrado) return <section className="financeiro-detalhe" aria-label="Entrada registrada">
    <p className="financeiro-detalhe-valor tom-entrada">
      <b className="num">{fmtCentavos(registrado.r.valor)}</b>
      <span>Registrada: parcela {registrado.parcela} de {registrado.k.codigo}, em {fmtData(registrado.r.data)}</span>
    </p>
    <ReceitasETextos r={registrado.r} k={registrado.k} parcela={registrado.parcela} />
    <div className="financeiro-acoes">
      <button type="button" className={estiloBotao({ variante: 'principal' })} onClick={() => setRegistrado(null)}>Lançar outra entrada</button>
    </div>
  </section>;

  return <form className="financeiro-form entrada-completa" noValidate aria-label="Nova entrada" onSubmit={enviar}>
    <section className="financeiro-grupo" aria-labelledby={id + 'g1'}>
      <span className="rotulo-caps" id={id + 'g1'}>Contrato</span>
      <Campo rotulo="Buscar o contrato" para={id + 'contrato'}>
        <input type="text" list={id + 'contratos'} placeholder="Código ou cliente" autoComplete="off" {...propsDoCampo(id + 'contrato')} value={contrato}
          onChange={e => { setContrato(e.target.value); limparContrato(); }} />
        <datalist id={id + 'contratos'}>{contratos.map(c => <option key={c.contratoId} value={`${c.codigo} · ${c.cliente}`} />)}</datalist>
      </Campo>
      {k && k.id === contratoId && <DadosDoContrato titulo="Confira os dados do contrato" k={k} parcela={parcela} parcelas={parcelas.filter(p => p.contrato_id === k.id)} />}
    </section>

    <section className="financeiro-grupo" aria-labelledby={id + 'g2'}>
      <span className="rotulo-caps" id={id + 'g2'}>O que o cliente pagou</span>
      <div className="financeiro-form-linha">
        <Campo rotulo="Parcela" para={id + 'parcela'}>
          <select {...propsDoCampo(id + 'parcela')} value={parcela?.id ?? ''} disabled={!doContrato.length} onChange={e => { setParcelaId(e.target.value); mudar({ valor: '', taxa: '' }); }}>
            {!doContrato.length && <option value="">Escolha o contrato</option>}
            {doContrato.map(p => <option key={p.id} value={p.id}>{nParcela(p)} · vence {fmtData(p.vencimento)} · {fmtCentavos(p.valor)}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Tipo do recebimento" para={id + 'tipo'}>
          <select {...propsDoCampo(id + 'tipo')} value={tipo || k?.categoria || ''} disabled={!k} onChange={e => setTipo(e.target.value as CategoriaHonorario)}>
            {!k && <option value="">—</option>}
            {(Object.keys(CATEGORIAS) as CategoriaHonorario[]).map(c => <option key={c} value={c}>{CATEGORIAS[c]}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Data do pagamento" para={id + 'data'} obrigatorio erro={erros.data}>
          <input type="date" {...propsDoCampo(id + 'data', { erro: erros.data })} value={f.data} onChange={e => mudar({ data: e.target.value })} />
        </Campo>
        <Campo rotulo="Valor pago" para={id + 'valor'} obrigatorio erro={erros.valor}>
          <input type="text" inputMode="decimal" placeholder="0,00" {...propsDoCampo(id + 'valor', { erro: erros.valor })} value={form.valor} onChange={e => mudar({ valor: e.target.value })} />
        </Campo>
        <Campo rotulo="Forma de pagamento" para={id + 'forma'}>
          <select {...propsDoCampo(id + 'forma')} value={forma} onChange={e => setForma(e.target.value as FormaDePagamento)}>
            <option value="">—</option>
            {(Object.keys(FORMAS_DE_PAGAMENTO) as FormaDePagamento[]).map(x => <option key={x} value={x}>{FORMAS_DE_PAGAMENTO[x]}</option>)}
          </select>
        </Campo>
        <CampoDoBanco rotulo="Banco onde recebeu" valor={bancoRecebido} aoMudar={setBancoRecebido} />
        {conta?.tem_das && <Campo rotulo="Juros da máquina" para={id + 'taxa'} erro={erros.taxa}>
          <input type="text" inputMode="decimal" placeholder="0,00" {...propsDoCampo(id + 'taxa', { erro: erros.taxa })} value={f.taxa} onChange={e => mudar({ taxa: e.target.value })} />
        </Campo>}
      </div>
      <Nota>Tipo do recebimento: num contrato misto, escolha o deste pagamento. Banco onde recebeu: onde o valor todo entrou (fica só como registro).</Nota>
    </section>

    <section className="financeiro-grupo" aria-labelledby={id + 'g3'}>
      <span className="rotulo-caps" id={id + 'g3'}>Envio ao escritório</span>
      <div className="financeiro-form-linha">
        <Campo rotulo="Conta" para={id + 'conta'} erro={erros.contaId}>
          <select {...propsDoCampo(id + 'conta', { erro: erros.contaId })} value={form.contaId} disabled={!prep} onChange={e => mudar({ contaId: e.target.value })}>
            {!prep && <option value="">—</option>}
            {prep?.contas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </Campo>
        <CampoDoBanco rotulo="Banco de envio" valor={bancoEnvio} aoMudar={setBancoEnvio} />
      </div>
      {prep && <div className="entrada-percentuais">
        <Segmentos rotulo="Parte na conta da empresa" atual={String(prep.parte_na_conta)} aoEscolher={v => setParte(Number(v) as ParaReceber['parte_na_conta'])}
          opcoes={PARTES.map(p => ({ id: String(p), rotulo: `${p}% do que o cliente pagou` }))} />
        {prepDoContrato!.terceiros.length > 0 && <div className="financeiro-form-linha">
          {prepDoContrato!.terceiros.map(t => <Campo key={t.id} rotulo={`% de ${t.nome} (${t.papel === 'indicador' ? 'indicador' : 'participante'})`} para={id + 'pct' + t.id}>
            <input type="text" inputMode="decimal" {...propsDoCampo(id + 'pct' + t.id)} value={percentuais[t.id] ?? String(t.percentual).replace('.', ',')}
              onChange={e => setPercentuais(x => ({ ...x, [t.id]: e.target.value }))} />
          </Campo>)}
        </div>}
        {percentualRuim && <Aviso tipo="erro">Cada percentual precisa ficar entre 0 e 100.</Aviso>}
      </div>}
    </section>

    {previa && 'erro' in previa && previa.erro && <Aviso tipo="info">{previa.erro}</Aviso>}
    {previa && 'divisao' in previa && <section className="financeiro-grupo" aria-labelledby={id + 'g4'}>
      <span className="rotulo-caps" id={id + 'g4'}>Como vai ficar a divisão</span>
      {previa.aviso && <Aviso tipo="info">{previa.aviso}</Aviso>}
      <Divisao rotulo="Como vai ficar a divisão" linhas={linhasDaDivisao(previa.divisao, previa.aliquota, x => nomes.get(x) ?? '', prep!.responsavel_socio, ehAdmin)} />
      <dl className="entrada-receitas">
        <div><dt>Receita bruta</dt><dd className="num">{fmtCentavos(dadosDoRecebimento(form, !!conta?.tem_das).valor)}</dd></div>
        <div><dt>Receita líquida do responsável</dt><dd className="num">{fmtCentavos(previa.divisao.responsavelFica)}</dd></div>
      </dl>
    </section>}
    {(erro || (atual && 'erro' in atual)) && <Aviso tipo="erro">{erro || (atual && 'erro' in atual ? atual.erro : '')}</Aviso>}
    <div className="financeiro-acoes">
      <button type="submit" className={estiloBotao({ variante: 'principal' })} disabled={ocupado || !parcela}>{ocupado ? 'Registrando…' : 'Registrar entrada'}</button>
    </div>
  </form>;
}

/** O formulário do caixa, para a entrada sem contrato e para a saída. */
export function FormDoCaixa({ tipo, titulo, rotulo, aoRegistrar }: { tipo: 'entrada' | 'saida'; titulo: string; rotulo: string; aoRegistrar?: () => void }) {
  const id = useId();
  const hoje = hojeISO();
  const categorias = tipo === 'entrada' ? (['outra_entrada'] as const) : (['despesa', 'das', 'repasse', 'indicacao'] as const);
  const [contas, setContas] = useState<ContaFinanceira[] | string | null>(null);
  const [f, setF] = useState<FormDoLancamento>({ contaId: '', data: hoje, categoria: categorias[0], valor: '', descricao: '' });
  const [conferido, setConferido] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let vivo = true;
    SD.financeiroContas().then(c => { if (vivo) setContas(c.filter(x => !x.arquivada_em)); }).catch(e => { if (vivo) setContas((e as Error).message); });
    return () => { vivo = false; };
  }, []);
  if (contas === null) return <Carregando />;
  if (typeof contas === 'string') return <Aviso tipo="erro">{contas}</Aviso>;
  if (!contas.length) return <Vazio>Nenhuma conta ativa. Crie as contas do escritório em Caixa.</Vazio>;

  const form = { ...f, contaId: f.contaId || contas[0].id };
  const conta = contas.find(c => c.id === form.contaId);
  const erros = conferido ? errosDoLancamento(form, conta) : {};
  const mudar = (m: Partial<FormDoLancamento>) => setF(x => ({ ...x, ...m }));

  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    setConferido(true);
    if (ocupado || Object.keys(errosDoLancamento(form, conta)).length) return;
    setOcupado(true);
    try {
      const novo = await SD.financeiroLancamentoCriar(dadosDoLancamento(form));
      feito(`${tipo === 'entrada' ? 'Entrada' : 'Saída'} registrada em ${conta?.nome}.`, tipo, async () => { await SD.financeiroLancamentoExcluir(novo.id); aoRegistrar?.(); });
      setF(x => ({ ...x, contaId: form.contaId, valor: '', descricao: '' })); setConferido(false);
      aoRegistrar?.();
    } catch (e) { falha(e); }
    setOcupado(false);
  }

  return <form className="financeiro-form" noValidate aria-label={titulo} onSubmit={enviar}>
    <div className="financeiro-form-linha">
      <Campo rotulo="Data" para={id + 'data'} obrigatorio erro={erros.data}>
        <input type="date" {...propsDoCampo(id + 'data', { erro: erros.data })} value={f.data} onChange={e => mudar({ data: e.target.value })} />
      </Campo>
      <Campo rotulo="Valor" para={id + 'valor'} obrigatorio erro={erros.valor}>
        <input type="text" inputMode="decimal" placeholder="0,00" {...propsDoCampo(id + 'valor', { erro: erros.valor })} value={f.valor} onChange={e => mudar({ valor: e.target.value })} />
      </Campo>
      <Campo rotulo="Conta" para={id + 'conta'} erro={erros.contaId}>
        <select {...propsDoCampo(id + 'conta', { erro: erros.contaId })} value={form.contaId} onChange={e => mudar({ contaId: e.target.value })}>
          {contas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </Campo>
      {categorias.length > 1 && <Campo rotulo="Tipo" para={id + 'cat'}>
        <select {...propsDoCampo(id + 'cat')} value={f.categoria} onChange={e => mudar({ categoria: e.target.value as FormDoLancamento['categoria'] })}>
          {categorias.map(c => <option key={c} value={c}>{nomeDaCategoria(c)}</option>)}
        </select>
      </Campo>}
      <Campo rotulo="Descrição" para={id + 'desc'} obrigatorio erro={erros.descricao}>
        <input type="text" {...propsDoCampo(id + 'desc', { erro: erros.descricao })} value={f.descricao} onChange={e => mudar({ descricao: e.target.value })} />
      </Campo>
    </div>
    <div className="financeiro-acoes">
      <button type="submit" className={estiloBotao({ variante: 'principal' })} disabled={ocupado}>{ocupado ? 'Registrando…' : rotulo}</button>
    </div>
  </form>;
}
