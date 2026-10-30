// O cronômetro do cartão da tarefa: conta o tempo de quem está com o cartão aberto (as regras estão em
// regras/cronometro.ts), grava o período no banco de minuto em minuto, ao pausar e ao fechar o cartão, e pergunta
// "Você ainda está aqui?" depois de um tempo sem mexer. Um período vai do abrir ao fechar do cartão; passou do máximo
// (12 horas), começa outro.
import { useCallback, useEffect, useRef, useState } from 'react';
import { SD } from '../dados';
import { PERIODO_MAXIMO } from '../dados/limites';
import { cronometro, PARADO, segundosDoPeriodo, type Cronometro, type Evento } from '../regras/cronometro';
import { falha } from '../ui/avisos';
import { janela } from '../ui/janela';
import { GRAVAR_TEMPO_A_CADA, INATIVIDADE_DO_CRONOMETRO, TIQUE_DO_CRONOMETRO } from '../ui/tempos';

/** O que a pessoa faz na tela e conta como "estou aqui". */
const MOVIMENTOS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'] as const;

interface Periodo { id: number | null; inicio: string; gravados: number }
const periodoNovo = (): Periodo => ({ id: null, inicio: new Date().toISOString(), gravados: 0 });

export function useCronometro(tarefaId: string, comecarSozinho: boolean, aoGravar: () => void) {
  const [estado, setEstado] = useState<Cronometro>(PARADO);
  const c = useRef(estado);
  const [agora, setAgora] = useState(() => Date.now());
  const periodo = useRef<Periodo>(periodoNovo());
  const fila = useRef<Promise<void>>(Promise.resolve());
  const aoGravarRef = useRef(aoGravar);
  aoGravarRef.current = aoGravar;

  const despachar = useCallback((e: Evento) => { c.current = cronometro(c.current, e); setEstado(c.current); }, []);

  // Grava o que o período tem até agora (só se cresceu), um pedido de cada vez.
  const gravar = useCallback(() => {
    fila.current = fila.current.then(async () => {
      const p = periodo.current, s = segundosDoPeriodo(c.current, Date.now());
      if (s <= p.gravados) return;
      if (p.id === null) p.id = await SD.tempoIniciar(tarefaId, p.inicio, s); else await SD.tempoGravar(p.id, s);
      p.gravados = s;
    }).catch(e => { falha(e); });
    return fila.current;
  }, [tarefaId]);

  // Começa sozinho (tarefa ativa) e, ao fechar o cartão, para e grava.
  useEffect(() => {
    if (comecarSozinho) despachar({ tipo: 'iniciar', agora: Date.now() });
    const aoSair = () => { void gravar(); };
    window.addEventListener('pagehide', aoSair);
    return () => {
      window.removeEventListener('pagehide', aoSair);
      despachar({ tipo: 'pausar', agora: Date.now() });
      void gravar();
    };
  // oxlint-disable-next-line react/exhaustive-deps -- começa uma vez, ao abrir o cartão
  }, []);

  // A pessoa mexendo na tela.
  useEffect(() => {
    let ultimo = 0;
    const mexeu = () => {
      const t = Date.now();
      if (t - ultimo < TIQUE_DO_CRONOMETRO) return;   // mover o mouse dispara muitas vezes: basta uma por tique
      ultimo = t;
      despachar({ tipo: 'mexeu', agora: t });
    };
    MOVIMENTOS.forEach(m => window.addEventListener(m, mexeu, { passive: true }));
    return () => MOVIMENTOS.forEach(m => window.removeEventListener(m, mexeu));
  }, [despachar]);

  // O relógio: anda, confere a inatividade, grava de tempos em tempos e começa outro período depois do máximo.
  useEffect(() => {
    let desdeGravar = 0;
    const tique = setInterval(() => {
      const t = Date.now(), antes = c.current;
      despachar({ tipo: 'tique', agora: t, inatividade: INATIVIDADE_DO_CRONOMETRO });
      setAgora(t);
      if (antes.aviso === null && c.current.aviso !== null) void perguntar();
      desdeGravar += TIQUE_DO_CRONOMETRO;
      if (desdeGravar >= GRAVAR_TEMPO_A_CADA) { desdeGravar = 0; void gravar().then(() => aoGravarRef.current()); }
      if (segundosDoPeriodo(c.current, t) >= PERIODO_MAXIMO) void comecarOutroPeriodo();
    }, TIQUE_DO_CRONOMETRO);
    return () => clearInterval(tique);
  // oxlint-disable-next-line react/exhaustive-deps -- um relógio só, enquanto o cartão está aberto
  }, []);

  async function perguntar() {
    const aindaEstou = await janela<boolean>({
      titulo: 'Você ainda está aqui?',
      corpo: 'Faz um tempo que nada muda nesta tarefa. O tempo desde este aviso só conta se você ainda estava trabalhando nela.',
      acoes: [{ rotulo: 'Não estava', valor: false }, { rotulo: 'Ainda estou', valor: true, tipo: 'pri' }]
    });
    despachar({ tipo: 'responder', agora: Date.now(), aindaEstou: aindaEstou === true });
    void gravar();
  }

  async function comecarOutroPeriodo() {
    await gravar();
    const contando = c.current.contando;
    c.current = PARADO;
    periodo.current = periodoNovo();
    if (contando) despachar({ tipo: 'iniciar', agora: Date.now() }); else setEstado(PARADO);
  }

  return {
    contando: estado.contando,
    /** Segundos do período deste cartão aberto (o que já foi gravado dele está em registros com o id abaixo). */
    segundos: segundosDoPeriodo(estado, agora),
    /** O registro do banco em que este período está sendo gravado (para não somá-lo duas vezes). */
    periodoId: periodo.current.id,
    pausar: async () => { despachar({ tipo: 'pausar', agora: Date.now() }); await gravar(); aoGravarRef.current(); },
    retomar: () => despachar({ tipo: 'iniciar', agora: Date.now() })
  };
}
