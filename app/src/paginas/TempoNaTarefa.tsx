// O tempo no cartão da tarefa: o cronômetro de quem está com o cartão aberto ("Seu tempo nesta tarefa": Iniciar,
// Pausar e Retomar, também pela tecla T), o ajuste à mão com motivo e, com a tarefa concluída, o esforço da equipe (o total, da criação à conclusão
// e a parte de cada um em %). Cada um vê só o próprio tempo; os administradores veem a duração de cada um e os ajustes.
// Desde a #383, ele fica numa faixa própria, logo abaixo da faixa das datas (a mesma peça, GrupoDeDatas, em ui/base): o relógio, a
// situação (pausado ou contando), Iniciar/Pausar e "Ajustar meu tempo" lado a lado, num dado largo, e o resumo de quem registrou
// tempo embaixo deles, na mesma faixa (LinhaDoGrupo). No cartão da demanda, a mesma faixa mostra a soma do tempo nas tarefas dela.
// Desde a #397 (pedido do dono de 20/11), o tempo total da tarefa (o da equipe toda) entra na faixa das datas, como o último dado, à
// direita ("Tempo total"), e o resumo de quem registrou tempo não o repete. Quem só lê o vê quando o banco o devolve (totalAparece). Uma peça só (DadosDaTarefa)
// lê o tempo e desenha as duas faixas: o cronômetro liga uma vez só (duas vezes, gravaria o tempo em dobro), e o total acompanha o
// relógio de quem está contando.
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { SD, type Tarefa, type TempoDaTarefa } from '../dados';
import { TAMANHO_MOTIVO } from '../dados/limites';
import { errosDoAjuste, fmtDecorrido, fmtDuracao, fmtRelogio, lerAjuste, somaDoTempo, tempoPorPessoa, totalAoVivo, totalAparece } from '../regras/cronometro';
import { Avatar } from '../ui/Avatar';
import { falha, feito } from '../ui/avisos';
import { Aviso, Campo, Carregando, DadoDoGrupo, estiloBotao, FaixaDasDatas, GrupoDeDatas, LinhaDoGrupo, Nota } from '../ui/base';
import { useAtalhosLigados } from '../ui/atalhos';
import { janela } from '../ui/janela';
import { useCtx } from '../ui/sessao';
import { dataCurta } from '../ui/util';
import { TECLA_DO_CRONOMETRO, useCronometro } from './useCronometro';

/** O nome da faixa do tempo no cartão (da tarefa e da demanda), logo abaixo da faixa das datas. */
const FAIXA_DO_TEMPO = 'Tempo';
/** O nome do cronômetro na faixa do tempo. */
const ROTULO_DO_TEMPO = 'Seu tempo nesta tarefa';
/** O nome do tempo total da tarefa, o último dado da faixa das datas (#397). */
export const ROTULO_DO_TEMPO_TOTAL = 'Tempo total';

/** O tempo lido do banco: chegando (null), lido, ou a mensagem do erro. */
type TempoLido = TempoDaTarefa | string | null;
type EstadoDoTempo = 'lendo' | 'lido' | 'erro';
const estadoDoTempo = (x: TempoLido): EstadoDoTempo => x === null ? 'lendo' : typeof x === 'string' ? 'erro' : 'lido';
/** O que o tempo total mostra em cada estado. Enquanto lê, o lugar do valor já está lá, e a faixa não pula. */
const TEXTO_DO_TOTAL: Record<EstadoDoTempo, (segundos: number) => string> = {
  lendo: () => '…',
  lido: segundos => fmtDuracao(segundos),
  erro: () => '—'
};
/** A dica do tempo total que não pôde ser lido. */
const TOTAL_SEM_LEITURA = 'Não foi possível ler o tempo agora';

interface PropsDosDados {
  t: Tarefa;
  /** Quem altera a tarefa tem o cronômetro ("Seu tempo nesta tarefa"); os outros veem só o total, quando o banco o devolve. */
  podeAlterar: boolean;
  /** As outras datas da faixa (o início e o prazo), entre a criação e o tempo total. */
  datas: ReactNode;
}

/**
 * Os dados da tarefa (#397): a faixa das datas, com o tempo total como o último dado, e, para quem altera, a faixa do tempo
 * logo abaixo (o cronômetro e o resumo). O tempo é lido uma vez aqui, para as duas.
 */
