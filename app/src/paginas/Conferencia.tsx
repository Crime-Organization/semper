// A conferência dos lançamentos com o caixa, em forma de planilha: cada responsável vê as próprias linhas, corrige o que foi pago e marca
// Confere ou Não confere. O administrador vê também o resumo de todos. Quem filtra é o banco. Corrigir aqui nunca muda o caixa.
import { useEffect, useId, useState } from 'react';
import { Navigate } from 'react-router';
import { SD, type LinhaDaConferencia, type ResumoDaConferencia, type SituacaoDaConferencia } from '../dados';
import { POR_PAGINA, TAMANHO_CONFERENCIA } from '../dados/limites';
import { fmtCentavos } from '../regras/caixa';
import {
  ANOS_DA_CONFERENCIA, correcaoDaLinha, filtrarConferencia, FILTROS_DA_CONFERENCIA, formDaLinha, SITUACOES_DA_CONFERENCIA, totaisDaConferencia, type FiltroDaConferencia, type FormDaLinha, type TotaisDaConferencia
} from '../regras/conferencia';
import { fmtData } from '../regras/pessoa';
import { falha, feito, useMudancas } from '../ui/avisos';
import { Aviso, Carregando, estiloBotao, Nota, propsDoCampo, Selo, TituloSecao, Vazio } from '../ui/base';
import { PaginaModulo } from '../ui/PaginaModulo';
import { useCtx } from '../ui/sessao';
import { hojeISO, useTitulo } from '../ui/util';
import { HistoricoDoCartao } from './HistoricoDoCartao';
import './Financeiro.css';

const SEM_RESPONSAVEL = 'Sem responsável';

function Totais({ t }: { t: TotaisDaConferencia }) {
  return <dl className="financeiro-resumo" aria-label="Totais da conferência">
    <div><dt>Linhas</dt><dd>{t.total}</dd></div>
    <div><dt>Confere</dt><dd>{t.confere}: {fmtCentavos(t.valor_confere)}</dd></div>
    <div><dt>Não confere</dt><dd>{t.nao_confere}: {fmtCentavos(t.valor_nao_confere)}</dd></div>
    <div><dt>A conferir</dt><dd>{t.falta}: {fmtCentavos(t.valor_falta)}</dd></div>
  </dl>;
}

function Resumo({ linhas, nomeDe, aoEscolher }: { linhas: ResumoDaConferencia[]; nomeDe: (id: string | null) => string; aoEscolher: (r: ResumoDaConferencia) => void }) {
  return <section className="financeiro-ajustes" aria-label="Resumo de todos">
    <TituloSecao>Resumo de todos</TituloSecao>
    <div className="tabela"><table aria-label="Resumo por responsável e ano">
      <thead><tr>
        <th scope="col">Responsável</th><th scope="col">Ano</th><th scope="col" className="financeiro-num">Linhas</th><th scope="col" className="financeiro-num">Confere</th>
        <th scope="col" className="financeiro-num">Não confere</th><th scope="col" className="financeiro-num">A conferir</th><th scope="col"><span className="sr">Ações</span></th>
      </tr></thead>
      <tbody>{linhas.map(r => <tr key={`${r.ano}|${r.responsavel_id}`}>
        <td>{nomeDe(r.responsavel_id)}</td><td>{r.ano}</td><td className="financeiro-num">{r.total}</td>
        <td className="financeiro-num">{r.confere}: {fmtCentavos(r.valor_confere)}</td>
        <td className="financeiro-num">{r.nao_confere}: {fmtCentavos(r.valor_nao_confere)}</td>
        <td className="financeiro-num">{r.falta}: {fmtCentavos(r.valor_falta)}</td>
        <td><button type="button" className={estiloBotao({ forma: 'mini' })} aria-label={`Ver as linhas de ${nomeDe(r.responsavel_id)} em ${r.ano}`} onClick={() => aoEscolher(r)}>Ver linhas</button></td>
      </tr>)}</tbody>
    </table></div>
  </section>;
}

