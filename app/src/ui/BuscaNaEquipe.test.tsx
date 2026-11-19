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

  // A regra mudou (pedido do dono, 18/11): a bolinha na frente de cada nome saiu da lista.
  it('quando a busca abre, então cada achado mostra só o nome, sem a bolinha', async () => {
    // Dado
    render(<BuscaNaEquipe buscar={todos} aoEscolher={vi.fn()} adicionar="Adicionar participante" />);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar participante' }));
    // Então
    const ana = screen.getByRole('button', { name: 'Ana Teste Lima' });
    expect(ana).toHaveTextContent(/^Ana Teste Lima$/);
    expect(ana.querySelector('svg, img, [aria-hidden="true"]')).toBeNull();
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

describe('Busca na equipe na bolinha "+" do topo do cartão', () => {
  const naBolinha = (props: Partial<Parameters<typeof BuscaNaEquipe>[0]> = {}) =>
    render(<BuscaNaEquipe buscar={todos} aoEscolher={vi.fn()} adicionar="Pôr participante" bolinha={{ tamanho: 34, motivoDesligado: 'Cheia.' }} {...props} />);

  it('quando a pessoa clica na bolinha, então a busca abre num painel por cima, com o foco no campo', async () => {
    // Dado
    naBolinha();
    const mais = screen.getByRole('button', { name: 'Pôr participante' });
    expect(mais).toHaveAttribute('aria-expanded', 'false');
    // Quando
    await userEvent.click(mais);
    // Então
    expect(mais).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('dialog', { name: 'Pôr participante' })).toBeInTheDocument();
    await vi.waitFor(() => expect(screen.getByRole('textbox', { name: 'Buscar na equipe: pôr participante' })).toHaveFocus());
  });

  it('quando a pessoa escolhe alguém, então a tela o recebe, o painel fecha e o foco volta à bolinha', async () => {
    // Dado
    const aoEscolher = vi.fn();
    naBolinha({ aoEscolher });
    await userEvent.click(screen.getByRole('button', { name: 'Pôr participante' }));
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Bruno Exemplo Souza' }));
    // Então
    expect(aoEscolher).toHaveBeenCalledWith(EQUIPE[1]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Pôr participante' })).toHaveFocus());
  });

  it('quando a pessoa tecla Esc, então o painel fecha e o foco volta à bolinha', async () => {
    // Dado
    naBolinha();
    await userEvent.click(screen.getByRole('button', { name: 'Pôr participante' }));
    // Quando
    await userEvent.keyboard('{Escape}');
    // Então
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pôr participante' })).toHaveFocus();
  });

  it('quando a pessoa clica de novo na bolinha aberta, então o painel fecha', async () => {
    // Dado
    naBolinha();
    const mais = screen.getByRole('button', { name: 'Pôr participante' });
    await userEvent.click(mais);
    // Quando
    await userEvent.click(mais);
    // Então
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mais).toHaveAttribute('aria-expanded', 'false');
  });

  it('dada a lista no máximo, quando a pessoa clica na bolinha, então ela vem desligada, com o motivo na dica, e a busca não abre', async () => {
    // Dado
    naBolinha({ desligado: true });
    const mais = screen.getByRole('button', { name: 'Pôr participante' });
    expect(mais).toHaveAttribute('aria-disabled', 'true');
    expect(mais).toHaveAttribute('data-dica', 'Cheia.');
    // Quando
    await userEvent.click(mais);
    // Então
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  // A regra mudou: antes a bolinha sumia, e o cartão ficava com o tracinho solto, sem dizer por que não dava para pôr ninguém.
  it('dado ninguém mais para entrar, quando a pessoa clica na bolinha, então ela vem desligada, com o motivo na dica, e a busca não abre', async () => {
    // Dado
    naBolinha({ buscar: () => [] });
    const mais = screen.getByRole('button', { name: 'Pôr participante' });
    expect(mais).toHaveAttribute('aria-disabled', 'true');
    expect(mais).toHaveAttribute('data-dica', 'Não há mais ninguém na equipe.');
    expect(mais).toHaveAccessibleDescription('Não há mais ninguém na equipe.');
    // Quando
    await userEvent.click(mais);
    // Então
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('dada a bolinha desligada, quando a pessoa chega a ela pelo Tab, então ela recebe o foco', async () => {
    // Dado
    naBolinha({ buscar: () => [] });
    // Quando
    await userEvent.tab();
    // Então
    expect(screen.getByRole('button', { name: 'Pôr participante' })).toHaveFocus();
  });
});
