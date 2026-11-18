// A busca geral (#321) fora da tela: se a janela está aberta (estado do sistema todo, como as janelas e os avisos) e onde
// ela busca. Cada grupo usa a listagem do próprio módulo, a mesma da busca da página dele: o banco aplica as regras de quem vê
// o quê (RLS e a fase de adaptação), então a janela nunca mostra o que a pessoa não vê na página do módulo.
// O que mostrar de cada linha, a ordem e os filtros ficam em regras/buscaGeral.ts.
import { SD, type Pagina } from '../dados';
import { BUSCA_GERAL_CANDIDATOS } from '../dados/limites';
import { achadoDoGrupo, type BuscaDoGrupo, type GrupoDaBusca, type ItemSemAcesso, type LinhaDoGrupo } from '../regras/buscaGeral';
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
 * Ponto de encaixe da #363 (pedir para participar): os itens que existem, mas de que a pessoa não faz parte, achados pelo código
 * exato ou pelo número do processo. Por enquanto, nenhum: com a fase de adaptação ligada, todos veem tudo, e a consulta (que
 * precisa de uma função nova no banco, para devolver só o tipo e o código) vem com a #363.
 */
const buscarSemAcesso = async (_termo: string, _grupos: readonly GrupoDaBusca[]): Promise<ItemSemAcesso[]> => [];

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
