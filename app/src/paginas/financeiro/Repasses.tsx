// Os repasses que o escritório paga a advogados e sócios, na aba Obrigações do Financeiro. O administrador vê os do escritório e paga;
// o advogado vê os dele, sem acesso ao caixa. Quem filtra é o banco. (Até a #331, moravam na página antiga das parcelas.)
import { useId, useState, type FormEvent } from 'react';
import { SD, type ContaFinanceira, type Repasse } from '../../dados';
import { anoAceito, dataExiste } from '../../regras/calendario';
import { fmtCentavos } from '../../regras/caixa';
import { nestePeriodo } from '../../regras/numerosDoFinanceiro';
import { fmtData } from '../../regras/pessoa';
import { falha, feito } from '../../ui/avisos';
import { Campo, CampoData, estiloBotao, Nota, propsDoCampo, Selo, Vazio } from '../../ui/base';
import { BotaoDuplo } from '../../ui/Botoes';

const NOME_DO_REPASSE: Record<Repasse['tipo'], string> = { responsavel: 'Responsável', socio_indicador: 'Sócio que indicou' };

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
        <CampoData formato="iso" {...propsDoCampo(id + 'data', { erro })} valor={data} aoMudar={v => setData(v)} />
      </Campo>
    </div>
    <div className="financeiro-acoes">
      <button type="submit" className={estiloBotao({ variante: 'principal' })} disabled={ocupado || !contaId}>{ocupado ? 'Salvando…' : 'Confirmar pagamento'}</button>
      <button type="button" className={estiloBotao()} onClick={aoCancelar}>Cancelar</button>
    </div>
  </form>;
}

/** Os repasses do período escolhido no alto do Financeiro: um mês ("aaaa-mm") ou o ano todo ("aaaa"). */
export function Repasses({ lista, periodo, admin, contas, hoje, aoMudar }: { lista: Repasse[]; periodo: string; admin: boolean; contas: ContaFinanceira[]; hoje: string; aoMudar: () => void }) {
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
  if (!lista.length) return <Vazio>{admin ? `Nenhum repasse a pagar, nem pago ${nestePeriodo(periodo)}.` : `Nenhum repasse para você ${nestePeriodo(periodo)}.`}</Vazio>;
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
    {admin && !contas.length && <Nota>Crie uma conta em "Contas e DAS" para pagar os repasses.</Nota>}
  </>;
}
