// O caixa do escritório, só para administradores: cada conta, mês a mês, com o saldo depois de cada lançamento. O saldo marcado no
// fim de cada dia é o que se compara com o banco. Abaixo, as contas e o DAS de cada mês. A página de módulo dá o cabeçalho.
import { useEffect, useState } from 'react';
import { Navigate } from 'react-router';
import { SD, type AliquotaDoDas, type ContaFinanceira, type Lancamento, type Socio } from '../dados';
import { CAMPOS_DO_LANCAMENTO, diasDoMes, fmtCentavos, formDoLancamento, lancamentoNovo, mesDe, mesDoCaixa, mesValido, nomeDaCategoria, transferenciaNova, valorNoAjuste, valorNoHistorico } from '../regras/caixa';
import { dasDoMes } from '../regras/financeiro';
import { fmtData } from '../regras/pessoa';
import { falha, feito, useMudancas } from '../ui/avisos';
import { Aviso, Carregando, estiloBotao, Nota, Vazio } from '../ui/base';
import { BotaoDuplo } from '../ui/Botoes';
import { Icone } from '../ui/Icone';
import { PaginaModulo } from '../ui/PaginaModulo';
import { lerPreferencia, salvarPreferencia } from '../ui/preferencias';
import { Recolhivel } from '../ui/Recolhivel';
import { useCtx } from '../ui/sessao';
import { hojeISO, useTitulo } from '../ui/util';
import { ContasDoEscritorio, DasDoEscritorio, FormLancamento, FormTransferencia } from './financeiro/Formularios';
import { SociosDoEscritorio } from './financeiro/Socios';
import { HistoricoDoCartao } from './HistoricoDoCartao';
import './Financeiro.css';

/** O lançamento que nasce de uma parcela só muda por lá: o caixa só mostra de onde ele veio. */
const ORIGEM_DO_LANCAMENTO: Record<NonNullable<Lancamento['origem']>, string> = { recebimento: 'Veio de uma parcela', repasse: 'Veio de um repasse' };

/** O que está aberto: lançamento novo, a mudança de um lançamento ou a transferência. */
type Aberto = { o: 'novo' } | { o: 'mudar'; lancamento: Lancamento } | { o: 'transferir' } | null;
/** O que foi lido, e de que conta e mês: a tela só mostra o que é da conta e do mês escolhidos. */
type Lido = { chave: string; lancamentos: Lancamento[]; saldoAnterior: number } | { chave: string; erro: string };

