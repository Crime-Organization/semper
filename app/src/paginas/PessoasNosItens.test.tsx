// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// As seções Clientes e Pessoas do cartão: no título, a corrente que liga uma pessoa do cadastro e o "+ Nova pessoa" (#376, #427),
// com as mesmas condições; embaixo, só a busca que a corrente abre.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { CLIENTES_MAXIMOS } from '../dados/limites';
import { Recolhivel } from '../ui/Recolhivel';
import { LigarPessoaNoItem, ligarPessoaNoItem, novaPessoaNoItem } from './PessoasNosItens';

vi.mock('../dados', () => ({ SD: { pessoasListar: async () => ({ linhas: [], total: 0 }) } }));

const pessoas = (n: number) => Array.from({ length: n }, (_, i) => ({ id: 'p' + i }));

describe('O "+ Nova pessoa" no título da seção', () => {
  it('dado o cartão de uma demanda que se pode alterar, quando monta o atalho, então o "+" leva ao cadastro já com a demanda', () => {
    // Dado / Quando / Então
    expect(novaPessoaNoItem('demandas', 'd1', pessoas(1), true)).toEqual({ para: '/pessoas/nova/?demanda=d1', rotulo: 'Nova pessoa como cliente desta demanda' });
  });

  it('dado o cartão só para ler (ou arquivado), quando monta o atalho, então não há nenhum', () => {
    // Dado / Quando / Então
    expect(novaPessoaNoItem('tarefas', 't1', [], false)).toBeUndefined();
  });

  it('dada a lista do item cheia, quando monta o atalho, então não há nenhum', () => {
    // Dado / Quando / Então
    expect(novaPessoaNoItem('processos', 'k1', pessoas(CLIENTES_MAXIMOS), true)).toBeUndefined();
  });
});

describe('A corrente "Ligar … existente" no título da seção', () => {
  it('dado o cartão só para ler, quando monta a corrente, então não há nenhuma', () => {
    // Dado / Quando / Então
    expect(ligarPessoaNoItem('tarefas', [], false)).toBeUndefined();
  });

  it('dada a lista do item cheia, quando monta a corrente, então ela vem desligada, com o motivo', () => {
    // Dado / Quando
    const corrente = ligarPessoaNoItem('processos', pessoas(CLIENTES_MAXIMOS), true);
    // Então
    expect(corrente?.rotulo).toBe('Ligar cliente existente');
    expect(corrente?.indisponivel).toBeTruthy();
  });

  it('dada a seção com a corrente e o "+" no título, quando ela abre, então não há botões embaixo e a corrente abre a busca ali', async () => {
    // Dado
    render(<MemoryRouter>
      <Recolhivel titulo="Pessoas" icone="pessoas" ligar={ligarPessoaNoItem('compromissos', [], true)} novo={novaPessoaNoItem('compromissos', 'c1', [], true)}>
        <LigarPessoaNoItem modulo="compromissos" itemId="c1" ligadas={[]} depois={() => undefined} />
      </Recolhivel>
    </MemoryRouter>);
    await userEvent.click(screen.getByRole('button', { name: 'Pessoas' }));
    // Então: embaixo, nenhum botão de ligar nem link de criar
    expect(screen.getAllByRole('button', { name: 'Ligar pessoa existente' })).toHaveLength(1);
    expect(screen.getAllByRole('link', { name: /Nova pessoa/ })).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Nova pessoa ligada a este compromisso' })).toHaveAttribute('href', '/pessoas/nova/?compromisso=c1');
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Ligar pessoa existente' }));
    // Então
    expect(screen.getByRole('textbox', { name: 'Buscar pessoa para ligar' })).toHaveFocus();
  });
});
