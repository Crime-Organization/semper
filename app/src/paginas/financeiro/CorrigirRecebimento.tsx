// Corrigir uma parcela já recebida (#267). Primeiro pergunta ao banco se algum valor daquele recebimento já foi pago:
//   - nada pago: o formulário vem preenchido com o que foi registrado; salvar estorna o original (que fica no histórico) e
//     registra o novo, refazendo divisão, caixa e repasses, com o motivo;
//   - já há pagamento: o original fica como está, e um administrador lança o registro de correção, uma saída do caixa
//     ligada ao recebimento, com o motivo (quem não é administrador vê o porquê e a quem pedir).
import { useEffect, useId, useState, type FormEvent } from 'react';
import { SD, type CategoriaHonorario, type ContaFinanceira, type FormaDePagamento, type Parcela, type ParaReceber, type RecebimentoGravado } from '../../dados';
import { centavosNoCampo, fmtCentavos } from '../../regras/caixa';
import { CATEGORIAS } from '../../regras/contrato';
import { dadosDoRecebimento, errosDoFormDeRecebimento, lerCentavos, linhasDaDivisao, previaDoRecebimento, type FormDoRecebimento } from '../../regras/parcelas';
import { codigoDeBancoValido, FORMAS_DE_PAGAMENTO } from '../../regras/recebimento';
import { avisar, falha, feito } from '../../ui/avisos';
import { Aviso, Campo, Carregando, estiloBotao, Nota, propsDoCampo, Segmentos } from '../../ui/base';
import { useCtx } from '../../ui/sessao';
import { hojeISO } from '../../ui/util';
import { CampoDoBanco } from './NovoLancamento';
import { Divisao } from './Parcelas';

const PARTES: ParaReceber['parte_na_conta'][] = [20, 30, 100];

type Lido = { r: RecebimentoGravado; pago: boolean } | string | null;

export function CorrigirRecebimento({ recebimentoId, parcela, aoTerminar, aoCancelar }: { recebimentoId: string; parcela: Parcela; aoTerminar: () => void; aoCancelar: () => void }) {
  const [lido, setLido] = useState<Lido>(null);
  useEffect(() => {
    let vivo = true;
    Promise.all([SD.financeiroRecebimento(recebimentoId), SD.financeiroRecebimentoTemPagamento(recebimentoId)])
      .then(([r, pago]) => { if (vivo) setLido(r ? { r, pago } : 'Este recebimento não foi encontrado.'); })
      .catch(e => { if (vivo) setLido((e as Error).message); });
    return () => { vivo = false; };
  }, [recebimentoId]);
  if (lido === null) return <Carregando />;
  if (typeof lido === 'string') return <Aviso tipo="erro">{lido}</Aviso>;
  return lido.pago
    ? <RegistroDeCorrecao r={lido.r} aoTerminar={aoTerminar} aoCancelar={aoCancelar} />
    : <RefazerRecebimento r={lido.r} parcela={parcela} aoTerminar={aoTerminar} aoCancelar={aoCancelar} />;
}

