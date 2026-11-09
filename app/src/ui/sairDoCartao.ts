// A pessoa sai do cartão depois de gravar o resto (#276).
import { SD } from '../dados';
import type { ModuloComSaida } from '../dados/tipos';
import { avisar, sinalizarMudanca } from './avisos';

/** O aviso quando o resto foi gravado, mas a saída falhou: salvar de novo refaz os dois passos. */
export const SAIDA_FALHOU = 'As alterações foram salvas, mas você continua neste cartão. Salve de novo para sair.';

export async function sairDoCartao(modulo: ModuloComSaida, id: string, aviso: string) {
  try {
    await SD.cartaoSair(modulo, id);
  } catch {
    sinalizarMudanca();   // o resto já foi gravado: a lista precisa mostrar
    throw new Error(SAIDA_FALHOU);
  }
  avisar(aviso);
  sinalizarMudanca();
}
