// Onde a lista do ! dos comentários (#297) procura os itens: a busca de cada módulo mencionável para ligar (a mesma das ligações da
// anotação), que só traz os itens ativos que quem digita vê. A ordem e o limite ficam em regras/comentarios.ts.
import { SD, type ItemDaAnotacao, type ModuloMencionavel } from '../dados';
import { ACHADOS_DA_MENCAO } from '../dados/limites';
import { ordenarItensParaMencionar } from '../regras/comentarios';

export type BuscarItensParaMencionar = (termo: string, modulos: readonly ModuloMencionavel[]) => Promise<ItemDaAnotacao[]>;

/** Busca nos módulos indicados ao mesmo tempo. Um módulo que falhar não derruba os outros. */
export const buscarItensParaMencionar: BuscarItensParaMencionar = async (termo, modulos) => {
  const respostas = await Promise.allSettled(modulos.map(m => SD.itensParaLigar(m, termo)));
  const achados = respostas.flatMap(r => r.status === 'fulfilled' ? r.value : []);
  return ordenarItensParaMencionar(achados, termo, ACHADOS_DA_MENCAO);
};