export default function Financeiro() {
  useTitulo('Caixa');
  const ctx = useCtx();
  const hoje = hojeISO();
  const [contas, setContas] = useState<ContaFinanceira[] | null>(null);
  const [erroInicial, setErroInicial] = useState('');
  const [das, setDas] = useState<AliquotaDoDas[]>([]);
  const [socios, setSocios] = useState<Socio[]>([]);
  const [contaId, setContaId] = useState(() => lerPreferencia('financeiro.conta', ''));
  const [mes, setMes] = useState(mesDe(hoje));
  const [lido, setLido] = useState<Lido | null>(null);
  const [aberto, setAberto] = useState<Aberto>(null);
  // Muda quando algo muda: relê as contas, o DAS, o mês e os históricos.
  const [versao, setVersao] = useState(0);
  const recarregar = () => setVersao(v => v + 1);
  const pode = ctx.ehAdmin && !!ctx.escritorio?.modulos?.financeiro;

  useEffect(() => {
    if (!pode) return;
    let vivo = true;
    Promise.all([SD.financeiroContas(), SD.financeiroDas(), SD.financeiroSocios()])
      .then(([c, d, s]) => { if (vivo) { setContas(c); setDas(d); setSocios(s); setErroInicial(''); } })
      // Numa releitura que falhou, a tela fica com o que já tinha (e o que estava sendo digitado não some).
      .catch(e => { if (vivo) setContas(atual => { if (atual) falha(e); else setErroInicial((e as Error).message); return atual; }); });
    return () => { vivo = false; };
  }, [versao, pode]);

  const ativas = (contas ?? []).filter(c => !c.arquivada_em);
  const conta = ativas.find(c => c.id === contaId) ?? ativas[0] ?? null;
  const contaAtual = conta?.id ?? '';
  const chave = contaAtual + '/' + mes;

  // Só vale a leitura mais recente: trocar de mês ou de conta não pode trazer de volta a lista anterior.
  useEffect(() => {
    if (!contaAtual) return;
    let vivo = true;
    const { de, ate } = diasDoMes(mes);
    Promise.all([SD.financeiroLancamentos(contaAtual, de, ate), SD.financeiroSaldoAntes(contaAtual, de)])
      .then(([lancamentos, saldoAnterior]) => { if (vivo) setLido({ chave: contaAtual + '/' + mes, lancamentos, saldoAnterior }); })
      .catch(e => { if (vivo) setLido({ chave: contaAtual + '/' + mes, erro: (e as Error).message }); });
    return () => { vivo = false; };
  }, [contaAtual, mes, versao]);
  // Depois de desfazer, o formulário aberto pode estar com dados velhos.
  useMudancas(() => { setAberto(null); recarregar(); });

  if (!pode) return <Navigate to="/inicio/" replace />;
  const cabecalho = { titulo: 'Caixa', visoes: [] };
  if (erroInicial) return <PaginaModulo {...cabecalho}><Aviso tipo="erro">{erroInicial}</Aviso></PaginaModulo>;
  if (contas === null) return <PaginaModulo {...cabecalho}><Carregando /></PaginaModulo>;

  const mudou = () => { setAberto(null); recarregar(); };
  async function excluir(l: Lancamento) {
    try {
      await SD.financeiroLancamentoExcluir(l.id);
      feito('Lançamento excluído.', 'exclusão do lançamento', async () => { await SD.financeiroLancamentoRestaurar(l.id); });
      if (aberto?.o === 'mudar' && aberto.lancamento.id === l.id) setAberto(null);
      recarregar();
    } catch (e) { falha(e); }
  }
  const dataNova = mesDe(hoje) === mes ? hoje : diasDoMes(mes).de;
  const ajustes = <div className="financeiro-ajustes">
    <Recolhivel titulo="Contas" icone="configuracoes" preferencia="financeiro.contas" contador={ativas.length}>
      <ContasDoEscritorio contas={contas} hoje={hoje} aoMudar={recarregar} />
    </Recolhivel>
    <Recolhivel titulo="DAS de cada mês" icone="dinheiro" preferencia="financeiro.das">
      <DasDoEscritorio key={mes} lista={das} mesInicial={mes} aoMudar={recarregar} />
    </Recolhivel>
    <Recolhivel titulo="Sócios" icone="equipe" preferencia="financeiro.socios" contador={socios.length}>
      <SociosDoEscritorio socios={socios} hoje={hoje} aoMudar={recarregar} />
    </Recolhivel>
    <Recolhivel titulo="Mudanças no saldo inicial, no DAS e nos sócios" icone="relogio" preferencia="financeiro.ajustes">
      <HistoricoDoCartao carregar={() => SD.financeiroAjustes()} campos={{}} valor={valorNoAjuste} versao={versao} />
    </Recolhivel>
  </div>;

  const dasAtual = dasDoMes(das, mes);
  const atual = lido?.chave === chave ? lido : null;
  const dados = atual && 'lancamentos' in atual ? mesDoCaixa(atual.lancamentos, atual.saldoAnterior) : null;
  const vazio = contas.length ? 'Todas as contas estão arquivadas. Reative uma em "Contas" para continuar.'
    : 'Nenhuma conta ainda. Crie as contas do escritório, cada uma com o saldo inicial, para começar.';

  // As contas ficam sempre no mesmo lugar: criar a primeira não pode fechar o formulário da segunda.
  return <PaginaModulo {...cabecalho} contador={conta?.nome}>
    {!conta ? <Vazio>{vazio}</Vazio> : <>
    <div className="financeiro-barra">
      <label>Conta
        <select className="campo" value={contaAtual} onChange={e => { setContaId(e.target.value); salvarPreferencia('financeiro.conta', e.target.value); setAberto(null); }}>
          {ativas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </label>
      <label>Mês
        {/* Apagar o campo não muda nada: fica o último mês válido. */}
        <input type="month" className="campo" value={mes} onChange={e => { if (mesValido(e.target.value)) { setMes(e.target.value); setAberto(null); } }} />
      </label>
      <button type="button" className={estiloBotao({ variante: 'principal' })} onClick={() => setAberto({ o: 'novo' })}><Icone nome="mais" tam={15} /> Novo lançamento</button>
      {ativas.length > 1 && <button type="button" className={estiloBotao()} onClick={() => setAberto({ o: 'transferir' })}>Repasse entre contas</button>}
    </div>

    {conta.tem_das && (dasAtual === null ? <Aviso tipo="info">Nenhum DAS lançado até este mês. Lance o percentual em "DAS de cada mês".</Aviso>
      : dasAtual.aviso ? <Aviso tipo="info">{dasAtual.aviso}</Aviso> : <Nota>DAS deste mês: {dasAtual.aliquota.toLocaleString('pt-BR')}%.</Nota>)}

    {aberto?.o === 'novo' && <FormLancamento inicial={lancamentoNovo(contaAtual, dataNova)} contas={ativas} aoTerminar={mudou} aoCancelar={() => setAberto(null)} />}
    {aberto?.o === 'mudar' && <FormLancamento key={aberto.lancamento.id} alvo={aberto.lancamento} inicial={formDoLancamento(aberto.lancamento)} contas={ativas} aoTerminar={mudou} aoCancelar={() => setAberto(null)} />}
    {aberto?.o === 'mudar' && <Recolhivel titulo="Histórico deste lançamento" icone="relogio" preferencia="financeiro.historico">
      <HistoricoDoCartao key={aberto.lancamento.id} carregar={() => SD.financeiroHistorico(aberto.lancamento.id)} campos={CAMPOS_DO_LANCAMENTO} valor={valorNoHistorico} versao={versao} />
    </Recolhivel>}
    {aberto?.o === 'transferir' && <FormTransferencia inicial={transferenciaNova(conta, ativas.find(c => c.id !== contaAtual), dataNova)} contas={ativas} aoTerminar={mudou} aoCancelar={() => setAberto(null)} />}

    {!atual ? <Carregando /> : 'erro' in atual ? <Aviso tipo="erro">{atual.erro}</Aviso> : dados && <>
      <dl className="financeiro-resumo" aria-label="Resumo do mês">
        <div><dt>Saldo anterior</dt><dd>{fmtCentavos(dados.saldoAnterior)}</dd></div>
        <div><dt>Entradas</dt><dd>{fmtCentavos(dados.entradas)}</dd></div>
        <div><dt>Saídas</dt><dd>{fmtCentavos(dados.saidas)}</dd></div>
        <div><dt>Saldo final</dt><dd><b>{fmtCentavos(dados.saldoFinal)}</b></dd></div>
      </dl>
      {dados.linhas.length ? <div className="tabela"><table aria-label="Lançamentos do mês">
        <thead><tr>
          <th scope="col">Data</th><th scope="col">Descrição</th><th scope="col">Categoria</th>
          <th scope="col" className="financeiro-num">Entrada</th><th scope="col" className="financeiro-num">Saída</th><th scope="col" className="financeiro-num">Saldo</th>
          <th scope="col"><span className="sr">Ações</span></th>
        </tr></thead>
        <tbody>{dados.linhas.map(({ lancamento: l, saldo, fimDoDia }) => <tr key={l.id} className={fimDoDia ? 'financeiro-fim-do-dia' : undefined}>
          <td>{fmtData(l.data)}</td><td>{l.descricao}</td><td>{nomeDaCategoria(l.categoria)}</td>
          <td className="financeiro-num">{l.tipo === 'entrada' ? fmtCentavos(l.valor) : ''}</td>
          <td className="financeiro-num">{l.tipo === 'saida' ? fmtCentavos(l.valor) : ''}</td>
          <td className="financeiro-num">{fimDoDia ? <b>{fmtCentavos(saldo)}</b> : fmtCentavos(saldo)}</td>
          <td>{l.origem ? <span className="financeiro-origem">{ORIGEM_DO_LANCAMENTO[l.origem]}</span> : <span className="financeiro-acoes">
            {!l.par_id && <button type="button" className={estiloBotao({ forma: 'mini' })} aria-label={`Mudar o lançamento ${l.descricao}`} onClick={() => setAberto({ o: 'mudar', lancamento: l })}><Icone nome="editar" tam={13} /> Mudar</button>}
            <BotaoDuplo pequeno variante="perigo" confirmar={l.par_id ? 'Confirmar: excluir as duas pontas' : 'Confirmar: excluir'} aoConfirmar={() => excluir(l)}><Icone nome="lixeira" tam={13} /> Excluir</BotaoDuplo>
          </span>}</td>
        </tr>)}</tbody>
      </table></div> : <Vazio>Nenhum lançamento nesta conta neste mês.</Vazio>}
      <Nota>O saldo em negrito é o do fim de cada dia: compare com o extrato do banco.</Nota>
    </>}
    </>}

    {ajustes}
  </PaginaModulo>;
}
