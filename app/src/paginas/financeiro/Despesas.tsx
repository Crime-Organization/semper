// As despesas do escritório a pagar (#439), na aba Obrigações do Financeiro, só para os administradores: DAS, funcionários, contas.
// Cada uma tem descrição, valor, vencimento e, se quiser, a repetição (as próximas datas nascem sozinhas). Marcar como paga só registra
// o pagamento (a saída no caixa se lança à parte); a próxima da repetição continua a pagar. Clicar na descrição abre a despesa: mudar,
// excluir e o histórico. As regras ficam em regras/despesas.ts; o banco, em 20261125102117_despesas_do_escritorio.sql.
import { useId, useState, type FormEvent } from 'react';
import { SD, type DespesaDoEscritorio } from '../../dados';
import { REPETICAO, TAMANHO_FINANCEIRO } from '../../dados/limites';
import { fmtCentavos } from '../../regras/caixa';
import {
  avisoDaDespesaCriada, avisoDaDespesaExcluida, avisoDaDespesaMudada, CAMPOS_DA_DESPESA, dadosDaDespesa, despesaNova, errosDaDespesa, ESCOLHAS_DA_REPETICAO,
  formDaDespesa, repeticaoDaDespesa, rotuloDaDespesa, totalAPagar, valorNaDespesa, type ErrosDaDespesa, type FormDaDespesa
} from '../../regras/despesas';
import { nestePeriodo } from '../../regras/numerosDoFinanceiro';
import { fmtData } from '../../regras/pessoa';
import { descreverRepeticao, FINS_DA_REPETICAO, FREQUENCIAS, type FimDaRepeticao } from '../../regras/repeticao';
import { avisar, falha, feito } from '../../ui/avisos';
import { Campo, CampoData, Escolhas, estiloBotao, Nota, propsDoCampo, Selo, Vazio } from '../../ui/base';
import { BotaoDuplo } from '../../ui/Botoes';
import { Icone } from '../../ui/Icone';
import { PainelCartao } from '../../ui/PainelCartao';
import { Recolhivel } from '../../ui/Recolhivel';
import { HistoricoDoCartao } from '../HistoricoDoCartao';

/** O botão que abre o cadastro, com o mesmo nome no título da janela. */
export const ROTULO_DA_NOVA_DESPESA = 'Nova despesa';
/** O tamanho do "+" do botão, como o de "Nova saída". */
const ICONE_DO_BOTAO = 15;
/** Só esta data ou esta e as seguintes da repetição. */
type Alcance = 'so_esta' | 'seguintes';
const ALCANCES: Record<Alcance, string> = { so_esta: 'Só esta', seguintes: 'Esta e as seguintes' };

function Acoes({ rotulo, ocupado, aoCancelar }: { rotulo: string; ocupado: boolean; aoCancelar: () => void }) {
  return <div className="financeiro-acoes">
    <button type="submit" className={estiloBotao({ variante: 'principal' })} disabled={ocupado}>{ocupado ? 'Salvando…' : rotulo}</button>
    <button type="button" className={estiloBotao()} onClick={aoCancelar}>Cancelar</button>
  </div>;
}

/** A descrição, o valor e o vencimento, no cadastro e no mudar. */
function CamposDaDespesa({ id, f, erros, mudar }: { id: string; f: FormDaDespesa; erros: ErrosDaDespesa; mudar: (m: Partial<FormDaDespesa>) => void }) {
  return <>
    <Campo rotulo="Descrição" para={id + 'desc'} obrigatorio erro={erros.descricao}>
      <input type="text" {...propsDoCampo(id + 'desc', { erro: erros.descricao })} maxLength={TAMANHO_FINANCEIRO.descricao} value={f.descricao} onChange={e => mudar({ descricao: e.target.value })} />
    </Campo>
    <div className="financeiro-form-linha">
      <Campo rotulo="Valor" para={id + 'valor'} obrigatorio erro={erros.valor}>
        <input type="text" inputMode="decimal" placeholder="0,00" {...propsDoCampo(id + 'valor', { erro: erros.valor })} value={f.valor} onChange={e => mudar({ valor: e.target.value })} />
      </Campo>
      <Campo rotulo="Vencimento" para={id + 'venc'} obrigatorio erro={erros.vencimento}>
        <CampoData formato="iso" {...propsDoCampo(id + 'venc', { erro: erros.vencimento })} valor={f.vencimento} aoMudar={v => mudar({ vencimento: v })} />
      </Campo>
    </div>
  </>;
}

