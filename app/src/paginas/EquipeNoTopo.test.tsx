// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// A equipe no topo do cartão (#356) faz uma mudança de cada vez: cada uma lê a equipe e grava a lista inteira, e duas ao mesmo
// tempo leriam a mesma equipe, com a segunda apagando o que a primeira pôs.
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import type { FimDaMudanca } from './equipeNoCartao';
import { EquipeNoTopo } from './EquipeNoTopo';

const { mudarAEquipe } = vi.hoisted(() => ({ mudarAEquipe: vi.fn<(...a: unknown[]) => Promise<FimDaMudanca>>() }));
vi.mock('./equipeNoCartao', () => ({ mudarAEquipe }));
const EQUIPE = [
  { id: 'u-ana', nome: 'Ana Teste Lima', ativo: true },
  { id: 'u-bruno', nome: 'Bruno Exemplo Souza', ativo: true },
  { id: 'u-mauro', nome: 'Mauro Teixeira Duarte', ativo: true }
];
vi.mock('../ui/sessao', () => ({ useCtx: () => ({ perfil: { id: 'u-mauro', papel: 'usuario' }, equipe: EQUIPE, ehAdmin: false, escritorio: { modulos: {} } }) }));

/** Põe alguém pelo "+": abre a busca e escolhe pelo nome. */
async function porPelaBolinha(nome: string) {
  await userEvent.click(screen.getByRole('button', { name: 'Pôr participante' }));
  await userEvent.click(within(screen.getByRole('dialog', { name: 'Pôr participante' })).getByRole('button', { name: nome }));
}

describe('Equipe no topo do cartão: uma mudança de cada vez', () => {
  it('dado um pedido ainda gravando, quando a pessoa tenta pôr outra pessoa, então nada é gravado em paralelo e o "+" volta quando a gravação termina', async () => {
    // Dado: a primeira gravação não respondeu
    let responder: (f: FimDaMudanca) => void = () => {};
    mudarAEquipe.mockImplementationOnce(() => new Promise(r => { responder = r; }));
    const depois = vi.fn();
    render(<MemoryRouter><EquipeNoTopo modulo="tarefas" id="t1" equipe={{ responsavel_id: 'u-ana', lista: [] }}
      mudar={{ saida: { podeSair: true }, depois, aoSair: vi.fn() }} /></MemoryRouter>);
    await porPelaBolinha('Bruno Exemplo Souza');
    expect(mudarAEquipe).toHaveBeenCalledTimes(1);
    // Quando
    const mais = screen.getByRole('button', { name: 'Pôr participante' });
    expect(mais).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(mais);
    // Então
    expect(screen.queryByRole('dialog', { name: 'Pôr participante' })).not.toBeInTheDocument();
    expect(mudarAEquipe).toHaveBeenCalledTimes(1);
    await act(async () => responder('gravou'));
    expect(depois).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Pôr participante' })).not.toHaveAttribute('aria-disabled');
  });
});

describe('Equipe no topo do cartão: o menu das bolinhas (#388)', () => {
  const montar = () => render(<MemoryRouter><EquipeNoTopo modulo="demandas" id="d1" equipe={{ responsavel_id: 'u-ana', lista: ['u-bruno', 'u-mauro'] }}
    mudar={{ saida: { podeSair: true }, depois: vi.fn(), aoSair: vi.fn() }} /></MemoryRouter>);

  it('dado um colaborador, quando a pessoa escolhe "Tornar responsável" no menu dele, então a demanda pede essa mudança, sem tirar ninguém', async () => {
    // Dado
    mudarAEquipe.mockReset().mockResolvedValue('gravou');
    montar();
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Bruno Exemplo Souza, Colaborador' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Tornar responsável' }));
    // Então
    expect(mudarAEquipe).toHaveBeenCalledWith('demandas', 'd1', { tipo: 'tornarResponsavel', id: 'u-bruno', nome: 'Bruno Exemplo Souza' }, { eu: 'u-mauro', podeSair: true, peloLigado: false });
  });

  it('dada a própria bolinha, quando o menu abre, então ele diz "Sair da demanda" no lugar de "Tirar"; e o perfil de outra pessoa, só com um administrador', async () => {
    // Dado
    montar();
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Mauro Teixeira Duarte, Colaborador' }));
    // Então
    expect(within(screen.getByRole('menu')).getAllByRole('menuitem').map(i => i.textContent?.trim())).toEqual(['Tornar responsável', 'Sair da demanda', 'Ver perfil']);
    expect(screen.getByRole('menuitem', { name: 'Ver perfil' })).toHaveAttribute('href', '/minha-conta/');
    // Quando
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('button', { name: 'Bruno Exemplo Souza, Colaborador' }));
    // Então
    expect(screen.getByRole('menuitem', { name: 'Tirar da demanda' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Ver perfil' })).not.toBeInTheDocument();
    expect(screen.getByRole('menu')).toHaveTextContent('Só um administrador abre o perfil de outra pessoa.');
  });
});

describe('Equipe no topo do cartão: quem foi desativado (#388)', () => {
  it('dado um colaborador desativado que continua na demanda, quando o menu dele abre, então o motivo fica no lugar de "Tornar responsável" e nada é pedido', async () => {
    // Dado
    mudarAEquipe.mockReset().mockResolvedValue('gravou');
    EQUIPE.push({ id: 'u-davi', nome: 'Davi Desligado', ativo: false });
    try {
      render(<MemoryRouter><EquipeNoTopo modulo="demandas" id="d1" equipe={{ responsavel_id: 'u-ana', lista: ['u-davi'] }}
        mudar={{ saida: { podeSair: true }, depois: vi.fn(), aoSair: vi.fn() }} /></MemoryRouter>);
      // Quando
      await userEvent.click(screen.getByRole('button', { name: 'Davi Desligado, Colaborador' }));
      // Então
      const menu = screen.getByRole('menu');
      expect(within(menu).queryByRole('menuitem', { name: 'Tornar responsável' })).not.toBeInTheDocument();
      expect(menu).toHaveTextContent('Quem está desativado na equipe não pode ser o responsável.');
      expect(within(menu).getByRole('menuitem', { name: 'Tirar da demanda' })).toBeInTheDocument();
      expect(mudarAEquipe).not.toHaveBeenCalled();
    } finally {
      EQUIPE.pop();
    }
  });
});
