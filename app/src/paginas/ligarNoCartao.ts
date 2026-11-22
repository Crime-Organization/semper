// Ligar, no cartão de um item, outro que já existe (#341, etapa 2): as gravações. Cada uma lê a lista (ou a ligação) gravada no
// item logo antes de gravar, para não apagar o que outra pessoa acabou de pôr, e devolve o Desfazer; null quando já estava ligado
// e nada foi gravado (a tela então avisa sem Desfazer, que apagaria a ligação feita por outra pessoa). O Desfazer também lê antes
// e tira só o que esta ligação pôs. As regras de cada passo estão em regras/ligarExistente.ts. O que as regras recusam vem como
// RecusaDaLigacao: tentar de novo pelo cartão daria a mesma recusa (#376).
import { SD, type ModuloDoCompromisso, type Tarefa } from '../dados';
import {
  acrescentar, desfazerTarefaEmMaisUmaDemanda, ligacaoDeUm, LISTA_CHEIA, motivoDasTarefasDaDemanda, RecusaDaLigacao, semOId,
  TAREFA_DE_OUTRO_PROCESSO, tarefaEmMaisUmaDemanda, tarefaNoPrazo, voltarOQueAindaE, type ItemComPessoas, type TarefaParaADemanda, type TarefaParaOPrazo
} from '../regras/ligarExistente';
import { CONTRATOS_DA_TAREFA_CHEIA, contratosDaTarefa, DEMANDAS_DA_TAREFA_CHEIA, demandasDaTarefa } from '../regras/tarefa';
import { CONTRATOS_POR_TAREFA, DEMANDAS_POR_TAREFA } from '../dados/limites';
import { avisar, falha, feito } from '../ui/avisos';

/** Volta o que a ligação gravou. */
export type Desfazer = () => Promise<void>;

/** O item sumiu entre a busca e o clique (foi excluído, ou a pessoa deixou de vê-lo). */
export const ITEM_SUMIU = 'Este item não foi encontrado. Ele pode ter sido excluído, ou você não tem mais acesso a ele.';
const ids = (lista: { id: string }[] | undefined) => lista?.map(x => x.id);

// ---------- uma pessoa do cadastro na lista do item ----------
interface ListaDoItem { ler: (id: string) => Promise<string[] | undefined>; gravar: (id: string, lista: string[]) => Promise<unknown> }
/** Onde fica a lista de pessoas de cada item (os clientes da demanda e do processo, as pessoas da tarefa e do compromisso). O banco troca a lista inteira. */
const PESSOAS_DO_ITEM: Record<ItemComPessoas, ListaDoItem> = {
  demandas: { ler: async id => ids((await SD.demandaObter(id))?.clientes), gravar: (id, clientes) => SD.demandaAtualizar(id, { clientes }) },
  processos: { ler: async id => ids((await SD.processoObter(id))?.clientes), gravar: (id, clientes) => SD.processoAtualizar(id, { clientes }) },
  tarefas: { ler: async id => ids((await SD.tarefaObter(id))?.pessoas), gravar: (id, pessoas) => SD.tarefaAtualizar(id, { pessoas }) },
  compromissos: { ler: async id => ids((await SD.compromissoObter(id))?.pessoas), gravar: (id, pessoas) => SD.compromissoAtualizar(id, { pessoas }) }
};
/** Põe a pessoa no fim da lista do item. */
export async function porAPessoa(modulo: ItemComPessoas, itemId: string, pessoaId: string): Promise<Desfazer | null> {
  const l = PESSOAS_DO_ITEM[modulo];
  const atual = await l.ler(itemId);
  if (!atual) throw new RecusaDaLigacao(ITEM_SUMIU);
  const r = acrescentar(atual, pessoaId);
  if ('recusa' in r) {
    if (r.recusa === 'ja') return null;
    throw new RecusaDaLigacao(LISTA_CHEIA);
  }
  await l.gravar(itemId, r.lista);
  return async () => {
    const agora = await l.ler(itemId);
    if (agora?.includes(pessoaId)) await l.gravar(itemId, semOId(agora, pessoaId));
  };
}

// ---------- as ligações de um só ----------
/**
 * As ligações de um só que os cartões fazem. A tarefa com as demandas e os contratos, que são listas desde a #283, tem as suas:
 * ligarTarefaNaDemanda e ligarContratoNaTarefa.
 */
