// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// O "+ Nova pessoa" das seções Clientes e Pessoas do cartão (#376): os dois atalhos, com as mesmas condições do "Ligar … existente".
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { CLIENTES_MAXIMOS } from '../dados/limites';
import { LigarPessoaNoItem, novaPessoaNoItem } from './PessoasNosItens';

vi.mock('../dados', () => ({ SD: {} }));

const pessoas = (n: number) => Array.from({ length: n }, (_, i) => ({ id: 'p' + i }));

describe('O "+ Nova pessoa" no cartão do item', () => {
  it('dado o cartão de uma demanda que se pode alterar, quando monta os atalhos, então o "+" do título e o botão levam ao cadastro já com a demanda', () => {
    // Dado / Quando
    const novo = novaPessoaNoItem('demandas', 'd1', pessoas(1), true);
    // Então
    expect(novo.titulo).toEqual({ para: '/pessoas/nova/?demanda=d1', rotulo: 'Nova pessoa como cliente desta demanda' });
    expect(novo.embaixo).toEqual({ para: '/pessoas/nova/?demanda=d1', rotulo: 'Nova pessoa' });
  });

  it('dado o cartão só para ler (ou arquivado), quando monta os atalhos, então não há nenhum', () => {
    // Dado / Quando / Então
    expect(novaPessoaNoItem('tarefas', 't1', [], false)).toEqual({});
  });

  it('dada a lista do item cheia, quando monta os atalhos, então não há nenhum, como o "Ligar existente"', () => {
    // Dado / Quando / Então
    expect(novaPessoaNoItem('processos', 'k1', pessoas(CLIENTES_MAXIMOS), true)).toEqual({});
  });

  it('dado o atalho, quando a seção mostra o "Ligar pessoa existente", então o "+ Nova pessoa" aparece ao lado, com o endereço do cadastro', () => {
    // Dado
    const { embaixo } = novaPessoaNoItem('compromissos', 'c1', [], true);
    // Quando
    render(<MemoryRouter><LigarPessoaNoItem modulo="compromissos" itemId="c1" ligadas={[]} depois={() => undefined} novo={embaixo} /></MemoryRouter>);
    // Então
    expect(screen.getByRole('button', { name: 'Ligar pessoa existente' })).toBeEnabled();
    expect(screen.getByRole('link', { name: 'Nova pessoa' })).toHaveAttribute('href', '/pessoas/nova/?compromisso=c1');
  });
});
