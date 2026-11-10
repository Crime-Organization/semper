// A visão por data da agenda: dia, semana ou mês, com os compromissos e os prazos de demandas e tarefas de cada dia, no
// horário de Brasília. A escolha de dia, semana ou mês fica guardada para cada pessoa. As contas de data ficam em regras/agenda.ts.
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { SD, type FiltroCompromissos } from '../../dados';
import { diaDaSemana, fmtDiaMes } from '../../regras/calendario';
import { DIAS_NA_SEMANA, diasDoPeriodo, hojeNaAgenda, itensDaAgenda, itensDoDia, noMesmoMes, numeroDoDia, ORIGENS_DE_PRAZO, VISOES, VISOES_DE_DATA, type ItemDaAgenda, type VisaoDeData } from '../../regras/agenda';
import { fmtHora, horarioDoCompromisso, TIPOS_COMPROMISSO } from '../../regras/compromisso';
import { cliquesQueAbrem } from '../../ui/abrirItem';
import { Aviso, Carregando, estiloBotao, Selo, Vazio } from '../../ui/base';
import { lerPreferencia, salvarPreferencia } from '../../ui/preferencias';

/** Quantos itens cada dia mostra na grade do mês; os outros aparecem como "+N", que abre o dia. */
const ITENS_POR_DIA_NO_MES = 3;
const PREFERENCIA = 'compromissos.periodo';

interface Props {
  filtro: FiltroCompromissos;
  /** Muda quando algo mudou na página: relê a agenda. */
  recarga: number | string;
  /** O nome da coluna do quadro em que o compromisso está. */
  situacao: (etapa: string | null) => string;
  endereco: (id: string) => string;
  aoAbrir: (id: string) => void;
}

export function VisaoPorData({ filtro, recarga, situacao, endereco, aoAbrir }: Props) {
  const [visao, setVisao] = useState<VisaoDeData>(() => { const v = lerPreferencia<VisaoDeData>(PREFERENCIA, 'semana'); return VISOES.includes(v) ? v : 'semana'; });
  const [data, setData] = useState(hojeNaAgenda);
  const [itens, setItens] = useState<ItemDaAgenda[] | string | null>(null);
  const { de, ate } = VISOES_DE_DATA[visao].periodo(data);
  const { termo, pessoa, tipo, etiqueta } = filtro;

  useEffect(() => {
    let vivo = true;
    // Filtrando por tipo ou etiqueta, os prazos saem: eles não têm nem um nem outro.
    const comPrazos = !tipo && !etiqueta;
    Promise.all([SD.compromissosDoPeriodo(de, ate, { termo, pessoa, tipo, etiqueta }), comPrazos ? SD.prazosDoPeriodo(de, ate, { termo, pessoa }) : Promise.resolve([])])
      .then(([compromissos, prazos]) => { if (vivo) setItens(itensDaAgenda(compromissos, prazos)); })
      .catch(e => { if (vivo) setItens((e as Error).message); });
    return () => { vivo = false; };
  }, [de, ate, termo, pessoa, tipo, etiqueta, recarga]);

  function trocarVisao(v: VisaoDeData) {
    setVisao(v);
    salvarPreferencia(PREFERENCIA, v);
  }
  function abrirDia(dia: string) {
    setData(dia);
    trocarVisao('dia');
  }
  const andar = (passos: number) => setData(VISOES_DE_DATA[visao].andar(data, passos));
  const VISAO = { dia: DiaInteiro, semana: Semana, mes: Mes }[visao];

  return <section className="agenda" aria-label="Agenda por data">
    <div className="agenda-barra">
      <div className="agenda-andar">
        <button type="button" className={estiloBotao({ forma: 'mini' })} onClick={() => andar(-1)}>Anterior</button>
        <button type="button" className={estiloBotao({ forma: 'mini' })} onClick={() => setData(hojeNaAgenda())}>Hoje</button>
        <button type="button" className={estiloBotao({ forma: 'mini' })} onClick={() => andar(1)}>Próximo</button>
      </div>
      <h2 className="agenda-titulo" aria-live="polite">{VISOES_DE_DATA[visao].titulo(data)}</h2>
      <div className="abas" role="group" aria-label="Período">
        {VISOES.map(v => <button key={v} type="button" aria-pressed={v === visao} onClick={() => trocarVisao(v)}>{VISOES_DE_DATA[v].nome}</button>)}
      </div>
    </div>
    {itens === null ? <Carregando />
      : typeof itens === 'string' ? <Aviso tipo="erro">{itens}</Aviso>
      : <VISAO itens={itens} data={data} dias={diasDoPeriodo({ de, ate })} abrirDia={abrirDia} situacao={situacao} endereco={endereco} aoAbrir={aoAbrir} />}
  </section>;
}