export type LigacaoNoItem = 'contrato da demanda' | 'processo da tarefa' | 'processo do compromisso';
interface UmNoItem {
  /** A ligação de agora: null, sem nenhuma; undefined, o item não foi encontrado. */
  ler: (id: string) => Promise<string | null | undefined>;
  gravar: (id: string, valor: string | null) => Promise<unknown>;
  /** A recusa quando o item já tem outro (trocar o tiraria de lá). */
  outro: string;
  /** Outra recusa, lida logo antes de gravar ('' = pode): a da demanda cujas tarefas são de outro contrato. */
  conferir?: (id: string, valor: string) => Promise<string>;
}
const LIGACOES_NO_ITEM: Record<LigacaoNoItem, UmNoItem> = {
  'contrato da demanda': { ler: async id => (await SD.demandaObter(id))?.contrato_id, gravar: (id, contrato_id) => SD.demandaAtualizar(id, { contrato_id }),
    outro: 'Esta demanda já está ligada a outro contrato.',
    conferir: async (id, contrato) => motivoDasTarefasDaDemanda((await SD.tarefasDaDemanda(id)).map(t => t.contrato_id), contrato) },
  'processo da tarefa': { ler: async id => (await SD.tarefaObter(id))?.processo_id, gravar: (id, processo_id) => SD.tarefaAtualizar(id, { processo_id }),
    outro: TAREFA_DE_OUTRO_PROCESSO },
  'processo do compromisso': { ler: async id => (await SD.compromissoObter(id))?.processo_id, gravar: (id, processo_id) => SD.compromissoAtualizar(id, { processo_id }),
    outro: 'Este compromisso já está ligado a outro processo.' }
};
/** Liga o item a `valor`, se ele ainda não tem nenhum. */
export async function ligarNoItem(qual: LigacaoNoItem, itemId: string, valor: string): Promise<Desfazer | null> {
  const l = LIGACOES_NO_ITEM[qual];
  const atual = await l.ler(itemId);
  if (atual === undefined) throw new RecusaDaLigacao(ITEM_SUMIU);
  const r = ligacaoDeUm(atual, valor);
  if (r === 'ja') return null;
  if (r === 'outro') throw new RecusaDaLigacao(l.outro);
  const motivo = await l.conferir?.(itemId, valor);
  if (motivo) throw new RecusaDaLigacao(motivo);
  await l.gravar(itemId, valor);
  return async () => { if (await l.ler(itemId) === valor) await l.gravar(itemId, null); };
}

// ---------- a tarefa, as demandas e os contratos (#283: listas) ----------
const tarefaParaADemanda = (t: Tarefa): TarefaParaADemanda => ({ demanda_ids: demandasDaTarefa(t), pessoas: ids(t.pessoas)!, contrato_ids: contratosDaTarefa(t) });
/**
 * Liga a tarefa a mais uma demanda, levando os clientes (se a tarefa não tem pessoas) e o contrato da demanda, como o cadastro de
 * tarefa (veja tarefaEmMaisUmaDemanda). As outras demandas da tarefa ficam.
 */
export async function ligarTarefaNaDemanda(tarefaId: string, demandaId: string): Promise<Desfazer | null> {
  const [t, d] = await Promise.all([SD.tarefaObter(tarefaId), SD.demandaObter(demandaId)]);
  if (!t || !d) throw new RecusaDaLigacao(ITEM_SUMIU);
  const r = tarefaEmMaisUmaDemanda(tarefaParaADemanda(t), { id: d.id, clientes: ids(d.clientes)!, contrato_id: d.contrato_id },
    { demandas: DEMANDAS_POR_TAREFA, contratos: CONTRATOS_POR_TAREFA });
  if ('recusa' in r) {
    if (r.recusa === 'ja') return null;
    throw new RecusaDaLigacao(DEMANDAS_DA_TAREFA_CHEIA);
  }
  await SD.tarefaAtualizar(tarefaId, r.dados);
  return async () => {
    const agora = await SD.tarefaObter(tarefaId);
    const volta = agora && desfazerTarefaEmMaisUmaDemanda(tarefaParaADemanda(agora), r);
    if (volta) await SD.tarefaAtualizar(tarefaId, volta);
  };
}
/** Liga a tarefa a mais um contrato (no fim da lista); os outros contratos dela ficam. */
export async function ligarContratoNaTarefa(tarefaId: string, contratoId: string): Promise<Desfazer | null> {
  const t = await SD.tarefaObter(tarefaId);
  if (!t) throw new RecusaDaLigacao(ITEM_SUMIU);
  const r = acrescentar(contratosDaTarefa(t), contratoId, CONTRATOS_POR_TAREFA);
  if ('recusa' in r) {
    if (r.recusa === 'ja') return null;
    throw new RecusaDaLigacao(CONTRATOS_DA_TAREFA_CHEIA);
  }
  await SD.tarefaAtualizar(tarefaId, { contrato_ids: r.lista });
  return async () => {
    const agora = await SD.tarefaObter(tarefaId);
    const lista = agora ? contratosDaTarefa(agora) : [];
    if (lista.includes(contratoId)) await SD.tarefaAtualizar(tarefaId, { contrato_ids: semOId(lista, contratoId) });
  };
}

