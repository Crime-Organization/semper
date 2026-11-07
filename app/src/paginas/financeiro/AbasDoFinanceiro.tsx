// As abas do Financeiro, no alto de cada página dele: o mesmo lugar para o painel, o lançamento, os contratos e as telas de detalhe.
// Quem não é administrador não vê as abas que só o administrador abre (Painel, Caixa e Lucro).
import { useLocation } from 'react-router';
import { NavegacaoEmAbas } from '../../ui/base';
import { useCtx } from '../../ui/sessao';

/** As abas na ordem em que aparecem. Uma aba nova é uma linha nova aqui. */
export const ABAS_DO_FINANCEIRO: readonly { para: string; rotulo: string; soAdmin: boolean }[] = [
  { para: '/financeiro/painel/', rotulo: 'Painel', soAdmin: true },
  { para: '/financeiro/entradas/', rotulo: 'Entradas', soAdmin: false },
  { para: '/financeiro/saidas/', rotulo: 'Saídas', soAdmin: true },
  { para: '/financeiro/contratos/', rotulo: 'Carteira', soAdmin: false },
  { para: '/financeiro/', rotulo: 'Caixa', soAdmin: true },
  { para: '/parcelas/', rotulo: 'Parcelas', soAdmin: false },
  { para: '/lucros/', rotulo: 'Lucro dos sócios', soAdmin: true },
  { para: '/meus-valores/', rotulo: 'Meus valores', soAdmin: false },
  { para: '/conferencia/', rotulo: 'Conferência', soAdmin: false }
];

export function AbasDoFinanceiro() {
  const { ehAdmin } = useCtx();
  const { pathname } = useLocation();
  const caminho = pathname.endsWith('/') ? pathname : pathname + '/';
  return <NavegacaoEmAbas rotulo="Telas do financeiro"
    abas={ABAS_DO_FINANCEIRO.filter(a => ehAdmin || !a.soAdmin).map(a => ({ para: a.para, rotulo: a.rotulo, atual: a.para === caminho }))} />;
}
