// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { abaDoCaminho } from '../paginas/financeiro/AbasDoFinanceiro';
import { MenuFinanceiro } from './MenuFinanceiro';

const abrir = (endereco: string) => render(<MemoryRouter initialEntries={[endereco]}><MenuFinanceiro /></MemoryRouter>);

describe('O Financeiro no menu', () => {
  it('quando aparece, então é um item só, que abre a página do Financeiro', () => {
    // Quando
    abrir('/inicio/');
    // Então
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Financeiro' })).toHaveAttribute('href', '/financeiro/');
  });

  it.each(['/financeiro/', '/financeiro/saidas/', '/financeiro/direitos/', '/financeiro/obrigacoes/'])('dado que entro em %s, quando a tela abre, então o item fica marcado', endereco => {
    // Quando
    abrir(endereco);
    // Então
    expect(screen.getByRole('link', { name: 'Financeiro' })).toHaveAttribute('aria-current', 'page');
  });
});

describe('A aba de cada endereço', () => {
  it.each([['/financeiro/', 'entradas'], ['/financeiro/saidas/', 'saidas'], ['/financeiro/direitos', 'direitos'], ['/financeiro/obrigacoes/', 'obrigacoes'], ['/financeiro/outra/', 'entradas']])(
    'quando o endereço é %s, então a aba é %s', (endereco, aba) => {
      // Quando / Então
      expect(abaDoCaminho(endereco)).toBe(aba);
    });
});
