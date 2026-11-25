// A lista dos papéis do cliente escritos pela equipe nos processos (#443), a mesma para o cadastro do processo e a pergunta do papel
// no cartão: fica guardada para não ser buscada por tela. É lida na primeira tela que a pede e de novo quando muda
// (recarregarPapeisEscritos: depois de pôr na lista o que a pessoa escreveu, ou de tirar um papel nas Configurações).
// Pertence a quem está logado: trocou a conta, a lista antiga é esquecida (iniciarPapeisEscritos, chamado pela sessão).
// O molde é ui/funcoesNaTarefa.ts.
import { useEffect } from 'react';
import { SD, type PapelEscrito } from '../dados';
import type { PapelEscolhido } from '../regras/papelEscrito';
import { falha } from './avisos';
import { criarLoja } from './loja';

/** A lista do escritório (null: ainda não veio). */
export const lojaDePapeisEscritos = criarLoja<PapelEscrito[] | null>(null);
/** Só a busca mais nova vale: uma resposta atrasada, de antes de trocar a conta, é descartada. */
let ultimaBusca = 0;
let buscando = false;
let dono: string | null = null;

/** Busca a lista de novo. Sem resposta, a lista fica vazia: as telas seguem só com os papéis fixos. */
export async function recarregarPapeisEscritos() {
  const esta = ++ultimaBusca;
  buscando = true;
  const lista = await SD.processoPapeisEscritos().catch(() => [] as PapelEscrito[]);
  if (esta === ultimaBusca) { lojaDePapeisEscritos.mudar(lista); buscando = false; }
}

/** Chamado pela sessão sempre que o perfil é lido: outra conta não vê a lista da anterior. */
export function iniciarPapeisEscritos(perfilId: string) {
  if (dono === perfilId) return;
  dono = perfilId;
  ultimaBusca++;
  buscando = false;
  lojaDePapeisEscritos.reiniciar();
}

/** Os nomes da lista do escritório, por nome (vazia enquanto não chegam). */
export function usePapeisEscritos(): string[] {
  const lista = lojaDePapeisEscritos.usar();
  useEffect(() => { if (lista === null && !buscando) void recarregarPapeisEscritos(); }, [lista]);
  return (lista ?? []).map(x => x.nome);
}

/**
 * Põe na lista do escritório os nomes que a pessoa escreveu agora, depois que o processo foi gravado, e lê a lista de novo. Não
 * segura a tela: se não der, o processo já está gravado, e só o aviso diz que o nome ficou fora da lista.
 */
export function incluirNaListaDoEscritorio(nomes: readonly string[]) {
  if (!nomes.length) return;
  void SD.processoPapeisIncluir([...nomes]).then(recarregarPapeisEscritos, falha);
}
/** O papel escolhido na pergunta do cartão: se a pessoa o escreveu agora, ele vai para a lista do escritório. */
export const incluirOEscrito = (escolha: PapelEscolhido | undefined) =>
  incluirNaListaDoEscritorio(escolha?.escritoAgora && escolha.escrito ? [escolha.escrito] : []);