/** Os campos da repetição, só no cadastro: a frequência, o "a cada N" e como termina. */
function CamposDaRepeticao({ id, f, erros, mudar }: { id: string; f: FormDaDespesa; erros: ErrosDaDespesa; mudar: (m: Partial<FormDaDespesa>) => void }) {
  return <>
    <Campo rotulo="Repetir" para={id + 'repetir'} dica="As próximas datas nascem sozinhas, até 12 meses adiante.">
      <select {...propsDoCampo(id + 'repetir', { dica: true })} value={f.repetir} onChange={e => mudar({ repetir: e.target.value as FormDaDespesa['repetir'] })}>
        <option value="">Não se repete</option>
        {ESCOLHAS_DA_REPETICAO.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
      </select>
    </Campo>
    {f.repetir && <>
      <Campo rotulo={`A cada (${FREQUENCIAS[f.repetir].unidade[1]})`} para={id + 'aCada'} obrigatorio erro={erros.aCada} dica="1 é toda vez.">
        <input type="number" inputMode="numeric" min={1} max={REPETICAO.intervaloMaximo} {...propsDoCampo(id + 'aCada', { dica: true, erro: erros.aCada })} value={f.aCada}
          onChange={e => mudar({ aCada: e.target.value })} />
      </Campo>
      <Escolhas rotulo="Termina" obrigatorio>
        {(Object.keys(FINS_DA_REPETICAO) as FimDaRepeticao[]).map(fim => <label key={fim}>
          <input type="radio" name={id + 'termina'} checked={f.termina === fim} onChange={() => mudar({ termina: fim })} />{FINS_DA_REPETICAO[fim]}
        </label>)}
      </Escolhas>
      {f.termina === 'data' && <Campo rotulo="Repetir até" para={id + 'ate'} obrigatorio erro={erros.repetirAte}>
        <CampoData formato="iso" {...propsDoCampo(id + 'ate', { erro: erros.repetirAte })} valor={f.repetirAte} aoMudar={v => mudar({ repetirAte: v })} />
      </Campo>}
      {f.termina === 'vezes' && <Campo rotulo="Quantas vezes" para={id + 'vezes'} obrigatorio erro={erros.repetirVezes} dica="Contando a primeira.">
        <input type="number" inputMode="numeric" min={2} max={REPETICAO.vezesMaximas} {...propsDoCampo(id + 'vezes', { dica: true, erro: erros.repetirVezes })} value={f.repetirVezes}
          onChange={e => mudar({ repetirVezes: e.target.value })} />
      </Campo>}
    </>}
  </>;
}

/** O formulário de cadastrar (sem `alvo`) ou de mudar uma despesa. */
function FormDespesa({ alvo, hoje, aoTerminar, aoCancelar }: { alvo?: DespesaDoEscritorio; hoje: string; aoTerminar: () => void; aoCancelar: () => void }) {
  const id = useId();
  const [f, setF] = useState(() => alvo ? formDaDespesa(alvo) : despesaNova(hoje));
  const [alcance, setAlcance] = useState<Alcance>('so_esta');
  const [conferido, setConferido] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const mudar = (m: Partial<FormDaDespesa>) => setF(x => ({ ...x, ...m }));
  const erros = conferido ? errosDaDespesa(f) : {};
  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setConferido(true);
    if (ocupado || Object.keys(errosDaDespesa(f)).length) return;
    setOcupado(true);
    try {
      const dados = dadosDaDespesa(f);
      if (alvo) {
        const seguintes = alcance === 'seguintes';
        const mudadas = await SD.financeiroDespesaMudar(alvo.id, dados, seguintes);
        const antes = { descricao: alvo.descricao, valor: alvo.valor, vencimento: alvo.vencimento };
        // "Esta e as seguintes" não tem Desfazer: as seguintes podiam estar diferentes umas das outras.
        if (seguintes) avisar(avisoDaDespesaMudada(mudadas));
        else feito(avisoDaDespesaMudada(mudadas), 'mudança da despesa', async () => { await SD.financeiroDespesaMudar(alvo.id, antes, false); });
      } else {
        const criada = await SD.financeiroDespesaCriar(dados, repeticaoDaDespesa(f));
        feito(avisoDaDespesaCriada(criada.ids.length), 'cadastro da despesa', async () => { await SD.financeiroDespesaExcluir(criada.id, true); });
      }
      aoTerminar();
    } catch (e) { falha(e); setOcupado(false); }
  }
  return <form className="cartao financeiro-form" noValidate aria-label={alvo ? 'Mudar despesa' : ROTULO_DA_NOVA_DESPESA} onSubmit={salvar}>
    <CamposDaDespesa id={id} f={f} erros={erros} mudar={mudar} />
    {!alvo && <CamposDaRepeticao id={id} f={f} erros={erros} mudar={mudar} />}
    {alvo?.repeticao && <Escolhas rotulo="Mudar" dica="Nas seguintes, mudam a descrição e o valor das que ainda estão a pagar; o vencimento muda só nesta.">
      {(Object.keys(ALCANCES) as Alcance[]).map(a => <label key={a}>
        <input type="radio" name={id + 'alcance'} checked={alcance === a} onChange={() => setAlcance(a)} />{ALCANCES[a]}
      </label>)}
    </Escolhas>}
    <Acoes rotulo={alvo ? 'Salvar despesa' : 'Cadastrar despesa'} ocupado={ocupado} aoCancelar={aoCancelar} />
  </form>;
}

