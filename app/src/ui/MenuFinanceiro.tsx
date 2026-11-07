// O Financeiro no menu lateral: um item só, que abre a página com os totais e as abas Entradas, Saídas, Receitas e Despesas.
import { NavLink } from 'react-router';
import { Icone } from './Icone';

export function MenuFinanceiro() {
  return <NavLink to="/financeiro/"><Icone nome="dinheiro" /><span>Financeiro</span></NavLink>;
}
