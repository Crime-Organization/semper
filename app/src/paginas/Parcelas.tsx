// As parcelas de cada mês, os repasses e o que o responsável passa aos terceiros. O administrador vê as do escritório e paga os repasses; o advogado vê as dos contratos dele e
// os repasses dele, sem acesso ao caixa. Quem filtra é o banco. A página de módulo dá o cabeçalho.
import { useEffect, useId, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router';
import { SD, type ContaFinanceira, type ParcelaDoEscritorio, type Repasse, type ValorAPassar } from '../dados';
import { anoAceito, dataExiste } from '../regras/calendario';
import { diasDoMes, fmtCentavos, mesDe, mesValido } from '../regras/caixa';
import { resumoDasParcelas, SITUACOES_DA_PARCELA } from '../regras/parcelas';
import { fmtData } from '../regras/pessoa';
import { falha, feito, useMudancas } from '../ui/avisos';
import { Aviso, Campo, Carregando, estiloBotao, Nota, propsDoCampo, Selo, TituloSecao, Vazio } from '../ui/base';
import { BotaoDuplo } from '../ui/Botoes';
import { PaginaModulo } from '../ui/PaginaModulo';
import { useCtx } from '../ui/sessao';
import { hojeISO, useTitulo } from '../ui/util';
import { ValoresAPassar } from './financeiro/APassar';
import { GestaoDeParcelas } from './financeiro/Parcelas';
import './Financeiro.css';
import { AbasDoFinanceiro } from './financeiro/AbasDoFinanceiro';

const NOME_DO_REPASSE: Record<Repasse['tipo'], string> = { responsavel: 'Responsável', socio_indicador: 'Sócio que indicou' };

type Lido = { chave: string; parcelas: ParcelaDoEscritorio[]; repasses: Repasse[]; aPassar: ValorAPassar[] } | { chave: string; erro: string };

function FormPagar({ repasse, contas, hoje, aoTerminar, aoCancelar }: { repasse: Repasse; contas: ContaFinanceira[]; hoje: string; aoTerminar: () => void; aoCancelar: () => void }) {
  const id = useId();
  const [contaId, setContaId] = useState(contas.some(c => c.id === repasse.conta_sugerida) ? repasse.conta_sugerida! : contas[0]?.id ?? '');
  const [data, setData] = useState(hoje);
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    const problema = !dataExiste(data) || !anoAceito(data) ? 'Informe uma data válida.' : '';
    setErro(problema);
    if (problema || ocupado || !contaId) return;
    setOcupado(true);
    try {
      await SD.financeiroPagarRepasse(repasse.id, contaId, data);
      feito('Repasse pago.', 'pagamento do repasse', () => SD.financeiroDesfazerPagamento(repasse.id));
      aoTerminar();
    } catch (e) { falha(e); setOcupado(false); }
  }
  return <form className="cartao financeiro-form" noValidate aria-label={`Pagar o repasse a ${repasse.nome}`} onSubmit={salvar}>
    <Nota>{fmtCentavos(repasse.valor)} a {repasse.nome}. Isto cria a saída no caixa.</Nota>
    <div className="financeiro-form-linha">
      <Campo rotulo="Conta de onde sai" para={id + 'conta'}>
        <select {...propsDoCampo(id + 'conta')} value={contaId} onChange={e => setContaId(e.target.value)}>
          {contas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </Campo>
      <Campo rotulo="Data do pagamento" para={id + 'data'} obrigatorio erro={erro}>
        <input type="date" {...propsDoCampo(id + 'data', { erro })} value={data} onChange={e => setData(e.target.value)} />
      </Campo>
    </div>
    <div className="financeiro-acoes">
      <button type="submit" className={estiloBotao({ variante: 'principal' })} disabled={ocupado || !contaId}>{ocupado ? 'Salvando…' : 'Confirmar pagamento'}</button>
      <button type="button" className={estiloBotao()} onClick={aoCancelar}>Cancelar</button>
    </div>
  </form>;
}

function Repasses({ lista, admin, contas, hoje, aoMudar }: { lista: Repasse[]; admin: boolean; contas: ContaFinanceira[]; hoje: string; aoMudar: () => void }) {
  const [pagando, setPagando] = useState<Repasse | null>(null);
  const terminou = () => { setPagando(null); aoMudar(); };
  async function desfazer(r: Repasse) {
    try {
      const { conta_paga: conta, pago_em: data } = r;
      await SD.financeiroDesfazerPagamento(r.id);
      feito('Pagamento desfeito.', 'desfazer o pagamento', async () => { if (conta && data) await SD.financeiroPagarRepasse(r.id, conta, data); });
      terminou();
    } catch (e) { falha(e); }
  }
  if (!lista.length) return <Vazio>{admin ? 'Nenhum repasse a pagar, nem pago neste mês.' : 'Nenhum repasse para você neste mês.'}</Vazio>;
  return <>
    {pagando && <FormPagar key={pagando.id} repasse={pagando} contas={contas} hoje={hoje} aoTerminar={terminou} aoCancelar={() => setPagando(null)} />}
    <div className="tabela"><table aria-label="Repasses">
      <thead><tr>
        <th scope="col">Para</th><th scope="col">Papel</th><th scope="col">De quê</th><th scope="col" className="financeiro-num">Valor</th><th scope="col">Situação</th>
        {admin && <th scope="col"><span className="sr">Ações</span></th>}
      </tr></thead>
      <tbody>{lista.map(r => <tr key={r.id}>
        <td>{r.nome}</td><td>{NOME_DO_REPASSE[r.tipo]}</td><td>{r.descricao}</td>
        <td className="financeiro-num">{fmtCentavos(r.valor)}</td>
        <td>{r.pago_em ? <><Selo tipo="ok">Pago</Selo> em {fmtData(r.pago_em)}</> : <Selo tipo="pend">A pagar</Selo>}</td>
        {admin && <td><span className="financeiro-acoes">{r.pago_em
          ? <BotaoDuplo pequeno variante="perigo" confirmar="Confirmar: desfazer" aoConfirmar={() => desfazer(r)}>Desfazer pagamento</BotaoDuplo>
          : <button type="button" className={estiloBotao({ forma: 'mini', variante: 'principal' })} aria-label={`Pagar o repasse a ${r.nome}`} disabled={!contas.length} onClick={() => setPagando(r)}>Pagar</button>}
        </span></td>}
      </tr>)}</tbody>
    </table></div>
    {admin && !contas.length && <Nota>Crie uma conta em Caixa para pagar os repasses.</Nota>}
  </>;
}

export default function Parcelas() {
  useTitulo('Parcelas');
  const ctx = useCtx();
  const hoje = hojeISO();
  const [mes, setMes] = useState(mesDe(hoje));
  const [lido, setLido] = useState<Lido | null>(null);
  const [contas, setContas] = useState<ContaFinanceira[]>([]);
  const [versao, setVersao] = useState(0);
  const recarregar = () => setVersao(v => v + 1);
  const pode = !!ctx.escritorio?.modulos?.financeiro;
  const admin = ctx.ehAdmin;

  // Só vale a leitura mais recente: trocar de mês não pode trazer de volta a lista anterior.
  useEffect(() => {
    if (!pode) return;
    let vivo = true;
    const { de, ate } = diasDoMes(mes);
    Promise.all([SD.parcelasDoPeriodo(de, ate, hojeISO()), SD.financeiroRepasses(de, ate), SD.financeiroAPassar(de, ate), admin ? SD.financeiroContas() : Promise.resolve([])])
      .then(([parcelas, repasses, aPassar, c]) => { if (vivo) { setLido({ chave: mes, parcelas, repasses, aPassar }); setContas(c.filter(x => !x.arquivada_em)); } })
      .catch(e => { if (vivo) setLido({ chave: mes, erro: (e as Error).message }); });
    return () => { vivo = false; };
  }, [mes, versao, pode, admin]);
  useMudancas(recarregar);

  if (!pode) return <Navigate to="/inicio/" replace />;
  const cabecalho = { titulo: 'Parcelas', visoes: [] };
  const atual = lido?.chave === mes ? lido : null;
  const dados = atual && 'parcelas' in atual ? atual : null;
  const resumo = dados ? resumoDasParcelas(dados.parcelas, hoje) : null;

  return <PaginaModulo {...cabecalho}>
    <AbasDoFinanceiro />
    <div className="financeiro-barra">
      <label>Mês
        {/* Apagar o campo não muda nada: fica o último mês válido. */}
        <input type="month" className="campo" value={mes} onChange={e => { if (mesValido(e.target.value)) setMes(e.target.value); }} />
      </label>
    </div>
    {!atual ? <Carregando /> : 'erro' in atual ? <Aviso tipo="erro">{atual.erro}</Aviso> : dados && resumo && <>
      <dl className="financeiro-resumo" aria-label="Resumo das parcelas">
        {(Object.keys(SITUACOES_DA_PARCELA) as (keyof typeof SITUACOES_DA_PARCELA)[]).map(s => <div key={s}><dt>{SITUACOES_DA_PARCELA[s].nome}</dt><dd>{fmtCentavos(resumo[s])}</dd></div>)}
      </dl>
      {!dados.parcelas.length && <Vazio>{admin ? 'Nenhuma parcela neste mês.' : 'Nenhuma parcela dos seus contratos neste mês.'}</Vazio>}
      <GestaoDeParcelas key={mes} lista={dados.parcelas} hoje={hoje} contrato={p => p} aoMudar={recarregar} />
      {!!dados.parcelas.length && <Nota>Além das que vencem no mês, aparecem as atrasadas de antes dele. As a receber de contratos arquivados só aparecem no contrato.</Nota>}
      <section className="financeiro-ajustes" aria-label="Repasses">
        <TituloSecao>{admin ? 'Repasses' : 'Meus repasses'}</TituloSecao>
        <Repasses lista={dados.repasses} admin={admin} contas={contas} hoje={hoje} aoMudar={recarregar} />
      </section>
      <section className="financeiro-ajustes" aria-label="A passar a participantes e indicadores">
        <TituloSecao>A passar a participantes e indicadores</TituloSecao>
        <ValoresAPassar key={mes} lista={dados.aPassar} hoje={hoje} aoMudar={recarregar} />
      </section>
    </>}
  </PaginaModulo>;
}
