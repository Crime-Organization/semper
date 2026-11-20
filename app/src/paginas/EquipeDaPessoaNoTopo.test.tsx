// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Os responsáveis da pessoa no topo do cartão (#387): bolinhas iguais, sem responsável principal; o "+" põe mais um e o menu da
// bolinha (#388) tira ou abre o perfil, pôr e tirar com o aviso e o Desfazer; a pessoa arquivada só mostra.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Pessoa } from '../dados';
import { EquipeDaPessoaNoTopo } from './EquipeDaPessoaNoTopo';

const { SD, feito } = vi.hoisted(() => ({
  SD: { responsavelIncluir: vi.fn<(p: string, u: string) => Promise<void>>(), responsavelRemover: vi.fn<(p: string, u: string) => Promise<void>>() },
  feito: vi.fn<(texto: string, oQue: string, acao: () => Promise<unknown>) => void>()
}));
vi.mock('../dados', async original => ({ ...await original<typeof import('../dados')>(), SD }));
vi.mock('../ui/avisos', async original => ({ ...await original<typeof import('../ui/avisos')>(), feito }));
const EQUIPE = [
  { id: 'u-ana', nome: 'Ana Teste Lima', ativo: true },
  { id: 'u-bruno', nome: 'Bruno Exemplo Souza', ativo: true },
  { id: 'u-mauro', nome: 'Mauro Teixeira Duarte', ativo: true }
];
vi.mock('../ui/sessao', () => ({ useCtx: () => ({ perfil: { id: 'u-mauro' }, equipe: EQUIPE, grupos: [], ehAdmin: true, escritorio: { modulos: {} } }) }));

/** Uma pessoa com a Ana e o Bruno de responsáveis. */
const PESSOA = { id: 'p1', resp: [{ perfil_id: 'u-ana' }, { perfil_id: 'u-bruno' }] } as unknown as Pessoa;
const responsaveis = () => screen.getByRole('group', { name: 'Equipe' });

beforeEach(() => {
  SD.responsavelIncluir.mockReset().mockResolvedValue();
  SD.responsavelRemover.mockReset().mockResolvedValue();
  feito.mockReset();
});

describe('Responsáveis da pessoa no topo do cartão', () => {
  // A regra mudou (#388, pedido do dono): a bolinha não tira mais na hora; ela abre um menu, e a dica é o nome e o papel.
  it('dada uma pessoa com dois responsáveis, quando o cartão abre, então os dois aparecem em bolinhas, com o nome na dica', () => {
    // Quando
    render(<MemoryRouter><EquipeDaPessoaNoTopo pessoa={PESSOA} depois={vi.fn()} /></MemoryRouter>);
    // Então
    expect(within(responsaveis()).getByRole('button', { name: 'Ana Teste Lima, Responsável' })).toHaveTextContent('AL');
    expect(within(responsaveis()).getByRole('button', { name: 'Bruno Exemplo Souza, Responsável' })).toHaveAttribute('data-dica', 'Bruno Exemplo Souza · Responsável');
  });

  it('dada a bolinha de um responsável, quando a pessoa clica nela, então abre o menu com "Tirar" e "Ver perfil", e ninguém sai', async () => {
    // Dado
    render(<MemoryRouter><EquipeDaPessoaNoTopo pessoa={PESSOA} depois={vi.fn()} /></MemoryRouter>);
    // Quando
    await userEvent.click(within(responsaveis()).getByRole('button', { name: 'Bruno Exemplo Souza, Responsável' }));
    // Então
    const menu = screen.getByRole('menu', { name: 'Bruno Exemplo Souza, Responsável' });
    expect(within(menu).getAllByRole('menuitem').map(i => i.textContent?.trim())).toEqual(['Tirar dos responsáveis', 'Ver perfil']);
    expect(within(menu).getByRole('menuitem', { name: 'Ver perfil' })).toHaveAttribute('href', '/equipe/perfil/?id=u-bruno');
    expect(SD.responsavelRemover).not.toHaveBeenCalled();
  });

  it('dado o "+", quando a pessoa escolhe alguém da equipe, então ele passa a ser responsável, com o aviso e o Desfazer', async () => {
    // Dado
    const depois = vi.fn();
    render(<MemoryRouter><EquipeDaPessoaNoTopo pessoa={PESSOA} depois={depois} /></MemoryRouter>);
    // Quando
    await userEvent.click(within(responsaveis()).getByRole('button', { name: 'Pôr responsável' }));
    const busca = screen.getByRole('dialog', { name: 'Pôr responsável' });
    expect(within(busca).getByRole('list', { name: 'Equipe' })).not.toHaveTextContent('Ana');
    await userEvent.click(within(busca).getByRole('button', { name: 'Mauro Teixeira Duarte' }));
    // Então
    expect(SD.responsavelIncluir).toHaveBeenCalledWith('p1', 'u-mauro');
    await vi.waitFor(() => expect(depois).toHaveBeenCalledTimes(1));
    expect(feito).toHaveBeenCalledWith('Mauro Teixeira Duarte agora é responsável.', 'inclusão do responsável', expect.any(Function));
    // Quando (o Desfazer)
    await feito.mock.calls[0][2]();
    // Então
    expect(SD.responsavelRemover).toHaveBeenCalledWith('p1', 'u-mauro');
  });

  it('quando a pessoa escolhe "Tirar dos responsáveis" no menu da bolinha de um, então ele sai, com o aviso e o Desfazer que o põe de volta', async () => {
    // Dado
    render(<MemoryRouter><EquipeDaPessoaNoTopo pessoa={PESSOA} depois={vi.fn()} /></MemoryRouter>);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Bruno Exemplo Souza, Responsável' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Tirar dos responsáveis' }));
    // Então
    expect(SD.responsavelRemover).toHaveBeenCalledWith('p1', 'u-bruno');
    await vi.waitFor(() => expect(feito).toHaveBeenCalledWith('Bruno Exemplo Souza saiu dos responsáveis.', 'retirada do responsável', expect.any(Function)));
    // Quando (o Desfazer)
    await feito.mock.calls[0][2]();
    // Então
    expect(SD.responsavelIncluir).toHaveBeenCalledWith('p1', 'u-bruno');
  });

  it('dada uma pessoa arquivada, quando o cartão abre, então as bolinhas aparecem só para ver, sem "+"', () => {
    // Quando
    render(<MemoryRouter><EquipeDaPessoaNoTopo pessoa={PESSOA} depois={null} /></MemoryRouter>);
    // Então
    expect(within(responsaveis()).getAllByRole('img').map(b => b.getAttribute('aria-label'))).toEqual(['Ana Teste Lima, Responsável', 'Bruno Exemplo Souza, Responsável']);
    expect(within(responsaveis()).queryByRole('button')).not.toBeInTheDocument();
  });
});
