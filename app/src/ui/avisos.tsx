// Avisos rápidos, desfazer (Ctrl+Z) e o sinal de "dados mudaram".
// Funções comuns (não dependem de componente): qualquer tela chama avisar(), falha() ou feito().
import { useEffect, useRef } from 'react';
import { criarLoja } from './loja';
import { DURACAO_AVISO } from './tempos';

type TipoAviso = 'ok' | 'erro' | 'info';
interface Aviso { id: number; texto: string; tipo: TipoAviso; acao?: { rotulo: string; fn: () => void }; saindo?: boolean }

const avisos = criarLoja<Aviso[]>([]);
let seq = 0;

export function removerAviso(id: number) {
  avisos.mudar(lista => lista.filter(a => a.id !== id));
}

/** Mostra um aviso no pé da tela. acao (opcional) vira um botão no aviso (ex.: "Desfazer"). Devolve o id. */
export function avisar(texto: string, tipo: TipoAviso = 'ok', acao?: Aviso['acao']) {
  const id = ++seq;
  avisos.mudar(lista => [...lista, { id, texto, tipo, acao }]);
  setTimeout(() => {
    avisos.mudar(lista => lista.map(a => a.id === id ? { ...a, saindo: true } : a));
    setTimeout(() => removerAviso(id), 300);
  }, tipo === 'erro' ? DURACAO_AVISO.erro : acao ? DURACAO_AVISO.comAcao : DURACAO_AVISO.ok);
  return id;
}
export const falha = (e: unknown) => avisar((e as Error)?.message || 'Não foi possível concluir agora.', 'erro');

// ---------- dados mudaram ----------
// Depois de desfazer (ou de qualquer mudança feita fora da tela aberta), as telas recarregam o que mostram.
export interface Mudanca { tipo?: string; id?: string }
const EVENTO = 'semper:dados-mudaram';
export function sinalizarMudanca(detalhe?: Mudanca | void) {
  window.dispatchEvent(new CustomEvent(EVENTO, { detail: detalhe || {} }));
}
export function useMudancas(fn: (detalhe: Mudanca) => void) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    const h = (e: Event) => ref.current((e as CustomEvent<Mudanca>).detail);
    window.addEventListener(EVENTO, h);
    return () => window.removeEventListener(EVENTO, h);
  }, []);
}

// ---------- desfazer ----------
// Cada ação que pode ser revertida registra como desfazê-la. Ctrl+Z (fora de campos de texto, onde vale
// o desfazer do navegador) ou o botão do aviso desfazem a mais recente. A pilha vale para o sistema todo:
// dá para salvar um cadastro, voltar à lista e desfazer de lá.
type AcaoDesfazer = () => Promise<Mudanca | void> | Mudanca | void;
interface ItemDesfazer { descricao: string; acao: AcaoDesfazer; aviso?: number }
const pilha: ItemDesfazer[] = [];

export function registrarDesfazer(descricao: string, acao: AcaoDesfazer) {
  const item: ItemDesfazer = { descricao, acao };
  pilha.push(item);
  if (pilha.length > 30) pilha.shift();
  return item;
}
async function executarDesfazer(item: ItemDesfazer) {
  const i = pilha.indexOf(item);
  if (i < 0) return;
  pilha.splice(i, 1);
  if (item.aviso) removerAviso(item.aviso);
  try {
    const detalhe = await item.acao();
    avisar(`Desfeito: ${item.descricao}.`);
    sinalizarMudanca(detalhe);
  } catch (e) { falha(e); }
}
export function desfazerUltimo() {
  if (pilha.length) void executarDesfazer(pilha[pilha.length - 1]);
  else avisar('Não há ação para desfazer.');
}
/** Mostra o aviso da ação feita, com o botão "Desfazer". */
export function feito(texto: string, descricao: string, acao: AcaoDesfazer) {
  const item = registrarDesfazer(descricao, acao);
  item.aviso = avisar(texto, 'ok', { rotulo: 'Desfazer', fn: () => executarDesfazer(item) });
}

function teclaDesfazer(e: KeyboardEvent) {
  if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey || e.key.toLowerCase() !== 'z') return;
  if ((e.target as Element | null)?.closest?.('input, textarea, select, [contenteditable="true"]')) return;
  if (document.querySelector('.veu-janela')) return;
  e.preventDefault();
  desfazerUltimo();
}

/** Área dos avisos (uma só, na raiz do app). Também liga o Ctrl+Z. */
export function Avisos() {
  const lista = avisos.usar();
  useEffect(() => {
    document.addEventListener('keydown', teclaDesfazer);
    return () => document.removeEventListener('keydown', teclaDesfazer);
  }, []);
  return <div id="avisos" role="status">
    {lista.map(a => <div key={a.id} className={`toast ${a.tipo}${a.saindo ? ' sai' : ''}`}>
      {a.texto}
      {a.acao && <button type="button" className="toast-acao" onClick={() => { removerAviso(a.id); a.acao!.fn(); }}>{a.acao.rotulo}</button>}
    </div>)}
  </div>;
}