/** Nada pago ainda: refaz o recebimento com os dados corrigidos. */
function RefazerRecebimento({ r, parcela, aoTerminar, aoCancelar }: { r: RecebimentoGravado; parcela: Parcela; aoTerminar: () => void; aoCancelar: () => void }) {
  const id = useId();
  const { ehAdmin } = useCtx();
  const [f, setF] = useState<FormDoRecebimento>({ data: r.data, valor: centavosNoCampo(r.valor), contaId: r.conta_id, taxa: r.taxa_maquina ? centavosNoCampo(r.taxa_maquina) : '' });
  const [tipo, setTipo] = useState<CategoriaHonorario | ''>(r.categoria ?? '');
  const [forma, setForma] = useState<FormaDePagamento | ''>(r.forma_pagamento ?? '');
  const [bancoRecebido, setBancoRecebido] = useState(r.banco_recebido ?? '');
  const [bancoEnvio, setBancoEnvio] = useState(r.banco_envio ?? '');
  const [parte, setParte] = useState(r.parte_na_conta as ParaReceber['parte_na_conta']);
  // Os percentuais que o recebimento usou (quem não entrou nele fica com o do contrato).
  const [percentuais, setPercentuais] = useState<Record<string, string>>(() => Object.fromEntries(r.terceiros.map(t => [t.id, String(t.percentual).replace('.', ',')])));
  const [motivo, setMotivo] = useState('');
  const [prepDoContrato, setPrep] = useState<ParaReceber | string | null>(null);
  const [conferido, setConferido] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let vivo = true;
    SD.financeiroParaReceber(parcela.id, f.data).then(p => { if (vivo) setPrep(p); }).catch(e => { if (vivo) setPrep((e as Error).message); });
    return () => { vivo = false; };
  }, [parcela.id, f.data]);
  if (prepDoContrato === null) return <Carregando />;
  if (typeof prepDoContrato === 'string') return <Aviso tipo="erro">{prepDoContrato}</Aviso>;
  const doContrato = prepDoContrato;

  const pctDe = (t: { id: string; percentual: number }) => { const v = percentuais[t.id]; return v === undefined || v.trim() === '' ? t.percentual : Number(v.replace(',', '.')); };
  const prep: ParaReceber = { ...prepDoContrato, parte_na_conta: parte, terceiros: prepDoContrato.terceiros.map(t => ({ ...t, percentual: pctDe(t) })).filter(t => Number.isFinite(t.percentual) && t.percentual > 0) };
  const conta = prep.contas.find(c => c.id === f.contaId);
  const erros = conferido ? errosDoFormDeRecebimento(f, !!conta?.tem_das) : {};
  const percentualRuim = prepDoContrato.terceiros.some(t => { const v = pctDe(t); return !Number.isFinite(v) || v < 0 || v > 100; });
  const previa = conta && !percentualRuim && !Object.keys(errosDoFormDeRecebimento(f, conta.tem_das)).length ? previaDoRecebimento(f, prep) : null;
  const nomes = new Map([...prep.terceiros, ...(prep.socio_indicador ? [prep.socio_indicador] : [])].map(x => [x.id, x.nome]));
  const mudar = (m: Partial<FormDoRecebimento>) => setF(x => ({ ...x, ...m }));

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setConferido(true);
    if (ocupado || !conta || percentualRuim || !motivo.trim() || [bancoRecebido, bancoEnvio].some(b => b && !codigoDeBancoValido(b)) || Object.keys(errosDoFormDeRecebimento(f, conta.tem_das)).length) return;
    setOcupado(true);
    try {
      const { data, valor, contaId, taxa } = dadosDoRecebimento(f, conta.tem_das);
      await SD.financeiroCorrigirRecebimento(r.id, {
        data, valor, conta: contaId, taxa, categoria: tipo || undefined, forma: forma || undefined, bancoRecebido: bancoRecebido || undefined,
        bancoEnvio: bancoEnvio || undefined, parte, percentuais: doContrato.terceiros.map(t => ({ id: t.id, percentual: pctDe(t) })), motivo: motivo.trim()
      });
      avisar('Recebimento corrigido. O de antes ficou no histórico, estornado.');
      aoTerminar();
    } catch (e) { falha(e); setOcupado(false); }
  }

  return <form className="cartao financeiro-form" noValidate aria-label={`Corrigir o recebimento da parcela ${parcela.numero}`} onSubmit={salvar}>
    <Nota>Nada deste recebimento foi pago ainda: a correção refaz a divisão, o caixa e os repasses. O de antes fica no histórico.</Nota>
    <div className="financeiro-form-linha">
      <Campo rotulo="Data do pagamento" para={id + 'data'} obrigatorio erro={erros.data}>
        <input type="date" {...propsDoCampo(id + 'data', { erro: erros.data })} value={f.data} onChange={e => mudar({ data: e.target.value })} />
      </Campo>
      <Campo rotulo="Valor pago" para={id + 'valor'} obrigatorio erro={erros.valor}>
        <input type="text" inputMode="decimal" {...propsDoCampo(id + 'valor', { erro: erros.valor })} value={f.valor} onChange={e => mudar({ valor: e.target.value })} />
      </Campo>
      <Campo rotulo="Tipo do recebimento" para={id + 'tipo'}>
        <select {...propsDoCampo(id + 'tipo')} value={tipo} onChange={e => setTipo(e.target.value as CategoriaHonorario)}>
          <option value="">O do contrato</option>
          {(Object.keys(CATEGORIAS) as CategoriaHonorario[]).map(c => <option key={c} value={c}>{CATEGORIAS[c]}</option>)}
        </select>
      </Campo>
      <Campo rotulo="Forma de pagamento" para={id + 'forma'}>
        <select {...propsDoCampo(id + 'forma')} value={forma} onChange={e => setForma(e.target.value as FormaDePagamento)}>
          <option value="">—</option>
          {(Object.keys(FORMAS_DE_PAGAMENTO) as FormaDePagamento[]).map(x => <option key={x} value={x}>{FORMAS_DE_PAGAMENTO[x]}</option>)}
        </select>
      </Campo>
      <CampoDoBanco rotulo="Banco onde recebeu" valor={bancoRecebido} aoMudar={setBancoRecebido} />
      <Campo rotulo="Conta" para={id + 'conta'} erro={erros.contaId}>
        <select {...propsDoCampo(id + 'conta', { erro: erros.contaId })} value={f.contaId} onChange={e => mudar({ contaId: e.target.value })}>
          {prep.contas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </Campo>
      <CampoDoBanco rotulo="Banco de envio" valor={bancoEnvio} aoMudar={setBancoEnvio} />
      {conta?.tem_das && <Campo rotulo="Juros da máquina" para={id + 'taxa'} erro={erros.taxa}>
        <input type="text" inputMode="decimal" placeholder="0,00" {...propsDoCampo(id + 'taxa', { erro: erros.taxa })} value={f.taxa} onChange={e => mudar({ taxa: e.target.value })} />
      </Campo>}
    </div>
    <Segmentos rotulo="Parte na conta da empresa" atual={String(parte)} aoEscolher={v => setParte(Number(v) as ParaReceber['parte_na_conta'])}
      opcoes={PARTES.map(p => ({ id: String(p), rotulo: `${p}% do que o cliente pagou` }))} />
    {prepDoContrato.terceiros.length > 0 && <div className="financeiro-form-linha">
      {prepDoContrato.terceiros.map(t => <Campo key={t.id} rotulo={`% de ${t.nome} (${t.papel === 'indicador' ? 'indicador' : 'participante'})`} para={id + 'pct' + t.id}>
        <input type="text" inputMode="decimal" {...propsDoCampo(id + 'pct' + t.id)} value={percentuais[t.id] ?? String(t.percentual).replace('.', ',')} onChange={e => setPercentuais(x => ({ ...x, [t.id]: e.target.value }))} />
      </Campo>)}
    </div>}
    {percentualRuim && <Aviso tipo="erro">Cada percentual precisa ficar entre 0 e 100.</Aviso>}
    {previa && 'erro' in previa && previa.erro && <Aviso tipo="info">{previa.erro}</Aviso>}
    {previa && 'divisao' in previa && <Divisao rotulo="Como vai ficar a divisão corrigida" linhas={linhasDaDivisao(previa.divisao, previa.aliquota, x => nomes.get(x) ?? '', prep.responsavel_socio, ehAdmin)} />}
    <Campo rotulo="Motivo da correção" para={id + 'motivo'} obrigatorio erro={conferido && !motivo.trim() ? 'Diga o motivo da correção.' : undefined}>
      <input type="text" {...propsDoCampo(id + 'motivo', { erro: conferido && !motivo.trim() ? 'x' : undefined })} value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ex.: o valor pago foi R$ 900,00, não R$ 1.000,00" />
    </Campo>
    <div className="financeiro-acoes">
      <button type="submit" className={estiloBotao({ variante: 'principal' })} disabled={ocupado}>{ocupado ? 'Corrigindo…' : 'Corrigir recebimento'}</button>
      <button type="button" className={estiloBotao()} onClick={aoCancelar}>Cancelar</button>
    </div>
  </form>;
}

