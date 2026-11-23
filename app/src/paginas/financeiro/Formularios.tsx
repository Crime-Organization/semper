// Os formulários do caixa: lançamento, repasse entre contas, contas do escritório e o DAS de cada mês.
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { SD, type AliquotaDoDas, type ContaFinanceira, type DadosConta, type Lancamento } from '../../dados';
import { TAMANHO_FINANCEIRO } from '../../dados/limites';
import {
  categoriasDoFormulario, centavosNoCampo, CONTA_COM_LANCAMENTOS, contaNova, dadosDaConta, dadosDaTransferencia, dadosDoLancamento, descricaoDoRepasse, ehAjuste, errosDaConta, errosDaTransferencia, errosDoLancamento, mesValido, rotuloDaCategoria,
  type FormDaConta, type FormDaTransferencia, type FormDoLancamento
} from '../../regras/caixa';
import { erroDoDas, lerAliquota } from '../../regras/financeiro';
import { fmtData } from '../../regras/pessoa';
import { normal } from '../../regras/texto';
import { avisar, falha, feito } from '../../ui/avisos';
import { Campo, CampoData, estiloBotao, Nota, propsDoCampo } from '../../ui/base';
import { Botao, BotaoDuplo } from '../../ui/Botoes';
import { Icone, ICONE_DO_BOTAO_PEQUENO } from '../../ui/Icone';
import { usePedidoDeNovo } from '../../ui/Recolhivel';

const DICA_DO_AJUSTE = 'Por que o saldo precisou deste acerto: é o que se confere na auditoria. O ajuste muda o saldo da conta, mas não conta como receita, despesa nem lucro.';

interface PropsDoForm<F> { inicial: F; contas: ContaFinanceira[]; aoTerminar: () => void; aoCancelar: () => void }

function Acoes({ rotulo, ocupado, aoCancelar }: { rotulo: string; ocupado: boolean; aoCancelar: () => void }) {
  return <div className="financeiro-acoes">
    <button type="submit" className={estiloBotao({ variante: 'principal' })} disabled={ocupado}>{ocupado ? 'Salvando…' : rotulo}</button>
    <button type="button" className={estiloBotao()} onClick={aoCancelar}>Cancelar</button>
  </div>;
}

/** Lançamento novo, ou a mudança de um (alvo). "categorias" limita a lista (o ajuste de saldo novo, na página das contas, oferece só os ajustes). */
export function FormLancamento({ alvo, inicial, contas, categorias, titulo, aoTerminar, aoCancelar }: PropsDoForm<FormDoLancamento> & { alvo?: Lancamento; categorias?: FormDoLancamento['categoria'][]; titulo?: string }) {
  const id = useId();
  const [f, setF] = useState(inicial);
  const [conferido, setConferido] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const mudar = (m: Partial<FormDoLancamento>) => setF(x => ({ ...x, ...m }));
  const conta = contas.find(c => c.id === f.contaId);
  const erros = conferido ? errosDoLancamento(f, conta) : {};
  const dicaDaDescricao = ehAjuste(f.categoria) ? DICA_DO_AJUSTE : undefined;
  // Numa lista longa, o formulário abre lá em cima: leva a pessoa até ele.
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { ref.current?.scrollIntoView?.({ block: 'center' }); }, []);
  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setConferido(true);
    if (ocupado || Object.keys(errosDoLancamento(f, conta)).length) return;
    setOcupado(true);
    try {
      const dados = dadosDoLancamento(f);
      if (alvo) {
        const { conta_id, data, tipo, categoria, valor, descricao } = alvo;
        await SD.financeiroLancamentoAtualizar(alvo.id, dados);
        feito('Lançamento atualizado.', 'mudança do lançamento', async () => { await SD.financeiroLancamentoAtualizar(alvo.id, { conta_id, data, tipo, categoria, valor, descricao }); });
      } else {
        const novo = await SD.financeiroLancamentoCriar(dados);
        feito('Lançamento salvo.', 'lançamento', async () => { await SD.financeiroLancamentoExcluir(novo.id); });
      }
      aoTerminar();
    } catch (e) { falha(e); setOcupado(false); }
  }
  return <form ref={ref} className="cartao financeiro-form" noValidate aria-label={titulo ?? (alvo ? 'Mudar lançamento' : 'Novo lançamento')} onSubmit={salvar}>
    <div className="financeiro-form-linha">
      <Campo rotulo="Conta" para={id + 'conta'} erro={erros.contaId}>
        <select {...propsDoCampo(id + 'conta', { erro: erros.contaId })} value={f.contaId} onChange={e => mudar({ contaId: e.target.value })}>
          {contas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </Campo>
      <Campo rotulo="Data" para={id + 'data'} obrigatorio erro={erros.data}>
        <CampoData formato="iso" {...propsDoCampo(id + 'data', { erro: erros.data })} valor={f.data} aoMudar={v => mudar({ data: v })} />
      </Campo>
      <Campo rotulo="Categoria" para={id + 'cat'}>
        <select {...propsDoCampo(id + 'cat')} value={f.categoria} onChange={e => mudar({ categoria: e.target.value as FormDoLancamento['categoria'] })}>
          {(categorias ?? categoriasDoFormulario(f.categoria)).map(c => <option key={c} value={c}>{rotuloDaCategoria(c)}</option>)}
        </select>
      </Campo>
      <Campo rotulo="Valor" para={id + 'valor'} obrigatorio erro={erros.valor}>
        <input type="text" inputMode="decimal" placeholder="0,00" {...propsDoCampo(id + 'valor', { erro: erros.valor })} value={f.valor} onChange={e => mudar({ valor: e.target.value })} />
      </Campo>
    </div>
    <Campo rotulo={dicaDaDescricao ? 'Motivo do ajuste' : 'Descrição'} para={id + 'desc'} obrigatorio dica={dicaDaDescricao} erro={erros.descricao}>
      <input type="text" {...propsDoCampo(id + 'desc', { dica: dicaDaDescricao, erro: erros.descricao })} maxLength={TAMANHO_FINANCEIRO.descricao} value={f.descricao} onChange={e => mudar({ descricao: e.target.value })} />
    </Campo>
    <Acoes rotulo={alvo ? 'Salvar lançamento' : 'Lançar'} ocupado={ocupado} aoCancelar={aoCancelar} />
  </form>;
}

