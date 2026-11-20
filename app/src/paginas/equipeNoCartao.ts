// A equipe mudada no topo do cartão (#356): as gravações. Cada uma lê a equipe gravada no item logo antes de gravar, para não
// apagar o que outra pessoa acabou de pôr, e usa a mesma função de dados do lápis de cada módulo (o histórico do cartão registra
// a mudança como registra a do lápis). As regras de cada passo estão em regras/equipeNoCartao.ts.
import { SD, type GrupoDaEquipe, type ModuloDoPedido } from '../dados';
import { AVISO_DOS_GRUPOS, desfazerNosGrupos, MUDANCAS_NOS_GRUPOS, type TipoDeMudancaNosGrupos } from '../regras/gruposDaEquipe';
import {
  AVISO_DA_MUDANCA, desfazerMudanca, EQUIPE_DO_MODULO, planoDaMudanca, saidaPelaBolinhaFalhou, type EquipeAGravar, type EquipeGravada, type ModuloDaEquipe, type PedidoNaEquipe,
  type SaidaDaPessoa
} from '../regras/equipeNoCartao';
import { avisar, feito, type Mudanca } from '../ui/avisos';
import { sairDoCartao } from '../ui/sairDoCartao';
import { ITEM_SUMIU } from './ligarNoCartao';

interface EquipeDoItem {
  /** A equipe gravada agora (null: o item não foi encontrado). */
  ler: (id: string) => Promise<EquipeGravada | null>;
  gravar: (id: string, e: EquipeAGravar) => Promise<unknown>;
  /** O sinal de "dados mudaram" depois de desfazer, como o do lápis. */
  mudanca: string;
}
/** O responsável vai junto só na troca: pôr e tirar gravam só a lista. */
const comResponsavel = (e: EquipeAGravar) => e.responsavel_id ? { responsavel_id: e.responsavel_id } : {};
const equipe = (x: { responsavel_id: string } | null, lista: string[] | undefined): EquipeGravada | null =>
  x && { responsavel_id: x.responsavel_id, lista: lista ?? [] };

/** Onde fica a equipe de cada item: os participantes da tarefa, do compromisso e da anotação; os colaboradores da demanda e do processo. */
const EQUIPE_DO_ITEM: Record<ModuloDaEquipe, EquipeDoItem> = {
  tarefas: { ler: async id => { const t = await SD.tarefaObter(id); return equipe(t, t?.participantes); },
    gravar: (id, e) => SD.tarefaAtualizar(id, { ...comResponsavel(e), participantes: e.lista }), mudanca: 'tarefaAtualizada' },
  demandas: { ler: async id => { const d = await SD.demandaObter(id); return equipe(d, d?.colaboradores); },
    gravar: (id, e) => SD.demandaAtualizar(id, { ...comResponsavel(e), colaboradores: e.lista }), mudanca: 'demandaAtualizada' },
  processos: { ler: async id => { const p = await SD.processoObter(id); return equipe(p, p?.colaboradores); },
    gravar: (id, e) => SD.processoAtualizar(id, { ...comResponsavel(e), colaboradores: e.lista }), mudanca: 'processoAtualizado' },
  compromissos: { ler: async id => { const c = await SD.compromissoObter(id); return equipe(c, c?.participantes); },
    gravar: (id, e) => SD.compromissoAtualizar(id, { ...comResponsavel(e), participantes: e.lista }), mudanca: 'compromissoAtualizado' },
  anotacoes: { ler: async id => { const a = await SD.anotacaoObter(id); return equipe(a, a?.participantes); },
    gravar: (id, e) => SD.anotacaoAtualizar(id, { ...comResponsavel(e), participantes: e.lista }), mudanca: 'anotacaoAtualizada' }
};

/** Como terminou: gravou (com Desfazer), nada mudou (já estava assim; o aviso já saiu) ou a pessoa saiu do cartão. */
export type FimDaMudanca = 'gravou' | 'nada' | 'saiu';

/**
 * Faz a mudança pedida na equipe do item e avisa: a gravada, com Desfazer (como o lápis); a que não muda nada, sem. Quem se
 * tira do cartão sem poder gravar fora dele sai por último (sairDoCartao), sem Desfazer, como no lápis.
 */
export async function mudarAEquipe(modulo: ModuloDaEquipe, itemId: string, pedido: PedidoNaEquipe, saida: SaidaDaPessoa): Promise<FimDaMudanca> {
  const l = EQUIPE_DO_ITEM[modulo], m = EQUIPE_DO_MODULO[modulo];
  const antes = await l.ler(itemId);
  if (!antes) throw new Error(ITEM_SUMIU);
  const plano = planoDaMudanca(modulo, pedido, antes, saida);
  if ('aviso' in plano) {
    avisar(plano.aviso, plano.tipo);
    return 'nada';
  }
  await l.gravar(itemId, plano.gravar);
  if (plano.sai) {
    // A falha da saída vem com o texto do lápis ("Salve de novo"), e aqui não há Salvar: o aviso diz como sair pela bolinha.
    await sairDoCartao(modulo, itemId, `Você saiu ${m.doItem}, e a saída ficou no histórico.`).catch(() => { throw new Error(saidaPelaBolinhaFalhou(modulo)); });
    return 'saiu';
  }
  feito(AVISO_DA_MUDANCA[pedido.tipo](modulo, pedido.nome), m.oQue, () => desfazerNoItem(modulo, itemId, pedido, antes));
  return 'gravou';
}

