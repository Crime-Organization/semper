// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// A equipe no topo do cartão do contrato (#356): as bolinhas pedem a mudança pela pessoa do cadastro (é ela que o contrato guarda),
// mostram o % de cada participante e fazem uma mudança de cada vez.
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Contrato } from '../dados';
import { FICARIA_FORA } from '../regras/equipeDoContrato';
import type { FimNoContrato } from './equipeDoContrato';
import { EquipeDoContratoNoTopo } from './EquipeDoContratoNoTopo';

const { mudarAEquipeDoContrato } = vi.hoisted(() => ({ mudarAEquipeDoContrato: vi.fn<(...a: unknown[]) => Promise<FimNoContrato>>() }));
vi.mock('./equipeDoContrato', () => ({ mudarAEquipeDoContrato }));
const EQUIPE = [
  { id: 'u-ana', nome: 'Ana Teste Lima', ativo: true, funcao: 'advogado' as const, pessoa_id: 'p-ana' },
  { id: 'u-bruno', nome: 'Bruno Exemplo Souza', ativo: true, funcao: 'estagiario' as const, pessoa_id: 'p-bruno' },
  { id: 'u-mateus', nome: 'Mateus Freitas Gonçalves', ativo: true, funcao: 'advogado' as const, pessoa_id: 'p-mateus' }
];
const EU = { id: 'u-mateus', pessoa_id: 'p-mateus', papel: 'master' };
/** Quem está logado em cada teste (o Mateus, administrador, se o teste não diz outro). */
let eu: typeof EU = EU;
vi.mock('../ui/sessao', () => ({ useCtx: () => ({ perfil: eu, equipe: EQUIPE, ehAdmin: true, escritorio: { modulos: {} } }) }));

/** Um contrato do Mateus, com o Bruno participante a 10% e um participante de fora da equipe (que fica nas Partes). */
const CONTRATO = {
  id: 'k1', responsavel_id: 'u-mateus', indicador_id: null, criado_por: 'u-mateus',
  participantes: [
    { pessoa: { id: 'p-bruno', codigo: '2', nome: 'BRUNO EXEMPLO SOUZA', tipo: 'pf' }, percentual: 10 },
    { pessoa: { id: 'p-fora', codigo: '9', nome: 'PARCEIRO DE FORA', tipo: 'pf' }, percentual: 5 }
  ]
} as unknown as Contrato;
const equipe = () => screen.getByRole('group', { name: 'Equipe' });

beforeEach(() => { eu = EU; mudarAEquipeDoContrato.mockReset(); mudarAEquipeDoContrato.mockResolvedValue('gravou'); });

