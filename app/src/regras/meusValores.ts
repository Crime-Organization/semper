// "Meus valores": como aparece a parte de cada pessoa em cada recebimento, e os totais por papel. Tudo puro, sem tela nem banco. Os valores
// são em centavos; as datas, "aaaa-mm-dd". Quem escolhe as linhas é o banco (public.financeiro_meus_valores), porque ninguém pode ver a parte
// dos colegas. Regras do escritório (tarefa #235):
// - só há valor depois que o cliente pagou: parcelas futuras ficam de fora;
// - o valor do responsável inclui o que ele passa aos terceiros;
// - participante e indicador que não é sócio recebem do responsável, sem passar pelo caixa do escritório.
import type { MeuValor, PapelNoValor, SituacaoDoValor } from '../dados/tipos';
import { anoAceito, dataExiste } from './calendario';

/** Na ordem em que aparecem. */
export const PAPEIS_DO_VALOR: Record<PapelNoValor, string> = { responsavel: 'Responsável', participante: 'Participante', indicador: 'Indicador' };
const PAPEIS = Object.keys(PAPEIS_DO_VALOR) as PapelNoValor[];

export const SITUACOES_DO_VALOR: Record<SituacaoDoValor, { nome: string; selo: 'ok' | 'pend' }> = {
  a_receber: { nome: 'A receber', selo: 'pend' }, recebido: { nome: 'Recebido', selo: 'ok' }
};

/** O banco diz de quem o valor vem: estes dois ou o nome do responsável, que aparece como está. */
const ORIGENS_DO_VALOR: Record<string, string> = { 'escritório': 'Escritório', cliente: 'Cliente' };
export const deQuemVem = (l: Pick<MeuValor, 'de_quem'>) => ORIGENS_DO_VALOR[l.de_quem] ?? l.de_quem;

export type TotaisPorPapel = Record<PapelNoValor, Record<SituacaoDoValor, number>>;

/** Cada papel tem os seus totais: eles não se somam entre si. */
export function totaisPorPapel(linhas: Pick<MeuValor, 'papel' | 'situacao' | 'valor'>[]): TotaisPorPapel {
  const totais = Object.fromEntries(PAPEIS.map(p => [p, { a_receber: 0, recebido: 0 }])) as TotaisPorPapel;
  linhas.forEach(l => { totais[l.papel][l.situacao] += l.valor; });
  return totais;
}

/** Só os papéis em que a pessoa tem algum valor no período. */
export const papeisComValor = (totais: TotaisPorPapel) => PAPEIS.filter(p => totais[p].a_receber + totais[p].recebido > 0);

/** O que há de errado na data em que o responsável pagou o terceiro, ou null. O banco confere a mesma faixa. */
export const erroDaDataDoPagamento = (data: string) => dataExiste(data) && anoAceito(data) ? null : 'Informe uma data válida.';
