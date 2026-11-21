// Concluir a tarefa que cumpre um prazo de processo pergunta se o prazo foi cumprido; reabri-la, se ele volta a ficar aberto (#355).
// Chamada pela oferta comum da Situação (situacaoDoItem.tsx), vale para todos os caminhos: o ✓ do cartão, o menu Situação, o
// círculo da miniatura e da tabela, o arrastar no quadro e a caixa da tarefa no cartão da demanda. Com o sim, grava como a caixa
// "Prazo cumprido" do cartão do processo (com o histórico do processo e o Desfazer).
import { SD } from '../dados';
import { PERGUNTA_DO_PRAZO, perguntaDoPrazo, prazosQueMudam } from '../regras/prazoDaTarefa';
import { falha, feito } from '../ui/avisos';
import { confirmar } from '../ui/janela';

/**
 * Chame depois de a tarefa mudar de coluna, de `de` para `para`. Só pergunta se ela chegou à coluna das concluídas (ou saiu dela) e
 * cumpre prazos que quem está logado vê, em processos ativos, ainda abertos (ou já cumpridos, ao reabrir). Devolve se gravou.
 */
export async function oferecerPrazoDoProcesso(tarefaId: string, de: string | null, para: string | null): Promise<boolean> {
  try {
    const pergunta = perguntaDoPrazo(await SD.colunasListar('tarefas'), de, para);
    if (!pergunta) return false;
    const prazos = prazosQueMudam(pergunta, await SD.prazosDaTarefa(tarefaId));
    if (!prazos.length) return false;
    const como = PERGUNTA_DO_PRAZO[pergunta];
    if (!await confirmar(como.titulo, como.texto(prazos.map(z => z.descricao)), como.botao)) return false;
    const concluido_em = como.concluidoEm(new Date().toISOString());
    await Promise.all(prazos.map(z => SD.processoPrazoAtualizar(z.id, { concluido_em })));
    feito(como.aviso(prazos.length), como.oQue, async () => {
      await Promise.all(prazos.map(z => SD.processoPrazoAtualizar(z.id, { concluido_em: z.concluido_em })));
    });
    return true;
  } catch (e) { falha(e); return false; }
}
