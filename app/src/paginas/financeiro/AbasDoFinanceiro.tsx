// As quatro abas do Financeiro. Entradas e Saídas: o que já entrou e saiu das contas. Direitos e Obrigações: o que ainda vai entrar e
// sair (as parcelas a receber e o que falta pagar).
// Saídas é só do administrador. As telas de detalhe (Caixa por conta, Lucro dos sócios, Meus valores) mostram as mesmas abas, para voltar.
import { useLocation } from 'react-router';
import { NavegacaoEmAbas } from '../../ui/base';
import { useCtx } from '../../ui/sessao';

export type AbaDoFinanceiro = 'entradas' | 'saidas' | 'direitos' | 'obrigacoes';
/** As abas na ordem em que aparecem. Uma aba nova é uma linha nova aqui. */
export const ABAS_DO_FINANCEIRO: Record<AbaDoFinanceiro, { para: string; rotulo: string; soAdmin: boolean }> = {
  entradas: { para: '/financeiro/', rotulo: 'Entradas', soAdmin: false },
  saidas: { para: '/financeiro/saidas/', rotulo: 'Saídas', soAdmin: true },
  direitos: { para: '/financeiro/direitos/', rotulo: 'Direitos', soAdmin: false },
  obrigacoes: { para: '/financeiro/obrigacoes/', rotulo: 'Obrigações', soAdmin: false }
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