describe('Equipe no topo do cartão do contrato', () => {
  it('dado quem só lê o contrato, quando o cartão abre, então as bolinhas mostram o responsável e o % do participante da equipe, sem ação', () => {
    // Quando
    render(<MemoryRouter><EquipeDoContratoNoTopo contrato={CONTRATO} depois={null} /></MemoryRouter>);
    // Então
    expect(within(equipe()).getByRole('img', { name: 'Mateus Freitas Gonçalves, Advogado responsável' })).toBeInTheDocument();
    expect(within(equipe()).getByRole('img', { name: 'Bruno Exemplo Souza, Participante · 10%' })).toBeInTheDocument();
    expect(within(equipe()).queryByRole('button')).not.toBeInTheDocument();
    expect(equipe()).not.toHaveTextContent('PARCEIRO');
  });

  it('dado quem altera o contrato, quando põe a Ana pelo "+", então a mudança é pedida pela pessoa dela, e a busca não mostra quem já participa', async () => {
    // Dado
    const depois = vi.fn();
    render(<MemoryRouter><EquipeDoContratoNoTopo contrato={CONTRATO} depois={depois} /></MemoryRouter>);
    // Quando
    await userEvent.click(within(equipe()).getByRole('button', { name: 'Pôr participante' }));
    const busca = screen.getByRole('dialog', { name: 'Pôr participante' });
    expect(within(busca).getByRole('list', { name: 'Equipe' })).not.toHaveTextContent('Bruno');
    await userEvent.click(within(busca).getByRole('button', { name: 'Ana Teste Lima' }));
    // Então
    expect(mudarAEquipeDoContrato).toHaveBeenCalledWith('k1', { tipo: 'por', id: 'p-ana', nome: 'Ana Teste Lima' }, EU);
    await vi.waitFor(() => expect(depois).toHaveBeenCalledTimes(1));
  });

  it('dado quem altera o contrato, quando clica na bolinha do Bruno, então ele é tirado pela pessoa dele', async () => {
    // Dado
    render(<MemoryRouter><EquipeDoContratoNoTopo contrato={CONTRATO} depois={vi.fn()} /></MemoryRouter>);
    // Quando
    await userEvent.click(within(equipe()).getByRole('button', { name: 'Tirar Bruno Exemplo Souza · 10%' }));
    // Então
    expect(mudarAEquipeDoContrato).toHaveBeenCalledWith('k1', { tipo: 'tirar', id: 'p-bruno', nome: 'Bruno Exemplo Souza' }, EU);
  });

  it('dado quem altera o contrato, quando troca o responsável, então a busca mostra só os outros advogados e a troca é pedida pelo usuário', async () => {
    // Dado
    render(<MemoryRouter><EquipeDoContratoNoTopo contrato={CONTRATO} depois={vi.fn()} /></MemoryRouter>);
    // Quando
    await userEvent.click(within(equipe()).getByRole('button', { name: 'Mateus Freitas Gonçalves, Advogado responsável. Trocar o responsável' }));
    const busca = screen.getByRole('dialog', { name: 'Trocar o responsável' });
    // Então: o Bruno é estagiário, e o Mateus já responde pelo contrato
    expect(within(within(busca).getByRole('list', { name: 'Equipe' })).getAllByRole('button').map(b => b.textContent)).toEqual(['Ana Teste Lima']);
    await userEvent.click(within(busca).getByRole('button', { name: 'Ana Teste Lima' }));
    expect(mudarAEquipeDoContrato).toHaveBeenCalledWith('k1', { tipo: 'responsavel', id: 'u-ana', nome: 'Ana Teste Lima' }, EU);
  });

  it('dado um pedido ainda gravando, quando clica em outra bolinha, então nada é pedido em paralelo', async () => {
    // Dado
    let responder: (f: FimNoContrato) => void = () => {};
    mudarAEquipeDoContrato.mockImplementationOnce(() => new Promise(r => { responder = r; }));
    const depois = vi.fn();
    render(<MemoryRouter><EquipeDoContratoNoTopo contrato={CONTRATO} depois={depois} /></MemoryRouter>);
    await userEvent.click(within(equipe()).getByRole('button', { name: 'Tirar Bruno Exemplo Souza · 10%' }));
    // Quando
    await userEvent.click(within(equipe()).getByRole('button', { name: 'Tirar Bruno Exemplo Souza · 10%' }));
    // Então
    expect(mudarAEquipeDoContrato).toHaveBeenCalledTimes(1);
    await act(async () => responder('gravou'));
    expect(depois).toHaveBeenCalledTimes(1);
  });

  it('dado o Bruno, participante que não cadastrou o contrato nem o administra, quando clica na própria bolinha, então ela vem desligada com o motivo e nada é pedido', async () => {
    // Dado
    eu = { id: 'u-bruno', pessoa_id: 'p-bruno', papel: 'usuario' };
    render(<MemoryRouter><EquipeDoContratoNoTopo contrato={CONTRATO} depois={vi.fn()} /></MemoryRouter>);
    const propria = within(equipe()).getByRole('button', { name: 'Bruno Exemplo Souza, Participante · 10%' });
    expect(propria).toHaveAttribute('aria-disabled', 'true');
    expect(propria).toHaveAttribute('aria-description', FICARIA_FORA.tirar);
    // Quando
    await userEvent.click(propria);
    // Então
    expect(mudarAEquipeDoContrato).not.toHaveBeenCalled();
    // A bolinha do responsável continua trocando: o Bruno segue no contrato como participante.
    expect(within(equipe()).getByRole('button', { name: 'Mateus Freitas Gonçalves, Advogado responsável. Trocar o responsável' })).not.toHaveAttribute('aria-disabled');
  });

  it('dada a Ana, responsável que não participa nem cadastrou o contrato, quando clica na bolinha dela, então ela vem desligada com o motivo e a busca não abre', async () => {
    // Dado
    eu = { id: 'u-ana', pessoa_id: 'p-ana', papel: 'usuario' };
    render(<MemoryRouter><EquipeDoContratoNoTopo contrato={{ ...CONTRATO, responsavel_id: 'u-ana' }} depois={vi.fn()} /></MemoryRouter>);
    const dela = within(equipe()).getByRole('button', { name: 'Ana Teste Lima, Advogado responsável' });
    expect(dela).toHaveAttribute('aria-description', FICARIA_FORA.responsavel);
    // Quando
    await userEvent.click(dela);
    // Então
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mudarAEquipeDoContrato).not.toHaveBeenCalled();
  });
});
