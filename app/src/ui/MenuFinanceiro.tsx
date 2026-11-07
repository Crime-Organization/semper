// O submenu do módulo Financeiro no menu lateral, na mesma ordem das abas do alto de cada página dele (paginas/financeiro/AbasDoFinanceiro.tsx).
// Painel, Caixa e Lucro dos sócios são só dos administradores.
import { NavLink } from 'react-router';
import { ABAS_DO_FINANCEIRO } from '../paginas/financeiro/AbasDoFinanceiro';
import { SubmenuLateral } from './SubmenuLateral';

export function MenuFinanceiro({ ehAdmin }: { ehAdmin: boolean }) {
  return <SubmenuLateral id="financeiro" icone="dinheiro" rotulo="Financeiro" caminhos={['/parcelas', '/meus-valores', '/conferencia', '/financeiro', '/lucros']}>
    {ABAS_DO_FINANCEIRO.filter(a => ehAdmin || !a.soAdmin).map(a => <NavLink key={a.para} to={a.para} end><span>{a.rotulo}</span></NavLink>)}
  </SubmenuLateral>;
}