export function DadosDaTarefa({ t, podeAlterar, datas }: PropsDosDados) {
  const [tempo, setTempo] = useState<TempoLido>(null);
  const carregar = useCallback(() => SD.tempoDaTarefa(t.id).then(setTempo).catch(e => setTempo((e as Error).message)), [t.id]);
  useEffect(() => { void carregar(); }, [carregar]);
  if (!podeAlterar) return <FaixaComTotal t={t} datas={datas} tempo={tempo} />;
  return <TempoNaTarefa t={t} tempo={tempo} carregar={carregar} datas={datas} />;
}

/** O relógio aberto de quem está com o cartão: o que ele conta e ainda não está no total gravado. */
interface RelogioAberto { eu: string; periodoId: number | null; segundos: number }

/**
 * A faixa das datas da tarefa, com o tempo total à direita; com o relógio aberto (quem altera a tarefa), o total o acompanha. Sem
 * ele (quem só lê), o total só entra quando o banco o devolve: enquanto lê, ou se a leitura falha, o dado não aparece.
 */
function FaixaComTotal({ t, datas, tempo, relogio }: { t: Tarefa; datas: ReactNode; tempo: TempoLido; relogio?: RelogioAberto }) {
  const estado = estadoDoTempo(tempo);
  const lido = typeof tempo === 'string' ? null : tempo;
  const total = !lido ? 0 : relogio ? totalAoVivo(lido, relogio.eu, relogio.periodoId, relogio.segundos) : lido.total;
  return <FaixaDasDatas criacao={{ rotulo: 'Criada em', em: t.criado_em }}>
    {datas}
    {totalAparece(!!relogio, total) && <DadoDoGrupo rotulo={ROTULO_DO_TEMPO_TOTAL}>
      <b className="num tempo-total" aria-busy={estado === 'lendo' || undefined}
        title={estado === 'erro' ? TOTAL_SEM_LEITURA : undefined}>{TEXTO_DO_TOTAL[estado](total)}</b>
    </DadoDoGrupo>}
  </FaixaDasDatas>;
}

/** O cronômetro de quem altera a tarefa: a faixa das datas (o total acompanha o relógio) e, logo abaixo, a faixa do tempo. */
function TempoNaTarefa({ t, tempo, carregar, datas }: { t: Tarefa; tempo: TempoLido; carregar: () => Promise<unknown>; datas: ReactNode }) {
  const ctx = useCtx();
  const eu = ctx.perfil.id;
  // Só conta quando a pessoa inicia; na tarefa concluída, a contagem já encerrou.
  const relogio = useCronometro(t, !t.concluida_em, () => { void carregar(); });
  // Com os atalhos de uma tecla desligados (Minha conta), o T não funciona e o botão não o promete.
  const atalhos = useAtalhosLigados();
  const faixa = <FaixaComTotal t={t} datas={datas} tempo={tempo} relogio={{ eu, periodoId: relogio.periodoId, segundos: relogio.segundos }} />;

  if (tempo === null) return <>{faixa}<FaixaDoTempo rotulo={ROTULO_DO_TEMPO}><Carregando /></FaixaDoTempo></>;
  if (typeof tempo === 'string') return <>{faixa}<FaixaDoTempo rotulo={ROTULO_DO_TEMPO}><Aviso tipo="erro">{tempo}</Aviso></FaixaDoTempo></>;
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
  return <>{faixa}<FaixaDoTempo rotulo={ROTULO_DO_TEMPO} resumo={(t.concluida_em || ctx.ehAdmin) && <TempoDaEquipe t={t} tempo={tempo} />}>
    <div className="cronometro">
      <span className="cronometro-leitura">
        <span className="cronometro-relogio" role="timer" aria-label={`Seu tempo: ${fmtDuracao(meu)}`}>{fmtRelogio(meu)}</span>
        <span className={'cronometro-situacao' + (relogio.contando ? ' contando' : '')}>{relogio.contando ? 'contando' : 'pausado'}</span>
      </span>
      <span className="cronometro-acoes">
        {t.concluida_em
          ? <span className="nota">Tarefa concluída: a contagem encerrou.</span>
          : <button type="button" className={estiloBotao({ forma: 'mini' }) + ' cronometro-alternar'} onClick={relogio.alternar}
            {...(atalhos ? { title: `Atalho: tecla ${TECLA_DO_CRONOMETRO.toUpperCase()}`, 'aria-keyshortcuts': TECLA_DO_CRONOMETRO.toUpperCase() } : {})}>
            {relogio.contando ? 'Pausar' : meu ? 'Retomar' : 'Iniciar'}{atalhos && <> <kbd>{TECLA_DO_CRONOMETRO.toUpperCase()}</kbd></>}
          </button>}
        <button type="button" className={estiloBotao({ forma: 'link' })} onClick={ajustar}>Ajustar meu tempo</button>
      </span>
    </div>
  </FaixaDoTempo></>;
}

