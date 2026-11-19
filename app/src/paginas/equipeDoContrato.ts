// A equipe do contrato mudada no topo do cartão (#356): a gravação. Lê o contrato logo antes de gravar, para não apagar o que
// outra pessoa acabou de pôr, e grava pela mesma função de dados do lápis (SD.contratoAtualizar), só com o que muda: o histórico
// do contrato registra a mudança como registra a do lápis. As regras de cada passo estão em regras/equipeDoContrato.ts.
// As mudanças e os Desfazer de um mesmo contrato entram numa fila (naFilaDoContrato): cada um lê e grava a lista inteira, e dois
// ao mesmo tempo leriam a mesma lista, com o segundo apagando o que o primeiro pôs (o Desfazer do aviso fica clicável enquanto
// a bolinha grava, fora da trava da tela).
import { SD } from '../dados';
import { AVISO_NO_CONTRATO, desfazerNoContrato, equipeDoContrato, planoNoContrato, type PedidoNoContrato, type QuemMuda } from '../regras/equipeDoContrato';
import { avisar, feito, type Mudanca } from '../ui/avisos';
import { ITEM_SUMIU } from './ligarNoCartao';

const lerEquipe = async (id: string) => {
  const k = await SD.contratoObter(id);
  if (!k) throw new Error(ITEM_SUMIU);
  return equipeDoContrato(k);
};

/** A última gravação da equipe de cada contrato, que a próxima espera terminar (dê certo ou não). */
const filas = new Map<string, Promise<unknown>>();
/** Faz `gravar` depois da gravação anterior da equipe do mesmo contrato, para uma não apagar a outra. */
export function naFilaDoContrato<T>(contratoId: string, gravar: () => Promise<T>): Promise<T> {
  const vez = (filas.get(contratoId) ?? Promise.resolve()).then(gravar, gravar);
  filas.set(contratoId, vez);
  const sair = () => { if (filas.get(contratoId) === vez) filas.delete(contratoId); };
  vez.then(sair, sair);
  return vez;
}

/** Como terminou: gravou (com Desfazer) ou nada mudou (já estava assim, ou não pode; o aviso já saiu). */
export type FimNoContrato = 'gravou' | 'nada';

/** Faz a mudança pedida na equipe do contrato e avisa: a gravada, com Desfazer (como o lápis); a que não grava, com o motivo. */
export const mudarAEquipeDoContrato = (contratoId: string, pedido: PedidoNoContrato, eu: QuemMuda) => naFilaDoContrato(contratoId, async (): Promise<FimNoContrato> => {
  const antes = await lerEquipe(contratoId);
  const plano = planoNoContrato(pedido, antes, eu);
  if ('aviso' in plano) {
    avisar(plano.aviso, plano.tipo);
    return 'nada';
  }
  await SD.contratoAtualizar(contratoId, plano.gravar);
  feito(AVISO_NO_CONTRATO[pedido.tipo](pedido.nome), 'mudança na equipe do contrato', () => naFilaDoContrato(contratoId, async (): Promise<Mudanca> => {
    const volta = desfazerNoContrato(pedido, antes, await lerEquipe(contratoId));
    if (volta && 'aviso' in volta) throw new Error(volta.aviso);
    if (volta) await SD.contratoAtualizar(contratoId, volta);
    return { tipo: 'contratoAtualizado', id: contratoId };
  }));
  return 'gravou';
});
