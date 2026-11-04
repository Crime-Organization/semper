// O submenu do módulo Financeiro no menu lateral. Parcelas e Meus valores são de todos; Caixa e Lucro dos sócios, só dos administradores.
import { NavLink } from 'react-router';
import { SubmenuLateral } from './SubmenuLateral';

export function MenuFinanceiro({ ehAdmin }: { ehAdmin: boolean }) {
  return <SubmenuLateral id="financeiro" icone="dinheiro" rotulo="Financeiro" caminhos={['/parcelas', '/meus-valores', '/financeiro', '/lucros']}>
    <NavLink to="/parcelas/"><span>Parcelas</span></NavLink>
    <NavLink to="/meus-valores/"><span>Meus valores</span></NavLink>
    {ehAdmin && <NavLink to="/financeiro/"><span>Caixa</span></NavLink>}
    {ehAdmin && <NavLink to="/lucros/"><span>Lucro dos sócios</span></NavLink>}
  </SubmenuLateral>;
}
