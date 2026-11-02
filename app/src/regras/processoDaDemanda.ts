// O processo que nasce de uma demanda: o que o cadastro já traz preenchido, quando perguntar e a tarefa que herda a demanda.
// Tudo puro, sem tela nem banco.
import type { Demanda, DemandaDoProcesso, Processo } from '../dados/tipos';
import type { CamposProcesso } from './processo';

/** Os clientes, o responsável e os colaboradores da demanda. Quem não está mais ativo fica de fora; sem responsável ativo, fica quem está cadastrando. */
export const camposDaDemanda = (d: Pick<Demanda, 'responsavel_id' | 'colaboradores' | 'clientes'>, ativos: string[], eu: string): Pick<CamposProcesso, 'responsavelId' | 'colaboradores' | 'clientes'> => {
  const responsavelId = ativos.includes(d.responsavel_id) ? d.responsavel_id : eu;
  // Sem cliente na demanda, fica a linha vazia do cadastro, para escolher.
  return { responsavelId, colaboradores: d.colaboradores.filter(id => ativos.includes(id) && id !== responsavelId), clientes: d.clientes.length ? d.clientes.map(c => c.id) : [''] };
};

/** Pergunta ao concluir a demanda: só com o módulo ligado, na demanda ativa, indo para a coluna das concluídas, e se ela ainda
 *  não tem processo (contando os que a pessoa não pode abrir). */
export const devePerguntarProcesso = (p: { modulo: boolean; arquivada: boolean; etapa: string | null; concluida: string | null; ligados: number }) =>
  p.modulo && !p.arquivada && !!p.concluida && p.etapa === p.concluida && p.ligados === 0;

type ProcessoParaHerdar = Pick<Processo, 'segredo' | 'criado_por' | 'responsavel_id' | 'colaboradores'>;
/** A demanda e o contrato que a tarefa nascida no processo herda: só com uma única demanda ativa ligada, para não haver
 *  dúvida. Quem vê a demanda vê a tarefa, e a tarefa traz o texto da intimação: por isso não herda em segredo de justiça,
 *  nem quando alguém da demanda não pode ver o processo. */
export function ligacoesParaTarefa(ligadas: DemandaDoProcesso[], p: ProcessoParaHerdar): { demanda_id: string | null; contrato_id: string | null } {
  const ativas = ligadas.filter(d => !d.arquivado_em);
  const nada = { demanda_id: null, contrato_id: null };
  if (ativas.length !== 1 || p.segredo) return nada;
  const [d] = ativas;
  const veOProcesso = new Set([p.criado_por, p.responsavel_id, ...p.colaboradores]);
  const todosVeem = [d.criado_por, d.responsavel_id, ...d.colaboradores].every(id => !id || veOProcesso.has(id));
  return todosVeem ? { demanda_id: d.id, contrato_id: d.contrato_id } : nada;
}
