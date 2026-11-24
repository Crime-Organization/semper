// Pôr uma pessoa do cadastro num item que já existe (#341, etapa 2), dos dois lados: no cartão da pessoa (as seções Demandas,
// Processos, Tarefas e Compromissos dela: ela entra como cliente da demanda ou do processo, ou como pessoa ligada à tarefa ou ao
// compromisso) e no cartão do item (as seções Clientes e Pessoas: entra uma pessoa que já está no cadastro). As duas gravam a lista
// do item, lida logo antes (veja porAPessoa). No cartão do item, ao lado, o "+ Nova pessoa", que abre o cadastro já ligado a ele (#376).
// Quem entra como cliente de um processo entra com o papel dele, perguntado numa janela antes de gravar (#426).
import { nomeDoCompromisso } from '../regras/compromisso';
import { listaDoItemCheia, motivoDaListaCheia, PESSOA_NO_ITEM, type ItemComPessoas } from '../regras/ligarExistente';
import type { PapeisDosClientes, PapelDaParte } from '../dados';
import { ehPapelDaParte, nomeDoProcesso, PAPEIS_DA_PARTE, PAPEIS_DO_CLIENTE, papelSugeridoDoCliente } from '../regras/processo';
import { AcoesDosLigados, type NovoLigado } from '../ui/ItensLigados';
import { escolherNaJanela } from '../ui/janela';
import { LigarDoModulo, type AchadoDe, type FiltroDe } from '../ui/LigarDoModulo';
import { cadastroDePessoaDe, ORIGEM_DA_PESSOA } from '../regras/origemDaPessoa';
import { ligarEAvisar, porAPessoa, type TextosDaLigacao } from './ligarNoCartao';

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
  /** O atalho para criar um item novo já com a pessoa, ao lado. */
  novo?: NovoLigado;
}

/** A pessoa que entra como cliente de um processo sem escolher o papel (#426) não é posta nele. */
export const SEM_PAPEL_NAO_LIGA = 'Sem o papel do cliente, a pessoa não foi posta no processo.';
/**
 * Pergunta o papel de quem entra como cliente do processo pelo cartão (#426): a lista do "Papel do cliente", já com o papel dos
 * outros clientes escolhido (veja papelSugeridoDoCliente). Devolve o papel, ou null se a pessoa desistiu.
 */
export async function pedirPapelDoCliente(papeis?: PapeisDosClientes): Promise<PapelDaParte | null> {
  const escolhido = await escolherNaJanela({ titulo: 'Papel do cliente no processo', rotulo: 'Papel do cliente', acao: 'Ligar',
    opcoes: PAPEIS_DO_CLIENTE.map(x => ({ valor: x, nome: PAPEIS_DA_PARTE[x] })), atual: papelSugeridoDoCliente(papeis) });
  return ehPapelDaParte(escolhido) ? escolhido : null;
}

/** O que se pergunta antes de pôr a pessoa no item, recebendo o papel dos clientes que ele já tem: no processo, o papel dela. null: desistiu. */
type AntesDePor = (papeis?: PapeisDosClientes) => Promise<{ papel?: PapelDaParte } | null>;
const nadaAPerguntar: AntesDePor = async () => ({});
const ANTES_DE_POR: Record<ItemComPessoas, AntesDePor> = {
  demandas: nadaAPerguntar, tarefas: nadaAPerguntar, compromissos: nadaAPerguntar,
  processos: async papeis => { const papel = await pedirPapelDoCliente(papeis); return papel ? { papel } : null; }
};
/** Pergunta o que falta (veja ANTES_DE_POR), põe a pessoa e avisa; se a pessoa desistiu da pergunta, nada muda. */
async function perguntarEPor(modulo: ItemComPessoas, itemId: string, pessoaId: string, papeis: PapeisDosClientes | undefined,
  textos: TextosDaLigacao, depois: () => void) {
  const antes = await ANTES_DE_POR[modulo](papeis);
  if (antes) await ligarEAvisar(() => porAPessoa(modulo, itemId, pessoaId, antes.papel), textos, depois);
}

/** No cartão da pessoa: "Ligar … existente", com os itens que ainda não a têm (e o motivo, nos que já estão cheios). */
export function LigarAPessoa<M extends ItemComPessoas>({ modulo, pessoaId, depois, novo }: NoCartaoDaPessoa<M>) {
  const t = PESSOA_NO_ITEM[modulo], achado = DO_ACHADO[modulo] as (typeof DO_ACHADO)[M];
  return <AcoesDosLigados novo={novo}>
    <LigarDoModulo modulo={modulo} filtro={{ semAPessoa: pessoaId } as FiltroDe<M>} motivo={x => motivoDaListaCheia(achado.pessoas(x), t.quem)}
      aoEscolher={x => perguntarEPor(modulo, x.id, pessoaId, undefined, { feito: t.noCartaoDaPessoa(achado.nome(x)), oQue: 'ligação da pessoa', ja: t.ja }, depois)} />
  </AcoesDosLigados>;
}

interface NoCartaoDoItem {
  modulo: ItemComPessoas;
  itemId: string;
  /** As pessoas que o item já tem: saem da busca, e a lista cheia desabilita o botão. */
  ligadas: { id: string }[];
  depois: () => void;
  /** Um aviso embaixo da busca (ex.: a demanda de um contrato). */
  aviso?: string;
  /** O atalho para cadastrar uma pessoa nova já no item, ao lado (veja novaPessoaNoItem). */
  novo?: NovoLigado;
  /** No processo, o papel dos clientes que ele já tem: a pergunta do papel de quem entra já vem com ele (#426). */
  papeis?: PapeisDosClientes;
}

/** No cartão do item: "Ligar cliente existente" (ou pessoa), com as pessoas do cadastro que ainda não estão nele, e o "+ Nova pessoa". */
export function LigarPessoaNoItem({ modulo, itemId, ligadas, depois, aviso, novo, papeis }: NoCartaoDoItem) {
  const t = PESSOA_NO_ITEM[modulo];
  return <AcoesDosLigados novo={novo}>
    <LigarDoModulo modulo="pessoas" rotulo={t.rotulo} filtro={{ fora: ligadas.map(p => p.id) }} indisponivel={listaDoItemCheia(modulo, ligadas)} aviso={aviso}
      aoEscolher={p => perguntarEPor(modulo, itemId, p.id, papeis, { feito: t.noCartaoDoItem(p.nome), oQue: 'ligação da pessoa', ja: t.ja }, depois)} />
  </AcoesDosLigados>;
}

/**
 * Os dois atalhos do "+ Nova pessoa" da seção Clientes ou Pessoas do cartão (#376): o "+" do título (`titulo`, para o novo= do
 * Recolhivel) e o botão embaixo da lista (`embaixo`, para o de LigarPessoaNoItem). Com as mesmas condições do "Ligar … existente":
 * nenhum quando o cartão só se lê (ou está arquivado, `pode` falso) ou quando a lista do item está cheia.
 */
export function novaPessoaNoItem(modulo: ItemComPessoas, itemId: string, ligadas: readonly unknown[], pode: boolean): { titulo?: NovoLigado; embaixo?: NovoLigado } {
  if (!pode || listaDoItemCheia(modulo, ligadas)) return {};
  const o = ORIGEM_DA_PESSOA[modulo], para = cadastroDePessoaDe(modulo, itemId);
  return { titulo: { para, rotulo: o.novoNoTitulo }, embaixo: { para, rotulo: o.novo } };
}
