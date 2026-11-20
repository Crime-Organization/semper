// O tempo no cartão da tarefa: o cronômetro de quem está com o cartão aberto ("Seu tempo nesta tarefa": Iniciar,
// Pausar e Retomar, também pela tecla T), o ajuste à mão com motivo e, com a tarefa concluída, o esforço da equipe (o total, da criação à conclusão
// e a parte de cada um em %). Cada um vê só o próprio tempo; os administradores veem a duração de cada um e os ajustes.
// Desde a #383, ele fica numa faixa própria, logo abaixo da faixa das datas (a mesma peça, GrupoDeDatas, em ui/base): o relógio, a
// situação (pausado ou contando), Iniciar/Pausar e "Ajustar meu tempo" lado a lado, num dado largo, e o resumo de quem registrou
// tempo embaixo deles, na mesma faixa (LinhaDoGrupo). No cartão da demanda, a mesma faixa mostra a soma do tempo nas tarefas dela.
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { SD, type Tarefa, type TempoDaTarefa } from '../dados';
import { TAMANHO_MOTIVO } from '../dados/limites';
import { errosDoAjuste, fmtDecorrido, fmtDuracao, fmtRelogio, lerAjuste, somaDoTempo, tempoPorPessoa } from '../regras/cronometro';
import { Avatar } from '../ui/Avatar';
import { falha, feito } from '../ui/avisos';
import { Aviso, Campo, Carregando, DadoDoGrupo, estiloBotao, GrupoDeDatas, LinhaDoGrupo, Nota } from '../ui/base';
import { janela } from '../ui/janela';
import { useCtx } from '../ui/sessao';
import { dataCurta } from '../ui/util';
import { TECLA_DO_CRONOMETRO, useCronometro } from './useCronometro';

/** O nome da faixa do tempo no cartão (da tarefa e da demanda), logo abaixo da faixa das datas. */
const FAIXA_DO_TEMPO = 'Tempo';
/** O nome do cronômetro na faixa do tempo. */
const ROTULO_DO_TEMPO = 'Seu tempo nesta tarefa';

export function TempoNaTarefa({ t }: { t: Tarefa }) {
  const ctx = useCtx();
  const eu = ctx.perfil.id;
  const [tempo, setTempo] = useState<TempoDaTarefa | string | null>(null);
  const carregar = useCallback(() => SD.tempoDaTarefa(t.id).then(setTempo).catch(e => setTempo((e as Error).message)), [t.id]);
  useEffect(() => { void carregar(); }, [carregar]);
  // Só conta quando a pessoa inicia; na tarefa concluída, a contagem já encerrou.
  const relogio = useCronometro(t, !t.concluida_em, () => { void carregar(); });

  if (tempo === null) return <FaixaDoTempo rotulo={ROTULO_DO_TEMPO}><Carregando /></FaixaDoTempo>;
  if (typeof tempo === 'string') return <FaixaDoTempo rotulo={ROTULO_DO_TEMPO}><Aviso tipo="erro">{tempo}</Aviso></FaixaDoTempo>;
  // O meu tempo: o que já está gravado (menos o período deste cartão aberto, que o relógio já conta) e o período.
  const gravado = somaDoTempo(tempo.registros.filter(r => r.id !== relogio.periodoId), eu);
  const meu = gravado + relogio.segundos;

  async function ajustar() {
    const campos = await janela<{ tanto: string; motivo: string }>({
      titulo: 'Ajustar meu tempo',
      corpo: <div className="ajuste-tempo">
        <Campo rotulo="Quanto" para="ajuste-tanto" dica={'Ex.: 30min, 1h15, 1:30. Com "-" na frente para tirar (-20min).'}>
          <input id="ajuste-tanto" name="tanto" type="text" className="campo" autoFocus />
        </Campo>
        <Campo rotulo="Motivo" para="ajuste-motivo" dica="Fica registrado junto do ajuste.">
          <input id="ajuste-motivo" name="motivo" type="text" className="campo" maxLength={TAMANHO_MOTIVO} />
        </Campo>
      </div>,
      acoes: [{ rotulo: 'Cancelar', valor: null },
        { rotulo: 'Salvar ajuste', tipo: 'pri', valor: f => ({ tanto: String(f.get('tanto') || ''), motivo: String(f.get('motivo') || '') }) }]
    });
    if (!campos) return;
    const erros = errosDoAjuste(campos.tanto, campos.motivo);
    if (erros.tanto || erros.motivo) { falha(new Error(erros.tanto || erros.motivo)); return; }
    try {
      const segundos = lerAjuste(campos.tanto);
      await SD.tempoAjustar(t.id, segundos, campos.motivo);
      // Desfazer é um ajuste ao contrário (o ajuste fica registrado; o banco não apaga registros de tempo).
      feito(`Tempo ajustado: ${segundos > 0 ? '+' : '−'}${fmtDuracao(Math.abs(segundos))}.`, 'ajuste de tempo',
        async () => { await SD.tempoAjustar(t.id, -segundos, `Desfeito: ${campos.motivo.trim()}`); });
      await carregar();
    } catch (e) { falha(e); }
  }

  // A faixa do tempo (#383): o relógio e a situação juntos e, ao lado, os botões (descem juntos quando não cabem); embaixo, o resumo.
  return <FaixaDoTempo rotulo={ROTULO_DO_TEMPO} resumo={(t.concluida_em || ctx.ehAdmin) && <TempoDaEquipe t={t} tempo={tempo} />}>
    <div className="cronometro">
      <span className="cronometro-leitura">
        <span className="cronometro-relogio" role="timer" aria-label={`Seu tempo: ${fmtDuracao(meu)}`}>{fmtRelogio(meu)}</span>
        <span className={'cronometro-situacao' + (relogio.contando ? ' contando' : '')}>{relogio.contando ? 'contando' : 'pausado'}</span>
      </span>
      <span className="cronometro-acoes">
        {t.concluida_em
          ? <span className="nota">Tarefa concluída: a contagem encerrou.</span>
          : <button type="button" className={estiloBotao({ forma: 'mini' })} onClick={relogio.alternar}
            title={`Atalho: tecla ${TECLA_DO_CRONOMETRO.toUpperCase()}`} aria-keyshortcuts={TECLA_DO_CRONOMETRO.toUpperCase()}>
            {relogio.contando ? 'Pausar' : meu ? 'Retomar' : 'Iniciar'} <kbd>{TECLA_DO_CRONOMETRO.toUpperCase()}</kbd>
          </button>}
        <button type="button" className={estiloBotao({ forma: 'link' })} onClick={ajustar}>Ajustar meu tempo</button>
      </span>
    </div>
  </FaixaDoTempo>;
}

