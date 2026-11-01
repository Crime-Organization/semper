// O calendário do ano, mês a mês: os feriados nacionais, os prontos que cada órgão segue e os dias que o escritório
// lançou. Os administradores lançam dias (um ou vários de uma vez, para um ou mais órgãos) e excluem os lançados.
import { useEffect, useState, type FormEvent } from 'react';
import { SD, type DiaLancado, type Orgao } from '../../dados';
import { TAMANHO_DIA } from '../../dados/limites';
import { diaDaSemana, erroDoLancamento, fmtPeriodo, linhasDoLancamento, MESES, ORIGENS, periodosDoAno, TIPOS_NA_TELA, TODOS_OS_ORGAOS, type PedidoDeLancamento, type PeriodoDoAno } from '../../regras/calendario';
import type { TipoSemExpediente } from '../../regras/prazos';
import { avisar, falha } from '../../ui/avisos';
import { BotaoDuplo } from '../../ui/Botoes';
import { Aviso, Campo, Carregando, Cartao, Escolhas, estiloBotao, naGrade, Nota, propsDoCampo, Selo, TituloSecao, Vazio, type TipoSelo } from '../../ui/base';
import { Icone } from '../../ui/Icone';

/** Os anos que a pessoa pode ver: do anterior até alguns à frente. */
const ANOS_PARA_TRAS = 1, ANOS_PARA_FRENTE = 3;
const TODOS = '';
/** A cor do selo de cada tipo: o que para o prazo chama mais atenção. */
const SELO_DO_TIPO: Record<TipoSemExpediente, TipoSelo | undefined> = { feriado: undefined, suspensao: 'pend', suspensao_com_expediente: 'pend' };

