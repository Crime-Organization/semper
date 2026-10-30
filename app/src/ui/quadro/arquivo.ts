// A coluna fixa "Arquivados", a última de todo quadro: arrastar um cartão para ela arquiva; arrastar dela para outra
// coluna desarquiva e põe o cartão lá. O quadro (Kanban.tsx) trata a coluna como as outras; a página do módulo só
// passa como arquivar e mover, e moverNoArquivo() cuida dos dois casos, com o aviso e o "Desfazer".
import { feito } from '../avisos';
import type { Movimento } from './Kanban';

/** O "id" da coluna Arquivados no quadro (não é uma coluna do banco). */
export const ARQUIVADOS = '__arquivados__';
export const ROTULO_ARQUIVADOS = 'Arquivados';

export interface AcoesDoArquivo {
  arquivar: (ids: string[], arquivar: boolean) => Promise<unknown>;
  mover: (id: string, etapaId: string | null, ordem: number | null) => Promise<void>;
}

/**
 * Se o movimento entra ou sai da coluna Arquivados, arquiva ou desarquiva (e põe na coluna de destino), avisa e
 * registra o "Desfazer"; devolve true. Se não tem a ver com ela, devolve false e a página segue com o movimento dela.
 */
export async function moverNoArquivo(rotulo: string, id: string, m: Movimento, a: AcoesDoArquivo, nomeDaColuna: (id: string | null) => string) {
  if (m.para === ARQUIVADOS) {
    await a.arquivar([id], true);
    feito(`${rotulo} foi para ${ROTULO_ARQUIVADOS}.`, 'arquivamento', async () => { await a.arquivar([id], false); });
    return true;
  }
  if (m.de === ARQUIVADOS) {
    await a.arquivar([id], false);
    await a.mover(id, m.para, m.ordem);
    feito(`${rotulo} saiu de ${ROTULO_ARQUIVADOS} e foi para "${nomeDaColuna(m.para)}".`, 'desarquivamento', async () => { await a.arquivar([id], true); });
    return true;
  }
  return false;
}
