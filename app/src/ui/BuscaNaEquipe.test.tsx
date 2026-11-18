// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. O resto do comportamento da busca (teclado, Esc, Tab,
// foco no grupo) é conferido pelo EscolhaDaEquipe.test.tsx, que a usa.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Membro } from '../dados/tipos';
import { BuscaNaEquipe } from './BuscaNaEquipe';

const EQUIPE: Membro[] = [
  { id: 'u-ana', nome: 'Ana Teste Lima', ativo: true },
  { id: 'u-bruno', nome: 'Bruno Exemplo Souza', ativo: true }
];
const todos = (termo: string) => EQUIPE.filter(m => m.nome.toLowerCase().includes(termo.toLowerCase()));

describe('Busca na equipe', () => {
  it('quando a busca abre, então mostra quem a tela mandou achar com o que foi digitado', async () => {
    // Dado
    const buscar = vi.fn(todos);
    render(<BuscaNaEquipe buscar={buscar} aoEscolher={vi.fn()} adicionar="Adicionar participante" />);
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar participante' }));
    // Quando
    await userEvent.type(screen.getByRole('textbox', { name: 'Buscar na equipe: adicionar participante' }), 'bru');
    // Então
    expect(buscar).toHaveBeenLastCalledWith('bru');
    expect(screen.getByRole('list', { name: 'Equipe' })).toHaveTextContent('Bruno Exemplo Souza');
    expect(screen.getByRole('list', { name: 'Equipe' })).not.toHaveTextContent('Ana Teste Lima');
  });

  it('quando a pessoa escolhe alguém, então a tela recebe quem foi e o foco vai aonde a tela pediu', async () => {
    // Dado
    const aoEscolher = vi.fn();
    render(<><BuscaNaEquipe buscar={todos} aoEscolher={aoEscolher} adicionar="Adicionar participante"
      focarAoEscolher={() => screen.getByRole('textbox', { name: '% novo' }).focus()} /><input aria-label="% novo" /></>);
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar participante' }));
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Ana Teste Lima' }));
    // Então
    expect(aoEscolher).toHaveBeenCalledWith(EQUIPE[0]);
    expect(screen.queryByRole('list', { name: 'Equipe' })).not.toBeInTheDocument();
    await vi.waitFor(() => expect(screen.getByRole('textbox', { name: '% novo' })).toHaveFocus());
  });

  it('dado a lista no máximo, quando a busca aparece, então o botão de adicionar vem desligado', () => {
    // Quando
    render(<BuscaNaEquipe buscar={todos} aoEscolher={vi.fn()} adicionar="Adicionar participante" desligado />);
    // Então
    expect(screen.getByRole('button', { name: 'Adicionar participante' })).toBeDisabled();
  });

  it('dado ninguém mais para entrar, quando a busca aparece, então no lugar do botão vem que não há mais ninguém', () => {
    // Quando
    render(<BuscaNaEquipe buscar={() => []} aoEscolher={vi.fn()} adicionar="Adicionar participante" />);
    // Então
    expect(screen.queryByRole('button', { name: 'Adicionar participante' })).not.toBeInTheDocument();
    expect(screen.getByText('Não há mais ninguém na equipe.')).toBeInTheDocument();
  });
});
