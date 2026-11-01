// A lista de etiquetas do escritório, a mesma para todos os módulos: fica guardada para não ser buscada por cartão.
// É lida de novo ao abrir uma página de módulo ou um cartão e quando chega um cartão com etiqueta que ela não conhece
// (criada por um colega). Pertence a quem está logado: trocou a conta, a lista antiga é esquecida na hora.
import { useEffect } from 'react';
import { SD, type Etiqueta } from '../dados';
import { etiquetasNaOrdem } from '../regras/etiquetas';
import { falha } from './avisos';
import { criarLoja } from './loja';

/** A lista do escritório (null: ainda não veio). */
export const lojaDeEtiquetas = criarLoja<Etiqueta[] | null>(null);
/** Só a busca mais nova vale: uma resposta atrasada, de antes de trocar a conta, é descartada. */
let ultimaBusca = 0;
let buscando = false;
let dono: string | null = null;
/** As etiquetas desconhecidas já procuradas: cada uma provoca uma busca só. */
const procuradas = new Set<string>();

export async function buscarEtiquetas() {
  const esta = ++ultimaBusca;
  buscando = true;
  try {
    const lista = await SD.etiquetasListar();
    if (esta === ultimaBusca) lojaDeEtiquetas.mudar(etiquetasNaOrdem(lista));
  } catch (e) {
    if (esta === ultimaBusca) falha(e);
  }
  if (esta === ultimaBusca) buscando = false;
}

/** Chamado pela sessão sempre que o perfil é lido: outra conta não vê a lista da anterior. */
export function iniciarEtiquetas(perfilId: string) {
  if (dono === perfilId) return;
  dono = perfilId;
  ultimaBusca++;
  buscando = false;
  procuradas.clear();
  lojaDeEtiquetas.reiniciar();
}

/** Um cartão trouxe etiquetas: as que a lista não conhece fazem buscá-la de novo (uma vez por etiqueta). */
export function procurarEtiquetas(ids: string[], lista: Etiqueta[]) {
  const novas = ids.filter(id => !procuradas.has(id) && !lista.some(e => e.id === id));
  if (!novas.length) return;
  novas.forEach(id => procuradas.add(id));
  void buscarEtiquetas();
}

export function useEtiquetas(): Etiqueta[] {
  const lista = lojaDeEtiquetas.usar();
  useEffect(() => { if (lista === null && !buscando) void buscarEtiquetas(); }, [lista]);
  return lista ?? [];
}

/** Para a página de módulo: relê a lista ao abrir e desliga o filtro de uma etiqueta que deixou de existir. */
export function useEtiquetasDaPagina(filtro: string | undefined, aoLimpar: () => void): Etiqueta[] {
  const etiquetas = useEtiquetas();
  const lista = lojaDeEtiquetas.usar();
  useEffect(() => { if (lojaDeEtiquetas.ler() !== null) void buscarEtiquetas(); }, []);
  const sumiu = !!filtro && lista !== null && !lista.some(e => e.id === filtro);
  useEffect(() => { if (sumiu) aoLimpar(); });
  return etiquetas;
}
