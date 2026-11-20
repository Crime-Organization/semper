// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Os nomes são inventados.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { GrupoDaEquipe, Membro } from '../dados/tipos';
import { GruposDoItem, GruposNoCartao, GruposNoLapis } from './GruposDoItem';

vi.mock('./sessao', () => ({
  useCtx: () => ({ grupos: [{ id: 'ga', nome: 'Núcleo A', integrantes: [] }, { id: 'gb', nome: 'Núcleo Bê', integrantes: [] }] })
}));

const EQUIPE: Membro[] = [
  { id: 'u-ana', nome: 'Ana Exemplo', ativo: true }, { id: 'u-beto', nome: 'Beto Teste', ativo: true },
  { id: 'u-caio', nome: 'Caio Fictício', ativo: false }
];
const nucleoA: GrupoDaEquipe = { id: 'ga', nome: 'Núcleo A', integrantes: ['u-ana', 'u-beto', 'u-caio'] };
const nucleoB: GrupoDaEquipe = { id: 'gb', nome: 'Núcleo Bê', integrantes: ['u-beto'] };
const muitos = Array.from({ length: 10 }, (_, i): GrupoDaEquipe => ({ id: 'g' + i, nome: `Grupo número ${i} com um nome bem comprido`, integrantes: ['u-ana'] }));

