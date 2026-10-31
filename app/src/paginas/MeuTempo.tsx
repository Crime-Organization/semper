// Meu tempo trabalhado: quanto a pessoa trabalhou em cada tarefa num período (esta semana, este mês, o mês passado ou
// as datas que escolher), com o total. Abre pelo menu "⋯" de Tarefas. Os administradores escolhem de quem ver; os
// outros veem só o próprio tempo. O tempo vem do cronômetro das tarefas e dos ajustes. Vai em horas, minutos e segundos
// (0:01:30): com só os minutos, a soma das linhas não bateria com o total.
import { useEffect, useState } from 'react';
import { SD, type TempoNaTarefaDoPeriodo } from '../dados';
import { fmtRelogio } from '../regras/cronometro';
import { intervaloDoPeriodo, PERIODOS, periodoPorExtenso, totalDoPeriodo, type Periodo } from '../regras/meuTempo';
import { LinhaQueAbre, NomeDaLinha } from '../ui/abrirItem';
import { Aviso, BotaoLink, Carregando, naGrade, Nota, TituloSecao, Vazio } from '../ui/base';
import { useSessao } from '../ui/sessao';
import { hojeISO, useTitulo } from '../ui/util';
import './Configuracoes.css';

export default function MeuTempo() {
  useTitulo('Meu tempo trabalhado');
  const { ctx } = useSessao();
  const eu = ctx.perfil.id;
  const [pessoa, setPessoa] = useState(eu);
  const [periodo, setPeriodo] = useState<Periodo>('semana');
  const [escolhido, setEscolhido] = useState({ de: '', ate: '' });
  const [linhas, setLinhas] = useState<TempoNaTarefaDoPeriodo[] | string | null>(null);

  const intervalo = intervaloDoPeriodo(periodo, hojeISO(), escolhido);
  const de = typeof intervalo === 'string' ? '' : intervalo.de, ate = typeof intervalo === 'string' ? '' : intervalo.ate;
  // Quem não é administrador vê só o próprio tempo (o banco também só devolve o dele).
  const quem = ctx.ehAdmin ? pessoa : eu;
  useEffect(() => {
    if (!de) return;
    let valendo = true;   // trocou o período ou a pessoa antes de chegar: a resposta antiga não vale mais
    setLinhas(null);
    SD.tempoPorTarefa(quem, de, ate).then(l => { if (valendo) setLinhas(l); }).catch(e => { if (valendo) setLinhas((e as Error).message); });
    return () => { valendo = false; };
  }, [quem, de, ate]);

  const membro = ctx.equipe.find(m => m.id === quem);
  const deOutro = quem !== eu;
  const total = Array.isArray(linhas) ? totalDoPeriodo(linhas) : 0;
  return <div className="miolo">
    <header>
      <p className="olho"><BotaoLink forma="link" to="/tarefas/">Tarefas</BotaoLink></p>
      <h1 className="titulo">{deOutro ? `Tempo de ${membro?.nome ?? 'alguém da equipe'}` : 'Meu tempo trabalhado'}<span className="ponto">.</span></h1>
      <p className="lead">Quanto {deOutro ? 'essa pessoa' : 'você'} trabalhou em cada tarefa no período, com o total. Vem do cronômetro das tarefas e dos ajustes.</p>
    </header>

    {/* Cada rótulo liga ao campo pelo id (como em Configurações): o nome do campo fica só o rótulo. */}
    <section className="cartao config form-grade campos">
      <div className="grade-form">
        {ctx.ehAdmin && <div className="campo-form" style={naGrade({ m: 6, g: 4 })}>
          <label htmlFor="mt-pessoa">De quem</label>
          <select id="mt-pessoa" value={pessoa} onChange={e => setPessoa(e.target.value)}>
            {ctx.equipe.map(m => <option key={m.id} value={m.id}>{m.id === eu ? `${m.nome} (você)` : m.nome}{m.ativo === false ? ' (desativado)' : ''}</option>)}
          </select>
        </div>}
        <div className="campo-form" style={naGrade({ m: 6, g: 4 })}>
          <label htmlFor="mt-periodo">Período</label>
          <select id="mt-periodo" value={periodo} onChange={e => setPeriodo(e.target.value as Periodo)}>
            {(Object.keys(PERIODOS) as Periodo[]).map(p => <option key={p} value={p}>{PERIODOS[p]}</option>)}
          </select>
        </div>
        {periodo === 'intervalo' && <>
          <div className="campo-form" style={naGrade({ p: 6, m: 6, g: 2 })}>
            <label htmlFor="mt-de">Primeiro dia</label>
            <input id="mt-de" type="date" value={escolhido.de} onChange={e => setEscolhido(x => ({ ...x, de: e.target.value }))} />
          </div>
          <div className="campo-form" style={naGrade({ p: 6, m: 6, g: 2 })}>
            <label htmlFor="mt-ate">Último dia</label>
            <input id="mt-ate" type="date" value={escolhido.ate} onChange={e => setEscolhido(x => ({ ...x, ate: e.target.value }))} />
          </div>
        </>}
      </div>
    </section>

    {typeof intervalo === 'string' ? <Aviso tipo="info">{intervalo}</Aviso>
      : <section className="meu-tempo" aria-labelledby="tMeuTempo">
        <div className="secao-topo">
          <TituloSecao id="tMeuTempo">{periodo === 'intervalo' ? 'No período' : PERIODOS[periodo]}, {periodoPorExtenso(intervalo)}</TituloSecao>
          {Array.isArray(linhas) && linhas.length > 0 && <p className="meu-tempo-total" role="status">Total: <b>{fmtRelogio(total)}</b></p>}
        </div>
        {linhas === null ? <Carregando />
          : typeof linhas === 'string' ? <Aviso tipo="erro">{linhas}</Aviso>
          : !linhas.length ? <Vazio>Nenhum tempo registrado {periodoPorExtenso(intervalo)}.</Vazio>
          : <div className="tabela"><table aria-label="Tempo por tarefa">
            <thead><tr><th scope="col">Tarefa</th><th scope="col">Demanda</th><th scope="col" className="num">Tempo</th></tr></thead>
            <tbody>{linhas.map(l => <LinhaQueAbre key={l.tarefa_id} para={'/tarefas/?id=' + l.tarefa_id}>
              <td><NomeDaLinha>{l.titulo}</NomeDaLinha><div className="sub">{l.codigo}{l.arquivada ? ' · arquivada' : ''}</div></td>
              <td>{l.demanda_codigo || '—'}</td>
              <td className="num">{fmtRelogio(l.segundos)}</td>
            </LinhaQueAbre>)}</tbody>
            <tfoot><tr><th scope="row" colSpan={2}>Total</th><td className="num">{fmtRelogio(total)}</td></tr></tfoot>
          </table></div>}
        <Nota>Em horas, minutos e segundos. Cada período do cronômetro conta no dia em que começou; os ajustes, no dia em que foram feitos.</Nota>
      </section>}
  </div>;
}
