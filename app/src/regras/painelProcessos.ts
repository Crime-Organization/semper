// O painel de Processos: até onde cada lista olha, os grupos de prazos, os números de cada coluna e os textos de cada linha.
// Tudo puro, sem tela nem banco. As datas são "aaaa-mm-dd".
import type { Coluna, FaseNoPainel, ProcessoNoPainel, PrazoNoPainel, TipoProcesso } from '../dados/tipos';
import { DIAS_PARADO } from '../dados/limites';
import { DIAS_DE_PRAZO_PROXIMO, rotuloDoPrazo, situacaoDoPrazoNoProcesso, type SituacaoDoPrazoNoProcesso } from './andamentos';
import { somarDias } from './prazos';
import { TIPOS_PROCESSO } from './processo';

/** Até quantos dias à frente aparecem as audiências e as perícias. */
export const DIAS_DE_MARCADOS = 15;
/** Quantos itens cada lista traz (passou disso, a tela avisa o total) e quantos são os últimos andamentos. */
export const ITENS_POR_LISTA = 100;
export const ULTIMOS_ANDAMENTOS = 10;

/** As datas-limite do painel, a partir de hoje. */
export const datasDoPainel = (hoje: string) => ({ ate_prazos: somarDias(hoje, DIAS_DE_PRAZO_PROXIMO), ate_marcados: somarDias(hoje, DIAS_DE_MARCADOS) });

/** Os grupos de prazos, na ordem da tela. O vencido vem primeiro e em destaque. */
const GRUPOS: { situacao: SituacaoDoPrazoNoProcesso; titulo: string; destaque: boolean }[] = [
  { situacao: 'vencido', titulo: 'Vencidos', destaque: true },
  { situacao: 'hoje', titulo: 'Vencem hoje', destaque: true },
  { situacao: 'proximo', titulo: `Próximos ${DIAS_DE_PRAZO_PROXIMO} dias`, destaque: false }
];
/** Os prazos em grupos, só os que têm algum. */
export function gruposDePrazos(prazos: PrazoNoPainel[], hoje: string) {
  const comSituacao = prazos.map(z => ({ z, situacao: situacaoDoPrazoNoProcesso({ final: z.final, concluido_em: null }, hoje) }));
  return GRUPOS.map(g => ({ ...g, prazos: comSituacao.filter(x => x.situacao === g.situacao).map(x => x.z) })).filter(g => g.prazos.length);
}
export const rotuloNoPainel = (z: Pick<PrazoNoPainel, 'final'>, hoje: string) => rotuloDoPrazo({ final: z.final, concluido_em: null }, hoje);

/** Quem aparece com a etapa vazia: fora do quadro. */
export const SEM_FASE = 'sem';

/** Os números de um tipo de processo, na ordem das colunas do quadro. Só as colunas com processo. */
export function fasesDoTipo(fases: FaseNoPainel[], tipo: TipoProcesso, colunas: Pick<Coluna, 'id' | 'nome'>[], semSituacao: string) {
  const doTipo = fases.filter(f => f.tipo === tipo);
  const contadas = colunas.flatMap(c => {
    const n = doTipo.find(f => f.etapa_id === c.id)?.n;
    return n ? [{ chave: c.id, nome: c.nome, n }] : [];
  });
  const fora = doTipo.find(f => f.etapa_id === null)?.n;
  return fora ? [...contadas, { chave: SEM_FASE, nome: semSituacao, n: fora }] : contadas;
}
/** O quadro já filtrado por aquela coluna, com a mesma escolha de "Meus" do painel. */
export const enderecoDaFase = (tipo: TipoProcesso, chave: string, meus: string | null) =>
  `${TIPOS_PROCESSO[tipo].caminho}?etapa=${chave}${meus ? `&pessoa=${meus}` : ''}`;

/** O endereço que abre o cartão do processo. */
export const enderecoDoProcesso = (p: Pick<ProcessoNoPainel, 'id' | 'tipo'>) => `${TIPOS_PROCESSO[p.tipo].caminho}?id=${p.id}`;

/** O processo como a regra da tarefa recebe (os clientes vêm só com o id). */
export const processoParaTarefa = (p: ProcessoNoPainel) => ({ ...p, clientes: p.clientes.map(id => ({ id })) });

/** O que há de errado nos dias sem andamento, ou null. */
export function erroDosDiasParado(texto: string): string | null {
  const n = Number(texto);
  return Number.isInteger(n) && n >= DIAS_PARADO.minimo && n <= DIAS_PARADO.maximo ? null : `Use um número de ${DIAS_PARADO.minimo} a ${DIAS_PARADO.maximo}.`;
}