/** A faixa do tempo, logo abaixo da das datas: o dado largo (o cronômetro, o total) e, embaixo dele, o resumo. */
function FaixaDoTempo({ rotulo, resumo, children }: { rotulo: string; resumo?: ReactNode; children: ReactNode }) {
  return <GrupoDeDatas rotulo={FAIXA_DO_TEMPO}>
    <DadoDoGrupo rotulo={rotulo} largo>{children}</DadoDoGrupo>
    {resumo && <LinhaDoGrupo>{resumo}</LinhaDoGrupo>}
  </GrupoDeDatas>;
}

/** No cartão da demanda, na faixa do tempo logo abaixo das datas (#383): o esforço aproximado dela, a soma do tempo de todos nas tarefas. */
export function TempoDaDemanda({ demandaId, versao }: { demandaId: string; versao: number }) {
  const [segundos, setSegundos] = useState<number | null>(null);
  useEffect(() => { SD.tempoDaDemanda(demandaId).then(setSegundos).catch(() => setSegundos(null)); }, [demandaId, versao]);
  if (!segundos) return null;
  return <FaixaDoTempo rotulo="Tempo nas tarefas desta demanda">
    <b className="num">{fmtDuracao(segundos)}</b>
    <Nota>Soma do tempo de toda a equipe nas tarefas desta demanda.</Nota>
  </FaixaDoTempo>;
}

/**
 * O esforço da equipe: com a tarefa concluída, o total, o tempo da criação à conclusão e a parte de cada um em %.
 * Os administradores veem também a duração de cada um e os ajustes (a qualquer momento).
 */
function TempoDaEquipe({ t, tempo }: { t: Tarefa; tempo: TempoDaTarefa }) {
  const ctx = useCtx();
  const membro = (id: string | null) => ctx.equipe.find(m => m.id === id) ?? { id: id ?? '', nome: 'Usuário removido' };
  const porPessoa = tempoPorPessoa(tempo.registros);
  const ajustes = tempo.registros.filter(r => r.ajuste);
  if (!tempo.equipe.length) return ctx.ehAdmin ? <div className="tempo-equipe"><Nota>Ninguém registrou tempo nesta tarefa ainda.</Nota></div> : null;
  return <div className="tempo-equipe">
    <p className="tempo-equipe-total">
      <b>{t.concluida_em ? 'Total da equipe' : 'Total até agora'}: {fmtDuracao(tempo.total)}</b>
      {t.concluida_em && <span> · Da criação à conclusão: {fmtDecorrido(t.criado_em, t.concluida_em)}</span>}
    </p>
    <ul className="tempo-equipe-lista" aria-label="Parte de cada um">
      {tempo.equipe.map(p => <li key={p.perfil_id ?? 'removido'}>
        <Avatar p={membro(p.perfil_id)} tam={22} />
        <span>{membro(p.perfil_id).nome}</span>
        <b>{p.percentual.toLocaleString('pt-BR')}%</b>
        {ctx.ehAdmin && <span className="nota">{fmtDuracao(porPessoa.get(p.perfil_id) ?? 0)}</span>}
      </li>)}
    </ul>
    {ctx.ehAdmin && ajustes.length > 0 && <div className="tempo-ajustes">
      <p className="rotulo-caps">Ajustes</p>
      <ul>{ajustes.map(a => <li key={a.id}>
        {dataCurta(a.inicio)} · {membro(a.perfil_id).nome}: <b>{a.segundos > 0 ? '+' : '−'}{fmtDuracao(Math.abs(a.segundos))}</b> · {a.motivo}
      </li>)}</ul>
    </div>}
  </div>;
}
