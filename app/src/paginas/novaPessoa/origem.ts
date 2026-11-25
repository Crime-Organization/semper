// O item de onde o cadastro de pessoa foi aberto (#376): lê o item (o nome, para a faixa e os avisos, e o endereço do cartão, para
// voltar) e sabe ligar a pessoa a ele. Os itens com lista de pessoas usam porAPessoa (a mesma ligação do "Ligar … existente", que lê a
// lista logo antes de gravar e devolve o Desfazer); a anotação, a ligação dela; o vínculo grava o vínculo entre as duas pessoas.
// O item arquivado (ou, no vínculo, a pessoa de origem arquivada) não recebe ninguém: o cadastro segue sem ligar, como o não achado.
// No processo, a pessoa entra como cliente com o papel dela (#426), perguntado numa janela ao ligar.
// O endereço e os textos de cada origem ficam em regras/origemDaPessoa.ts.
import { SD } from '../../dados';
import { nomeDoCompromisso } from '../../regras/compromisso';
import { RecusaDaLigacao, type ItemComPessoas } from '../../regras/ligarExistente';
import { cartaoDeOrigem, VINCULO_COM_ELA_MESMA, type Origem, type OrigemDaPessoa, type SemOrigem } from '../../regras/origemDaPessoa';
import { nomeDoProcesso } from '../../regras/processo';
import { opcaoPelaChave, pontasDoVinculo, rotuloNaOutraPonta } from '../../regras/vinculos';
import { porAPessoa, type Desfazer } from '../ligarNoCartao';
import { pedirPapelDoCliente, SEM_PAPEL_NAO_LIGA } from '../PessoasNosItens';

/** O item de origem já lido. */
export interface ItemDeOrigem {
  /** Como ele aparece na faixa e nos avisos ("DM-0001 (Registro de marca)"; no vínculo, "Filho(a) de MARIA"). */
  nome: string;
  /** O cartão dele, para onde a tela volta ao terminar. */
  endereco: string;
  /** Liga a pessoa a ele: o Desfazer, ou null se ela já estava. */
  ligar: (pessoaId: string) => Promise<Desfazer | null>;
}

/** O item lido, ou por que o cadastro segue sem ligar. */
type Lido = ItemDeOrigem | SemOrigem;
const lido = <T extends { arquivado_em: string | null }>(x: T | null, item: (x: T) => ItemDeOrigem): Lido =>
  !x ? 'sumiu' : x.arquivado_em ? 'arquivada' : item(x);

/** Um item com lista de pessoas, sem papel (o processo, que pede o papel do cliente, tem a sua entrada): lido pelo módulo, ligado por porAPessoa. */
function comPessoas<T extends { arquivado_em: string | null }>(modulo: Exclude<ItemComPessoas, 'processos'>, obter: (id: string) => Promise<T | null>,
  nome: (x: T) => string) {
  return async (o: Origem): Promise<Lido> => lido(await obter(o.id),
    x => ({ nome: nome(x), endereco: cartaoDeOrigem(o), ligar: pessoa => porAPessoa(modulo, o.id, pessoa) }));
}

/** Como ler cada origem. Origem nova = uma entrada nova (e a dela em ORIGEM_DA_PESSOA). */
const LER_A_ORIGEM: Record<OrigemDaPessoa, (o: Origem) => Promise<Lido>> = {
  demandas: comPessoas('demandas', (id: string) => SD.demandaObter(id), d => `${d.codigo} (${d.titulo})`),
  // No processo, a pessoa entra como cliente com o papel dela (#426), perguntado ao ligar; sem ele, não entra.
  processos: async o => lido(await SD.processoObter(o.id), p => ({ nome: nomeDoProcesso(p), endereco: cartaoDeOrigem(o, p.tipo), ligar: async pessoa => {
    const papel = await pedirPapelDoCliente(p.papeis_clientes, p.papeis_escritos);
    if (!papel) throw new RecusaDaLigacao(SEM_PAPEL_NAO_LIGA);
    return porAPessoa('processos', o.id, pessoa, papel.papel, papel.escrito);
  } })),
  tarefas: comPessoas('tarefas', (id: string) => SD.tarefaObter(id), t => t.titulo),
  compromissos: comPessoas('compromissos', (id: string) => SD.compromissoObter(id), nomeDoCompromisso),
  anotacoes: async o => lido(await SD.anotacaoObter(o.id), a => ({ nome: `${a.codigo} (${a.titulo})`, endereco: cartaoDeOrigem(o), ligar: async pessoa => {
    // Outra pessoa ligou antes: a ligação é dela, e não há Desfazer que a apague.
    if (!await SD.anotacaoLigar(o.id, 'pessoas', pessoa)) return null;
    return () => SD.anotacaoDesligar(o.id, 'pessoas', pessoa);
  } })),
  vinculos: async o => {
    const [aberta, tipos] = await Promise.all([SD.pessoaObter(o.id), SD.vinculoTiposListar()]);
    const opcao = opcaoPelaChave(tipos, o.tipoDoVinculo ?? '');
    if (!opcao) return 'sumiu';
    return lido(aberta, a => ({ nome: `${rotuloNaOutraPonta(tipos, opcao)} ${a.nome}`, endereco: cartaoDeOrigem(o), ligar: async nova => {
      if (nova === a.id) throw new Error(VINCULO_COM_ELA_MESMA);
      const { de, para } = pontasDoVinculo(opcao, a.id, nova);
      const id = await SD.vinculoCriar(de, para, opcao.tipoId, o.descricao ?? '');
      return async () => { await SD.vinculoApagar(id); };
    } }));
  }
};

/** Lê o item de origem: o item, ou por que o cadastro segue sem ligar ('sumiu': excluído, ou sem acesso; 'arquivada'). */
export const lerItemDeOrigem = (o: Origem) => LER_A_ORIGEM[o.modulo](o);
