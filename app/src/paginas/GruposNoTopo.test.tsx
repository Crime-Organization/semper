// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Os nomes são inventados.
// Os grupos da equipe no topo do cartão (#378): pôr pelo "+" e tirar pela lista da pílula; o grupo que é o único caminho da pessoa até
// o cartão não tem "Tirar" (ela deixaria de vê-lo, e o banco recusa), e o motivo manda pedir a um administrador.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FimDaMudanca } from './equipeNoCartao';
import { EquipeNoTopo } from './EquipeNoTopo';

const { mudarAEquipe, mudarOsGrupos, ctx } = vi.hoisted(() => ({
  mudarAEquipe: vi.fn<(...a: unknown[]) => Promise<FimDaMudanca>>(),
  mudarOsGrupos: vi.fn<(...a: unknown[]) => Promise<FimDaMudanca>>(),
  ctx: { atual: {} as Record<string, unknown> }
}));
vi.mock('./equipeNoCartao', () => ({ mudarAEquipe, mudarOsGrupos }));
vi.mock('../ui/sessao', () => ({ useCtx: () => ctx.atual }));

const EQUIPE = [
  { id: 'u-ana', nome: 'Ana Teste Lima', ativo: true },
  { id: 'u-bruno', nome: 'Bruno Exemplo Souza', ativo: true }
];
const ALFA = { id: 'ga', nome: 'Núcleo Alfa', integrantes: ['u-bruno'] }, BETA = { id: 'gb', nome: 'Núcleo Beta', integrantes: ['u-ana'] };
const entrar = (grupos = [ALFA, BETA]) => { ctx.atual = { perfil: { id: 'u-bruno', papel: 'usuario' }, equipe: EQUIPE, grupos, ehAdmin: false, escritorio: { modulos: {} } }; };

function montar(grupos: string[], podeSair = false) {
  const depois = vi.fn();
  render(<MemoryRouter><EquipeNoTopo modulo="demandas" id="d1" equipe={{ responsavel_id: 'u-ana', lista: [] }} grupos={grupos}
    mudar={{ saida: { podeSair }, depois, aoSair: vi.fn() }} /></MemoryRouter>);
  return { depois };
}

describe('Grupos da equipe no topo do cartão', () => {
  beforeEach(() => { vi.clearAllMocks(); entrar(); mudarOsGrupos.mockResolvedValue('gravou'); });

  it('quando a pessoa escolhe um grupo no "+", então ele é posto na demanda e o cartão lê de novo', async () => {
    // Dado
    const { depois } = montar(['ga']);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Pôr colaborador ou grupo' }));
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Pôr colaborador ou grupo' })).getByRole('button', { name: 'Grupo Núcleo Beta, 1 pessoa' }));
    // Então
    expect(mudarOsGrupos).toHaveBeenCalledWith('demandas', 'd1', 'porGrupo', BETA);
    expect(depois).toHaveBeenCalled();
  });

  it('dada a pessoa na demanda só pelo grupo, quando abre a pílula, então não há "Tirar": o motivo diz para pedir a um administrador', async () => {
    // Dado
    montar(['ga']);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: /Grupo Núcleo Alfa/ }));
    // Então
    expect(screen.getByText('Sem este grupo, você deixaria de participar deste cartão. Para sair, peça a um administrador.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tirar o grupo do cartão' })).not.toBeInTheDocument();
  });

  it('dada a pessoa na demanda por dois grupos, quando tira um deles, então ele sai, porque o outro a mantém no cartão', async () => {
    // Dado
    entrar([{ ...ALFA }, { ...BETA, integrantes: ['u-ana', 'u-bruno'] }]);
    const { depois } = montar(['ga', 'gb']);
    await userEvent.click(screen.getByRole('button', { name: /Grupo Núcleo Alfa/ }));
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Tirar o grupo do cartão' }));
    // Então
    expect(mudarOsGrupos).toHaveBeenCalledWith('demandas', 'd1', 'tirarGrupo', ALFA);
    expect(depois).toHaveBeenCalled();
  });

  it('dada a pessoa só lendo a demanda, quando abre a pílula do grupo dela, então lê como sair, sem "Tirar"', async () => {
    // Dado
    render(<MemoryRouter><EquipeNoTopo modulo="demandas" id="d1" equipe={{ responsavel_id: 'u-ana', lista: [] }} grupos={['ga']} mudar={null} /></MemoryRouter>);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: /Grupo Núcleo Alfa/ }));
    // Então
    expect(screen.getByText('Você participa deste cartão pelo grupo Núcleo Alfa. Para sair, peça a um administrador.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tirar o grupo do cartão' })).not.toBeInTheDocument();
  });

  it('dada a pessoa que grava fora do cartão (quem o criou, a administradora), quando tira o próprio grupo, então ele sai', async () => {
    // Dado
    montar(['ga'], true);
    await userEvent.click(screen.getByRole('button', { name: /Grupo Núcleo Alfa/ }));
    // Então: ela tira o grupo pelo botão, sem a nota que manda pedir a um administrador
    expect(screen.queryByText(/Para sair, peça a um administrador/)).not.toBeInTheDocument();
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Tirar o grupo do cartão' }));
    // Então
    expect(mudarOsGrupos).toHaveBeenCalledWith('demandas', 'd1', 'tirarGrupo', ALFA);
  });

  it('dado um escritório sem grupos, quando o topo aparece, então fica como sempre: sem pílula e com o "+" de sempre', async () => {
    // Dado
    entrar([]);
    montar([]);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Pôr colaborador' }));
    // Então
    expect(within(screen.getByRole('dialog', { name: 'Pôr colaborador' })).queryByRole('group')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Grupo / })).not.toBeInTheDocument();
  });
});
