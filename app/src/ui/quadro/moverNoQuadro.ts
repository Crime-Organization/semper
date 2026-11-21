// Mover uma miniatura de coluna só na tela, sem arrastar (#350): o círculo de concluir grava a coluna nova e pede ao quadro que
// leve a miniatura para lá, como o arrastar faz, em vez de reler o quadro inteiro. Fora do quadro (na tabela), não há quem mova:
// o valor é null, e quem gravou avisa a página para reler.
import { createContext } from 'react';

/**
 * Leva o item `id` para a coluna `para`, na posição `ordem` da ordem manual. Com `focar` (a pessoa usou o teclado), se o item não
 * fica à vista na coluna nova, o foco vai para a miniatura vizinha na coluna de onde ele saiu.
 */
export type MoverNaTela = (id: string, para: string | null, ordem: number, focar: boolean) => void;

export const MoverNoQuadro = createContext<MoverNaTela | null>(null);
