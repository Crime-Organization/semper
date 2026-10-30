// Os cronômetros de tarefa que estão contando agora, em todas as abas deste navegador (cada aba pode ter um cartão de
// tarefa aberto contando: o Ctrl+clique abre o cartão numa aba nova), e o pedido "Pausar todos". As abas conversam por
// um canal do navegador (BroadcastChannel): cada uma anuncia o que começa e o que para, e quem abre pergunta quem está
// contando. Sem o canal (navegador antigo), vale só para a própria aba.
import { criarLoja } from './loja';

/** Uma tarefa contando: em qual aba e o título, para mostrar. */
export interface CronometroAtivo { aba: string; tarefaId: string; titulo: string }
type Mensagem =
  | { tipo: 'contando'; quem: CronometroAtivo; contando: boolean }
  | { tipo: 'quem-esta-contando' }
  | { tipo: 'pausar-todos' };

const NOME_DO_CANAL = 'semper-cronometros';
const ABA = crypto.randomUUID();
const canal = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(NOME_DO_CANAL);
const chave = (c: CronometroAtivo) => `${c.aba}:${c.tarefaId}`;

/** Os que estão contando, nesta aba e nas outras. */
export const cronometrosAtivos = criarLoja<Record<string, CronometroAtivo>>({});
/** Os desta aba (para responder a quem pergunta e para pausar). */
const daqui = new Map<string, { quem: CronometroAtivo; pausar: () => void }>();

function marcar(quem: CronometroAtivo, contando: boolean) {
  cronometrosAtivos.mudar(atual => {
    const novo = { ...atual };
    if (contando) novo[chave(quem)] = quem; else delete novo[chave(quem)];
    return novo;
  });
}

/** O cronômetro de uma tarefa avisa que começou (com o que fazer para pausá-lo) ou parou. */
export function anunciarCronometro(tarefaId: string, titulo: string, contando: boolean, pausar: () => void) {
  const quem = { aba: ABA, tarefaId, titulo };
  if (contando) daqui.set(tarefaId, { quem, pausar }); else daqui.delete(tarefaId);
  marcar(quem, contando);
  canal?.postMessage({ tipo: 'contando', quem, contando } satisfies Mensagem);
}

/** Pausa todos os cronômetros que estão contando, nesta aba e nas outras. */
export function pausarTodos() {
  daqui.forEach(c => c.pausar());
  canal?.postMessage({ tipo: 'pausar-todos' } satisfies Mensagem);
}

const RESPOSTAS: { [T in Mensagem['tipo']]: (m: Extract<Mensagem, { tipo: T }>) => void } = {
  'contando': m => marcar(m.quem, m.contando),
  'quem-esta-contando': () => daqui.forEach(c => canal?.postMessage({ tipo: 'contando', quem: c.quem, contando: true } satisfies Mensagem)),
  'pausar-todos': () => daqui.forEach(c => c.pausar())
};

if (canal) {
  canal.onmessage = (e: MessageEvent<Mensagem>) => (RESPOSTAS[e.data.tipo] as (m: Mensagem) => void)(e.data);
  canal.postMessage({ tipo: 'quem-esta-contando' } satisfies Mensagem);
  // Ao fechar a aba, as outras ficam sabendo que os cronômetros dela pararam.
  window.addEventListener('pagehide', () => daqui.forEach(c => canal.postMessage({ tipo: 'contando', quem: c.quem, contando: false } satisfies Mensagem)));
}
