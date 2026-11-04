// A conferência dos lançamentos com o caixa: situações, filtros, totais e o que salvar quando alguém corrige uma linha. Tudo puro.
// Os valores são em centavos; as datas, "aaaa-mm-dd". A sugestão é o resultado do cruzamento; a situação é o que a pessoa marcou.
import type { LinhaDaConferencia, ResumoDaConferencia, SituacaoDaConferencia } from '../dados/tipos';
import type { TipoSelo } from '../ui/base';
import { centavosNoCampo } from './caixa';
import { dataBoa, lerCentavos } from './parcelas';

export const SITUACOES_DA_CONFERENCIA: Record<SituacaoDaConferencia, { nome: string; selo: TipoSelo }> = {
  confere: { nome: 'Confere', selo: 'ok' }, nao_confere: { nome: 'Não confere', selo: 'erro' }
};

/** Os anos em que a planilha geral foi cruzada com as dos advogados. */
export const ANOS_DA_CONFERENCIA = [2026, 2025];

export type FiltroDaConferencia = 'todas' | 'falta' | SituacaoDaConferencia;
export const FILTROS_DA_CONFERENCIA: Record<FiltroDaConferencia, string> = {
  todas: 'Todas', falta: 'A conferir', confere: SITUACOES_DA_CONFERENCIA.confere.nome, nao_confere: SITUACOES_DA_CONFERENCIA.nao_confere.nome
};

const semAcento = (t: string) => t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

export function filtrarConferencia<L extends Pick<LinhaDaConferencia, 'situacao' | 'cliente' | 'servico' | 'referencia'>>(linhas: L[], filtro: FiltroDaConferencia, busca: string): L[] {
  const termo = semAcento(busca.trim());
  return linhas.filter(l => (filtro === 'todas' || (filtro === 'falta' ? !l.situacao : l.situacao === filtro))
    && (!termo || semAcento([l.cliente, l.servico, l.referencia].filter(Boolean).join(' ')).includes(termo)));
}

/** O valor que a linha representa: o que foi pago, ou o que entrou no caixa quando só existe lá. */
export const valorDaLinha = (l: Pick<LinhaDaConferencia, 'valor_pago' | 'valor_caixa'>) => l.valor_pago ?? l.valor_caixa ?? 0;

type LinhaDoResumo = Pick<LinhaDaConferencia, 'situacao' | 'valor_pago' | 'valor_caixa'>;
export type TotaisDaConferencia = Omit<ResumoDaConferencia, 'responsavel_id' | 'ano'>;

export function totaisDaConferencia(linhas: LinhaDoResumo[]): TotaisDaConferencia {
  const t: TotaisDaConferencia = { total: linhas.length, confere: 0, nao_confere: 0, falta: 0, valor_confere: 0, valor_nao_confere: 0, valor_falta: 0 };
  for (const l of linhas) {
    const valor = valorDaLinha(l);
    if (l.situacao === 'confere') { t.confere++; t.valor_confere += valor; }
    else if (l.situacao === 'nao_confere') { t.nao_confere++; t.valor_nao_confere += valor; }
    else { t.falta++; t.valor_falta += valor; }
  }
  return t;
}

/** Por responsável e por ano, do ano mais novo ao mais antigo, como financeiro_conferencia_resumo no banco. */
export function resumoDaConferencia(linhas: (LinhaDoResumo & Pick<LinhaDaConferencia, 'responsavel_id' | 'ano'>)[]): ResumoDaConferencia[] {
  const grupos = new Map<string, typeof linhas>();
  for (const l of linhas) {
    const chave = `${l.ano}|${l.responsavel_id ?? ''}`;
    grupos.set(chave, [...(grupos.get(chave) ?? []), l]);
  }
  return [...grupos.values()]
    .map(g => ({ responsavel_id: g[0].responsavel_id, ano: g[0].ano, ...totaisDaConferencia(g) }))
    .toSorted((a, b) => b.ano - a.ano || Number(a.responsavel_id === null) - Number(b.responsavel_id === null) || (a.responsavel_id ?? '').localeCompare(b.responsavel_id ?? ''));
}

export interface FormDaLinha { pagoEm: string; valorPago: string }
export const formDaLinha = (l: Pick<LinhaDaConferencia, 'data_pago' | 'valor_pago'>): FormDaLinha => ({ pagoEm: l.data_pago ?? '', valorPago: l.valor_pago === null ? '' : centavosNoCampo(l.valor_pago) });

export type CorrecaoDaLinha = { acao: 'nada' } | { acao: 'erro'; erros: Partial<Record<keyof FormDaLinha, string>> } | { acao: 'salvar'; data: string; valor: number };

/**
 * O que fazer quando a pessoa sai de um campo. Na linha que só existe no caixa, enquanto falta a data ou o valor, ainda não há o que salvar:
 * ela está preenchendo. Na linha que já tinha o pagamento, apagar um dos dois é erro.
 */
export function correcaoDaLinha(f: FormDaLinha, l: Pick<LinhaDaConferencia, 'data_pago' | 'valor_pago'>, hoje: string): CorrecaoDaLinha {
  const original = formDaLinha(l);
  if (f.pagoEm === original.pagoEm && f.valorPago === original.valorPago) return { acao: 'nada' };
  const tinhaPagamento = l.data_pago !== null && l.valor_pago !== null;
  if (!tinhaPagamento && (!f.pagoEm || !f.valorPago.trim())) return { acao: 'nada' };
  const valor = lerCentavos(f.valorPago, null);
  const erros = {
    ...(!dataBoa(f.pagoEm) ? { pagoEm: 'Informe uma data válida.' } : f.pagoEm > hoje ? { pagoEm: 'A data do pagamento não pode estar no futuro.' } : {}),
    ...('erro' in valor ? { valorPago: valor.erro } : {})
  };
  if (Object.keys(erros).length || 'erro' in valor) return { acao: 'erro', erros };
  return { acao: 'salvar', data: f.pagoEm, valor: valor.centavos };
}
