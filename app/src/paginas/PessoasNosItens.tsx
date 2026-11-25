// Pôr uma pessoa do cadastro num item que já existe (#341, etapa 2), dos dois lados: no cartão da pessoa (as seções Demandas,
// Processos, Tarefas e Compromissos dela: ela entra como cliente da demanda ou do processo, ou como pessoa ligada à tarefa ou ao
// compromisso) e no cartão do item (as seções Clientes e Pessoas: entra uma pessoa que já está no cadastro). As duas gravam a lista
// do item, lida logo antes (veja porAPessoa). No título da seção ficam a corrente, que abre a busca daqui (#427), e o "+ Nova pessoa",
// que abre o cadastro já ligado ao item (#376). Quem entra como cliente de um processo entra com o papel dele, perguntado numa janela
// antes de gravar (#426); a pergunta também oferece os papéis escritos pela equipe e o de escrever um agora (#443).
import { nomeDoCompromisso } from '../regras/compromisso';
import { listaDoItemCheia, motivoDaListaCheia, PESSOA_NO_ITEM, type ItemComPessoas } from '../regras/ligarExistente';
import type { PapeisDosClientes, PapeisEscritos } from '../dados';
import { nomeDoProcesso, PAPEIS_DO_CLIENTE } from '../regras/processo';
import { valorSugeridoDoCliente, type PapelEscolhido } from '../regras/papelEscrito';
import { lojaDePapeisEscritos, recarregarPapeisEscritos } from '../ui/papeisEscritos';
import { opcoesDoPapelNaJanela, papelDaEscolha } from './processo/EscolhaDoPapel';
import { AcoesDosLigados, type NovoLigado } from '../ui/ItensLigados';
import { LigarDoModulo, ligarDoModulo, type AchadoDe, type FiltroDe } from '../ui/LigarDoModulo';
import type { LigarNaSecao } from '../ui/Recolhivel';
import { cadastroDePessoaDe, ORIGEM_DA_PESSOA } from '../regras/origemDaPessoa';
import { ligarEAvisar, porAPessoa, tirarAPessoa, tirarEAvisar, type TextosDaLigacao } from './ligarNoCartao';
import { EXPLICACAO_DE_TIRAR_A_PESSOA, PESSOA_TIRADA, podeTirarAPessoa, saiPeloCartaoDaPessoa } from '../regras/tirarDoCartao';
import type { PedidoDeTirar } from '../ui/base';
import { escolherNaJanela } from '../ui/janela';

/** Do achado de cada módulo: a lista de pessoas que ele já tem e o nome dele, para o aviso. */
const DO_ACHADO: { [M in ItemComPessoas]: { pessoas: (x: AchadoDe<M>) => string[]; nome: (x: AchadoDe<M>) => string } } = {
  demandas: { pessoas: d => d.clientes, nome: d => d.titulo },
  processos: { pessoas: p => p.clientes, nome: nomeDoProcesso },
  tarefas: { pessoas: t => t.pessoas, nome: t => t.titulo },
  compromissos: { pessoas: c => c.pessoas, nome: nomeDoCompromisso }
};

interface NoCartaoDaPessoa<M extends ItemComPessoas> {
  modulo: M;
  pessoaId: string;
  /** Depois de ligar: o cartão lê a seção e o contador de novo. */
  depois: () => void;
}

/** A corrente do título da seção, no cartão da pessoa, que abre a busca de LigarAPessoa (#427). */
export const ligarAPessoa = (modulo: ItemComPessoas, pode: boolean): LigarNaSecao | undefined => pode ? ligarDoModulo(modulo) : undefined;

/** A pessoa que entra como cliente de um processo sem escolher o papel (#426) não é posta nele. */
export const SEM_PAPEL_NAO_LIGA = 'Sem o papel do cliente, a pessoa não foi posta no processo.';
/** Os papéis dos clientes que o processo já tem: o papel (#426) e o nome escrito (#443). */
interface PapeisDoItem { papeis?: PapeisDosClientes; escritos?: PapeisEscritos }
/**
 * Pergunta o papel de quem entra como cliente do processo pelo cartão (#426): a lista do "Papel do cliente", com os papéis escritos
 * pela equipe e o de escrever um agora (#443), já com o papel dos outros clientes escolhido (veja valorSugeridoDoCliente). Devolve o
 * papel, ou null se a pessoa desistiu (da escolha ou de escrever).
 */
