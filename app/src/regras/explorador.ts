// O explorador da página Documentos, como o do Obsidian: a árvore das pastas com as anotações dentro de cada uma, e as que
// não estão em nenhuma pasta no primeiro nível, depois das pastas. A ordem das anotações é a que a pessoa escolheu no
// explorador (o banco já as devolve nela); aqui elas só são repartidas pelas pastas. Desde a #370, a anotação se arrasta para
// uma pasta (ou para "Sem pasta", que a tira delas). Regras puras: sem tela, sem banco.
import type { Ordem } from '../dados/tipos';
import { caminhoDaPasta, textoDoCaminho, type PastaDaArvore } from './pastas';

/** O que o explorador precisa de cada anotação. */
export interface AnotacaoDoExplorador { id: string; titulo: string; pasta_id: string | null }

/** As ordens que o botão "Ordenar" do explorador oferece (a primeira é a de quem nunca escolheu). */
export const ORDENS_DO_EXPLORADOR: Ordem[] = ['nome', 'nome_desc', 'recentes', 'novos', 'antigos'];
/** A ordem guardada que não é do explorador (de uma versão antiga, por exemplo) volta à primeira. */
export const ordemDoExplorador = (guardada: string): Ordem =>
  (ORDENS_DO_EXPLORADOR as string[]).includes(guardada) ? guardada as Ordem : ORDENS_DO_EXPLORADOR[0];

/**
 * As anotações de cada pasta, na ordem em que vieram. A chave `null` junta as que não estão em pasta nenhuma e as que estão
 * numa pasta que a lista ainda não conhece (um colega acabou de criá-la): ficam no primeiro nível até as pastas chegarem.
 */
export function anotacoesPorPasta<A extends AnotacaoDoExplorador>(anotacoes: A[], pastas: PastaDaArvore[]): Map<string | null, A[]> {
  const conhecidas = new Set(pastas.map(p => p.id));
  const grupos = new Map<string | null, A[]>();
  for (const a of anotacoes) {
    const chave = a.pasta_id && conhecidas.has(a.pasta_id) ? a.pasta_id : null;
    grupos.set(chave, [...(grupos.get(chave) ?? []), a]);
  }
  return grupos;
}

/**
 * As pastas que precisam estar abertas para a anotação aberta (e a pasta escolhida) aparecerem na árvore: todas as do caminho
 * até elas, sem repetir.
 */
export const pastasParaMostrar = (pastas: PastaDaArvore[], ...ids: (string | null)[]) =>
  [...new Set(ids.flatMap(id => caminhoDaPasta(pastas, id).map(p => p.id)))];

// ---------- levar a anotação para outra pasta, arrastando (#370) ----------
/**
 * O alvo do arrasto que tira a anotação das pastas: a linha do alto do explorador, que vira "Sem pasta" enquanto a anotação é
 * arrastada. Cada pasta é alvo pelo próprio id.
 */
export const ALVO_SEM_PASTA = 'sem-pasta';
/** A pasta de destino de um alvo do arrasto (null: fora das pastas). */
export const pastaDoAlvo = (alvo: string): string | null => alvo === ALVO_SEM_PASTA ? null : alvo;
/** Soltar a anotação neste alvo muda a pasta dela? Na pasta em que ela já está, não: o alvo nem se destaca. */
export const mudaDePasta = (atual: string | null, alvo: string) => pastaDoAlvo(alvo) !== atual;
/** O aviso no pé da tela depois de levar a anotação para outra pasta (null: para fora das pastas). */
export const avisoDaMudancaDePasta = (pastas: PastaDaArvore[], destino: string | null) =>
  destino ? `Anotação levada para a pasta ${textoDoCaminho(pastas, destino)}.` : 'Anotação levada para fora das pastas.';