export function DiasDoAno({ orgaos, ehAdmin, versao, aoMudar }: { orgaos: Orgao[]; ehAdmin: boolean; versao: number; aoMudar: () => void }) {
  const esteAno = new Date().getFullYear();
  const [ano, setAno] = useState(esteAno);
  const [orgaoId, setOrgaoId] = useState(TODOS);
  const [lancados, setLancados] = useState<DiaLancado[] | string | null>(null);
  const [lancando, setLancando] = useState(false);

  useEffect(() => {
    let vale = true;
    setLancados(null);
    SD.diasListar(`${ano}-01-01`, `${ano}-12-31`)
      .then(d => { if (vale) setLancados(d); })
      .catch(e => { if (vale) setLancados((e as Error).message); });
    return () => { vale = false; };
  }, [ano, versao]);

  const anos = Array.from({ length: ANOS_PARA_TRAS + ANOS_PARA_FRENTE + 1 }, (_, i) => esteAno - ANOS_PARA_TRAS + i);
  const periodos = Array.isArray(lancados) ? periodosDoAno(ano, orgaos, lancados, orgaoId || null) : [];
  const porMes = MESES.map((nome, i) => ({ nome, periodos: periodos.filter(p => Number(p.de.slice(5, 7)) === i + 1) })).filter(m => m.periodos.length);

  async function excluir(p: PeriodoDoAno) {
    try { await SD.diasExcluir(p.ids); avisar('Dias excluídos do calendário.'); aoMudar(); } catch (e) { falha(e); }
  }

  return <section className="dias-do-ano form-grade" aria-labelledby="tAno">
    <div className="secao-topo">
      <TituloSecao id="tAno">Calendário de {ano}</TituloSecao>
      {ehAdmin && !lancando && <button type="button" className={estiloBotao({ variante: 'principal' })} onClick={() => setLancando(true)}>
        <Icone nome="mais" tam={15} /> Lançar dias
      </button>}
    </div>
    {lancando && <LancarDias orgaos={orgaos} aoFechar={() => setLancando(false)} aoLancar={() => { setLancando(false); aoMudar(); }} />}
    <div className="grade-form campos">
      <div className="campo-form" style={naGrade({ p: 5, m: 3, g: 2 })}>
        <label htmlFor="ca-ano">Ano</label>
        <select id="ca-ano" value={ano} onChange={e => setAno(Number(e.target.value))}>
          {anos.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>
      <div className="campo-form" style={naGrade({ p: 7, m: 5, g: 4 })}>
        <label htmlFor="ca-orgao">Mostrar</label>
        <select id="ca-orgao" value={orgaoId} onChange={e => setOrgaoId(e.target.value)}>
          <option value={TODOS}>{TODOS_OS_ORGAOS}</option>
          {orgaos.map(o => <option key={o.id} value={o.id}>Só o que vale para {o.sigla}</option>)}
        </select>
      </div>
    </div>
    {lancados === null ? <Carregando />
      : typeof lancados === 'string' ? <Aviso tipo="erro">{lancados}</Aviso>
      : !porMes.length ? <Vazio>Nenhum dia sem expediente em {ano}.</Vazio>
      : <div className="meses">{porMes.map(m => <section key={m.nome} className="mes" aria-label={`${m.nome} de ${ano}`}>
        <h3>{m.nome}</h3>
        <ul>{m.periodos.map(p => <li key={[p.de, p.origem, p.motivo, p.valePara].join()} className="dia">
          <span className="dia-data"><b>{fmtPeriodo(p.de, p.ate)}</b>{p.de === p.ate && <small>{diaDaSemana(p.de)}</small>}</span>
          <span className="dia-motivo">{p.motivo}<small>{ORIGENS[p.origem]}: {p.valePara}</small></span>
          <Selo tipo={SELO_DO_TIPO[p.tipo]}>{TIPOS_NA_TELA[p.tipo].curto}</Selo>
          {ehAdmin && p.ids.length > 0 && <BotaoDuplo forma="mini" variante="perigo" confirmar="Confirmar exclusão" aoConfirmar={() => excluir(p)}><Icone nome="lixeira" tam={13} /> Excluir</BotaoDuplo>}
        </li>)}</ul>
      </section>)}</div>}
    <Nota>{Object.values(TIPOS_NA_TELA).map(t => `${t.curto}: ${t.explicacao}`).join(' ')}</Nota>
  </section>;
}

const PEDIDO_VAZIO: PedidoDeLancamento = { motivo: '', tipo: 'feriado', de: '', ate: '', orgaos: [] };

function LancarDias({ orgaos, aoFechar, aoLancar }: { orgaos: Orgao[]; aoFechar: () => void; aoLancar: () => void }) {
  const [p, setP] = useState(PEDIDO_VAZIO);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const mudar = (campos: Partial<PedidoDeLancamento>) => { setP(x => ({ ...x, ...campos })); setErro(null); };
  // "Todos os órgãos" vale sozinho: marcá-lo desmarca os outros, e marcar um órgão desmarca "todos".
  const marcar = (id: string | null, marcado: boolean) => mudar({
    orgaos: !marcado ? p.orgaos.filter(o => o !== id) : id === null ? [null] : [...p.orgaos.filter(o => o !== null), id]
  });

  async function lancar(e: FormEvent) {
    e.preventDefault();
    const problema = erroDoLancamento(p);
    if (problema) { setErro(problema); return; }
    setOcupado(true);
    try {
      await SD.diasLancar(linhasDoLancamento(p));
      avisar('Dias lançados no calendário.');
      aoLancar();
    } catch (err) { falha(err); }
    setOcupado(false);
  }

  return <Cartao>
    <form className="lancar-dias" noValidate onSubmit={lancar} aria-label="Lançar dias sem expediente">
      <Campo rotulo="Motivo" para="ld-motivo" obrigatorio dica="Ex.: Aniversário de Belo Horizonte, Portaria 12/2026 do TJMG.">
        <input type="text" {...propsDoCampo('ld-motivo', { dica: true })} className="campo" maxLength={TAMANHO_DIA.motivo} value={p.motivo}
          onChange={e => mudar({ motivo: e.target.value })} autoFocus />
      </Campo>
      <Escolhas rotulo="O que acontece nesses dias" obrigatorio arranjo="coluna-unica">
        {(Object.keys(TIPOS_NA_TELA) as TipoSemExpediente[]).map(t => <label key={t}>
          <input type="radio" name="ld-tipo" value={t} checked={p.tipo === t} onChange={() => mudar({ tipo: t })} />
          <span><b>{TIPOS_NA_TELA[t].curto}</b> <small>{TIPOS_NA_TELA[t].explicacao}</small></span>
        </label>)}
      </Escolhas>
      <div className="grade-form campos">
        <div className="campo-form" style={naGrade({ p: 6, m: 6, g: 3 })}>
          <label htmlFor="ld-de">Primeiro dia</label>
          <input id="ld-de" type="date" value={p.de} onChange={e => mudar({ de: e.target.value })} />
        </div>
        <div className="campo-form" style={naGrade({ p: 6, m: 6, g: 3 })}>
          <label htmlFor="ld-ate">Último dia <small>(em branco: um dia só)</small></label>
          <input id="ld-ate" type="date" value={p.ate} onChange={e => mudar({ ate: e.target.value })} />
        </div>
      </div>
      <Escolhas rotulo="Vale para" obrigatorio arranjo="multipla">
        <label><input type="checkbox" checked={p.orgaos.includes(null)} onChange={e => marcar(null, e.target.checked)} />{TODOS_OS_ORGAOS}</label>
        {orgaos.map(o => <label key={o.id}>
          <input type="checkbox" checked={p.orgaos.includes(o.id)} onChange={e => marcar(o.id, e.target.checked)} />{o.sigla}
        </label>)}
      </Escolhas>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      <div className="lancar-acoes">
        <button type="submit" className={estiloBotao({ variante: 'principal', pequeno: true })} disabled={ocupado}>{ocupado ? 'Lançando…' : 'Lançar'}</button>
        <button type="button" className={estiloBotao({ pequeno: true })} onClick={aoFechar}>Cancelar</button>
      </div>
    </form>
  </Cartao>;
}