export async function pedirPapelDoCliente(papeis?: PapeisDosClientes, escritos?: PapeisEscritos): Promise<PapelEscolhido | null> {
  // A lista do escritório já lida (o cartão do processo a lê ao abrir): a pergunta abre na hora. Ainda sem ela, só os papéis fixos.
  const lida = lojaDePapeisEscritos.ler();
  if (lida === null) void recarregarPapeisEscritos();
  const lista = (lida ?? []).map(x => x.nome);
  const escolhido = await escolherNaJanela({ titulo: 'Papel do cliente no processo', rotulo: 'Papel do cliente', acao: 'Ligar',
    opcoes: opcoesDoPapelNaJanela(PAPEIS_DO_CLIENTE, lista), atual: valorSugeridoDoCliente(papeis, escritos) });
  return escolhido ? (await papelDaEscolha(escolhido, lista)) ?? null : null;
}

/** O que se pergunta antes de pôr a pessoa no item, recebendo o papel dos clientes que ele já tem: no processo, o papel dela. null: desistiu. */
type AntesDePor = (doItem: PapeisDoItem) => Promise<{ papel?: PapelEscolhido } | null>;
const nadaAPerguntar: AntesDePor = async () => ({});
const ANTES_DE_POR: Record<ItemComPessoas, AntesDePor> = {
  demandas: nadaAPerguntar, tarefas: nadaAPerguntar, compromissos: nadaAPerguntar,
  processos: async doItem => { const papel = await pedirPapelDoCliente(doItem.papeis, doItem.escritos); return papel ? { papel } : null; }
};
/** Pergunta o que falta (veja ANTES_DE_POR), põe a pessoa e avisa; se a pessoa desistiu da pergunta, nada muda. */
async function perguntarEPor(modulo: ItemComPessoas, itemId: string, pessoaId: string, doItem: PapeisDoItem,
  textos: TextosDaLigacao, depois: () => void) {
  const antes = await ANTES_DE_POR[modulo](doItem);
  if (!antes) return;
  await ligarEAvisar(() => porAPessoa(modulo, itemId, pessoaId, antes.papel?.papel, antes.papel?.escrito), textos, depois);
  // O papel escrito (#443) entrou na lista do escritório.
  if (antes.papel?.escrito) void recarregarPapeisEscritos();
}

/** No cartão da pessoa: a busca "Ligar … existente", com os itens que ainda não a têm (e o motivo, nos que já estão cheios). */
export function LigarAPessoa<M extends ItemComPessoas>({ modulo, pessoaId, depois }: NoCartaoDaPessoa<M>) {
  const t = PESSOA_NO_ITEM[modulo], achado = DO_ACHADO[modulo] as (typeof DO_ACHADO)[M];
  return <AcoesDosLigados>
    <LigarDoModulo modulo={modulo} filtro={{ semAPessoa: pessoaId } as FiltroDe<M>} motivo={x => motivoDaListaCheia(achado.pessoas(x), t.quem)}
      aoEscolher={x => perguntarEPor(modulo, x.id, pessoaId, {}, { feito: t.noCartaoDaPessoa(achado.nome(x)), oQue: 'ligação da pessoa', ja: t.ja }, depois)} />
  </AcoesDosLigados>;
}

interface NoCartaoDoItem {
  modulo: ItemComPessoas;
  itemId: string;
  /** As pessoas que o item já tem: saem da busca, e a lista cheia desliga a corrente. */
  ligadas: { id: string }[];
  depois: () => void;
  /** Um aviso embaixo da busca (ex.: a demanda de um contrato). */
  aviso?: string;
  /** No processo, o papel dos clientes que ele já tem: a pergunta do papel de quem entra já vem com ele (#426). */
  papeis?: PapeisDosClientes;
  /** E o nome escrito do papel deles (#443). */
  escritos?: PapeisEscritos;
}