function Linha({ l, nomeDe, aoMudar, aoVerHistorico }: { l: LinhaDaConferencia; nomeDe: (id: string | null) => string; aoMudar: (m: Partial<LinhaDaConferencia>) => void; aoVerHistorico: () => void }) {
  const ctx = useCtx();
  const id = useId();
  const [f, setF] = useState<FormDaLinha>(() => formDaLinha(l));
  const [observacao, setObservacao] = useState(l.observacao ?? '');
  const [erros, setErros] = useState<Partial<Record<keyof FormDaLinha, string>>>({});
  const rotulo = `${l.cliente}${l.referencia ? ', ' + l.referencia : ''}`;

  // O desfazer relê a lista: o que estava digitado acompanha o que ficou gravado.
  const { data_pago: pagoGravado, valor_pago: valorGravado } = l;
  useEffect(() => { setF(formDaLinha({ data_pago: pagoGravado, valor_pago: valorGravado })); }, [pagoGravado, valorGravado]);
  useEffect(() => { setObservacao(l.observacao ?? ''); }, [l.observacao]);

  async function salvarPagamento() {
    const c = correcaoDaLinha(f, l, hojeISO());
    if (c.acao === 'erro') { setErros(c.erros); return; }
    setErros({});
    if (c.acao === 'nada') return;
    const { data_pago, valor_pago } = l;
    try {
      await SD.conferenciaCorrigir(l.id, c.data, c.valor);
      aoMudar({ data_pago: c.data, valor_pago: c.valor });
      // A linha que só existe no caixa não tinha pagamento para onde voltar.
      if (data_pago && valor_pago) feito('Pagamento corrigido.', 'correção do pagamento', () => SD.conferenciaCorrigir(l.id, data_pago, valor_pago));
    } catch (e) { falha(e); }
  }
  async function marcar(situacao: SituacaoDaConferencia | null, texto: string) {
    const antes = { situacao: l.situacao, observacao: l.observacao };
    const limpa = texto.trim() || null;
    if (situacao === antes.situacao && limpa === antes.observacao) return;
    try {
      await SD.conferenciaMarcar(l.id, situacao, limpa);
      aoMudar({ situacao, observacao: limpa, marcado_por: situacao || limpa ? ctx.perfil?.id ?? null : null, marcado_em: situacao || limpa ? new Date().toISOString() : null });
      feito('Conferência salva.', 'conferência', () => SD.conferenciaMarcar(l.id, antes.situacao, antes.observacao));
    } catch (e) { falha(e); }
  }

  return <tr>
    <td>{l.cliente}{l.servico && <div className="nota">{l.servico}</div>}{l.referencia && <div className="nota">{l.referencia}</div>}</td>
    <td>
      <input type="date" className="campo" aria-label={`Pago em: ${rotulo}`} {...propsDoCampo(id + 'data', { erro: erros.pagoEm })} value={f.pagoEm} onChange={e => setF({ ...f, pagoEm: e.target.value })} onBlur={salvarPagamento} />
      {erros.pagoEm && <div className="msg-erro" role="alert" id={id + 'data-erro'}>{erros.pagoEm}</div>}
    </td>
    <td>
      <input type="text" inputMode="decimal" className="campo conferencia-valor" aria-label={`Valor pago: ${rotulo}`} {...propsDoCampo(id + 'valor', { erro: erros.valorPago })} value={f.valorPago} onChange={e => setF({ ...f, valorPago: e.target.value })} onBlur={salvarPagamento} />
      {erros.valorPago && <div className="msg-erro" role="alert" id={id + 'valor-erro'}>{erros.valorPago}</div>}
    </td>
    <td className="financeiro-num">{l.valor_esperado === null ? '—' : fmtCentavos(l.valor_esperado)}</td>
    <td>{l.valor_caixa === null ? 'Sem entrada' : <>{fmtCentavos(l.valor_caixa)}{l.data_caixa && <div className="nota">{fmtData(l.data_caixa)}</div>}{l.conta_caixa && <div className="nota">{l.conta_caixa}</div>}</>}</td>
    <td><Selo tipo={SITUACOES_DA_CONFERENCIA[l.sugestao].selo}>{SITUACOES_DA_CONFERENCIA[l.sugestao].nome}</Selo>{l.motivo && <div className="nota">{l.motivo}</div>}</td>
    <td>
      <select className="campo" aria-label={`Situação: ${rotulo}`} value={l.situacao ?? ''} onChange={e => marcar((e.target.value || null) as SituacaoDaConferencia | null, observacao)}>
        <option value="">A conferir</option>
        {(Object.keys(SITUACOES_DA_CONFERENCIA) as SituacaoDaConferencia[]).map(s => <option key={s} value={s}>{SITUACOES_DA_CONFERENCIA[s].nome}</option>)}
      </select>
      {l.marcado_em && <div className="nota">{nomeDe(l.marcado_por)}, {fmtData(l.marcado_em.slice(0, 10))}</div>}
    </td>
    <td><input type="text" className="campo" aria-label={`Observação: ${rotulo}`} maxLength={TAMANHO_CONFERENCIA.observacao} value={observacao} onChange={e => setObservacao(e.target.value)} onBlur={() => marcar(l.situacao, observacao)} /></td>
    <td><button type="button" className={estiloBotao({ forma: 'mini' })} aria-label={`Ver o histórico: ${rotulo}`} onClick={aoVerHistorico}>Histórico</button></td>
  </tr>;
}