describe('Grupos do item no quadro e na tabela (#378)', () => {
  it('dado um item sem grupos, quando a linha aparece, então não há pílula nenhuma', () => {
    // Quando
    const { container } = render(<GruposDoItem grupos={[]} equipe={EQUIPE} eu="u-ana" />);
    // Então
    expect(container).toBeEmptyDOMElement();
  });

  it('dados dois grupos, quando aparecem, então cada pílula diz o nome, os ativos e quem está, só para ver, sem botão', () => {
    // Quando
    render(<GruposDoItem grupos={[nucleoA, nucleoB]} equipe={EQUIPE} eu="u-ana" />);
    // Então
    const pilulas = screen.getAllByRole('img');
    expect(pilulas.map(p => p.getAttribute('aria-label'))).toEqual(['Grupo Núcleo A · 2 pessoas: Ana Exemplo e Beto Teste', 'Grupo Núcleo Bê · 1 pessoa: Beto Teste']);
    expect(pilulas[0]).toHaveTextContent('Núcleo A · 2');
    expect(pilulas[0]).toHaveAttribute('data-dica', 'Núcleo A · 2 pessoas: Ana Exemplo e Beto Teste. Você está neste grupo');
    expect(pilulas[1]).toHaveAttribute('data-dica', 'Núcleo Bê · 1 pessoa: Beto Teste');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('dados mais grupos do que cabem, quando aparecem, então os outros viram "+N", com os nomes', () => {
    // Quando
    render(<GruposDoItem grupos={muitos} equipe={EQUIPE} eu="u-ana" />);
    // Então
    const pilulas = screen.getAllByRole('img');
    expect(pilulas).toHaveLength(3);
    expect(pilulas[2]).toHaveTextContent('+8');
    expect(pilulas[2].getAttribute('aria-label')).toMatch(/^Mais 8: Grupo número 2/);
  });
});

describe('Grupos no topo do cartão (#378)', () => {
  it('quando a pessoa clica na pílula, então abre a lista de quem está, com "Você", e o grupo não sai do cartão', async () => {
    // Dado
    const tirar = vi.fn();
    render(<GruposNoCartao grupos={[nucleoA]} equipe={EQUIPE} eu="u-beto" tirar={tirar} />);
    const pilula = screen.getByRole('button', { name: 'Grupo Núcleo A, 2 pessoas. Ver quem está' });
    expect(pilula).toHaveAttribute('aria-haspopup', 'dialog');
    expect(pilula).toHaveAttribute('data-dica', 'Núcleo A · 2 pessoas: Ana Exemplo e Beto Teste. Você está neste grupo');
    // Quando
    await userEvent.click(pilula);
    // Então
    const painel = screen.getByRole('dialog', { name: 'Grupo Núcleo A' });
    const lista = within(painel).getByRole('list', { name: 'Integrantes do grupo Núcleo A' });
    expect(within(lista).getAllByRole('listitem').map(li => li.textContent)).toEqual(['AEAna Exemplo', 'BTBeto TesteVocê']);
    await vi.waitFor(() => expect(lista).toHaveFocus());
    expect(tirar).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Grupo Núcleo A/ })).toHaveAttribute('aria-expanded', 'true');
  });

  it('dada a lista aberta, quando a pessoa tecla Esc, então ela fecha e o foco volta à pílula', async () => {
    // Dado
    render(<GruposNoCartao grupos={[nucleoA]} equipe={EQUIPE} eu="u-ana" />);
    const pilula = screen.getByRole('button', { name: /Grupo Núcleo A/ });
    await userEvent.click(pilula);
    // Quando
    await userEvent.keyboard('{Escape}');
    // Então
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(pilula).toHaveFocus();
  });

  it('dado quem altera o cartão, quando escolhe "Tirar o grupo do cartão", então o cartão recebe o grupo e a lista fecha', async () => {
    // Dado
    const tirar = vi.fn();
    render(<GruposNoCartao grupos={[nucleoA, nucleoB]} equipe={EQUIPE} eu="u-ana" tirar={tirar} />);
    await userEvent.click(screen.getByRole('button', { name: /Grupo Núcleo Bê/ }));
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Tirar o grupo do cartão' }));
    // Então
    expect(tirar).toHaveBeenCalledWith(nucleoB);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('dado quem só lê o cartão, quando abre a lista, então não há "Tirar"; quem está só pelo grupo vê a nota', async () => {
    // Dado
    render(<GruposNoCartao grupos={[nucleoA]} equipe={EQUIPE} eu="u-beto" nota={g => `Você participa deste cartão pelo grupo ${g.nome}. Para sair, peça a um administrador.`} />);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: /Grupo Núcleo A/ }));
    // Então
    expect(screen.queryByRole('button', { name: 'Tirar o grupo do cartão' })).not.toBeInTheDocument();
    expect(screen.getByText('Você participa deste cartão pelo grupo Núcleo A. Para sair, peça a um administrador.')).toBeInTheDocument();
  });

  it('dados dez grupos, quando o topo aparece, então mostra três pílulas e "+7 grupos", que abre a lista dos outros', async () => {
    // Dado
    const tirar = vi.fn();
    render(<GruposNoCartao grupos={muitos} equipe={EQUIPE} eu="u-ana" tirar={tirar} />);
    expect(screen.getAllByRole('button', { name: /^Grupo Grupo número/ })).toHaveLength(3);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: /^\+7 grupos/ }));
    // Então
    const painel = screen.getByRole('dialog', { name: 'Grupos da equipe' });
    expect(within(painel).getAllByRole('region')).toHaveLength(7);
    await userEvent.click(within(painel).getByRole('button', { name: 'Tirar o grupo do cartão: Grupo número 9 com um nome bem comprido' }));
    expect(tirar).toHaveBeenCalledWith(muitos[9]);
  });

  it('dada uma mudança gravando, quando a lista abre, então o "Tirar" fica desligado', async () => {
    // Dado
    render(<GruposNoCartao grupos={[nucleoA]} equipe={EQUIPE} eu="u-ana" tirar={vi.fn()} ocupado />);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: /Grupo Núcleo A/ }));
    // Então
    expect(screen.getByRole('button', { name: 'Tirar o grupo do cartão' })).toBeDisabled();
  });
});

describe('Grupos no lápis (#378)', () => {
  it('dado um item com grupos, quando o lápis abre, então uma linha diz quais e onde mudá-los; sem grupos, nada', () => {
    // Quando
    const { rerender, container } = render(<GruposNoLapis ids={['gb', 'ga']} />);
    // Então
    expect(screen.getByText('Grupos: Núcleo Bê e Núcleo A (mude no topo do cartão)')).toBeInTheDocument();
    // Quando
    rerender(<GruposNoLapis ids={[]} />);
    // Então
    expect(container).toBeEmptyDOMElement();
  });
});