/** Marcar como paga: o dia do pagamento. */
function FormPagar({ despesa, hoje, aoTerminar, aoCancelar }: { despesa: DespesaDoEscritorio; hoje: string; aoTerminar: () => void; aoCancelar: () => void }) {
  const id = useId();
  const [data, setData] = useState(hoje);
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    const problema = errosDaDespesa({ ...formDaDespesa(despesa), vencimento: data }).vencimento ?? '';
    setErro(problema);
    if (problema || ocupado) return;
    setOcupado(true);
    try {
      await SD.financeiroDespesaPagar(despesa.id, data);
      feito('Despesa marcada como paga.', 'marcação de paga', () => SD.financeiroDespesaDesfazerPagamento(despesa.id));
      aoTerminar();
    } catch (e) { falha(e); setOcupado(false); }
  }
  return <form className="cartao financeiro-form" noValidate aria-label={`Marcar como paga: ${rotuloDaDespesa(despesa)}`} onSubmit={salvar}>
    <Nota>{fmtCentavos(despesa.valor)} de {despesa.descricao}. Isto só registra que a despesa foi paga: não cria lançamento no caixa.</Nota>
    <div className="financeiro-form-linha">
      <Campo rotulo="Data do pagamento" para={id + 'data'} obrigatorio erro={erro}>
        <CampoData formato="iso" {...propsDoCampo(id + 'data', { erro })} valor={data} aoMudar={v => setData(v)} />
      </Campo>
    </div>
    <Acoes rotulo="Confirmar" ocupado={ocupado} aoCancelar={aoCancelar} />
  </form>;
}

const situacao = (d: DespesaDoEscritorio) => d.paga_em ? <><Selo tipo="ok">Paga</Selo> em {fmtData(d.paga_em)}</> : <Selo tipo="pend">A pagar</Selo>;

/** A despesa aberta: os dados, mudar, excluir e o histórico. */
function DetalheDaDespesa({ despesa, hoje, aoMudar, aoFechar }: { despesa: DespesaDoEscritorio; hoje: string; aoMudar: () => void; aoFechar: () => void }) {
  const [editando, setEditando] = useState(false);
  const terminou = () => { aoFechar(); aoMudar(); };
  async function excluir(seguintes: boolean) {
    try {
      const ids = await SD.financeiroDespesaExcluir(despesa.id, seguintes);
      feito(avisoDaDespesaExcluida(ids.length, seguintes), 'exclusão da despesa', () => SD.financeiroDespesaRestaurar(ids));
      terminou();
    } catch (e) { falha(e); }
  }
  if (editando) return <FormDespesa alvo={despesa} hoje={hoje} aoTerminar={terminou} aoCancelar={() => setEditando(false)} />;
  return <div className="financeiro-detalhe">
    <p className="financeiro-detalhe-valor tom-saida">
      <b className="num">{fmtCentavos(despesa.valor)}</b>
      <span>{despesa.descricao} · vence em {fmtData(despesa.vencimento)}</span>
    </p>
    <dl className="dados">
      <dt>Situação</dt><dd>{situacao(despesa)}</dd>
      <dt>Repetição</dt><dd>{despesa.repeticao ? descreverRepeticao(despesa.repeticao) : 'Não se repete'}</dd>
    </dl>
    <div className="financeiro-acoes">
      <button type="button" className={estiloBotao({ variante: 'principal' })} onClick={() => setEditando(true)}><Icone nome="editar" tam={14} /> Mudar despesa</button>
      {despesa.repeticao ? <>
        <BotaoDuplo variante="perigo" confirmar="Confirmar: excluir só esta" aoConfirmar={() => excluir(false)}><Icone nome="lixeira" tam={14} /> Excluir só esta</BotaoDuplo>
        <BotaoDuplo variante="perigo" confirmar="Confirmar: excluir esta e as seguintes" aoConfirmar={() => excluir(true)}><Icone nome="lixeira" tam={14} /> Excluir esta e as seguintes</BotaoDuplo>
      </> : <BotaoDuplo variante="perigo" confirmar="Confirmar: excluir" aoConfirmar={() => excluir(false)}><Icone nome="lixeira" tam={14} /> Excluir</BotaoDuplo>}
    </div>
    {despesa.repeticao && <Nota>Excluir esta e as seguintes leva junto as seguintes ainda a pagar, e a repetição para.</Nota>}
    <Recolhivel titulo="Histórico desta despesa" icone="relogio" preferencia="financeiro.historico">
      <HistoricoDoCartao key={despesa.id} carregar={() => SD.financeiroDespesaHistorico(despesa.id)} campos={CAMPOS_DA_DESPESA} valor={valorNaDespesa} versao={0} />
    </Recolhivel>
  </div>;
}

