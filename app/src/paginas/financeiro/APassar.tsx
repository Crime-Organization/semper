// O que o responsável passa aos participantes e ao indicador que não é sócio. Esse dinheiro não passa pelo caixa do escritório: marcar como
// pago só registra o fato, e é isso que muda a linha da pessoa em "Meus valores". Quem marca é quem recebeu o dinheiro, o responsável da época, ou um administrador.
import { useId, useState, type FormEvent } from 'react';
import { SD, type ValorAPassar } from '../../dados';
import { fmtCentavos } from '../../regras/caixa';
import { erroDaDataDoPagamento } from '../../regras/meusValores';
import { fmtData } from '../../regras/pessoa';
import { falha, feito } from '../../ui/avisos';
import { Campo, estiloBotao, Nota, propsDoCampo, Selo, Vazio } from '../../ui/base';
import { BotaoDuplo } from '../../ui/Botoes';

const rotuloDoValor = (v: ValorAPassar) => `${v.nome}, parcela ${v.parcela_numero} de ${v.contrato_codigo}`;

function FormMarcar({ valor, hoje, aoTerminar, aoCancelar }: { valor: ValorAPassar; hoje: string; aoTerminar: () => void; aoCancelar: () => void }) {
  const id = useId();
  const [data, setData] = useState(hoje);
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    const problema = erroDaDataDoPagamento(data) ?? '';
    setErro(problema);
    if (problema || ocupado) return;
    setOcupado(true);
    try {
      await SD.financeiroTerceiroMarcarPago(valor.recebimento_id, valor.pessoa_id, data);
      feito('Marcado como pago.', 'marcação de pago', () => SD.financeiroTerceiroDesfazerPago(valor.recebimento_id, valor.pessoa_id));
      aoTerminar();
    } catch (e) { falha(e); setOcupado(false); }
  }
  return <form className="cartao financeiro-form" noValidate aria-label={`Marcar como pago: ${rotuloDoValor(valor)}`} onSubmit={salvar}>
    <Nota>{fmtCentavos(valor.valor)} a {valor.nome}. Isto só registra que o valor foi pago: não cria lançamento no caixa.</Nota>
    <div className="financeiro-form-linha">
      <Campo rotulo="Data do pagamento" para={id + 'data'} obrigatorio erro={erro}>
        <input type="date" {...propsDoCampo(id + 'data', { erro })} value={data} onChange={e => setData(e.target.value)} />
      </Campo>
    </div>
    <div className="financeiro-acoes">
      <button type="submit" className={estiloBotao({ variante: 'principal' })} disabled={ocupado}>{ocupado ? 'Salvando…' : 'Confirmar'}</button>
      <button type="button" className={estiloBotao()} onClick={aoCancelar}>Cancelar</button>
    </div>
  </form>;
}

export function ValoresAPassar({ lista, hoje, aoMudar }: { lista: ValorAPassar[]; hoje: string; aoMudar: () => void }) {
  const [marcando, setMarcando] = useState<ValorAPassar | null>(null);
  const terminou = () => { setMarcando(null); aoMudar(); };
  async function desfazer(v: ValorAPassar) {
    try {
      const data = v.pago_em!;
      await SD.financeiroTerceiroDesfazerPago(v.recebimento_id, v.pessoa_id);
      feito('Marcação desfeita.', 'desfazer a marcação de pago', () => SD.financeiroTerceiroMarcarPago(v.recebimento_id, v.pessoa_id, data));
      terminou();
    } catch (e) { falha(e); }
  }
  if (!lista.length) return <Vazio>Nada a passar neste mês.</Vazio>;
  return <div className="financeiro-form">
    {marcando && <FormMarcar key={marcando.recebimento_id + marcando.pessoa_id} valor={marcando} hoje={hoje} aoTerminar={terminou} aoCancelar={() => setMarcando(null)} />}
    <div className="tabela"><table aria-label="Valores a passar">
      <thead><tr>
        <th scope="col">Para</th><th scope="col">Contrato</th><th scope="col">Cliente</th><th scope="col">Parcela</th><th scope="col">Cliente pagou em</th>
        <th scope="col" className="financeiro-num">Valor</th><th scope="col">Situação</th><th scope="col"><span className="sr">Ações</span></th>
      </tr></thead>
      <tbody>{lista.map(v => <tr key={v.recebimento_id + v.pessoa_id}>
        <td>{v.nome}</td><td>{v.contrato_codigo}</td><td>{v.cliente_nome}</td><td>{v.parcela_numero}</td><td>{fmtData(v.recebido_em)}</td>
        <td className="financeiro-num">{fmtCentavos(v.valor)}</td>
        <td>{v.pago_em ? <><Selo tipo="ok">Pago</Selo> em {fmtData(v.pago_em)}</> : <Selo tipo="pend">A pagar</Selo>}</td>
        <td><span className="financeiro-acoes">{v.pago_em
          ? <BotaoDuplo pequeno variante="perigo" confirmar="Confirmar: desfazer" aoConfirmar={() => desfazer(v)}>Desfazer marcação</BotaoDuplo>
          : <button type="button" className={estiloBotao({ forma: 'mini', variante: 'principal' })} aria-label={`Marcar como pago: ${rotuloDoValor(v)}`} onClick={() => setMarcando(v)}>Marcar como pago</button>}
        </span></td>
      </tr>)}</tbody>
    </table></div>
    <Nota>Quem era o responsável quando o cliente pagou passa estes valores direto, sem passar pelo caixa. Além dos recebimentos do mês, aparecem os ainda não pagos de antes dele.</Nota>
  </div>;
}