/** A faixa do tempo, logo abaixo da das datas: o dado largo (o cronômetro, o total) e, embaixo dele, o resumo. */
function FaixaDoTempo({ rotulo, resumo, children }: { rotulo: string; resumo?: ReactNode; children: ReactNode }) {
  return <GrupoDeDatas rotulo={FAIXA_DO_TEMPO}>
    <DadoDoGrupo rotulo={rotulo} largo>{children}</DadoDoGrupo>
    {resumo && <LinhaDoGrupo>{resumo}</LinhaDoGrupo>}
  </GrupoDeDatas>;
}

/** O nome do dado na faixa do tempo da demanda: a soma do tempo de todos nas tarefas dela. */
const ROTULO_DA_SOMA = 'Tempo da equipe nas tarefas';

/** Em que pé está a soma do tempo da demanda: chegando do banco, com tempo, sem tempo ainda ou com erro. */
type EstadoDaSoma = 'somando' | 'com-tempo' | 'sem-tempo' | 'erro';
type Soma = number | 'erro' | null;
const estadoDaSoma = (s: Soma): EstadoDaSoma => s === null ? 'somando' : s === 'erro' ? 'erro' : s > 0 ? 'com-tempo' : 'sem-tempo';
/** O que a faixa mostra em cada estado. Enquanto soma, o lugar do valor já está lá, na mesma altura, e o cartão não pula. */
const TEXTO_DA_SOMA: Record<EstadoDaSoma, (segundos: number) => string> = {
  'somando': () => '…',
  'com-tempo': segundos => fmtDuracao(segundos),
  'sem-tempo': () => 'Ninguém registrou tempo ainda',
  'erro': () => 'Não foi possível somar agora'
};

/**
 * No cartão da demanda, na faixa do tempo logo abaixo das datas (#383): o esforço aproximado dela, a soma do tempo de todos nas
 * tarefas, no mesmo desenho do relógio da tarefa. A faixa aparece junto com o cartão (sem tempo, diz que ninguém registrou), para o
 * que vem embaixo não pular quando a soma chega do banco.
 */
export function TempoDaDemanda({ demandaId, versao }: { demandaId: string; versao: number }) {
  const [segundos, setSegundos] = useState<Soma>(null);
  useEffect(() => { SD.tempoDaDemanda(demandaId).then(setSegundos).catch(() => setSegundos('erro')); }, [demandaId, versao]);
  const estado = estadoDaSoma(segundos);
  return <FaixaDoTempo rotulo={ROTULO_DA_SOMA}>
    <span className={'tempo-da-demanda ' + estado} aria-busy={estado === 'somando' || undefined}>
      {TEXTO_DA_SOMA[estado](typeof segundos === 'number' ? segundos : 0)}
    </span>
  </FaixaDoTempo>;
}

/**
 * O esforço da equipe: com a tarefa concluída, o tempo da criação à conclusão e a parte de cada um em % (o total está na faixa das
 * datas, #397). Os administradores veem também a duração de cada um e os ajustes (a qualquer momento).
 */
function TempoDaEquipe({ t, tempo }: { t: Tarefa; tempo: TempoDaTarefa }) {
  const ctx = useCtx();
  const membro = (id: string | null) => ctx.equipe.find(m => m.id === id) ?? { id: id ?? '', nome: 'Usuário removido' };
  const porPessoa = tempoPorPessoa(tempo.registros);
  const ajustes = tempo.registros.filter(r => r.ajuste);
  if (!tempo.equipe.length) return ctx.ehAdmin ? <div className="tempo-equipe"><Nota>Ninguém registrou tempo nesta tarefa ainda.</Nota></div> : null;
  return <div className="tempo-equipe">
    {t.concluida_em && <p className="tempo-equipe-total">
      Da criação à conclusão: <b className="duracao">{fmtDecorrido(t.criado_em, t.concluida_em)}</b>
    </p>}
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
