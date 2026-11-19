// Pôr uma pessoa do cadastro num item que já existe (#341, etapa 2), dos dois lados: no cartão da pessoa (as seções Demandas,
// Processos, Tarefas e Compromissos dela: ela entra como cliente da demanda ou do processo, ou como pessoa ligada à tarefa ou ao
// compromisso) e no cartão do item (as seções Clientes e Pessoas: entra uma pessoa que já está no cadastro). As duas gravam a lista
// do item, lida logo antes (veja porAPessoa). No cartão do item, ao lado, o "+ Nova pessoa", que abre o cadastro já ligado a ele (#376).
import { nomeDoCompromisso } from '../regras/compromisso';
import { listaDoItemCheia, motivoDaListaCheia, PESSOA_NO_ITEM, type ItemComPessoas } from '../regras/ligarExistente';
import { nomeDoProcesso } from '../regras/processo';
import { AcoesDosLigados, type NovoLigado } from '../ui/ItensLigados';
import { LigarDoModulo, type AchadoDe, type FiltroDe } from '../ui/LigarDoModulo';
import { cadastroDePessoaDe, ORIGEM_DA_PESSOA } from '../regras/origemDaPessoa';
import { ligarEAvisar, porAPessoa } from './ligarNoCartao';

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

/** No cartão da pessoa: "Ligar … existente", com os itens que ainda não a têm (e o motivo, nos que já estão cheios). */
export function LigarAPessoa<M extends ItemComPessoas>({ modulo, pessoaId, depois, novo }: NoCartaoDaPessoa<M>) {
  const t = PESSOA_NO_ITEM[modulo], achado = DO_ACHADO[modulo] as (typeof DO_ACHADO)[M];
  return <AcoesDosLigados novo={novo}>
    <LigarDoModulo modulo={modulo} filtro={{ semAPessoa: pessoaId } as FiltroDe<M>} motivo={x => motivoDaListaCheia(achado.pessoas(x), t.quem)}
      aoEscolher={x => ligarEAvisar(() => porAPessoa(modulo, x.id, pessoaId), { feito: t.noCartaoDaPessoa(achado.nome(x)), oQue: 'ligação da pessoa', ja: t.ja }, depois)} />
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
}

/** No cartão do item: "Ligar cliente existente" (ou pessoa), com as pessoas do cadastro que ainda não estão nele, e o "+ Nova pessoa". */
export function LigarPessoaNoItem({ modulo, itemId, ligadas, depois, aviso, novo }: NoCartaoDoItem) {
  const t = PESSOA_NO_ITEM[modulo];
  return <AcoesDosLigados novo={novo}>
    <LigarDoModulo modulo="pessoas" rotulo={t.rotulo} filtro={{ fora: ligadas.map(p => p.id) }} indisponivel={listaDoItemCheia(modulo, ligadas)} aviso={aviso}
      aoEscolher={p => ligarEAvisar(() => porAPessoa(modulo, itemId, p.id), { feito: t.noCartaoDoItem(p.nome), oQue: 'ligação da pessoa', ja: t.ja }, depois)} />
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
