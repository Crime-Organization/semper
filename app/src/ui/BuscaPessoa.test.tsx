// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PessoaLista } from '../dados';
import { BuscaPessoa } from './BuscaPessoa';

const { pessoasListar } = vi.hoisted(() => ({ pessoasListar: vi.fn() }));
vi.mock('../dados', () => ({ SD: { pessoasListar } }));

const ana = { id: 'p-ana', codigo: 'A1', tipo: 'pf', nome: 'ANA TESTE LIMA', documento: '52998224725' } as PessoaLista;
const padaria = { id: 'p-pad', codigo: 'P1', tipo: 'pj', nome: 'PADARIA ANA', documento: '11222333000181' } as PessoaLista;

function montar(desativar?: (p: PessoaLista) => string | null) {
  const aoEscolher = vi.fn();
  render(<MemoryRouter><BuscaPessoa rotulo="Pessoa" escolhida={null} aoEscolher={aoEscolher} desativar={desativar} /></MemoryRouter>);
  return aoEscolher;
}

describe('Busca de pessoa', () => {
  beforeEach(() => { pessoasListar.mockReset(); pessoasListar.mockResolvedValue({ linhas: [ana, padaria], total: 2 }); });

  it('quando a pessoa digita parte do nome, então a lista mostra quem foi encontrado, com tipo e documento', async () => {
    // Dado
    montar();
    // Quando
    await userEvent.type(screen.getByRole('textbox', { name: 'Pessoa' }), 'ana');
    // Então
    expect(await screen.findByRole('button', { name: /ANA TESTE LIMA/ })).toHaveTextContent('Pessoa física · 529.982.247-25');
    expect(screen.getByRole('button', { name: /PADARIA ANA/ })).toHaveTextContent('Pessoa jurídica · 11.222.333/0001-81');
    expect(pessoasListar).toHaveBeenLastCalledWith({ termo: 'ana', porPagina: 8 });
  });

  it('quando se digita só uma letra, então ainda não busca', async () => {
    // Dado
    montar();
    // Quando
    await userEvent.type(screen.getByRole('textbox', { name: 'Pessoa' }), 'a');
    await new Promise(r => setTimeout(r, 400));
    // Então
    expect(pessoasListar).not.toHaveBeenCalled();
  });

  it('quando a pessoa escolhe alguém da lista, então essa pessoa é a escolhida', async () => {
    // Dado
    const aoEscolher = montar();
    await userEvent.type(screen.getByRole('textbox', { name: 'Pessoa' }), 'ana');
    // Quando
    await userEvent.click(await screen.findByRole('button', { name: /PADARIA ANA/ }));
    // Então
    expect(aoEscolher).toHaveBeenCalledWith(padaria);
  });

  it('quando a pessoa aperta Enter, então escolhe o primeiro que pode ser escolhido', async () => {
    // Dado
    const aoEscolher = montar(p => p.id === 'p-ana' ? 'já tem acesso' : null);
    const campo = screen.getByRole('textbox', { name: 'Pessoa' });
    await userEvent.type(campo, 'ana');
    expect(await screen.findByRole('button', { name: /ANA TESTE LIMA/ })).toBeDisabled();
    // Quando
    await userEvent.type(campo, '{Enter}');
    // Então
    expect(aoEscolher).toHaveBeenCalledWith(padaria);
  });

  it('quando ninguém é encontrado, então oferece cadastrar uma pessoa nova', async () => {
    // Dado
    pessoasListar.mockResolvedValue({ linhas: [], total: 0 });
    montar();
    // Quando
    await userEvent.type(screen.getByRole('textbox', { name: 'Pessoa' }), 'zé');
    // Então
    expect(await screen.findByText(/Nenhuma pessoa encontrada/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Cadastrar' })).toHaveAttribute('href', '/pessoas/nova/');
  });
});
