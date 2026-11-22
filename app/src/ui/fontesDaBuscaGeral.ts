// A busca geral (#321) fora da tela: se a janela está aberta (estado do sistema todo, como as janelas e os avisos) e onde
// ela busca. Cada grupo usa a listagem do próprio módulo, a mesma da busca da página dele: o banco aplica as regras de quem vê
// o quê (RLS e a fase de adaptação), então a janela nunca mostra o que a pessoa não vê na página do módulo.
// O que mostrar de cada linha, a ordem e os filtros ficam em regras/buscaGeral.ts.
import { SD, type Pagina } from '../dados';
import { BUSCA_GERAL_CANDIDATOS } from '../dados/limites';
import {
  achadoDoGrupo, lerTermo, MODULO_DO_GRUPO_DO_PEDIDO, podeSerOCodigo, semAcessoDoPedido, type BuscaDoGrupo, type GrupoDaBusca, type ItemSemAcesso, type LinhaDoGrupo
} from '../regras/buscaGeral';
import { estadoDoItemSemAcesso, type EstadoDoItemSemAcesso } from '../regras/pedidoDeParticipacao';
import { criarLoja } from './loja';
import { fecharMenusAbertos } from './Menu';

/** A janela da busca geral está aberta. */
export const buscaGeralAberta = criarLoja(false);
/** Abre a busca. Um menu aberto (os filtros, o "⋯") fecha antes: escondido atrás da janela, ele roubaria o Esc dela. */
export const abrirBuscaGeral = () => { fecharMenusAbertos(); buscaGeralAberta.mudar(true); };
export const fecharBuscaGeral = () => buscaGeralAberta.mudar(false);

/**
 * Cada listagem traz os candidatos, dos mais novos aos mais antigos (é o que deixa o filtro de data exato): mais do que a
 * janela mostra, para o exato e os que começam com o termo subirem (regras/buscaGeral.ts, montarGrupos).
 */
const DA_JANELA = { porPagina: BUSCA_GERAL_CANDIDATOS, ordem: 'novos' } as const;
/** A listagem de cada grupo, a mesma da página do módulo (só os itens ativos). */
const LISTAGEM: { [G in GrupoDaBusca]: (termo: string) => Promise<Pagina<LinhaDoGrupo[G]>> } = {
  pessoas: termo => SD.pessoasListar({ termo, ...DA_JANELA }),
  judiciais: termo => SD.processosListar({ tipo: 'judicial', termo, ...DA_JANELA }),
  administrativos: termo => SD.processosListar({ tipo: 'administrativo', termo, ...DA_JANELA }),
  extrajudiciais: termo => SD.processosListar({ tipo: 'extrajudicial', termo, ...DA_JANELA }),
  investigacoes: termo => SD.processosListar({ tipo: 'investigacao', termo, ...DA_JANELA }),
  contratos: termo => SD.contratosListar({ termo, ...DA_JANELA }),
  demandas: termo => SD.demandasListar({ termo, ...DA_JANELA }),
  tarefas: termo => SD.tarefasListar({ termo, ...DA_JANELA }),
  compromissos: termo => SD.compromissosListar({ termo, ...DA_JANELA }),
  anotacoes: termo => SD.anotacoesListar({ termo, ...DA_JANELA })
};

async function buscarNoGrupo<G extends GrupoDaBusca>(grupo: G, termo: string): Promise<BuscaDoGrupo> {
  const { linhas, total } = await LISTAGEM[grupo](termo);
  return { grupo, total, itens: linhas.map(x => achadoDoGrupo(grupo, x)) };
}

/**
 * Os itens que existem, mas de que a pessoa não faz parte (#363), achados pelo código exato ou pelo número inteiro do processo:
 * o banco devolve só o tipo e o código, do escritório dela, e só o que ela ainda não vê. Nomes e palavras não vão ao banco.
 */
async function buscarSemAcesso(termo: string, grupos: readonly GrupoDaBusca[]): Promise<ItemSemAcesso[]> {
  if (!podeSerOCodigo(lerTermo(termo))) return [];
  const itens = await SD.itensParaPedir(termo);
  return itens.filter(i => grupos.includes(i.grupo)).map(semAcessoDoPedido);
}

/** O botão da linha do item: pede para participar ou cancela o pedido pendente. Devolve o pedido pendente depois da ação. */
export type AlternarPedido = (item: ItemSemAcesso) => Promise<string | null>;
const ACAO_DO_PEDIDO: Record<EstadoDoItemSemAcesso, AlternarPedido> = {
  livre: item => SD.participacaoPedir(MODULO_DO_GRUPO_DO_PEDIDO[item.grupo], item.id),
  pedido: async item => { await SD.participacaoCancelar(item.pedido_id!); return null; }
};
export const alternarPedido: AlternarPedido = item => ACAO_DO_PEDIDO[estadoDoItemSemAcesso(item.pedido_id)](item);

export interface ResultadoDaBuscaGeral {
  buscas: BuscaDoGrupo[];
  semAcesso: ItemSemAcesso[];
  /** Os grupos em que a busca falhou: os outros aparecem, e a janela avisa destes. */
  falhas: GrupoDaBusca[];
}
export type BuscarEmTudo = (termo: string, grupos: readonly GrupoDaBusca[]) => Promise<ResultadoDaBuscaGeral>;

/** Busca nos grupos indicados ao mesmo tempo. Um módulo que falhar não derruba os outros. */
export const buscarEmTudo: BuscarEmTudo = async (termo, grupos) => {
  const [respostas, semAcesso] = await Promise.all([
    Promise.allSettled(grupos.map(g => buscarNoGrupo(g, termo))),
    buscarSemAcesso(termo, grupos).catch(() => [])
  ]);
  return {
    buscas: respostas.flatMap(r => r.status === 'fulfilled' ? [r.value] : []),
    semAcesso,
    falhas: grupos.filter((_g, i) => respostas[i].status === 'rejected')
  };
};