/** As despesas do período escolhido no alto do Financeiro (um mês "aaaa-mm" ou o ano "aaaa") e as a pagar que venceram antes dele. */
export function DespesasDoEscritorio({ lista, periodo, hoje, aoMudar }: { lista: DespesaDoEscritorio[]; periodo: string; hoje: string; aoMudar: () => void }) {
  const [cadastrando, setCadastrando] = useState(false);
  const [pagando, setPagando] = useState<DespesaDoEscritorio | null>(null);
  const [aberta, setAberta] = useState<DespesaDoEscritorio | null>(null);
  const terminou = () => { setCadastrando(false); setPagando(null); aoMudar(); };
  async function desfazer(d: DespesaDoEscritorio) {
    try {
      const data = d.paga_em!;
      await SD.financeiroDespesaDesfazerPagamento(d.id);
      feito('Pagamento desfeito.', 'desfazer a marcação de paga', () => SD.financeiroDespesaPagar(d.id, data));
      aoMudar();
    } catch (e) { falha(e); }
  }
  return <div className="financeiro-form">
    {cadastrando
      ? <FormDespesa hoje={hoje} aoTerminar={terminou} aoCancelar={() => setCadastrando(false)} />
      : <div><button type="button" className={estiloBotao()} onClick={() => setCadastrando(true)}><Icone nome="mais" tam={ICONE_DO_BOTAO} /> {ROTULO_DA_NOVA_DESPESA}</button></div>}
    {pagando && <FormPagar key={pagando.id} despesa={pagando} hoje={hoje} aoTerminar={terminou} aoCancelar={() => setPagando(null)} />}
    {lista.length ? <div className="tabela"><table aria-label="Despesas do escritório">
      <thead><tr>
        <th scope="col">Descrição</th><th scope="col">Vencimento</th><th scope="col" className="financeiro-num">Valor</th><th scope="col">Situação</th>
        <th scope="col"><span className="sr">Ações</span></th>
      </tr></thead>
      <tbody>{lista.map(d => <tr key={d.id}>
        <td><button type="button" className="financeiro-abrir" aria-label={`Abrir a despesa: ${rotuloDaDespesa(d)}`} onClick={() => setAberta(d)}>{d.descricao}</button>
          {d.repeticao && <span className="sub">{descreverRepeticao(d.repeticao)}</span>}</td>
        <td>{fmtData(d.vencimento)}</td>
        <td className="financeiro-num">{fmtCentavos(d.valor)}</td>
        <td>{situacao(d)}</td>
        <td><span className="financeiro-acoes">{d.paga_em
          ? <BotaoDuplo pequeno variante="perigo" confirmar="Confirmar: desfazer" aoConfirmar={() => desfazer(d)}>Desfazer pagamento</BotaoDuplo>
          : <button type="button" className={estiloBotao({ forma: 'mini', variante: 'principal' })} aria-label={`Marcar como paga: ${rotuloDaDespesa(d)}`} onClick={() => setPagando(d)}>Marcar como paga</button>}
        </span></td>
      </tr>)}</tbody>
      <tfoot><tr><th scope="row" colSpan={2}>Total a pagar</th><td className="financeiro-num"><b>{fmtCentavos(totalAPagar(lista))}</b></td><td colSpan={2} /></tr></tfoot>
    </table></div> : <Vazio>Nenhuma despesa {nestePeriodo(periodo)}.</Vazio>}
    <Nota>Além das que vencem no período, aparecem as ainda a pagar que venceram antes dele. Marcar como paga só registra o pagamento: a saída no caixa se lança em Nova saída.</Nota>
    {aberta && <PainelCartao aoFechar={() => setAberta(null)} soNoCentro ajustado rotulo="Despesa">
      <header className="cartao-cabeca"><h2>Despesa</h2></header>
      <DetalheDaDespesa key={aberta.id} despesa={aberta} hoje={hoje} aoMudar={aoMudar} aoFechar={() => setAberta(null)} />
    </PainelCartao>}
  </div>;
}
