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
  { id: 'u-mauro', nome: 'Mauro Teixeira Duarte', ativo: true, funcao: 'advogado' as const, pessoa_id: 'p-mauro' }
];
const EU = { id: 'u-mauro', pessoa_id: 'p-mauro', papel: 'master' };
/** Quem está logado em cada teste (o Mauro, administrador, se o teste não diz outro). */
let eu: typeof EU = EU;
vi.mock('../ui/sessao', () => ({ useCtx: () => ({ perfil: eu, equipe: EQUIPE, ehAdmin: true, escritorio: { modulos: {} } }) }));

/** Um contrato do Mauro, com o Bruno participante a 10% e um participante de fora da equipe (que fica nas Partes). */
const CONTRATO = {
  id: 'k1', responsavel_id: 'u-mauro', indicador_id: null, criado_por: 'u-mauro',
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
    expect(within(equipe()).getByRole('img', { name: 'Mauro Teixeira Duarte, Advogado responsável' })).toBeInTheDocument();
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
    expect(mudarAEquipeDoContrato).toHaveBeenCalledWith('k1', { tipo: 'por', id: 'p-ana', nome: 'Ana Teste Lima' }, EU, expect.any(Function));
    await vi.waitFor(() => expect(depois).toHaveBeenCalledTimes(1));
  });

  // A regra mudou (#388, pedido do dono): a bolinha abre um menu, e o "Tirar do contrato" fica nele.
  it('dado quem altera o contrato, quando escolhe "Tirar do contrato" no menu da bolinha do Bruno, então ele é tirado pela pessoa dele', async () => {
    // Dado
    render(<MemoryRouter><EquipeDoContratoNoTopo contrato={CONTRATO} depois={vi.fn()} /></MemoryRouter>);
    // Quando
    await userEvent.click(within(equipe()).getByRole('button', { name: 'Bruno Exemplo Souza, Participante · 10%' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Tirar do contrato' }));
    // Então
    expect(mudarAEquipeDoContrato).toHaveBeenCalledWith('k1', { tipo: 'tirar', id: 'p-bruno', nome: 'Bruno Exemplo Souza' }, EU, expect.any(Function));
  });

  it('dado o Bruno, participante que não é advogado, quando o menu dele abre, então "Tornar responsável" não aparece', async () => {
    // Dado
    render(<MemoryRouter><EquipeDoContratoNoTopo contrato={CONTRATO} depois={vi.fn()} /></MemoryRouter>);
    // Quando
    await userEvent.click(within(equipe()).getByRole('button', { name: 'Bruno Exemplo Souza, Participante · 10%' }));
    // Então
    const menu = screen.getByRole('menu', { name: 'Bruno Exemplo Souza, Participante · 10%' });
    expect(within(menu).queryByRole('menuitem', { name: 'Tornar responsável' })).not.toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: 'Tirar do contrato' })).toBeInTheDocument();
  });

  it('dada a Ana, participante advogada, quando a pessoa escolhe "Tornar responsável", então a troca é pedida pelo usuário dela, sabendo a pessoa do Mauro', async () => {
    // Dado
    const comAna = { ...CONTRATO, participantes: [...CONTRATO.participantes, { pessoa: { id: 'p-ana', codigo: '3', nome: 'ANA TESTE LIMA', tipo: 'pf' }, percentual: 0 }] } as unknown as Contrato;
    render(<MemoryRouter><EquipeDoContratoNoTopo contrato={comAna} depois={vi.fn()} /></MemoryRouter>);
    // Quando
    await userEvent.click(within(equipe()).getByRole('button', { name: 'Ana Teste Lima, Participante · 0%' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Tornar responsável' }));
    // Então
    expect(mudarAEquipeDoContrato).toHaveBeenCalledWith('k1', { tipo: 'tornarResponsavel', id: 'u-ana', nome: 'Ana Teste Lima' }, EU, expect.any(Function));
    // A pessoa do Mauro, responsável de agora, é a que continua como participante.
    const pessoaDe = mudarAEquipeDoContrato.mock.calls[0][3] as (perfilId: string) => string | null | undefined;
    expect(pessoaDe('u-mauro')).toBe('p-mauro');
  });

  it('dado quem altera o contrato, quando troca o responsável pelo menu, então a busca mostra só os outros advogados e a troca é pedida pelo usuário', async () => {
    // Dado
    render(<MemoryRouter><EquipeDoContratoNoTopo contrato={CONTRATO} depois={vi.fn()} /></MemoryRouter>);
    // Quando
    await userEvent.click(within(equipe()).getByRole('button', { name: 'Mauro Teixeira Duarte, Advogado responsável' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Trocar o responsável' }));
    const busca = screen.getByRole('dialog', { name: 'Trocar o responsável' });
    // Então: o Bruno é estagiário, e o Mauro já responde pelo contrato
    expect(within(within(busca).getByRole('list', { name: 'Equipe' })).getAllByRole('button').map(b => b.textContent)).toEqual(['Ana Teste Lima']);
    await userEvent.click(within(busca).getByRole('button', { name: 'Ana Teste Lima' }));
    expect(mudarAEquipeDoContrato).toHaveBeenCalledWith('k1', { tipo: 'responsavel', id: 'u-ana', nome: 'Ana Teste Lima' }, EU, expect.any(Function));
  });

  it('dado um pedido ainda gravando, quando abre o menu de outra bolinha, então o aviso de gravando aparece no lugar das ações e nada é pedido em paralelo', async () => {
    // Dado
    let responder: (f: FimNoContrato) => void = () => {};
    mudarAEquipeDoContrato.mockImplementationOnce(() => new Promise(r => { responder = r; }));
    const depois = vi.fn();
    render(<MemoryRouter><EquipeDoContratoNoTopo contrato={CONTRATO} depois={depois} /></MemoryRouter>);
    await userEvent.click(within(equipe()).getByRole('button', { name: 'Bruno Exemplo Souza, Participante · 10%' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Tirar do contrato' }));
    // Quando
    await userEvent.click(within(equipe()).getByRole('button', { name: 'Bruno Exemplo Souza, Participante · 10%' }));
    // Então
    expect(screen.queryByRole('menuitem', { name: 'Tirar do contrato' })).not.toBeInTheDocument();
    expect(screen.getByRole('menu', { name: 'Bruno Exemplo Souza, Participante · 10%' })).toHaveTextContent('Gravando a mudança na equipe…');
    expect(mudarAEquipeDoContrato).toHaveBeenCalledTimes(1);
    await act(async () => responder('gravou'));
    expect(depois).toHaveBeenCalledTimes(1);
  });

  it('dado o Bruno, participante que não cadastrou o contrato nem o administra, quando abre o menu da própria bolinha, então o motivo aparece no lugar do "Sair" e nada é pedido', async () => {
    // Dado
    eu = { id: 'u-bruno', pessoa_id: 'p-bruno', papel: 'usuario' };
    render(<MemoryRouter><EquipeDoContratoNoTopo contrato={CONTRATO} depois={vi.fn()} /></MemoryRouter>);
    // Quando
    await userEvent.click(within(equipe()).getByRole('button', { name: 'Bruno Exemplo Souza, Participante · 10%' }));
    // Então
    const menu = screen.getByRole('menu', { name: 'Bruno Exemplo Souza, Participante · 10%' });
    expect(within(menu).queryByRole('menuitem', { name: 'Sair do contrato' })).not.toBeInTheDocument();
    expect(menu).toHaveTextContent(FICARIA_FORA.tirar);
    expect(mudarAEquipeDoContrato).not.toHaveBeenCalled();
    // Quando: o menu do responsável continua trocando, porque o Bruno segue no contrato como participante.
    await userEvent.keyboard('{Escape}');
    await userEvent.click(within(equipe()).getByRole('button', { name: 'Mauro Teixeira Duarte, Advogado responsável' }));
    // Então
    expect(screen.getByRole('menuitem', { name: 'Trocar o responsável' })).toBeInTheDocument();
  });

  it('dada a Ana, responsável que não participa nem cadastrou o contrato, quando abre o menu da bolinha dela, então o motivo aparece no lugar de "Trocar" e a busca não abre', async () => {
    // Dado
    eu = { id: 'u-ana', pessoa_id: 'p-ana', papel: 'usuario' };
    render(<MemoryRouter><EquipeDoContratoNoTopo contrato={{ ...CONTRATO, responsavel_id: 'u-ana' }} depois={vi.fn()} /></MemoryRouter>);
    // Quando
    await userEvent.click(within(equipe()).getByRole('button', { name: 'Ana Teste Lima, Advogado responsável' }));
    // Então
    const menu = screen.getByRole('menu', { name: 'Ana Teste Lima, Advogado responsável' });
    expect(within(menu).queryByRole('menuitem', { name: 'Trocar o responsável' })).not.toBeInTheDocument();
    expect(menu).toHaveTextContent(FICARIA_FORA.responsavel);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mudarAEquipeDoContrato).not.toHaveBeenCalled();
  });
});
