// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// A regra mudou (pedido do dono, 18/11): clicar numa bolinha não abre mais a ficha com o nome e as opções. O nome aparece na
// dica; a bolinha do responsável abre direto a troca, a de um participante o tira na hora, e sem responsável há a bolinha vazia.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import type { Membro } from '../dados';
import { GRUPOS_POR_ITEM } from '../dados/limites';
import { EquipeDoCartao, type GruposDoCartao, type MudarAEquipe } from './EquipeDoCartao';

const ana = { id: 'u-ana', nome: 'Ana Teste Lima', papel: 'Responsável' };
const bruno = { id: 'u-bruno', nome: 'Bruno Exemplo Souza', papel: 'Participante · 10%' };
const mateus = { id: 'u-mateus', nome: 'Mateus Freitas Gonçalves', papel: 'Participante' };
const grupo = () => screen.getByRole('group', { name: 'Equipe' });

describe('Equipe do cartão, para quem só lê', () => {
  it('quando o cartão tem responsável e participantes, então cada um é uma bolinha com as iniciais, o responsável primeiro, com o nome na dica', () => {
    // Quando
    render(<MemoryRouter><EquipeDoCartao responsavel={ana} participantes={[bruno, mateus]} /></MemoryRouter>);
    // Então
    const bolinhas = within(grupo()).getAllByRole('img');
    expect(bolinhas.map(b => b.getAttribute('aria-label'))).toEqual(['Ana Teste Lima, Responsável', 'Bruno Exemplo Souza, Participante · 10%',
      'Mateus Freitas Gonçalves, Participante']);
    expect(bolinhas.map(b => b.textContent)).toEqual(['AL', 'BS', 'MG']);
    expect(bolinhas[0]).toHaveAttribute('data-dica', 'Ana Teste Lima · Responsável');
    // Só a dica da bolinha: a do navegador (o title do Avatar) não aparece por cima dela.
    expect(grupo().querySelectorAll('[title]')).toHaveLength(0);
  });

  it('quando a pessoa chega a uma bolinha pelo Tab, então ela recebe o foco (e a dica aparece), mas não há botão nem "+"', async () => {
    // Dado
    render(<MemoryRouter><EquipeDoCartao responsavel={ana} participantes={[bruno]} /></MemoryRouter>);
    // Quando
    await userEvent.tab();
    // Então
    expect(screen.getByRole('img', { name: 'Ana Teste Lima, Responsável' })).toHaveFocus();
    expect(within(grupo()).queryByRole('button')).not.toBeInTheDocument();
  });

  it('dado um cartão sem responsável, quando aparece, então a bolinha dele vem vazia, dizendo que não há responsável', () => {
    // Quando
    render(<MemoryRouter><EquipeDoCartao responsavel={null} participantes={[]} /></MemoryRouter>);
    // Então
    expect(screen.getByRole('img', { name: 'Sem responsável' })).toHaveTextContent('');
  });
});

