// Tirar do cartão o que se ligou nele (#424): o "x" de cada item ligado (ui/base/BotaoTirar.tsx). As regras puras: quem pode
// sair sem deixar o item num estado que o cadastro não aceita, o que o Desfazer põe de volta (no mesmo lugar da lista) e qual papel
// a pessoa precisa ter num item para sair dele pelo cartão dela. As gravações ficam em paginas/ligarNoCartao.ts.
import type { ItemComPessoas } from './ligarExistente';

/** Quantas pessoas cada lista precisa manter: o processo, ao menos um cliente (o cadastro pede); os outros podem ficar sem. */
export const MINIMO_DE_PESSOAS: Record<ItemComPessoas, number> = { processos: 1, demandas: 0, tarefas: 0, compromissos: 0 };
/** A pessoa pode sair da lista pelo "x": a lista continua com o mínimo do item. */
export const podeTirarAPessoa = (modulo: ItemComPessoas, quantas: number) => quantas > MINIMO_DE_PESSOAS[modulo];
/** A recusa quando a pessoa é o último cliente do processo (tirar pelo "x" deixaria o processo sem cliente). */
export const ULTIMO_CLIENTE_DO_PROCESSO = 'O processo precisa de ao menos um cliente. Para trocar o cliente, use o lápis do cartão.';

/**
 * A tarefa sai de uma demanda pelo "x" só se continua em outra: sem nenhuma, ela iria para a demanda contínua de um grupo, e quem
 * escolhe o grupo é o lápis (o cadastro da tarefa pergunta). Por isso o "x" só aparece com duas demandas ou mais.
 */
export const MINIMO_DE_DEMANDAS_DA_TAREFA = 1;
export const podeTirarADemandaDaTarefa = (quantas: number) => quantas > MINIMO_DE_DEMANDAS_DA_TAREFA;
/** A recusa quando a tarefa ficaria sem demanda. */
export const TAREFA_FICARIA_SEM_DEMANDA = 'A tarefa precisa continuar em uma demanda. Para tirá-la desta, use o lápis do cartão.';

/** A demanda que nasceu de um objeto do contrato não sai dele pelo "x": o objeto ficaria sem a demanda dele. Troca-se pelo lápis. */
export const podeTirarOContratoDaDemanda = (d: { objeto: string | null }) => !d.objeto;

/**
 * O Desfazer de tirar um id de uma lista: ele volta ao lugar em que estava (`posicao`), ou ao fim, se a lista encolheu. null quando
 * não há o que voltar: o id já voltou (outra pessoa o pôs de novo) ou a lista encheu (`maximo`) enquanto isso.
 */
export function devolverNaLista(atual: readonly string[], id: string, posicao: number, maximo = Infinity): string[] | null {
  if (atual.includes(id) || atual.length >= maximo) return null;
  const lugar = Math.min(Math.max(posicao, 0), atual.length);
  return [...atual.slice(0, lugar), id, ...atual.slice(lugar)];
}

/**
 * No cartão da pessoa (#424): o papel que ela precisa ter no item para sair dele pelo "x". É o papel da lista de pessoas do item (o
 * cliente da demanda e do processo, a pessoa ligada à tarefa e ao compromisso); quem está no item só pela equipe sai pelo topo do
 * cartão do item, e não por aqui.
 */
export const PAPEL_QUE_SAI: Record<ItemComPessoas, string> = { demandas: 'cliente', processos: 'cliente', tarefas: 'pessoa', compromissos: 'pessoa' };
/** A pessoa tem, no item, o papel que sai pelo "x" do cartão dela. */
export const saiPeloCartaoDaPessoa = (modulo: ItemComPessoas, papeis: readonly string[]) => papeis.includes(PAPEL_QUE_SAI[modulo]);

/** O aviso depois de tirar a pessoa da lista do item, com o nome dela (#424). */
export const PESSOA_TIRADA: Record<ItemComPessoas, (nome: string) => string> = {
  demandas: nome => `Cliente tirado da demanda: ${nome}.`,
  processos: nome => `Cliente tirado do processo: ${nome}.`,
  tarefas: nome => `Pessoa tirada da tarefa: ${nome}.`,
  compromissos: nome => `Pessoa tirada do compromisso: ${nome}.`
};
/** O que a janela de tirar a pessoa explica. */
export const EXPLICACAO_DE_TIRAR_A_PESSOA = 'A pessoa continua no cadastro: só sai deste cartão. Dá para desfazer logo depois, no aviso do pé da tela.';

/** Os textos de tirar a tarefa de uma das demandas ou de um dos contratos dela (#283, #424), pelo código do item. */
export const TIRAR_DA_TAREFA: Record<'demandas' | 'contratos', { oQue: (codigo: string) => string; feito: (codigo: string) => string; acao: string; explicacao: string }> = {
  demandas: { oQue: c => `a demanda ${c}`, feito: c => `Tarefa tirada da demanda ${c}.`, acao: 'retirada da demanda',
    explicacao: 'A tarefa continua nas outras demandas dela. Quem está só nesta demanda pode deixar de ver a tarefa. Dá para desfazer logo depois, no aviso do pé da tela.' },
  contratos: { oQue: c => `o contrato ${c}`, feito: c => `Tarefa tirada do contrato ${c}.`, acao: 'retirada do contrato',
    explicacao: 'Quem está só neste contrato deixa de ver a tarefa. Dá para desfazer logo depois, no aviso do pé da tela.' }
};
/** O que a janela de tirar o contrato da demanda explica. */
export const EXPLICACAO_DE_TIRAR_O_CONTRATO_DA_DEMANDA = 'Quem está só no contrato deixa de ver esta demanda. Dá para desfazer logo depois, no aviso do pé da tela.';
/** O que a janela de tirar um item do processo explica (a demanda, o contrato, a tarefa, o compromisso). */
export const EXPLICACAO_DE_TIRAR_DO_PROCESSO = 'O item continua no SEMPER: só deixa de estar ligado a este processo. Dá para desfazer logo depois, no aviso do pé da tela.';