/** Já há pagamento: o registro de correção, uma saída do caixa ligada ao recebimento. */
function RegistroDeCorrecao({ r, aoTerminar, aoCancelar }: { r: RecebimentoGravado; aoTerminar: () => void; aoCancelar: () => void }) {
  const id = useId();
  const { ehAdmin } = useCtx();
  const [contas, setContas] = useState<ContaFinanceira[]>([]);
  const [data, setData] = useState(hojeISO());
  const [valor, setValor] = useState(centavosNoCampo(r.na_conta));
  const [conta, setConta] = useState(r.conta_id);
  const [motivo, setMotivo] = useState('');
  const [conferido, setConferido] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => {
    if (!ehAdmin) return;
    let vivo = true;
    SD.financeiroContas().then(c => { if (vivo) setContas(c.filter(x => !x.arquivada_em)); }).catch(falha);
    return () => { vivo = false; };
  }, [ehAdmin]);
  const explicacao = <Aviso tipo="info">Já há valor pago deste recebimento ({fmtCentavos(r.valor)} em {r.data.split('-').reverse().join('/')}): ele fica como está.
    A correção é um registro novo, uma saída do caixa ligada a ele, para ficar registrado exatamente como aconteceu.</Aviso>;
  if (!ehAdmin) return <div className="financeiro-form">{explicacao}<Nota>Só um administrador lança a correção no caixa: peça a ele, com o motivo.</Nota>
    <div className="financeiro-acoes"><button type="button" className={estiloBotao()} onClick={aoCancelar}>Fechar</button></div></div>;

  const lido = lerCentavos(valor, null);
  async function lancar(ev: FormEvent) {
    ev.preventDefault();
    setConferido(true);
    if (ocupado || 'erro' in lido || !motivo.trim() || !conta) return;
    setOcupado(true);
    try {
      const novo = await SD.financeiroLancarCorrecao({ recebimento: r.id, data, valor: lido.centavos, conta, motivo: motivo.trim() });
      feito('Correção lançada no caixa.', 'correção do recebimento', () => SD.financeiroLancamentoExcluir(novo));
      aoTerminar();
    } catch (e) { falha(e); setOcupado(false); }
  }
  return <form className="cartao financeiro-form" noValidate aria-label="Registro de correção" onSubmit={lancar}>
    {explicacao}
    <div className="financeiro-form-linha">
      <Campo rotulo="Data" para={id + 'data'} obrigatorio>
        <input type="date" {...propsDoCampo(id + 'data')} value={data} onChange={e => setData(e.target.value)} />
      </Campo>
      <Campo rotulo="Valor que sai do caixa" para={id + 'valor'} obrigatorio erro={conferido && 'erro' in lido ? lido.erro : undefined}>
        <input type="text" inputMode="decimal" {...propsDoCampo(id + 'valor')} value={valor} onChange={e => setValor(e.target.value)} />
      </Campo>
      <Campo rotulo="Conta" para={id + 'conta'}>
        <select {...propsDoCampo(id + 'conta')} value={conta} onChange={e => setConta(e.target.value)}>
          {contas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </Campo>
    </div>
    <Campo rotulo="Motivo da correção" para={id + 'motivo'} obrigatorio erro={conferido && !motivo.trim() ? 'Diga o motivo da correção.' : undefined}>
      <input type="text" {...propsDoCampo(id + 'motivo')} value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ex.: o cliente pagou R$ 100,00 a menos" />
    </Campo>
    <div className="financeiro-acoes">
      <button type="submit" className={estiloBotao({ variante: 'principal' })} disabled={ocupado}>{ocupado ? 'Lançando…' : 'Lançar a correção'}</button>
      <button type="button" className={estiloBotao()} onClick={aoCancelar}>Cancelar</button>
    </div>
  </form>;
}