/** Repasse entre contas: uma saída numa e uma entrada na outra. Não é lucro. */
export function FormTransferencia({ inicial, contas, aoTerminar, aoCancelar }: PropsDoForm<FormDaTransferencia>) {
  const id = useId();
  const [f, setF] = useState(inicial);
  const [conferido, setConferido] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  // O texto acompanha as contas escolhidas, até a pessoa escrever o dela.
  const [textoProprio, setTextoProprio] = useState(false);
  const nomeDa = (id: string) => contas.find(c => c.id === id)?.nome ?? '';
  const mudar = (m: Partial<FormDaTransferencia>) => setF(x => {
    const novo = { ...x, ...m };
    return textoProprio || m.descricao !== undefined ? novo : { ...novo, descricao: descricaoDoRepasse(nomeDa(novo.de), nomeDa(novo.para)) };
  });
  const erros = conferido ? errosDaTransferencia(f, contas) : {};
  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setConferido(true);
    if (ocupado || Object.keys(errosDaTransferencia(f, contas)).length) return;
    setOcupado(true);
    try {
      const novo = await SD.financeiroTransferir(dadosDaTransferencia(f));
      feito('Repasse lançado nas duas contas.', 'repasse entre contas', async () => { await SD.financeiroLancamentoExcluir(novo); });
      aoTerminar();
    } catch (e) { falha(e); setOcupado(false); }
  }
  const opcoes = contas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>);
  return <form className="cartao financeiro-form" noValidate aria-label="Repasse entre contas" onSubmit={salvar}>
    <Nota>Sai de uma conta e entra na outra, no mesmo dia. Não é divisão de lucro.</Nota>
    <div className="financeiro-form-linha">
      <Campo rotulo="Sai de" para={id + 'de'}><select {...propsDoCampo(id + 'de')} value={f.de} onChange={e => mudar({ de: e.target.value })}>{opcoes}</select></Campo>
      <Campo rotulo="Entra em" para={id + 'para'} erro={erros.para}><select {...propsDoCampo(id + 'para', { erro: erros.para })} value={f.para} onChange={e => mudar({ para: e.target.value })}>{opcoes}</select></Campo>
      <Campo rotulo="Data" para={id + 'data'} obrigatorio erro={erros.data}><CampoData formato="iso" {...propsDoCampo(id + 'data', { erro: erros.data })} valor={f.data} aoMudar={v => mudar({ data: v })} /></Campo>
      <Campo rotulo="Valor" para={id + 'valor'} obrigatorio erro={erros.valor}><input type="text" inputMode="decimal" placeholder="0,00" {...propsDoCampo(id + 'valor', { erro: erros.valor })} value={f.valor} onChange={e => mudar({ valor: e.target.value })} /></Campo>
    </div>
    <Campo rotulo="Descrição" para={id + 'desc'} obrigatorio erro={erros.descricao}>
      <input type="text" {...propsDoCampo(id + 'desc', { erro: erros.descricao })} maxLength={TAMANHO_FINANCEIRO.descricao} value={f.descricao} onChange={e => { setTextoProprio(true); mudar({ descricao: e.target.value }); }} />
    </Campo>
    <Acoes rotulo="Lançar repasse" ocupado={ocupado} aoCancelar={aoCancelar} />
  </form>;
}