type Lido<T> = { chave: string; dados: T } | { chave: string; erro: string };

export default function Conferencia() {
  useTitulo('Conferência');
  const ctx = useCtx();
  const pode = !!ctx.escritorio?.modulos?.financeiro;
  const [ano, setAno] = useState(ANOS_DA_CONFERENCIA[0]);
  const [responsavel, setResponsavel] = useState('');
  const [filtro, setFiltro] = useState<FiltroDaConferencia>('todas');
  const [busca, setBusca] = useState('');
  const [quantas, setQuantas] = useState(POR_PAGINA);
  const [lido, setLido] = useState<Lido<LinhaDaConferencia[]> | null>(null);
  const [resumo, setResumo] = useState<ResumoDaConferencia[] | string | null>(null);
  const [historico, setHistorico] = useState<LinhaDaConferencia | null>(null);
  const [versao, setVersao] = useState(0);
  const [edicoes, setEdicoes] = useState(0);
  const chave = `${ano}|${responsavel}`;
  const nomeDe = (pid: string | null) => (pid && ctx.equipe.find(m => m.id === pid)?.nome) || SEM_RESPONSAVEL;

  // Só vale a leitura mais recente: trocar de ano não pode trazer de volta a lista anterior.
  useEffect(() => {
    if (!pode) return;
    let vivo = true;
    SD.conferenciaListar(ano, responsavel || null)
      .then(dados => { if (vivo) setLido({ chave, dados }); })
      .catch(e => { if (vivo) setLido({ chave, erro: (e as Error).message }); });
    return () => { vivo = false; };
  }, [ano, responsavel, chave, versao, pode]);
  useEffect(() => {
    if (!pode || !ctx.ehAdmin) return;
    let vivo = true;
    SD.conferenciaResumo().then(r => { if (vivo) setResumo(r); }).catch(e => { if (vivo) setResumo((e as Error).message); });
    return () => { vivo = false; };
  }, [versao, pode, ctx.ehAdmin]);
  useMudancas(() => setVersao(v => v + 1));

  if (!pode) return <Navigate to="/inicio/" replace />;
  const atual = lido?.chave === chave ? lido : null;
  const linhas = atual && 'dados' in atual ? atual.dados : [];
  const achadas = filtrarConferencia(linhas, filtro, busca);
  const mudarLinha = (id: string, m: Partial<LinhaDaConferencia>) => {
    setLido(x => x && 'dados' in x ? { ...x, dados: x.dados.map(l => l.id === id ? { ...l, ...m } : l) } : x);
    setEdicoes(n => n + 1);
    // O resumo soma o que acabou de mudar; a lista já está certa.
    if (ctx.ehAdmin) SD.conferenciaResumo().then(setResumo).catch(() => {});
  };

  return <PaginaModulo titulo="Conferência" visoes={[]}>
    <Nota>Confira cada lançamento com o que entrou no caixa. Corrigir aqui não muda o caixa, os repasses nem o lucro.</Nota>
    {ctx.ehAdmin && (resumo === null ? <Carregando /> : typeof resumo === 'string' ? <Aviso tipo="erro">{resumo}</Aviso>
      : resumo.length > 0 && <Resumo linhas={resumo} nomeDe={nomeDe} aoEscolher={r => { setAno(r.ano); setResponsavel(r.responsavel_id ?? ''); setQuantas(POR_PAGINA); }} />)}
    <div className="financeiro-barra">
      <label>Ano
        <select className="campo" aria-label="Ano" value={ano} onChange={e => { setAno(Number(e.target.value)); setQuantas(POR_PAGINA); }}>
          {ANOS_DA_CONFERENCIA.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </label>
      {ctx.ehAdmin && <label>Responsável
        <select className="campo" aria-label="Responsável" value={responsavel} onChange={e => { setResponsavel(e.target.value); setQuantas(POR_PAGINA); }}>
          <option value="">Todos</option>
          {ctx.equipe.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
        </select>
      </label>}
      <label>Situação
        <select className="campo" aria-label="Situação" value={filtro} onChange={e => { setFiltro(e.target.value as FiltroDaConferencia); setQuantas(POR_PAGINA); }}>
          {(Object.keys(FILTROS_DA_CONFERENCIA) as FiltroDaConferencia[]).map(s => <option key={s} value={s}>{FILTROS_DA_CONFERENCIA[s]}</option>)}
        </select>
      </label>
      <label>Buscar
        <input type="search" className="campo" placeholder="Cliente, serviço ou contrato" value={busca} onChange={e => { setBusca(e.target.value); setQuantas(POR_PAGINA); }} />
      </label>
    </div>
    {!atual ? <Carregando /> : 'erro' in atual ? <Aviso tipo="erro">{atual.erro}</Aviso> : !linhas.length
      ? <Vazio>Nenhum lançamento para conferir em {ano}.</Vazio>
      : <>
        <Totais t={totaisDaConferencia(linhas)} />
        {!achadas.length ? <Vazio>Nenhuma linha com esse filtro.</Vazio> : <div className="tabela"><table className="conferencia" aria-label="Lançamentos para conferir">
          <thead><tr>
            <th scope="col">Cliente</th><th scope="col">Pago em</th><th scope="col">Valor pago</th><th scope="col" className="financeiro-num">Parte do escritório</th>
            <th scope="col">Entrou no caixa</th><th scope="col">Cruzamento</th><th scope="col">Situação</th><th scope="col">Observação</th><th scope="col"><span className="sr">Ações</span></th>
          </tr></thead>
          <tbody>{achadas.slice(0, quantas).map(l => <Linha key={l.id} l={l} nomeDe={nomeDe} aoMudar={m => mudarLinha(l.id, m)} aoVerHistorico={() => setHistorico(l)} />)}</tbody>
        </table></div>}
        {achadas.length > quantas && <div className="financeiro-acoes"><button type="button" className={estiloBotao()} onClick={() => setQuantas(q => q + POR_PAGINA)}>Mostrar mais ({achadas.length - quantas})</button></div>}
        {historico && <section className="financeiro-ajustes" aria-label="Histórico da linha">
          <TituloSecao>Histórico: {historico.cliente}</TituloSecao>
          <HistoricoDoCartao key={historico.id} carregar={() => SD.conferenciaHistorico(historico.id)} campos={{}} valor={(_campo, v) => v === null || v === undefined ? '—' : String(v)} versao={versao + edicoes} />
          <div className="financeiro-acoes"><button type="button" className={estiloBotao()} onClick={() => setHistorico(null)}>Fechar</button></div>
        </section>}
      </>}
  </PaginaModulo>;
}
