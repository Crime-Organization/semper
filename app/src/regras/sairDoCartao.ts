// Sair de um cartão: tarefa, demanda, processo ou compromisso (#276). A regra de verdade está no banco.
import { equipeEditaTudo, equipeVeTudo } from './equipeVeTudo';

type Escritorio = { modulos?: Record<string, boolean> } | null | undefined;

/**
 * O banco aceita a gravação que deixa a pessoa fora do cartão? Aceita para quem administra, para quem criou, na fase de adaptação e para quem
 * continua vendo pelo item ligado (a demanda da tarefa, o processo do compromisso). Com só a chave de ver tudo, o item ligado aparece para todos
 * e não prova que a pessoa pode gravar.
 */
export const gravaForaDoCartao = (ctx: { ehAdmin: boolean; escritorio?: Escritorio }, criou: boolean, continuaPeloLigado = false) =>
  ctx.ehAdmin || criou || equipeEditaTudo(ctx.escritorio) || (continuaPeloLigado && !equipeVeTudo(ctx.escritorio));

/** Quem estava no cartão antes de gravar. */
export interface CartaoAntes { responsavel_id: string; lista: readonly string[] }

/**
 * A lista que vai para o banco, e se a pessoa ainda precisa sair depois de gravar.
 * - Pode gravar fora do cartão, ou continua nele: nada muda.
 * - Estava no cartão e saiu: esta gravação ainda a mantém, e a saída vem depois, por SD.cartaoSair (ficou).
 * - Nunca esteve e chegou pelo item ligado: não entra nem sai. Se ela tirou a ligação, entra na lista, senão o banco recusaria e ela perderia o acesso.
 */
export function pessoasAoGravar(lista: string[], responsavelDepois: string | undefined, eu: string, antes: CartaoAntes, podeSair: boolean, continuaPeloLigado = false) {
  if (podeSair || responsavelDepois === eu || lista.includes(eu)) return { lista, ficou: false };
  if (antes.responsavel_id === eu || antes.lista.includes(eu)) return { lista: listaAteSair(lista, eu, antes.lista), ficou: true };
  return { lista: continuaPeloLigado ? lista : [...lista, eu], ficou: false };
}

/** A lista da gravação que ainda mantém a pessoa: ela volta ao lugar de antes, para o histórico não mostrar uma troca de ordem que não houve. */
export function listaAteSair(lista: readonly string[], eu: string, antes: readonly string[] = []): string[] {
  const nova = [...lista], lugar = antes.indexOf(eu);
  nova.splice(lugar < 0 ? nova.length : Math.min(lugar, nova.length), 0, eu);
  return nova;
}