/** As contas do escritório: criar, mudar, arquivar e desarquivar e, a arquivada que nunca teve lançamento, excluir (#347). */
/** O botão de baixo das contas e o "+" do título da seção (#390), com o mesmo nome. */
export const ROTULO_DA_NOVA_CONTA = 'Nova conta';

export function ContasDoEscritorio({ contas, hoje, aoMudar }: { contas: ContaFinanceira[]; hoje: string; aoMudar: () => void }) {
  const id = useId();
  const [edicao, setEdicao] = useState<{ id?: string } | null>(null);
  const [f, setF] = useState<FormDaConta>(() => contaNova(hoje));
  const [conferido, setConferido] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const mudar = (m: Partial<FormDaConta>) => setF(x => ({ ...x, ...m }));
  const erros = conferido ? errosDaConta(f, contas, normal, edicao?.id) : {};
  function abrir(c?: ContaFinanceira) {
    setF(c ? { nome: c.nome, temDas: c.tem_das, saldoInicial: centavosNoCampo(c.saldo_inicial), saldoInicialEm: c.saldo_inicial_em } : contaNova(hoje));
    setEdicao(c ? { id: c.id } : {});
    setConferido(false);
  }
  // As arquivadas com lançamentos (mesmo excluídos) não podem ser excluídas: no lugar da lixeira, a explicação. Enquanto não
  // chega a lista destas contas, nem uma nem outra: a lista de antes não vale para a conta que acabou de ser arquivada.
  const [lista, setLista] = useState<{ de: ContaFinanceira[]; ids: Set<string> } | null>(null);
  useEffect(() => {
    let vivo = true;
    SD.financeiroArquivadasComLancamentos().then(ids => { if (vivo) setLista({ de: contas, ids: new Set(ids) }); }).catch(falha);
    return () => { vivo = false; };
  }, [contas]);
  const comLancamentos = lista?.de === contas ? lista.ids : null;
  // O "+" do título da seção abre o mesmo formulário do botão de baixo (que some com um formulário aberto).
  usePedidoDeNovo(() => { if (!edicao) abrir(); });
  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setConferido(true);
    if (ocupado || Object.keys(errosDaConta(f, contas, normal, edicao?.id)).length) return;
    setOcupado(true);
    try {
      const dados: DadosConta = dadosDaConta(f);
      if (edicao?.id) await SD.financeiroContaAtualizar(edicao.id, dados); else await SD.financeiroContaCriar(dados);
      avisar(edicao?.id ? 'Conta atualizada.' : 'Conta criada.');
      setEdicao(null);
      aoMudar();
    } catch (e) { falha(e); }
    setOcupado(false);
  }
  async function arquivar(c: ContaFinanceira, arquivar: boolean) {
    try {
      await SD.financeiroContaAtualizar(c.id, { arquivada_em: arquivar ? new Date().toISOString() : null });
      feito(arquivar ? `Conta ${c.nome} arquivada.` : `Conta ${c.nome} desarquivada.`, 'arquivamento da conta', async () => { await SD.financeiroContaAtualizar(c.id, { arquivada_em: c.arquivada_em }); });
      aoMudar();
    } catch (e) { falha(e); }
  }
  async function excluir(c: ContaFinanceira) {
    try {
      await SD.financeiroContaExcluir(c.id);
      avisar(`Conta ${c.nome} excluída definitivamente.`);
      aoMudar();
    } catch (e) { falha(e); }
  }
  return <div className="financeiro-form">
    {contas.length > 0 && <ul className="financeiro-lista" aria-label="Contas do escritório">{contas.map(c => <li key={c.id}>
      <span><b>{c.nome}</b>{c.tem_das ? ' (recolhe DAS)' : ''}{c.arquivada_em ? ' (arquivada)' : ''}<br /><small>Saldo inicial de {centavosNoCampo(c.saldo_inicial)} em {fmtData(c.saldo_inicial_em)}</small>
        {c.arquivada_em && comLancamentos?.has(c.id) && <><br /><small>{CONTA_COM_LANCAMENTOS}</small></>}</span>
      <span className="financeiro-acoes">
        {!c.arquivada_em && <button type="button" className={estiloBotao({ forma: 'mini' })} aria-label={`Mudar a conta ${c.nome}`} onClick={() => abrir(c)}>Mudar</button>}
        {c.arquivada_em
          ? <Botao forma="mini" aria-label={`Desarquivar a conta ${c.nome}`} onClick={() => arquivar(c, false)}><Icone nome="arquivoAberto" tam={ICONE_DO_BOTAO_PEQUENO} /> Desarquivar</Botao>
          : <Botao forma="mini" aria-label={`Arquivar a conta ${c.nome}`} onClick={() => arquivar(c, true)}><Icone nome="arquivo" tam={ICONE_DO_BOTAO_PEQUENO} /> Arquivar</Botao>}
        {c.arquivada_em && comLancamentos && !comLancamentos.has(c.id) &&
          <BotaoDuplo forma="mini" variante="perigo" confirmar={`Confirmar exclusão de ${c.nome}`} aoConfirmar={() => excluir(c)}>
            <Icone nome="lixeira" tam={ICONE_DO_BOTAO_PEQUENO} /> Excluir <span className="sr">a conta {c.nome}</span></BotaoDuplo>}
      </span>
    </li>)}</ul>}
    {edicao ? <form className="financeiro-form" noValidate aria-label={edicao.id ? 'Mudar conta' : 'Nova conta'} onSubmit={salvar}>
      <div className="financeiro-form-linha">
        <Campo rotulo="Nome da conta" para={id + 'nome'} obrigatorio erro={erros.nome}>
          <input type="text" {...propsDoCampo(id + 'nome', { erro: erros.nome })} maxLength={TAMANHO_FINANCEIRO.nomeDaConta} value={f.nome} onChange={e => mudar({ nome: e.target.value })} />
        </Campo>
        <Campo rotulo="Saldo inicial" para={id + 'saldo'} obrigatorio erro={erros.saldoInicial} dica="Pode ser negativo: -250,50.">
          <input type="text" inputMode="decimal" {...propsDoCampo(id + 'saldo', { dica: true, erro: erros.saldoInicial })} value={f.saldoInicial} onChange={e => mudar({ saldoInicial: e.target.value })} />
        </Campo>
        <Campo rotulo="Em que dia" para={id + 'em'} obrigatorio erro={erros.saldoInicialEm} dica="Nada pode ser lançado antes desse dia.">
          <CampoData formato="iso" {...propsDoCampo(id + 'em', { dica: true, erro: erros.saldoInicialEm })} valor={f.saldoInicialEm} aoMudar={v => mudar({ saldoInicialEm: v })} />
        </Campo>
      </div>
      <label className="financeiro-marcar"><input type="checkbox" checked={f.temDas} onChange={e => mudar({ temDas: e.target.checked })} /> Esta conta recolhe DAS (é a conta da empresa)</label>
      <Acoes rotulo={edicao.id ? 'Salvar conta' : 'Criar conta'} ocupado={ocupado} aoCancelar={() => setEdicao(null)} />
    </form> : <div><button type="button" className={estiloBotao()} onClick={() => abrir()}><Icone nome="mais" tam={15} /> {ROTULO_DA_NOVA_CONTA}</button></div>}
  </div>;
}

