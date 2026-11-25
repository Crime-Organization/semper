// O endereço que abre uma despesa do escritório (#439): a aba Obrigações do Financeiro, no mês do vencimento, com a despesa aberta.
// Puro (sem rede, sem banco, sem importar nada): o site lê o endereço (paginas/financeiro/Hub.tsx) e a função do servidor que põe a
// despesa na agenda Administrativo do Google (#166) o leva na descrição do evento, com o endereço do site do escritório na frente.
// Testado em app/src/regras/enderecoDaDespesa.test.ts.

/** A aba Obrigações do Financeiro, onde ficam as despesas do escritório. */
export const CAMINHO_DAS_DESPESAS = '/financeiro/obrigacoes/';
/**
 * Os parâmetros do endereço: o mês do vencimento ("aaaa-mm", o mesmo "mes" do lançamento pedido, PARAMETROS_DO_LANCAMENTO em
 * app/src/regras/caixa.ts) e a despesa que abre. A página lê uma vez e tira do endereço.
 */
export const PARAMETROS_DA_DESPESA = { mes: 'mes', despesa: 'despesa' } as const;

/** O endereço da despesa, sem o site na frente: "/financeiro/obrigacoes/?mes=2026-12&despesa=…". */
export const enderecoDaDespesa = (d: { id: string; vencimento: string }) =>
  `${CAMINHO_DAS_DESPESAS}?${new URLSearchParams({ [PARAMETROS_DA_DESPESA.mes]: d.vencimento.slice(0, 7), [PARAMETROS_DA_DESPESA.despesa]: d.id })}`;