interface PropsVisao extends Pick<Props, 'situacao' | 'endereco' | 'aoAbrir'> {
  itens: ItemDaAgenda[];
  /** A data em que a pessoa está. */
  data: string;
  dias: string[];
  abrirDia: (dia: string) => void;
}

/** Um dia só, em lista: cada item com o horário, o tipo, o local e a situação. */
function DiaInteiro({ itens, data, situacao, endereco, aoAbrir }: PropsVisao) {
  const doDia = itensDoDia(itens, data);
  if (!doDia.length) return <Vazio>Nenhum compromisso ou prazo neste dia.</Vazio>;
  return <ul className="agenda-lista">{doDia.map(i => <li key={i.chave}><Item item={i} completo situacao={situacao} endereco={endereco} aoAbrir={aoAbrir} /></li>)}</ul>;
}

/** Os dias da semana lado a lado (em espaço estreito, um embaixo do outro). */
function Semana({ itens, dias, abrirDia, situacao, endereco, aoAbrir }: PropsVisao) {
  const hoje = hojeNaAgenda();
  return <div className="agenda-semana">{dias.map(dia => {
    const doDia = itensDoDia(itens, dia);
    return <section key={dia} className={'agenda-dia' + (dia === hoje ? ' hoje' : '')} aria-label={`${diaDaSemana(dia)}, ${fmtDiaMes(dia)}`}>
      <button type="button" className="agenda-dia-titulo" title="Abrir este dia" onClick={() => abrirDia(dia)}>
        <span>{diaDaSemana(dia).split('-')[0]}</span> <b>{fmtDiaMes(dia)}</b>
      </button>
      {doDia.length ? <ul className="agenda-lista">{doDia.map(i => <li key={i.chave}><Item item={i} situacao={situacao} endereco={endereco} aoAbrir={aoAbrir} /></li>)}</ul>
        : <span className="agenda-nada">—</span>}
    </section>;
  })}</div>;
}

/** A grade do mês, em semanas inteiras: cada dia mostra os primeiros itens e quantos mais há. */
function Mes({ itens, data, dias, abrirDia, situacao, endereco, aoAbrir }: PropsVisao) {
  const hoje = hojeNaAgenda();
  return <div className="agenda-mes" role="list">
    {dias.slice(0, DIAS_NA_SEMANA).map(dia => <span key={dia} className="agenda-mes-semana" aria-hidden="true">{diaDaSemana(dia).split('-')[0]}</span>)}
    {dias.map(dia => {
      const doDia = itensDoDia(itens, dia), sobram = doDia.length - ITENS_POR_DIA_NO_MES;
      return <section key={dia} role="listitem" aria-label={`${diaDaSemana(dia)}, ${fmtDiaMes(dia)}`}
        className={'agenda-dia' + (dia === hoje ? ' hoje' : '') + (noMesmoMes(dia, data) ? '' : ' outro-mes')}>
        <button type="button" className="agenda-dia-titulo" title="Abrir este dia" onClick={() => abrirDia(dia)}>
          <b>{numeroDoDia(dia)}</b>{doDia.length > 0 && <small className="agenda-contagem" aria-label={`${doDia.length} no dia`}>{doDia.length}</small>}
        </button>
        <ul className="agenda-lista">{doDia.slice(0, ITENS_POR_DIA_NO_MES).map(i => <li key={i.chave}><Item item={i} situacao={situacao} endereco={endereco} aoAbrir={aoAbrir} /></li>)}</ul>
        {sobram > 0 && <button type="button" className="agenda-mais" onClick={() => abrirDia(dia)}>+{sobram}</button>}
      </section>;
    })}
  </div>;
}

/** Um compromisso (abre o cartão dele aqui) ou um prazo (leva ao cartão da demanda ou da tarefa). */
function Item({ item, completo, situacao, endereco, aoAbrir }: { item: ItemDaAgenda; completo?: boolean } & Pick<Props, 'situacao' | 'endereco' | 'aoAbrir'>) {
  const { compromisso: c, prazo: p } = item;
  if (p) {
    const origem = ORIGENS_DE_PRAZO[p.origem];
    return <Link className="agenda-item prazo" to={origem.endereco + p.id}>
      <small>{p.hora ? `${origem.nome} · ${fmtHora(p.hora)}` : origem.nome}</small>
      <b>{item.titulo}</b>
    </Link>;
  }
  const para = endereco(c!.id);
  return <a className="agenda-item" href={para} {...cliquesQueAbrem(para, () => aoAbrir(c!.id))}>
    <small>{horarioDoCompromisso(c!)}</small>
    <b>{item.titulo}</b>
    {completo && <span className="agenda-item-mais">
      <Selo tipo="arq">{TIPOS_COMPROMISSO[c!.tipo].nome}</Selo>
      {c!.geral && <Selo>Agenda geral</Selo>}
      {c!.local && <span>{c!.local}</span>}
      <span>{situacao(c!.etapa_id)}</span>
    </span>}
  </a>;
}
