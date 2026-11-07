// Os formulários de lançar, abertos na janela flutuante do Financeiro: a entrada de uma parcela de contrato e o lançamento direto no caixa
// (a entrada sem contrato e a saída). Só o formulário: a janela, o título e o fechar ficam com quem abre.
import { useEffect, useId, useState, type FormEvent } from 'react';
import { SD, type ContaFinanceira, type ParaReceber, type ParcelaDoEscritorio } from '../../dados';
import { dadosDoLancamento, errosDoLancamento, fmtCentavos, nomeDaCategoria, type FormDoLancamento } from '../../regras/caixa';
import { carteiraDeContratos } from '../../regras/painelFinanceiro';
import { dadosDoRecebimento, errosDoFormDeRecebimento, maiorParcelaPorContrato, numeroDaParcela, previaDoRecebimento, recebimentoNovo, situacaoDaParcela, type FormDoRecebimento } from '../../regras/parcelas';
import { fmtData } from '../../regras/pessoa';
import { falha, feito } from '../../ui/avisos';
import { Aviso, Campo, Carregando, estiloBotao, propsDoCampo, Vazio } from '../../ui/base';
import { hojeISO } from '../../ui/util';

type Preparo = { chave: string; prep: ParaReceber } | { chave: string; erro: string };

/** A entrada de uma parcela: o contrato, a parcela, a data, o valor e a conta. */
export function NovaEntrada({ parcelas, parcelaInicial, aoRegistrar }: { parcelas: ParcelaDoEscritorio[]; parcelaInicial?: string; aoRegistrar: () => void }) {
  const id = useId();
  const hoje = hojeISO();
  const abertas = parcelas.filter(p => situacaoDaParcela(p, hoje) !== 'recebida');
  const maior = maiorParcelaPorContrato(parcelas);
  const inicial = abertas.find(p => p.id === parcelaInicial);
  const [contrato, setContrato] = useState(inicial ? `${inicial.contrato_codigo} · ${inicial.cliente_nome}` : '');
  const [parcelaId, setParcelaId] = useState(inicial?.id ?? '');
  const [f, setF] = useState<FormDoRecebimento>({ data: hoje, valor: '', contaId: '', taxa: '' });
  const [lido, setLido] = useState<Preparo | null>(null);
  const [conferido, setConferido] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');

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

  const atual = lido?.chave === chave ? lido : null;
  const prep = atual && 'prep' in atual ? atual.prep : null;
  const sugerido = parcela && prep ? recebimentoNovo(parcela, f.data, prep.contas) : null;
  const form: FormDoRecebimento = { ...f, valor: f.valor || (sugerido?.valor ?? ''), contaId: f.contaId || (sugerido?.contaId ?? '') };
  const conta = prep?.contas.find(c => c.id === form.contaId);
  const erros = conferido ? errosDoFormDeRecebimento(form, !!conta?.tem_das) : {};
  const mudar = (m: Partial<FormDoRecebimento>) => { setF(x => ({ ...x, ...m })); setErro(''); };

  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    setConferido(true);
    if (ocupado || !parcela || !prep || !conta || Object.keys(errosDoFormDeRecebimento(form, conta.tem_das)).length) return;
    const previa = previaDoRecebimento(form, prep);
    if ('erro' in previa) { setErro(previa.erro); return; }
    setOcupado(true);
    try {
      const { data, valor, contaId, taxa } = dadosDoRecebimento(form, conta.tem_das);
      const novo = await SD.financeiroReceber({ parcela: parcela.id, data, valor, conta: contaId, taxa });
      feito(`Entrada registrada: parcela ${numeroDaParcela(parcela.numero, parcela.total_parcelas, maior.get(parcela.contrato_id))} de ${parcela.contrato_codigo}.`, 'entrada', async () => { await SD.financeiroEstornar(novo); aoRegistrar(); });
      setParcelaId(''); setConferido(false); setF(x => ({ ...x, valor: '', taxa: '', contaId: form.contaId }));
      aoRegistrar();
    } catch (e) { falha(e); }
    setOcupado(false);
  }

  return <form className="financeiro-form" noValidate aria-label="Nova entrada" onSubmit={enviar}>
    <div className="financeiro-form-linha">
      <Campo rotulo="Contrato" para={id + 'contrato'}>
        <input type="text" list={id + 'contratos'} placeholder="Código ou cliente" autoComplete="off" {...propsDoCampo(id + 'contrato')} value={contrato}
          onChange={e => { setContrato(e.target.value); setParcelaId(''); setF(x => ({ ...x, valor: '', contaId: '', taxa: '' })); setErro(''); }} />
        <datalist id={id + 'contratos'}>{contratos.map(c => <option key={c.contratoId} value={`${c.codigo} · ${c.cliente}`} />)}</datalist>
      </Campo>
      <Campo rotulo="Parcela" para={id + 'parcela'}>
        <select {...propsDoCampo(id + 'parcela')} value={parcela?.id ?? ''} disabled={!doContrato.length} onChange={e => { setParcelaId(e.target.value); mudar({ valor: '', taxa: '' }); }}>
          {!doContrato.length && <option value="">Escolha o contrato</option>}
          {doContrato.map(p => <option key={p.id} value={p.id}>{numeroDaParcela(p.numero, p.total_parcelas, maior.get(p.contrato_id))} · vence {fmtData(p.vencimento)} · {fmtCentavos(p.valor)}</option>)}
        </select>
      </Campo>
      <Campo rotulo="Data" para={id + 'data'} obrigatorio erro={erros.data}>
        <input type="date" {...propsDoCampo(id + 'data', { erro: erros.data })} value={f.data} onChange={e => mudar({ data: e.target.value })} />
      </Campo>
      <Campo rotulo="Valor" para={id + 'valor'} obrigatorio erro={erros.valor}>
        <input type="text" inputMode="decimal" placeholder="0,00" {...propsDoCampo(id + 'valor', { erro: erros.valor })} value={form.valor} onChange={e => mudar({ valor: e.target.value })} />
      </Campo>
      <Campo rotulo="Conta" para={id + 'conta'} erro={erros.contaId}>
        <select {...propsDoCampo(id + 'conta', { erro: erros.contaId })} value={form.contaId} disabled={!prep} onChange={e => mudar({ contaId: e.target.value })}>
          {!prep && <option value="">–</option>}
          {prep?.contas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </Campo>
      {conta?.tem_das && <Campo rotulo="Taxa da máquina" para={id + 'taxa'} erro={erros.taxa}>
        <input type="text" inputMode="decimal" placeholder="0,00" {...propsDoCampo(id + 'taxa', { erro: erros.taxa })} value={f.taxa} onChange={e => mudar({ taxa: e.target.value })} />
      </Campo>}
    </div>
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