/** O percentual do DAS de cada mês. Mudar um mês não muda o que já foi recebido. */
export function DasDoEscritorio({ lista, mesInicial, aoMudar }: { lista: AliquotaDoDas[]; mesInicial: string; aoMudar: () => void }) {
  const id = useId();
  const [mes, setMes] = useState(mesInicial);
  const [texto, setTexto] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    const lida = lerAliquota(texto);
    const problema = 'erro' in lida ? lida.erro : !mesValido(mes) ? 'Escolha o mês.' : erroDoDas({ mes, aliquota: lida.aliquota });
    setErro(problema ?? '');
    if (problema || 'erro' in lida || ocupado) return;
    setOcupado(true);
    try {
      await SD.financeiroDasSalvar(mes, lida.aliquota);
      avisar('DAS salvo.');
      setTexto('');
      aoMudar();
    } catch (e) { falha(e); }
    setOcupado(false);
  }
  const ordem = lista.toSorted((a, b) => b.mes.localeCompare(a.mes));
  return <div className="financeiro-form">
    <form className="financeiro-form-linha" noValidate aria-label="Lançar o DAS" onSubmit={salvar}>
      <Campo rotulo="Mês" para={id + 'mes'}><input type="month" {...propsDoCampo(id + 'mes')} value={mes} onChange={e => setMes(e.target.value)} /></Campo>
      <Campo rotulo="Percentual do DAS" para={id + 'pct'} erro={erro}><input type="text" inputMode="decimal" placeholder="4,5" {...propsDoCampo(id + 'pct', { erro })} value={texto} onChange={e => setTexto(e.target.value)} /></Campo>
      <div className="financeiro-acoes"><button type="submit" className={estiloBotao()} disabled={ocupado}>Salvar DAS</button></div>
    </form>
    {ordem.length ? <ul className="financeiro-lista" aria-label="DAS lançados">{ordem.map(a => <li key={a.mes}><span>{a.mes.slice(5)}/{a.mes.slice(0, 4)}</span><b>{a.aliquota.toLocaleString('pt-BR')}%</b></li>)}</ul> : <Nota>Nenhum DAS lançado ainda.</Nota>}
  </div>;
}