// ---------- o prazo do processo e a tarefa que o cumpre ----------
const lerPrazo = async (processoId: string, prazoId: string) => (await SD.processoPrazos(processoId)).find(x => x.id === prazoId);
const tarefaParaOPrazo = ({ processo_id, prazo }: Tarefa): TarefaParaOPrazo => ({ processo_id, prazo });
/** Liga ao prazo uma tarefa que já existe (veja tarefaNoPrazo): a tarefa sem processo passa a ser deste, com o último dia do prazo. */
export async function ligarTarefaNoPrazo(processoId: string, prazoId: string, tarefaId: string): Promise<Desfazer | null> {
  const [z, t] = await Promise.all([lerPrazo(processoId, prazoId), SD.tarefaObter(tarefaId)]);
  if (!z || !t) throw new RecusaDaLigacao(ITEM_SUMIU);
  const r = ligacaoDeUm(z.tarefa_id, tarefaId);
  if (r === 'ja') return null;
  if (r === 'outro') throw new RecusaDaLigacao('Este prazo já tem outra tarefa.');
  const naTarefa = tarefaNoPrazo(tarefaParaOPrazo(t), processoId, z.final);
  if ('recusa' in naTarefa) throw new RecusaDaLigacao(naTarefa.recusa);
  const antes = tarefaParaOPrazo(t);
  await SD.processoPrazoAtualizar(prazoId, { tarefa_id: tarefaId });
  if (Object.keys(naTarefa.dados).length) await SD.tarefaAtualizar(tarefaId, naTarefa.dados);
  return async () => {
    const [prazo, agora] = await Promise.all([lerPrazo(processoId, prazoId), SD.tarefaObter(tarefaId)]);
    // Outra pessoa já trocou a tarefa deste prazo: fica como ela deixou.
    if (prazo?.tarefa_id !== tarefaId) return;
    await SD.processoPrazoAtualizar(prazoId, { tarefa_id: null });
    const volta = agora ? voltarOQueAindaE(tarefaParaOPrazo(agora), naTarefa.dados, antes) : {};
    if (Object.keys(volta).length) await SD.tarefaAtualizar(tarefaId, volta);
  };
}

// ---------- as ligações de muitos para muitos ----------
/** Liga a demanda ao processo (papel "atua", como no cartão da demanda). */
export async function ligarDemandaNoProcesso(processoId: string, demandaId: string): Promise<Desfazer | null> {
  if ((await SD.demandasDoProcesso(processoId)).some(d => d.id === demandaId)) return null;
  // Outra pessoa ligou entre a leitura e a gravação: a ligação é dela, e não há Desfazer que a apague.
  if (!await SD.processoDemandaLigar(processoId, demandaId, 'atua')) return null;
  return () => SD.processoDemandaDesligar(processoId, demandaId);
}
/** Relaciona uma demanda à outra (#310), nos dois sentidos. A que já estava relacionada (talvez por outra pessoa agora há pouco) não ganha Desfazer. */
export async function relacionarDemandas(demandaId: string, outraId: string): Promise<Desfazer | null> {
  if (!await SD.demandaRelacionar(demandaId, outraId)) return null;
  return () => SD.demandaDesrelacionar(demandaId, outraId);
}
/** Liga o contrato ao processo (a mesma ligação do cartão do contrato). */
export async function ligarContratoNoProcesso(processoId: string, contratoId: string): Promise<Desfazer | null> {
  if ((await SD.contratosDoProcesso(processoId)).visiveis.some(k => k.id === contratoId)) return null;
  if (!await SD.contratoProcessoLigar(contratoId, processoId)) return null;
  return () => SD.contratoProcessoDesligar(contratoId, processoId);
}

/** Liga o compromisso à tarefa, à demanda ou ao contrato (#306), a mesma ligação do cartão do compromisso. */
export async function ligarCompromissoNoItem(modulo: ModuloDoCompromisso, itemId: string, compromissoId: string): Promise<Desfazer | null> {
  // Outra pessoa ligou entre a busca e o clique: a ligação é dela, e não há Desfazer que a apague.
  if (!await SD.compromissoLigar(compromissoId, modulo, itemId)) return null;
  return () => SD.compromissoDesligar(compromissoId, modulo, itemId);
}

// ---------- o aviso ----------
/** Os textos do aviso de uma ligação: o que foi feito, o nome da ação (para o Desfazer) e o aviso de quando já estava ligado. */
export interface TextosDaLigacao { feito: string; oQue: string; ja: string }
/** Liga e avisa: a ligação nova, com Desfazer; a que já estava, sem. Depois, `depois` relê o cartão (mesmo se nada mudou: alguém mudou antes). */
export async function ligarEAvisar(ligar: () => Promise<Desfazer | null>, t: TextosDaLigacao, depois: () => unknown) {
  try {
    const desfazer = await ligar();
    if (desfazer) feito(t.feito, t.oQue, desfazer);
    else avisar(t.ja, 'info');
    depois();
  } catch (e) { falha(e); }
}
