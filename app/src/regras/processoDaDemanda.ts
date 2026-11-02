// O processo que nasce de uma demanda: o que o cadastro já traz preenchido, quando perguntar e a tarefa que herda a demanda.
// Tudo puro, sem tela nem banco.
import type { Demanda, DemandaLigada } from '../dados/tipos';
import type { CamposProcesso } from './processo';

/** Os clientes, o responsável e os colaboradores da demanda. Quem não está mais ativo fica de fora; sem responsável ativo, fica quem está cadastrando. */
export const camposDaDemanda = (d: Pick<Demanda, 'responsavel_id' | 'colaboradores' | 'clientes'>, ativos: string[], eu: string): Pick<CamposProcesso, 'responsavelId' | 'colaboradores' | 'clientes'> => {
  const responsavelId = ativos.includes(d.responsavel_id) ? d.responsavel_id : eu;
  return { responsavelId, colaboradores: d.colaboradores.filter(id => ativos.includes(id) && id !== responsavelId), clientes: d.clientes.map(c => c.id) };
};

/** Pergunta ao concluir a demanda: só com o módulo ligado, indo para a coluna das concluídas, e se ela ainda não tem processo. */
export const devePerguntarProcesso = (p: { modulo: boolean; etapa: string | null; concluida: string | null; ligados: number }) =>
  p.modulo && !!p.concluida && p.etapa === p.concluida && p.ligados === 0;

/** A demanda que a tarefa nascida no processo herda: só quando não há dúvida, com uma única demanda ativa ligada. */
export function demandaParaTarefa(ligadas: Pick<DemandaLigada, 'id' | 'arquivado_em'>[]): string | null {
  const ativas = ligadas.filter(d => !d.arquivado_em);
  return ativas.length === 1 ? ativas[0].id : null;
}
