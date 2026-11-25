// O cronômetro do cartão da tarefa (as regras estão em regras/cronometro.ts). Regras do dono do produto (30/10):
// - só começa quando a pessoa inicia (o botão ou a tecla T, que também pausa e retoma);
// - fechar o cartão pausa sozinho; a tarefa concluída não conta mais;
// - depois de um tempo sem mexer, pergunta "Você ainda está aqui?";
// - "Pausar todos" (ui/cronometros.ts) pausa os que estão contando, em todas as abas.
// O período vai sendo gravado no banco de minuto em minuto, ao pausar e ao fechar; passou do máximo (12 horas),
// começa outro.
import { useCallback, useEffect, useRef, useState } from 'react';
import { SD } from '../dados';
import { PERIODO_MAXIMO } from '../dados/limites';
import { ehTeclaSozinha } from '../regras/atalhos';
import { cronometro, PARADO, segundosDoPeriodo, type Cronometro, type Evento } from '../regras/cronometro';
import { atalhosLigados, estaEscrevendo, teclaDoEvento } from '../ui/atalhos';
import { avisar, falha } from '../ui/avisos';
import { anunciarCronometro } from '../ui/cronometros';
import { janela } from '../ui/janela';
import { GRAVAR_TEMPO_A_CADA, INATIVIDADE_DO_CRONOMETRO, TIQUE_DO_CRONOMETRO } from '../ui/tempos';

/** O que a pessoa faz na tela e conta como "estou aqui". */
const MOVIMENTOS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'] as const;
/** A tecla que inicia, pausa e retoma a contagem (com o cartão aberto e fora de um campo de texto). */
export const TECLA_DO_CRONOMETRO = 't';

/**
 * O período que o cronômetro grava: o registro (id), quando começou e quanto já gravou nele. "desconto": os segundos deste período do
 * cronômetro que ficaram num registro que foi corrigido ou apagado em outro lugar (#400) e não entram no registro de agora.
 */
interface Periodo { id: number | null; inicio: string; gravados: number; desconto: number }
const periodoNovo = (): Periodo => ({ id: null, inicio: new Date().toISOString(), gravados: 0, desconto: 0 });
/** O aviso a quem está contando quando o registro do período foi mudado ou apagado em outra aba, aparelho ou por um administrador. */
export const PERIODO_TROCADO = 'Seu registro de tempo desta tarefa foi mudado ou apagado em outro lugar. O tempo contado depois disso foi para um registro novo.';