/**
 * Desfaz no item gravado a mudança pedida na equipe, sobre a equipe como ela está agora (lida logo antes, desfazerMudanca). Serve
 * também à anotação nova que foi ao banco depois da mudança, feita ainda na tela (#369).
 */
export async function desfazerNoItem(modulo: ModuloDaEquipe, itemId: string, pedido: PedidoNaEquipe, antes: EquipeGravada): Promise<Mudanca> {
  const l = EQUIPE_DO_ITEM[modulo];
  const agora = await l.ler(itemId);
  if (!agora) throw new Error(ITEM_SUMIU);
  const volta = desfazerMudanca(modulo, pedido, antes, agora);
  if (volta && 'aviso' in volta) throw new Error(volta.aviso);
  if (volta) await l.gravar(itemId, volta);
  return { tipo: l.mudanca, id: itemId };
}

// ---------- os grupos da equipe nas bolinhas (#378) ----------
/** Os grupos gravados agora em cada item (null: o item não foi encontrado, ou a pessoa não o vê mais). */
const GRUPOS_GRAVADOS: Record<ModuloDoPedido, (id: string) => Promise<string[] | null>> = {
  tarefas: async id => { const x = await SD.tarefaObter(id); return x && (x.grupos ?? []); },
  demandas: async id => { const x = await SD.demandaObter(id); return x && (x.grupos ?? []); },
  processos: async id => { const x = await SD.processoObter(id); return x && (x.grupos ?? []); },
  compromissos: async id => { const x = await SD.compromissoObter(id); return x && (x.grupos ?? []); },
  anotacoes: async id => { const x = await SD.anotacaoObter(id); return x && (x.grupos ?? []); },
  contratos: async id => { const x = await SD.contratoObter(id); return x && (x.grupos ?? []); }
};
/** As palavras de cada item nos avisos dos grupos e o sinal de "dados mudaram" do Desfazer. */
const ITEM_DOS_GRUPOS: Record<ModuloDoPedido, { noItem: string; doItem: string; mudanca: string }> = {
  tarefas: { noItem: 'na tarefa', doItem: 'da tarefa', mudanca: 'tarefaAtualizada' },
  demandas: { noItem: 'na demanda', doItem: 'da demanda', mudanca: 'demandaAtualizada' },
  processos: { noItem: 'no processo', doItem: 'do processo', mudanca: 'processoAtualizado' },
  compromissos: { noItem: 'no compromisso', doItem: 'do compromisso', mudanca: 'compromissoAtualizado' },
  anotacoes: { noItem: 'na anotação', doItem: 'da anotação', mudanca: 'anotacaoAtualizada' },
  contratos: { noItem: 'no contrato', doItem: 'do contrato', mudanca: 'contratoAtualizado' }
};
/** As palavras de um item, para quem pergunta antes de tirar o grupo. */
export const palavrasDosGrupos = (modulo: ModuloDoPedido) => ITEM_DOS_GRUPOS[modulo];

/**
 * Põe ou tira um grupo da equipe do item, sobre os grupos gravados logo antes (para não apagar o que outra pessoa acabou de pôr), e
 * avisa, com o Desfazer. (O grupo que é o único caminho de quem muda até o item a tela nem oferece tirar.)
 */
export async function mudarOsGrupos(modulo: ModuloDoPedido, itemId: string, tipo: TipoDeMudancaNosGrupos, grupo: Pick<GrupoDaEquipe, 'id' | 'nome'>): Promise<FimDaMudanca> {
  const palavras = ITEM_DOS_GRUPOS[modulo];
  const antes = await GRUPOS_GRAVADOS[modulo](itemId);
  if (!antes) throw new Error(ITEM_SUMIU);
  const plano = MUDANCAS_NOS_GRUPOS[tipo](antes, grupo, palavras.noItem);
  if ('aviso' in plano) {
    avisar(plano.aviso, plano.tipo);
    return 'nada';
  }
  await SD.itemDefinirGrupos(modulo, itemId, plano.gravar);
  feito(AVISO_DOS_GRUPOS[tipo](grupo.nome, palavras.noItem, palavras.doItem), `mudança nos grupos ${palavras.doItem}`, async () => {
    const agora = await GRUPOS_GRAVADOS[modulo](itemId);
    if (!agora) throw new Error(ITEM_SUMIU);
    const volta = desfazerNosGrupos(tipo, agora, grupo.id);
    if (volta && 'aviso' in volta) throw new Error(volta.aviso);
    if (volta) await SD.itemDefinirGrupos(modulo, itemId, volta);
    return { tipo: palavras.mudanca, id: itemId };
  });
  return 'gravou';
}
