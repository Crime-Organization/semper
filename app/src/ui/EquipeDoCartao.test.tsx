// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { EquipeDoCartao } from './EquipeDoCartao';

const ana = { id: 'u-ana', nome: 'Ana Teste Lima', papel: 'Responsável', para: '/pessoas/?id=p-ana' };
const bruno = { id: 'u-bruno', nome: 'Bruno Exemplo Souza', papel: 'Participante · 10%' };
const mateus = { id: 'u-mateus', nome: 'Mateus Freitas Gonçalves', papel: 'Participante' };

describe('Equipe do cartão', () => {
  it('quando o cartão tem responsável e participantes, então cada um é uma bolinha com as iniciais, o responsável primeiro', () => {
    // Quando
    render(<MemoryRouter><EquipeDoCartao responsavel={ana} participantes={[bruno, mateus]} /></MemoryRouter>);
    // Então
    const bolinhas = within(screen.getByRole('group', { name: 'Equipe' })).getAllByRole('button');
    expect(bolinhas.map(b => b.getAttribute('aria-label'))).toEqual(['Ana Teste Lima, Responsável', 'Bruno Exemplo Souza, Participante · 10%',
      'Mateus Freitas Gonçalves, Participante']);
    expect(bolinhas.map(b => b.textContent)).toEqual(['AL', 'BS', 'MG']);
  });

  it('quando a pessoa clica numa bolinha, então vê o nome completo, o papel e o link para o cartão da pessoa', async () => {
    // Dado
    render(<MemoryRouter><EquipeDoCartao responsavel={ana} participantes={[]} /></MemoryRouter>);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Ana Teste Lima, Responsável' }));
    // Então
    const ficha = screen.getByRole('dialog', { name: 'Ana Teste Lima' });
    expect(ficha).toHaveTextContent('Ana Teste LimaResponsável');
    expect(within(ficha).getByRole('link', { name: 'Abrir o cartão da pessoa' })).toHaveAttribute('href', '/pessoas/?id=p-ana');
  });

  it('quando a pessoa não tem cartão, então a ficha não tem link', async () => {
    // Dado
    render(<MemoryRouter><EquipeDoCartao responsavel={ana} participantes={[bruno]} /></MemoryRouter>);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: /Bruno Exemplo Souza/ }));
    // Então
    expect(within(screen.getByRole('dialog', { name: 'Bruno Exemplo Souza' })).queryByRole('link')).not.toBeInTheDocument();
  });
});
