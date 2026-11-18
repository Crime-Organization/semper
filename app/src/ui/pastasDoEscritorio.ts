// As pastas dos documentos do escritório (#342), as mesmas na página Documentos, no cartão e na anotação nova: ficam guardadas
// para não serem buscadas a cada tela. São lidas de novo ao abrir a página Documentos, depois de cada mudança feita aqui e quando
// aparece uma pasta que a lista guardada não conhece (um colega a criou e pôs nela uma anotação): como nas etiquetas, cada pasta
// desconhecida provoca uma leitura só. Pertencem a quem está logado: trocou a conta, a lista antiga é esquecida.
import { useEffect, useRef } from 'react';
import { SD, type Pasta } from '../dados';
import { falha } from './avisos';
import { criarLoja } from './loja';
import { useCtx } from './sessao';

/** A lista do escritório e de quem ela é (null: ainda não veio). */
export const lojaDePastas = criarLoja<{ dono: string; lista: Pasta[] } | null>(null);
/** Só a busca mais nova vale: uma resposta atrasada (de antes de uma mudança, ou de outra conta) é descartada. */
let ultimaBusca = 0;
/** As pastas desconhecidas já procuradas (cada uma provoca uma busca só) e, delas, as que ainda esperam a resposta. De um dono só. */
let donoDasProcuradas: string | null = null;
const procuradas = new Set<string>();
const esperando = new Set<string>();

/** Lê as pastas de novo (depois de criar, renomear, mover ou apagar uma, e ao abrir a página). */
export async function buscarPastas(dono: string) {
  const esta = ++ultimaBusca;
  try {
    const lista = await SD.pastasListar();
    if (esta !== ultimaBusca) return;
    // A busca mais nova começou depois de todas as procuras que esperam: a resposta dela vale por todas.
    esperando.clear();
    lojaDePastas.mudar({ dono, lista });
  } catch (e) {
    if (esta !== ultimaBusca) return;
    esperando.clear();
    // Quem esperava uma pasta volta a mostrar a lista que há.
    lojaDePastas.mudar(atual => atual && { ...atual });
    falha(e);
  }
}

/** Pastas que uma tela trouxe (a da anotação, as da lista): as que a lista não conhece fazem buscá-la de novo, uma vez por pasta. */
export function procurarPastas(dono: string, ids: (string | null | undefined)[], lista: Pasta[]) {
  if (donoDasProcuradas !== dono) {
    donoDasProcuradas = dono;
    procuradas.clear();
    esperando.clear();
  }
  const novas = ids.filter((id): id is string => !!id && !procuradas.has(id) && !lista.some(p => p.id === id));
  if (!novas.length) return;
  novas.forEach(id => { procuradas.add(id); esperando.add(id); });
  void buscarPastas(dono);
}

/** A pasta que a lista não conhece ainda pode chegar: não foi procurada, ou a busca dela não voltou. */
const podeChegar = (dono: string, id: string, lista: Pasta[]) =>
  !lista.some(p => p.id === id) && (donoDasProcuradas !== dono || !procuradas.has(id) || esperando.has(id));

/** A lista de quem está logado (null: ainda não veio) e o dono dela. */
function useMinhas() {
  const dono = useCtx().perfil.id;
  const atual = lojaDePastas.usar();
  return { dono, minhas: atual?.dono === dono ? atual.lista : null };
}

interface OpcoesDasPastas {
  /** Lê de novo uma vez ao aparecer, mesmo com a lista guardada (a página Documentos: o que um colega mudou). */
  reler?: boolean;
  /**
   * A pasta que a tela precisa mostrar (a da anotação, a do endereço). Se a lista guardada não a conhece, lê de novo e, até a
   * resposta chegar, devolve null (a tela mostra "carregando", e não "Sem pasta"). Se depois disso ela não vier, foi apagada.
   */
  precisa?: string | null;
}

/** As pastas do escritório de quem está logado (null enquanto não chegam). */
export function usePastas({ reler = false, precisa = null }: OpcoesDasPastas = {}): Pasta[] | null {
  const { dono, minhas } = useMinhas();
  const falta = minhas === null;
  // Lê quando ainda não há lista desta conta e, uma vez ao aparecer, quando a tela pede a mais nova (o que um colega mudou).
  const pedeLeitura = useRef(reler);
  useEffect(() => {
    if (!falta && !pedeLeitura.current) return;
    pedeLeitura.current = false;
    void buscarPastas(dono);
  }, [dono, falta]);
  useEffect(() => { if (minhas && precisa) procurarPastas(dono, [precisa], minhas); }, [dono, minhas, precisa]);
  return minhas && precisa && podeChegar(dono, precisa, minhas) ? null : minhas;
}

/** Para uma lista de anotações: as pastas delas que a lista guardada não conhece fazem buscá-la de novo (uma vez por pasta). */
export function useProcurarPastas(ids: (string | null | undefined)[]) {
  const { dono, minhas } = useMinhas();
  const chave = [...new Set(ids.filter(Boolean))].join();
  useEffect(() => { if (minhas && chave) procurarPastas(dono, chave.split(','), minhas); }, [dono, minhas, chave]);
}