export function useCronometro(tarefa: { id: string; titulo: string }, podeContar: boolean, aoGravar: () => void) {
  const [estado, setEstado] = useState<Cronometro>(PARADO);
  const c = useRef(estado);
  const [agora, setAgora] = useState(() => Date.now());
  const periodo = useRef<Periodo>(periodoNovo());
  const fila = useRef<Promise<void>>(Promise.resolve());
  const aoGravarRef = useRef(aoGravar);
  aoGravarRef.current = aoGravar;

  const despachar = useCallback((e: Evento) => { c.current = cronometro(c.current, e); setEstado(c.current); }, []);

  // Grava o que o período tem até agora (só se cresceu), um pedido de cada vez. Se o registro não aceita mais (foi corrigido ou
  // apagado em outra aba, aparelho ou por um administrador), o que foi contado depois da última gravação vai para um registro novo.
  const gravar = useCallback(() => {
    fila.current = fila.current.then(async () => {
      const p = periodo.current, contados = segundosDoPeriodo(c.current, Date.now());
      if (contados - p.desconto <= p.gravados) return;
      if (p.id !== null) {
        if (await SD.tempoGravar(p.id, contados - p.desconto)) { p.gravados = contados - p.desconto; return; }
        Object.assign(p, { id: null, inicio: new Date().toISOString(), desconto: p.desconto + p.gravados, gravados: 0 });
        avisar(PERIODO_TROCADO, 'info');
      }
      const s = contados - p.desconto;
      p.id = await SD.tempoIniciar(tarefa.id, p.inicio, s);
      p.gravados = s;
    }).catch(e => { falha(e); });
    return fila.current;
  }, [tarefa.id]);

  const pausar = useCallback(async () => {
    if (!c.current.contando) return;
    despachar({ tipo: 'pausar', agora: Date.now() });
    await gravar();
    aoGravarRef.current();
  }, [despachar, gravar]);
  // O período que ainda não foi gravado começa agora (não quando o cartão abriu): é o "desde" do registro e da linha que conta (#442).
  const iniciar = useCallback(() => {
    if (!podeContar) return;
    if (periodo.current.id === null && periodo.current.gravados === 0) periodo.current.inicio = new Date().toISOString();
    despachar({ tipo: 'iniciar', agora: Date.now() });
  }, [podeContar, despachar]);
  const alternar = useCallback(() => { if (c.current.contando) void pausar(); else iniciar(); }, [pausar, iniciar]);
  // O registro do período pausado foi apagado ou corrigido (#400): o cronômetro o solta, e o próximo Retomar começa outro período
  // (gravar no registro corrigido desfaria a correção; no apagado, o tempo se perderia). Contando, não solta: a tela pede para pausar.
  const soltarPeriodo = useCallback(() => {
    if (c.current.contando) return;
    periodo.current = periodoNovo();
    c.current = PARADO;
    setEstado(PARADO);
  }, []);

  // Ao fechar o cartão (ou a aba), pausa e grava.
  useEffect(() => {
    const aoSair = () => { void gravar(); };
    window.addEventListener('pagehide', aoSair);
    return () => {
      window.removeEventListener('pagehide', aoSair);
      despachar({ tipo: 'pausar', agora: Date.now() });
      void gravar();
    };
  // oxlint-disable-next-line react/exhaustive-deps -- uma vez, ao abrir e ao fechar o cartão
  }, []);

  // A tarefa que foi para a coluna das concluídas para de contar (a contagem dela encerra).
  useEffect(() => { if (!podeContar) void pausar(); }, [podeContar, pausar]);

  // Avisa as outras abas (e o "Pausar todos" do menu) quando começa e quando para.
  useEffect(() => {
    anunciarCronometro(tarefa.id, tarefa.titulo, estado.contando, () => { void pausar(); });
  }, [estado.contando, tarefa.id, tarefa.titulo, pausar]);
  useEffect(() => () => anunciarCronometro(tarefa.id, tarefa.titulo, false, () => {}), [tarefa.id, tarefa.titulo]);

  // A tecla T: inicia, pausa e retoma (não vale digitando num campo, nem com uma janela aberta por cima). O que é "digitando"
  // e "tecla sozinha" (sem Ctrl, Alt ou Cmd; o AltGr não conta) é a mesma regra dos atalhos da página (regras/atalhos.ts, #86), e ele também
  // para quando a pessoa desliga os atalhos de uma tecla só.
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== TECLA_DO_CRONOMETRO || !ehTeclaSozinha(teclaDoEvento(e))) return;
      if (estaEscrevendo(e.target) || document.querySelector('.veu-janela') || !atalhosLigados()) return;
      e.preventDefault();
      alternar();
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [alternar]);

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
      if (desdeGravar >= GRAVAR_TEMPO_A_CADA) { desdeGravar = 0; if (c.current.contando) void gravar().then(() => aoGravarRef.current()); }
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
    /** Segundos do período deste cartão aberto (o que já foi gravado dele está no registro periodoId). */
    segundos: segundosDoPeriodo(estado, agora) - periodo.current.desconto,
    /** O registro do banco em que este período está sendo gravado (para não somá-lo duas vezes). */
    periodoId: periodo.current.id,
    /** Quando começou o período deste cartão: o "desde" da linha que conta, antes mesmo da primeira gravação (#442). */
    inicio: periodo.current.inicio,
    pausar, iniciar, alternar, soltarPeriodo
  };
}
