// As quatro abas do Financeiro. Entradas e Saídas: o que já entrou e saiu das contas. Receitas e Despesas: o que ainda vai entrar e sair.
// Saídas é só do administrador. As telas de detalhe (Caixa por conta, Lucro dos sócios, Meus valores) mostram as mesmas abas, para voltar.
import { useLocation } from 'react-router';
import { NavegacaoEmAbas } from '../../ui/base';
import { useCtx } from '../../ui/sessao';

export type AbaDoFinanceiro = 'entradas' | 'saidas' | 'receitas' | 'despesas';
/** As abas na ordem em que aparecem. Uma aba nova é uma linha nova aqui. */
export const ABAS_DO_FINANCEIRO: Record<AbaDoFinanceiro, { para: string; rotulo: string; soAdmin: boolean }> = {
  entradas: { para: '/financeiro/', rotulo: 'Entradas', soAdmin: false },
  saidas: { para: '/financeiro/saidas/', rotulo: 'Saídas', soAdmin: true },
  receitas: { para: '/financeiro/receitas/', rotulo: 'Receitas', soAdmin: false },
  despesas: { para: '/financeiro/despesas/', rotulo: 'Despesas', soAdmin: false }
};

/** A aba de um endereço ("/financeiro/saidas/" é Saídas); qualquer outro é Entradas. */
export const abaDoCaminho = (caminho: string): AbaDoFinanceiro =>
  (Object.keys(ABAS_DO_FINANCEIRO) as AbaDoFinanceiro[]).find(a => ABAS_DO_FINANCEIRO[a].para === (caminho.endsWith('/') ? caminho : caminho + '/')) ?? 'entradas';

export function AbasDoFinanceiro() {
  const { ehAdmin } = useCtx();
  const { pathname } = useLocation();
  const caminho = pathname.endsWith('/') ? pathname : pathname + '/';
  return <NavegacaoEmAbas rotulo="Abas do financeiro"
    abas={Object.values(ABAS_DO_FINANCEIRO).filter(a => ehAdmin || !a.soAdmin).map(a => ({ para: a.para, rotulo: a.rotulo, atual: a.para === caminho }))} />;
}
