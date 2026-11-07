// O lucro dos sócios, só para administradores: quanto cada um acumulou em cada mês, quanto já foi pago e quanto está em aberto. "Como
// responsável" e "como indicador" ficam em tabelas separadas e nunca se somam. A página de módulo dá o cabeçalho.
import { useEffect, useId, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router';
import { SD, type ContaFinanceira, type MovimentoDoLucro, type Socio } from '../dados';
import { TAMANHO_FINANCEIRO } from '../dados/limites';
import { fmtCentavos } from '../regras/caixa';
import { anosDoLucro, avisoDaRetirada, dadosDaRetirada, emAbertoComoResponsavel, errosDaRetirada, lucroDoAno, MESES_DO_ANO, retiradaNova, rotuloDoEmAberto, totalDasLinhas, type FormDaRetirada, type LinhaDoLucro } from '../regras/lucro';
import { fmtData } from '../regras/pessoa';
import { falha, feito, useMudancas } from '../ui/avisos';
import { Aviso, Campo, Carregando, estiloBotao, Nota, propsDoCampo, TituloSecao, Vazio } from '../ui/base';
import { BotaoDuplo } from '../ui/Botoes';
import { Icone } from '../ui/Icone';
import { PaginaModulo } from '../ui/PaginaModulo';
import { useCtx } from '../ui/sessao';
import { hojeISO, useTitulo } from '../ui/util';
import './Financeiro.css';
import { AbasDoFinanceiro } from './financeiro/AbasDoFinanceiro';

/** Zero aparece como traço, para o que importa saltar aos olhos. */
const valorOuTraco = (centavos: number) => centavos === 0 ? '—' : fmtCentavos(centavos);

function TabelaDoLucro({ rotulo, linhas, ano, hoje }: { rotulo: string; linhas: LinhaDoLucro[]; ano: number; hoje: string }) {
  const total = totalDasLinhas(linhas);
  return <div className="tabela"><table aria-label={rotulo}>
    <thead><tr>
      <th scope="col">Sócio</th><th scope="col" className="financeiro-num">{rotuloDoEmAberto(ano, hoje)}</th><th scope="col" className="financeiro-num">Pago em {ano}</th>
      <th scope="col" className="financeiro-num">Antes de {ano}</th>
      {MESES_DO_ANO.map(m => <th key={m} scope="col" className="financeiro-num">{m}</th>)}
    </tr></thead>
    <tbody>{linhas.map(l => <tr key={l.pessoaId}>
      <td className="nome">{l.nome}</td><td className="financeiro-num"><b>{fmtCentavos(l.emAberto)}</b></td><td className="financeiro-num">{valorOuTraco(l.pago)}</td>
      <td className="financeiro-num">{valorOuTraco(l.anterior)}</td>
      {l.meses.map((v, i) => <td key={MESES_DO_ANO[i]} className="financeiro-num">{valorOuTraco(v)}</td>)}
    </tr>)}</tbody>
    <tfoot><tr>
      <th scope="row">Total</th><td className="financeiro-num"><b>{fmtCentavos(total.emAberto)}</b></td><td className="financeiro-num">{valorOuTraco(total.pago)}</td>
      <td className="financeiro-num">{valorOuTraco(total.anterior)}</td>
      {total.meses.map((v, i) => <td key={MESES_DO_ANO[i]} className="financeiro-num">{valorOuTraco(v)}</td>)}
    </tr></tfoot>
  </table></div>;
}

function FormPagarLucro({ socios, contas, movimento, hoje, aoTerminar, aoCancelar }: { socios: { id: string; nome: string }[]; contas: ContaFinanceira[]; movimento: MovimentoDoLucro; hoje: string; aoTerminar: (ano: number) => void; aoCancelar: () => void }) {
  const id = useId();
  const emAberto = (pessoaId: string) => pessoaId ? emAbertoComoResponsavel(movimento, pessoaId) : 0;
  const [f, setF] = useState<FormDaRetirada>(() => retiradaNova(socios[0]?.id ?? '', contas[0]?.id ?? '', hoje, emAberto(socios[0]?.id ?? '')));
  const [conferido, setConferido] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const conta = contas.find(c => c.id === f.contaId);
  const erros = conferido ? errosDaRetirada(f, conta) : {};
  const mudar = (m: Partial<FormDaRetirada>) => setF(x => ({ ...x, ...m }));
  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setConferido(true);
    if (ocupado || Object.keys(errosDaRetirada(f, conta)).length) return;
    setOcupado(true);
    try {
      const retirada = await SD.financeiroPagarLucro(dadosDaRetirada(f));
      feito('Lucro pago.', 'pagamento do lucro', () => SD.financeiroDesfazerLucro(retirada));
      aoTerminar(Number(f.data.slice(0, 4)));
    } catch (e) { falha(e); setOcupado(false); }
  }
  return <form className="cartao financeiro-form" noValidate aria-label="Pagar lucro" onSubmit={salvar}>
    <Nota>Isto cria a saída "Divisão de lucro" no caixa. Para só mover dinheiro da PJ para a PF, use "Repasse entre contas", no Caixa: não conta como lucro.</Nota>
    <div className="financeiro-form-linha">
      <Campo rotulo="Sócio" para={id + 'socio'} obrigatorio erro={erros.pessoaId}>
        <select {...propsDoCampo(id + 'socio', { erro: erros.pessoaId })} value={f.pessoaId} onChange={e => { const em = emAberto(e.target.value); mudar({ pessoaId: e.target.value, valor: retiradaNova(e.target.value, f.contaId, f.data, em).valor }); }}>
          {socios.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
        </select>
      </Campo>
      <Campo rotulo="Conta de onde sai" para={id + 'conta'} obrigatorio erro={erros.contaId}>
        <select {...propsDoCampo(id + 'conta', { erro: erros.contaId })} value={f.contaId} onChange={e => mudar({ contaId: e.target.value })}>
          {contas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </Campo>
    </div>
    <div className="financeiro-form-linha">
      <Campo rotulo="Data do pagamento" para={id + 'data'} obrigatorio erro={erros.data}>
        <input type="date" {...propsDoCampo(id + 'data', { erro: erros.data })} value={f.data} onChange={e => mudar({ data: e.target.value })} />
      </Campo>
      <Campo rotulo="Valor" para={id + 'valor'} obrigatorio erro={erros.valor} dica={`Em aberto até hoje: ${fmtCentavos(emAberto(f.pessoaId))}.`}>
        <input type="text" inputMode="decimal" placeholder="0,00" {...propsDoCampo(id + 'valor', { erro: erros.valor })} value={f.valor} onChange={e => mudar({ valor: e.target.value })} />
      </Campo>
    </div>
    {avisoDaRetirada(f, emAberto(f.pessoaId)) && <Aviso tipo="info">{avisoDaRetirada(f, emAberto(f.pessoaId))}</Aviso>}
    <Campo rotulo="Descrição" para={id + 'descricao'} erro={erros.descricao} dica="Em branco, fica o nome do sócio.">
      <input type="text" {...propsDoCampo(id + 'descricao', { erro: erros.descricao })} maxLength={TAMANHO_FINANCEIRO.descricao} value={f.descricao} onChange={e => mudar({ descricao: e.target.value })} />
    </Campo>
    <div className="financeiro-acoes">
      <button type="submit" className={estiloBotao({ variante: 'principal' })} disabled={ocupado}>{ocupado ? 'Salvando…' : 'Confirmar pagamento'}</button>
      <button type="button" className={estiloBotao()} onClick={aoCancelar}>Cancelar</button>
    </div>
  </form>;
}

export default function Lucros() {
  useTitulo('Lucro dos sócios');
  const ctx = useCtx();
  const hoje = hojeISO();
  const [dados, setDados] = useState<{ movimento: MovimentoDoLucro; contas: ContaFinanceira[]; socios: Socio[] } | null>(null);
  const [erroInicial, setErroInicial] = useState('');
  const [ano, setAno] = useState(Number(hoje.slice(0, 4)));
  const [pagando, setPagando] = useState(false);
  const [versao, setVersao] = useState(0);
  const recarregar = () => setVersao(v => v + 1);
  const pode = ctx.ehAdmin && !!ctx.escritorio?.modulos?.financeiro;

  useEffect(() => {
    if (!pode) return;
    let vivo = true;
    Promise.all([SD.financeiroLucro(), SD.financeiroContas(), SD.financeiroSocios()])
      .then(([movimento, contas, socios]) => { if (vivo) { setDados({ movimento, contas, socios }); setErroInicial(''); } })
      .catch(e => { if (vivo) setDados(atual => { if (atual) falha(e); else setErroInicial((e as Error).message); return atual; }); });
    return () => { vivo = false; };
  }, [versao, pode]);
  useMudancas(() => { setPagando(false); recarregar(); });

  if (!pode) return <Navigate to="/inicio/" replace />;
  const cabecalho = { titulo: 'Lucro dos sócios', visoes: [] };
  if (erroInicial) return <PaginaModulo {...cabecalho}><AbasDoFinanceiro /><Aviso tipo="erro">{erroInicial}</Aviso></PaginaModulo>;
  if (!dados) return <PaginaModulo {...cabecalho}><AbasDoFinanceiro /><Carregando /></PaginaModulo>;

  const { movimento, contas, socios } = dados;
  const { responsavel, indicador } = lucroDoAno(movimento, socios, ano);
  const ativas = contas.filter(c => !c.arquivada_em);
  // Quem pode receber: todos os sócios da lista e quem acumulou, mesmo que já tenha saído.
  const quemRecebe = [...new Map([...socios.map(s => [s.pessoa_id, s.nome] as const), ...movimento.recebimentos.map(r => [r.pessoa_id, r.nome] as const)]).entries()]
    .map(([id, nome]) => ({ id, nome })).toSorted((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const doAno = movimento.retiradas.filter(r => r.data.startsWith(String(ano))).toSorted((a, b) => b.data.localeCompare(a.data));
  async function desfazer(id: string, nome: string) {
    try {
      await SD.financeiroDesfazerLucro(id);
      feito(`O pagamento a ${nome} foi desfeito.`, 'pagamento desfeito', () => SD.financeiroRestaurarLucro(id));
      recarregar();
    } catch (e) { falha(e); }
  }

  return <PaginaModulo {...cabecalho}>
    <AbasDoFinanceiro />
    <div className="financeiro-barra">
      <label>Ano
        <select className="campo" value={ano} onChange={e => setAno(Number(e.target.value))}>
          {anosDoLucro(movimento, hoje, ano).map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </label>
      <button type="button" className={estiloBotao({ variante: 'principal' })} disabled={!quemRecebe.length || !ativas.length} onClick={() => setPagando(true)}><Icone nome="mais" tam={15} /> Pagar lucro</button>
    </div>
    {quemRecebe.length > 0 && !ativas.length && <Nota>Para pagar, crie ou reative uma conta no Caixa.</Nota>}
    {[...responsavel, ...indicador].some(l => l.emAberto < 0) && <Nota>Valor negativo em aberto: o sócio retirou mais do que acumulou.</Nota>}
    {!quemRecebe.length && !responsavel.length && !indicador.length ? <Vazio>Nenhum sócio ainda. Coloque os sócios na lista, no Caixa, para acompanhar o lucro.</Vazio> : <>
      {pagando && <FormPagarLucro socios={quemRecebe} contas={ativas} movimento={movimento} hoje={hoje} aoTerminar={anoPago => { setPagando(false); setAno(anoPago); recarregar(); }} aoCancelar={() => setPagando(false)} />}

      <TituloSecao>Como responsável</TituloSecao>
      <Nota>A parte do responsável nas entradas de que o sócio cuidou, quando tudo foi para a conta da empresa. A parte do escritório não entra aqui.</Nota>
      <TabelaDoLucro rotulo="Lucro como responsável" linhas={responsavel} ano={ano} hoje={hoje} />

      <TituloSecao>Como indicador</TituloSecao>
      <Nota>Os 10% do que o cliente pagou. O pagamento é feito em Parcelas, nos repasses.</Nota>
      <TabelaDoLucro rotulo="Lucro como indicador" linhas={indicador} ano={ano} hoje={hoje} />

      <TituloSecao>Pagamentos de {ano}</TituloSecao>
      {doAno.length ? <ul className="financeiro-lista" aria-label={`Pagamentos de lucro de ${ano}`}>{doAno.map(r => <li key={r.id}>
        <span><b>{r.nome}</b>: {fmtCentavos(r.valor)} em {fmtData(r.data)}, de {contas.find(c => c.id === r.conta_id)?.nome ?? 'conta'}</span>
        <BotaoDuplo pequeno variante="perigo" confirmar="Confirmar: desfazer" aoConfirmar={() => desfazer(r.id, r.nome)}>Desfazer</BotaoDuplo>
      </li>)}</ul> : <Vazio>Nenhum pagamento de lucro neste ano.</Vazio>}
    </>}
  </PaginaModulo>;
}