describe('Equipe do cartão que a pessoa pode alterar (#356)', () => {
  const EQUIPE: Membro[] = [
    { id: 'u-ana', nome: 'Ana Teste Lima', ativo: true },
    { id: 'u-bruno', nome: 'Bruno Exemplo Souza', ativo: true },
    { id: 'u-mateus', nome: 'Mateus Freitas Gonçalves', ativo: true }
  ];
  const mudar = (extra: Partial<MudarAEquipe> = {}): MudarAEquipe => ({
    por: 'Pôr participante', candidatos: () => [EQUIPE[2]], responsaveis: () => [EQUIPE[1], EQUIPE[2]], tirar: p => `Tirar ${p.nome}`,
    aoPor: vi.fn(), aoTirar: vi.fn(), aoTrocarResponsavel: vi.fn(), ...extra
  });
  const montar = (m: MudarAEquipe, participantes = [bruno], responsavel: typeof ana | null = ana) =>
    render(<MemoryRouter><EquipeDoCartao responsavel={responsavel} participantes={participantes} mudar={m} /></MemoryRouter>);
  const responsavel = () => screen.getByRole('button', { name: 'Ana Teste Lima, Responsável. Trocar o responsável' });

  it('dado um cartão sem participantes, quando abre, então aparecem o responsável e a bolinha com "+"', () => {
    // Quando
    montar(mudar(), []);
    // Então
    const bolinhas = within(grupo()).getAllByRole('button');
    expect(bolinhas.map(b => b.getAttribute('aria-label'))).toEqual(['Ana Teste Lima, Responsável. Trocar o responsável', 'Pôr participante']);
    expect(bolinhas[0]).toHaveAttribute('data-dica', 'Ana Teste Lima · Responsável. Clique para trocar.');
  });

  it('dadas as bolinhas de quem altera, quando a pessoa passa o mouse, então só a dica da bolinha aparece ("Tirar Bruno"), sem a do navegador com o nome', () => {
    // Quando
    montar(mudar());
    // Então
    expect(screen.getByRole('button', { name: 'Tirar Bruno Exemplo Souza' })).toHaveAttribute('data-dica', 'Tirar Bruno Exemplo Souza');
    expect(grupo().querySelectorAll('[title]')).toHaveLength(0);
  });

  it('dado um escritório sem outra pessoa para assumir, quando o cartão abre, então a bolinha do responsável vem desligada e a dica diz só isso, sem "clique para trocar"', async () => {
    // Dado
    const m = mudar({ responsaveis: () => [] });
    montar(m);
    // Então
    const bolinha = screen.getByRole('button', { name: 'Ana Teste Lima, Responsável' });
    expect(bolinha).toHaveAttribute('aria-disabled', 'true');
    expect(bolinha).toHaveAttribute('data-dica', 'Ana Teste Lima · Responsável. Não há outra pessoa na equipe para assumir.');
    // Quando
    await userEvent.click(bolinha);
    // Então
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('quando a pessoa escolhe alguém na busca do "+", então a tela o recebe para pôr como participante, e a lista mostra só os nomes', async () => {
    // Dado
    const m = mudar();
    montar(m);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Pôr participante' }));
    const achado = within(screen.getByRole('list', { name: 'Equipe' })).getByRole('button', { name: 'Mateus Freitas Gonçalves' });
    expect(achado).toHaveTextContent(/^Mateus Freitas Gonçalves$/);
    await userEvent.click(achado);
    // Então
    expect(m.aoPor).toHaveBeenCalledWith(EQUIPE[2]);
  });

  it('quando a pessoa clica na bolinha de um participante, então ele sai na hora, sem ficha no meio, e o foco vai à bolinha com "+"', async () => {
    // Dado
    const m = mudar();
    montar(m);
    const bolinha = screen.getByRole('button', { name: 'Tirar Bruno Exemplo Souza' });
    expect(bolinha).toHaveAttribute('data-dica', 'Tirar Bruno Exemplo Souza');
    // Quando
    await userEvent.click(bolinha);
    // Então
    expect(m.aoTirar).toHaveBeenCalledWith(bruno);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Pôr participante' })).toHaveFocus());
  });

  it('quando a pessoa clica na bolinha do responsável, então a busca de trocá-lo abre direto e a tela recebe o novo; o foco volta à bolinha', async () => {
    // Dado
    const m = mudar();
    montar(m);
    // Quando
    await userEvent.click(responsavel());
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Trocar o responsável' })).getByRole('button', { name: 'Bruno Exemplo Souza' }));
    // Então
    expect(m.aoTrocarResponsavel).toHaveBeenCalledWith(EQUIPE[1]);
    await vi.waitFor(() => expect(responsavel()).toHaveFocus());
  });

  it('dado um cartão sem responsável, quando a pessoa clica na bolinha vazia, então escolhe um responsável', async () => {
    // Dado
    const m = mudar();
    montar(m, [], null);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Sem responsável. Escolher o responsável' }));
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Trocar o responsável' })).getByRole('button', { name: 'Mateus Freitas Gonçalves' }));
    // Então
    expect(m.aoTrocarResponsavel).toHaveBeenCalledWith(EQUIPE[2]);
  });

  it('dada a lista cheia, quando o cartão abre, então a bolinha com "+" vem desligada, com o motivo na dica', () => {
    // Quando
    montar(mudar({ cheia: 'Uma tarefa pode ter até 20 participantes.' }));
    // Então
    expect(screen.getByRole('button', { name: 'Pôr participante' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: 'Pôr participante' })).toHaveAttribute('data-dica', 'Uma tarefa pode ter até 20 participantes.');
  });

  it('dada uma mudança ainda gravando, quando a pessoa tenta pôr, tirar ou trocar alguém, então nada acontece até ela terminar', async () => {
    // Dado
    const m = mudar({ ocupado: true });
    montar(m);
    const mais = screen.getByRole('button', { name: 'Pôr participante' });
    expect(mais).toHaveAttribute('aria-disabled', 'true');
    expect(mais).toHaveAttribute('data-dica', 'Gravando a mudança na equipe…');
    // Quando
    await userEvent.click(mais);
    await userEvent.click(screen.getByRole('button', { name: 'Tirar Bruno Exemplo Souza' }));
    await userEvent.click(responsavel());
    // Então
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(m.aoPor).not.toHaveBeenCalled();
    expect(m.aoTirar).not.toHaveBeenCalled();
  });

  it('dado um participante que não pode sair, quando a pessoa clica na bolinha dele, então ela vem desligada, com o motivo na dica, e nada muda nem o foco sai do lugar', async () => {
    // Dado
    const motivo = 'Você não pode sair deste contrato.';
    const m = mudar({ impedeTirar: p => p.id === bruno.id ? motivo : undefined });
    montar(m, [bruno, mateus]);
    const bolinha = screen.getByRole('button', { name: 'Bruno Exemplo Souza, Participante · 10%' });
    expect(bolinha).toHaveAttribute('aria-disabled', 'true');
    expect(bolinha).toHaveAttribute('data-dica', `Bruno Exemplo Souza · Participante · 10% · ${motivo}`);
    expect(bolinha).toHaveAttribute('aria-description', motivo);
    // Quando
    await userEvent.click(bolinha);
    // Então
    expect(m.aoTirar).not.toHaveBeenCalled();
    expect(bolinha).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Tirar Mateus Freitas Gonçalves' })).not.toHaveAttribute('aria-disabled');
  });

  it('dado um responsável que não pode passar o cartão adiante, quando a pessoa clica na bolinha dele, então ela vem desligada, com o motivo na dica, e a busca não abre', async () => {
    // Dado
    const motivo = 'Você não pode passar este contrato a outro advogado.';
    const m = mudar({ impedeTrocar: motivo });
    montar(m);
    const bolinha = screen.getByRole('button', { name: 'Ana Teste Lima, Responsável' });
    expect(bolinha).toHaveAttribute('aria-disabled', 'true');
    expect(bolinha).toHaveAttribute('data-dica', `Ana Teste Lima · Responsável · ${motivo}`);
    // Quando
    await userEvent.click(bolinha);
    // Então
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(m.aoTrocarResponsavel).not.toHaveBeenCalled();
  });

  it('dado um cartão com todos da equipe ativa dentro, quando a pessoa tira um participante, então o foco vai à bolinha com "+", sem se perder', async () => {
    // Dado
    const m = mudar({ candidatos: () => [] });
    montar(m);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Tirar Bruno Exemplo Souza' }));
    // Então
    expect(m.aoTirar).toHaveBeenCalledWith(bruno);
    await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Pôr participante' })).toHaveFocus());
  });
});

describe('Equipe do cartão com grupos da equipe (#378)', () => {
  const EQUIPE: Membro[] = [{ id: 'u-ana', nome: 'Ana Teste Lima', ativo: true }, { id: 'u-bruno', nome: 'Bruno Exemplo Souza', ativo: true }];
  const NUCLEO = { id: 'ga', nome: 'Núcleo Alfa', integrantes: ['u-bruno'] }, OUTRO = { id: 'gb', nome: 'Núcleo Beta', integrantes: ['u-ana'] };
  const mudar = (extra: Partial<MudarAEquipe> = {}): MudarAEquipe => ({
    por: 'Pôr colaborador', candidatos: () => [EQUIPE[1]], responsaveis: () => [EQUIPE[1]], tirar: p => `Tirar ${p.nome}`,
    aoPor: vi.fn(), aoTirar: vi.fn(), aoTrocarResponsavel: vi.fn(), ...extra
  });
  const grupos = (extra: Partial<NonNullable<GruposDoCartao['mudar']>> = {}, doItem = [NUCLEO]): GruposDoCartao => ({
    doItem, equipe: EQUIPE, eu: 'u-ana',
    mudar: { candidatos: () => [OUTRO], cheio: false, por: 'Pôr colaborador ou grupo', aoPor: vi.fn(), aoTirar: vi.fn(), ...extra }
  });

  it('dado um item com grupo, quando o topo aparece, então a pílula do grupo vem depois das bolinhas, e o "+" acha pessoas e grupos', async () => {
    // Dado
    const g = grupos();
    render(<MemoryRouter><EquipeDoCartao responsavel={ana} participantes={[]} mudar={mudar()} grupos={g} /></MemoryRouter>);
    // Então
    expect(within(grupo()).getByRole('button', { name: 'Grupo Núcleo Alfa, 1 pessoa. Ver quem está' })).toHaveTextContent('Núcleo Alfa · 1');
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Pôr colaborador ou grupo' }));
    await userEvent.click(screen.getByRole('button', { name: 'Grupo Núcleo Beta, 1 pessoa' }));
    // Então
    expect(g.mudar!.aoPor).toHaveBeenCalledWith(OUTRO);
  });

  it('dado quem altera, quando tira o grupo pela lista, então o cartão recebe o grupo e o foco vai ao "+"', async () => {
    // Dado
    const g = grupos();
    render(<MemoryRouter><EquipeDoCartao responsavel={ana} participantes={[]} mudar={mudar()} grupos={g} /></MemoryRouter>);
    await userEvent.click(screen.getByRole('button', { name: /Grupo Núcleo Alfa/ }));
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Tirar o grupo do cartão' }));
    // Então
    expect(g.mudar!.aoTirar).toHaveBeenCalledWith(NUCLEO);
    await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Pôr colaborador ou grupo' })).toHaveFocus());
  });

  it('dada a lista de pessoas cheia, quando ainda há grupo para pôr, então o "+" continua ligado; sem grupo, desliga com o motivo', () => {
    // Quando
    const { unmount } = render(<MemoryRouter><EquipeDoCartao responsavel={ana} participantes={[]} mudar={mudar({ cheia: 'Cheia.' })} grupos={grupos()} /></MemoryRouter>);
    // Então
    expect(screen.getByRole('button', { name: 'Pôr colaborador ou grupo' })).not.toHaveAttribute('aria-disabled');
    unmount();
    // Quando
    render(<MemoryRouter><EquipeDoCartao responsavel={ana} participantes={[]} mudar={mudar({ cheia: 'Cheia.' })} grupos={grupos({ cheio: true })} /></MemoryRouter>);
    // Então
    const mais = screen.getByRole('button', { name: 'Pôr colaborador ou grupo' });
    expect(mais).toHaveAttribute('aria-disabled', 'true');
    expect(mais).toHaveAttribute('data-dica', 'Cheia.');
  });

  it('dado o item com o máximo de grupos e a lista de pessoas com vaga, quando o topo aparece, então o "+" continua ligado e a busca mostra as pessoas e o motivo dos grupos', async () => {
    // Dado
    const m = mudar();
    render(<MemoryRouter><EquipeDoCartao responsavel={ana} participantes={[]} mudar={m} grupos={grupos({ cheio: true })} /></MemoryRouter>);
    const mais = screen.getByRole('button', { name: 'Pôr colaborador ou grupo' });
    expect(mais).not.toHaveAttribute('aria-disabled');
    // Quando
    await userEvent.click(mais);
    // Então
    const busca = screen.getByRole('dialog', { name: 'Pôr colaborador ou grupo' });
    expect(within(busca).getByText(`Um item pode ter até ${GRUPOS_POR_ITEM} grupos.`)).toBeInTheDocument();
    await userEvent.click(within(busca).getByRole('button', { name: /Bruno Exemplo Souza/ }));
    expect(m.aoPor).toHaveBeenCalledWith(EQUIPE[1]);
  });

  it('dado o item com o máximo de grupos e ninguém mais para pôr, quando o topo aparece, então o "+" desliga com o motivo dos grupos', () => {
    // Quando
    render(<MemoryRouter><EquipeDoCartao responsavel={ana} participantes={[]} mudar={mudar({ candidatos: () => [] })} grupos={grupos({ cheio: true })} /></MemoryRouter>);
    // Então
    const mais = screen.getByRole('button', { name: 'Pôr colaborador ou grupo' });
    expect(mais).toHaveAttribute('aria-disabled', 'true');
    expect(mais).toHaveAttribute('data-dica', `Um item pode ter até ${GRUPOS_POR_ITEM} grupos.`);
  });

  it('dado quem só lê, quando o topo aparece, então a pílula mostra quem está, sem "+" nem "Tirar"', async () => {
    // Dado
    render(<MemoryRouter><EquipeDoCartao responsavel={ana} participantes={[]} grupos={{ doItem: [NUCLEO], equipe: EQUIPE, eu: 'u-bruno' }} /></MemoryRouter>);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: /Grupo Núcleo Alfa/ }));
    // Então
    expect(screen.getByRole('list', { name: 'Integrantes do grupo Núcleo Alfa' })).toHaveTextContent('Bruno Exemplo Souza');
    expect(screen.queryByRole('button', { name: 'Tirar o grupo do cartão' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Pôr/ })).not.toBeInTheDocument();
  });
});
