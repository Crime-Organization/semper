// Caixa de mensagens (#112): para onde cada mensagem leva e como ela aparece. A tela só chama estas funções.
import { MAIOR_CONTADOR_DE_MENSAGENS, TRECHO_DA_MENSAGEM } from '../dados/limites';
import type { ModuloComentado } from '../dados/tipos';

/** O parâmetro do endereço que diz qual comentário mostrar quando o cartão abre. */
export const PARAMETRO_DO_COMENTARIO = 'comentario';

/** A página de cada módulo e o nome do cartão dele. Módulo novo com comentários = uma entrada nova. */
export const CARTAO_DO_MODULO: Record<ModuloComentado, { pagina: string; nome: string }> = {
  pessoas: { pagina: '/pessoas/', nome: 'Pessoa' },
  contratos: { pagina: '/contratos/', nome: 'Contrato' },
  demandas: { pagina: '/demandas/', nome: 'Demanda' },
  tarefas: { pagina: '/tarefas/', nome: 'Tarefa' },
  compromissos: { pagina: '/agenda/', nome: 'Compromisso' }
};

/** O endereço que abre o cartão no comentário da mensagem. */
export function enderecoDoComentario(modulo: ModuloComentado, cartaoId: string, comentarioId: string) {
  return `${CARTAO_DO_MODULO[modulo].pagina}?${new URLSearchParams({ id: cartaoId, [PARAMETRO_DO_COMENTARIO]: comentarioId })}`;
}

/** O começo do comentário, numa linha só, para a lista. */
export function trechoDaMensagem(texto: string) {
  const corrido = texto.replace(/\s+/g, ' ').trim();
  return corrido.length > TRECHO_DA_MENSAGEM ? corrido.slice(0, TRECHO_DA_MENSAGEM).trimEnd() + '…' : corrido;
}

/** O número do contador do menu. */
export const textoDoContador = (naoLidas: number) => naoLidas > MAIOR_CONTADOR_DE_MENSAGENS ? MAIOR_CONTADOR_DE_MENSAGENS + '+' : String(naoLidas);

/** O nome do item do menu para quem usa leitor de tela, com o número de não lidas. */
export const rotuloDoMenu = (naoLidas: number) => ({ 0: 'Mensagens', 1: 'Mensagens, 1 não lida' } as Record<number, string>)[naoLidas] ?? `Mensagens, ${naoLidas} não lidas`;