/**
 * A corrente do título das seções Clientes e Pessoas (#427), que abre a busca de LigarPessoaNoItem: nenhuma quando o cartão só se lê
 * (ou está arquivado, `pode` falso); com a lista do item cheia, desligada, com o motivo.
 */
export function ligarPessoaNoItem(modulo: ItemComPessoas, ligadas: readonly unknown[], pode: boolean): LigarNaSecao | undefined {
  if (!pode) return undefined;
  return { rotulo: PESSOA_NO_ITEM[modulo].rotulo, indisponivel: listaDoItemCheia(modulo, ligadas) || undefined };
}

/** No cartão do item: a busca "Ligar cliente existente" (ou pessoa), com as pessoas do cadastro que ainda não estão nele. */
export function LigarPessoaNoItem({ modulo, itemId, ligadas, depois, aviso, papeis, escritos }: NoCartaoDoItem) {
  const t = PESSOA_NO_ITEM[modulo];
  return <AcoesDosLigados>
    <LigarDoModulo modulo="pessoas" rotulo={t.rotulo} filtro={{ fora: ligadas.map(p => p.id) }} indisponivel={listaDoItemCheia(modulo, ligadas)} aviso={aviso}
      aoEscolher={p => perguntarEPor(modulo, itemId, p.id, { papeis, escritos }, { feito: t.noCartaoDoItem(p.nome), oQue: 'ligação da pessoa', ja: t.ja }, depois)} />
  </AcoesDosLigados>;
}

/**
 * O "+ Nova pessoa" do título da seção Clientes ou Pessoas do cartão (#376), com as mesmas condições da corrente: nenhum quando o
 * cartão só se lê (ou está arquivado, `pode` falso) ou quando a lista do item está cheia.
 */
export function novaPessoaNoItem(modulo: ItemComPessoas, itemId: string, ligadas: readonly unknown[], pode: boolean): NovoLigado | undefined {
  if (!pode || listaDoItemCheia(modulo, ligadas)) return undefined;
  return { para: cadastroDePessoaDe(modulo, itemId), rotulo: ORIGEM_DA_PESSOA[modulo].novoNoTitulo };
}

/**
 * O "x" de cada pessoa das seções Clientes e Pessoas do cartão (#424): tira a pessoa da lista do item, depois da pergunta, com o
 * Desfazer. Nenhum quando a lista ficaria abaixo do mínimo (o processo precisa de um cliente). Quem não pode mudar o cartão não vê
 * o "x" (o cartão diz isso, em CriarNoCartao).
 */
export function tirarPessoaDoItem(modulo: ItemComPessoas, itemId: string, pessoa: { id: string; nome: string }, quantas: number, depois: () => void): PedidoDeTirar | undefined {
  if (!podeTirarAPessoa(modulo, quantas)) return undefined;
  return { oQue: pessoa.nome, explicacao: EXPLICACAO_DE_TIRAR_A_PESSOA,
    aoTirar: () => tirarEAvisar(() => tirarAPessoa(modulo, itemId, pessoa.id), PESSOA_TIRADA[modulo](pessoa.nome), 'retirada da pessoa', depois) };
}

/**
 * No cartão da pessoa (#424): o "x" que a tira de um item em que ela é cliente (ou pessoa ligada). Quem só está no item pela equipe
 * sai pelo topo do cartão do item, e aqui não há "x".
 */
export function tirarAPessoaDoItem(modulo: ItemComPessoas, pessoa: { id: string; nome: string }, item: { id: string; papeis: readonly string[] }, deOnde: string, depois: () => void): PedidoDeTirar | undefined {
  if (!saiPeloCartaoDaPessoa(modulo, item.papeis)) return undefined;
  return { oQue: `${pessoa.nome} ${deOnde}`, explicacao: EXPLICACAO_DE_TIRAR_A_PESSOA,
    aoTirar: () => tirarEAvisar(() => tirarAPessoa(modulo, item.id, pessoa.id), PESSOA_TIRADA[modulo](pessoa.nome), 'retirada da pessoa', depois) };
}
