// A lista de funções dos participantes da tarefa (#313), a mesma para o cadastro, o cartão e os filtros: fica guardada para não ser
// buscada por tela. É lida na primeira tela que a pede e de novo quando as Configurações a mudam (recarregarFuncoes). Pertence a quem
// está logado: trocou a conta, a lista antiga é esquecida (iniciarFuncoes, chamado pela sessão).
import { useEffect } from 'react';
import { SD, type FuncaoNaTarefa } from '../dados';
import { funcoesNaOrdem } from '../regras/funcoesNaTarefa';
import { criarLoja } from './loja';

/** A lista do escritório (null: ainda não veio). */
export const lojaDeFuncoes = criarLoja<FuncaoNaTarefa[] | null>(null);
/** Só a busca mais nova vale: uma resposta atrasada, de antes de trocar a conta, é descartada. */
let ultimaBusca = 0;
let buscando = false;
let dono: string | null = null;

/** Busca a lista de novo (depois de mudá-la nas Configurações). Sem resposta, a lista fica vazia: as telas seguem sem funções. */
export async function recarregarFuncoes() {
  const esta = ++ultimaBusca;
  buscando = true;
  const lista = await SD.funcoesNaTarefaListar().catch(() => [] as FuncaoNaTarefa[]);
  if (esta === ultimaBusca) { lojaDeFuncoes.mudar(funcoesNaOrdem(lista)); buscando = false; }
}

/** Chamado pela sessão sempre que o perfil é lido: outra conta não vê a lista da anterior. */
export function iniciarFuncoes(perfilId: string) {
  if (dono === perfilId) return;
  dono = perfilId;
  ultimaBusca++;
  buscando = false;
  lojaDeFuncoes.reiniciar();
}

/** As funções do escritório, na ordem da lista (vazia enquanto não chegam). */
export function useFuncoesNaTarefa(): FuncaoNaTarefa[] {
  const lista = lojaDeFuncoes.usar();
  useEffect(() => { if (lista === null && !buscando) void recarregarFuncoes(); }, [lista]);
  return lista ?? [];
}
