// Do cliente ao contrato (#269), na tela: o que acontece quando um cartão chega a uma coluna-marco.
//  - A pessoa em "Contrato fechado" ganha um contrato em "Aguardando assinatura" (o banco cria, uma vez só por pessoa).
//    A mudança de etapa já está gravada: se o contrato não nascer, ela fica, e o aviso diz o porquê.
//  - O contrato assinado sem objeto definido não gera demanda: o aviso diz o que fazer.
import { SD, type Coluna, type ContratoDoClienteFechado } from '../dados';
import { objetosDefinidos } from '../regras/contrato';
import { colunaComMarco } from '../regras/quadro';
import { avisar, falha, sinalizarMudanca } from '../ui/avisos';

/** O endereço que abre o cartão do contrato. */
export const enderecoDoContrato = (id: string) => '/contratos/?id=' + id;

/** O que o cartão do contrato e o aviso dizem quando os objetos ainda estão "A definir". */
export const SEM_OBJETO_DEFINIDO = 'Os objetos deste contrato ainda estão "A definir", então nenhuma demanda nasceu dele. '
  + 'Edite o contrato e escreva os objetos: cada um vira uma demanda quando o contrato estiver assinado.';

/** O aviso de quando a pessoa chega a "Contrato fechado": o contrato acabou de nascer, ou já existia. */
export const avisoDoContratoFechado = (nome: string, k: ContratoDoClienteFechado) => k.novo
  ? `${nome} tem um contrato em "Aguardando assinatura". Complete os dados dele para a assinatura.`
  : `${nome} já tem o contrato ${k.codigo}, que nasceu quando foi para "Contrato fechado".`;

/**
 * Se a pessoa chegou a "Contrato fechado", cria (ou acha) o contrato dela e avisa. As telas abertas recarregam (o cartão
 * da pessoa mostra o contrato). Devolve o contrato, ou null.
 */
export async function contratoDaPessoaFechada(pessoa: { id: string; nome: string }, etapaId: string | null, colunas: Coluna[],
  abrir: (endereco: string) => void): Promise<ContratoDoClienteFechado | null> {
  if (!colunaComMarco(colunas, etapaId, 'contrato_fechado')) return null;
  try {
    const k = await SD.pessoaFecharContrato(pessoa.id);
    if (!k) return null;
    avisar(avisoDoContratoFechado(pessoa.nome, k), 'ok', { rotulo: 'Abrir o contrato', fn: () => abrir(enderecoDoContrato(k.id)) });
    if (k.novo) sinalizarMudanca({ tipo: 'contratoCriado', id: k.id });
    return k;
  } catch (e) { falha(e); return null; }
}

/** Se o contrato chegou a "Assinado" sem nenhum objeto de verdade, avisa que nenhuma demanda nasceu. */
export function avisarSeAssinadoSemObjeto(objetos: string[], etapaId: string | null, colunas: Coluna[], acao: { rotulo: string; fn: () => void }) {
  if (!colunaComMarco(colunas, etapaId, 'assinado') || objetosDefinidos(objetos).length) return;
  avisar(SEM_OBJETO_DEFINIDO, 'info', acao);
}
