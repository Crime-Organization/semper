// O submenu do módulo Financeiro no menu lateral. Caixa e Lucro dos sócios são só dos administradores.
import { NavLink } from 'react-router';
import { SubmenuLateral } from './SubmenuLateral';

export function MenuFinanceiro({ ehAdmin }: { ehAdmin: boolean }) {
  return <SubmenuLateral id="financeiro" icone="dinheiro" rotulo="Financeiro" caminhos={['/parcelas', '/financeiro', '/lucros']}>
    <NavLink to="/parcelas/"><span>Parcelas</span></NavLink>
    {ehAdmin && <NavLink to="/financeiro/"><span>Caixa</span></NavLink>}
    {ehAdmin && <NavLink to="/lucros/"><span>Lucro dos sócios</span></NavLink>}
  </SubmenuLateral>;
}
