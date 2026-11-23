// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// A regra mudou de novo (#388, pedido do dono): o clique numa bolinha não tira mais ninguém na hora nem abre direto a troca do
// responsável. Ele abre um menu com o nome, o papel e as ações que quem chama a peça escolheu (a tabela ACOES_NA_BOLINHA); a ação
// impedida aparece com o motivo no lugar dela. Sem responsável, a bolinha vazia continua abrindo direto a escolha.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import type { Membro } from '../dados';
import { GRUPOS_POR_ITEM } from '../dados/limites';
import { ACOES_NA_BOLINHA, acoesSem } from '../regras/menuDaBolinha';
import { ENTRA_COMO, EquipeDoCartao, type GruposDoCartao, type MudarAEquipe, type MudarALista } from './EquipeDoCartao';

const ana = { id: 'u-ana', nome: 'Ana Teste Lima', papel: 'Responsável' };
const bruno = { id: 'u-bruno', nome: 'Bruno Exemplo Souza', papel: 'Participante · 10%' };
const mauro = { id: 'u-mauro', nome: 'Mauro Teixeira Duarte', papel: 'Participante' };
const grupo = () => screen.getByRole('group', { name: 'Equipe' });

describe('Equipe do cartão, para quem só lê', () => {
  it('quando o cartão tem responsável e participantes, então cada um é uma bolinha com as iniciais, o responsável primeiro, com o nome na dica', () => {
    // Quando
    render(<MemoryRouter><EquipeDoCartao responsavel={ana} participantes={[bruno, mauro]} /></MemoryRouter>);
    // Então
    const bolinhas = within(grupo()).getAllByRole('img');
    expect(bolinhas.map(b => b.getAttribute('aria-label'))).toEqual(['Ana Teste Lima, Responsável', 'Bruno Exemplo Souza, Participante · 10%',
      'Mauro Teixeira Duarte, Participante']);
    expect(bolinhas.map(b => b.textContent)).toEqual(['AL', 'BS', 'MD']);
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

describe('Equipe do cartão que a pessoa pode alterar: o menu de cada bolinha (#388)', () => {
  const EQUIPE: Membro[] = [
    { id: 'u-ana', nome: 'Ana Teste Lima', ativo: true },
    { id: 'u-bruno', nome: 'Bruno Exemplo Souza', ativo: true },
    { id: 'u-mauro', nome: 'Mauro Teixeira Duarte', ativo: true }
  ];
  const mudar = (extra: Partial<MudarAEquipe> = {}): MudarAEquipe => ({
    por: 'Pôr participante', candidatos: () => [EQUIPE[2]], responsaveis: () => [EQUIPE[1], EQUIPE[2]], tirar: () => 'Tirar da tarefa',
    acoes: () => ACOES_NA_BOLINHA.participante, acoesDoResponsavel: ACOES_NA_BOLINHA.responsavel, perfil: p => ({ para: '/equipe/perfil/?id=' + p.id }),
    aoPor: vi.fn(), aoTirar: vi.fn(), aoTrocarResponsavel: vi.fn(), aoTornarResponsavel: vi.fn(), ...extra
  });
  const montar = (m: MudarAEquipe, participantes = [bruno], responsavel: typeof ana | null = ana) =>
    render(<MemoryRouter><EquipeDoCartao responsavel={responsavel} participantes={participantes} mudar={m} /></MemoryRouter>);
  const bolinhaDoBruno = () => within(grupo()).getByRole('button', { name: 'Bruno Exemplo Souza, Participante · 10%' });
  const bolinhaDaAna = () => within(grupo()).getByRole('button', { name: 'Ana Teste Lima, Responsável' });
  const menuDe = (nome: string) => screen.getByRole('menu', { name: nome });

  it('dado um cartão sem participantes, quando abre, então aparecem o responsável e a bolinha com "+"', () => {
    // Quando
    montar(mudar(), []);
    // Então
    const bolinhas = within(grupo()).getAllByRole('button');
    expect(bolinhas.map(b => b.getAttribute('aria-label'))).toEqual(['Ana Teste Lima, Responsável', 'Pôr participante']);
    expect(bolinhas[0]).toHaveAttribute('data-dica', 'Ana Teste Lima · Responsável');
    expect(bolinhas[0]).toHaveAttribute('aria-haspopup', 'menu');
  });

  it('dado um colaborador, quando a pessoa clica na bolinha dele, então abre um menu com o nome e o papel, e ninguém sai do item', async () => {
    // Dado
    const m = mudar();
    montar(m);
    // Quando
    await userEvent.click(bolinhaDoBruno());
    // Então
    const menu = menuDe('Bruno Exemplo Souza, Participante · 10%');
    expect(menu).toHaveTextContent('Bruno Exemplo Souza');
    expect(menu).toHaveTextContent('Participante · 10%');
    expect(within(menu).getAllByRole('menuitem').map(i => i.textContent?.trim())).toEqual(['Tornar responsável', 'Tirar da tarefa', 'Ver perfil']);
    expect(bolinhaDoBruno()).toHaveAttribute('aria-expanded', 'true');
    expect(m.aoTirar).not.toHaveBeenCalled();
    // Só a dica da bolinha: a do navegador (o title do Avatar) não aparece por cima dela.
    expect(grupo().querySelectorAll('[title]')).toHaveLength(0);
  });

  it('dado o menu aberto, quando a pessoa escolhe "Tirar", então a tela recebe quem sai, o menu fecha e o foco vai à bolinha com "+"', async () => {
    // Dado
    const m = mudar();
    montar(m);
    await userEvent.click(bolinhaDoBruno());
    // Quando
    await userEvent.click(screen.getByRole('menuitem', { name: 'Tirar da tarefa' }));
    // Então
    expect(m.aoTirar).toHaveBeenCalledWith(bruno);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Pôr participante' })).toHaveFocus());
  });

  it('dado o menu de um colaborador, quando a pessoa escolhe "Tornar responsável", então a tela o recebe e o foco vai à bolinha do responsável', async () => {
    // Dado
    const m = mudar();
    montar(m);
    await userEvent.click(bolinhaDoBruno());
    // Quando
    await userEvent.click(screen.getByRole('menuitem', { name: 'Tornar responsável' }));
    // Então
    expect(m.aoTornarResponsavel).toHaveBeenCalledWith(bruno);
    expect(m.aoTirar).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(bolinhaDaAna()).toHaveFocus());
  });

  it('dado o menu do responsável, quando a pessoa escolhe "Trocar o responsável", então abre a busca de hoje e a tela recebe o novo; o foco volta à bolinha', async () => {
    // Dado
    const m = mudar();
    montar(m);
    await userEvent.click(bolinhaDaAna());
    expect(within(menuDe('Ana Teste Lima, Responsável')).getAllByRole('menuitem').map(i => i.textContent?.trim())).toEqual(['Trocar o responsável', 'Ver perfil']);
    // Quando
    await userEvent.click(screen.getByRole('menuitem', { name: 'Trocar o responsável' }));
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Trocar o responsável' })).getByRole('button', { name: 'Bruno Exemplo Souza' }));
    // Então
    expect(m.aoTrocarResponsavel).toHaveBeenCalledWith(EQUIPE[1]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await vi.waitFor(() => expect(bolinhaDaAna()).toHaveFocus());
  });

  it('dado o menu aberto, quando a pessoa tecla Esc, então o menu fecha e o foco volta à bolinha', async () => {
    // Dado
    montar(mudar());
    await userEvent.click(bolinhaDoBruno());
    expect(screen.getByRole('menuitem', { name: 'Tornar responsável' })).toHaveFocus();
    // Quando
    await userEvent.keyboard('{Escape}');
    // Então
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(bolinhaDoBruno()).toHaveFocus();
  });

  it('dado o menu aberto, quando a pessoa clica fora, então o menu fecha e o foco volta à bolinha', async () => {
    // Dado
    const m = mudar();
    montar(m);
    await userEvent.click(bolinhaDoBruno());
    // Quando
    await userEvent.click(document.body);
    // Então
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    await vi.waitFor(() => expect(bolinhaDoBruno()).toHaveFocus());
    expect(m.aoTirar).not.toHaveBeenCalled();
  });

  it('dado o menu, quando a pessoa olha o "Ver perfil", então ele é o link do perfil; sem poder abri-lo, o motivo aparece no lugar', async () => {
    // Dado
    const { unmount } = montar(mudar());
    await userEvent.click(bolinhaDoBruno());
    // Então
    expect(screen.getByRole('menuitem', { name: 'Ver perfil' })).toHaveAttribute('href', '/equipe/perfil/?id=u-bruno');
    unmount();
    // Dado
    montar(mudar({ perfil: () => ({ motivo: 'Só um administrador abre o perfil de outra pessoa.' }) }));
    // Quando
    await userEvent.click(bolinhaDoBruno());
    // Então
    expect(screen.queryByRole('menuitem', { name: 'Ver perfil' })).not.toBeInTheDocument();
    expect(menuDe('Bruno Exemplo Souza, Participante · 10%')).toHaveTextContent('Só um administrador abre o perfil de outra pessoa.');
  });

  it('dado quem não pode ser responsável (a tabela de quem chama sem "Tornar responsável"), quando o menu abre, então essa ação não aparece', async () => {
    // Dado
    montar(mudar({ acoes: () => acoesSem(ACOES_NA_BOLINHA.participante, 'tornarResponsavel') }));
    // Quando
    await userEvent.click(bolinhaDoBruno());
    // Então
    expect(screen.queryByRole('menuitem', { name: 'Tornar responsável' })).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Tirar da tarefa' })).toBeInTheDocument();
  });

  it('dado um participante que não pode sair, quando o menu dele abre, então o motivo aparece no lugar do "Tirar", e o resto continua', async () => {
    // Dado
    const motivo = 'Você não pode sair deste contrato.';
    const m = mudar({ impedeTirar: p => p.id === bruno.id ? motivo : undefined });
    montar(m, [bruno, mauro]);
    // Quando
    await userEvent.click(bolinhaDoBruno());
    // Então
    const menu = menuDe('Bruno Exemplo Souza, Participante · 10%');
    expect(within(menu).queryByRole('menuitem', { name: 'Tirar da tarefa' })).not.toBeInTheDocument();
    expect(menu).toHaveTextContent(motivo);
    expect(within(menu).getByRole('menuitem', { name: 'Tornar responsável' })).toBeInTheDocument();
    expect(m.aoTirar).not.toHaveBeenCalled();
  });

  it('dado um responsável que não pode passar o cartão adiante, quando o menu dele abre, então o motivo aparece no lugar de "Trocar o responsável"', async () => {
    // Dado
    const motivo = 'Você não pode passar este contrato a outro advogado.';
    montar(mudar({ impedeTrocar: motivo }));
    // Quando
    await userEvent.click(bolinhaDaAna());
    // Então
    const menu = menuDe('Ana Teste Lima, Responsável');
    expect(within(menu).queryByRole('menuitem', { name: 'Trocar o responsável' })).not.toBeInTheDocument();
    expect(menu).toHaveTextContent(motivo);
    // O primeiro item que sobra, o link do perfil, recebe o foco.
    expect(within(menu).getByRole('menuitem', { name: 'Ver perfil' })).toHaveFocus();
  });

  it('dado um escritório sem outra pessoa para assumir, quando o menu do responsável abre, então diz isso no lugar de "Trocar o responsável"', async () => {
    // Dado
    montar(mudar({ responsaveis: () => [] }));
    // Quando
    await userEvent.click(bolinhaDaAna());
    // Então
    expect(screen.queryByRole('menuitem', { name: 'Trocar o responsável' })).not.toBeInTheDocument();
    expect(menuDe('Ana Teste Lima, Responsável')).toHaveTextContent('Não há outra pessoa na equipe para assumir.');
  });

  it('dada uma mudança ainda gravando, quando a pessoa abre o menu, então o aviso aparece uma vez no lugar das ações que mudam a equipe', async () => {
    // Dado
    const m = mudar({ ocupado: true });
    montar(m);
    const mais = screen.getByRole('button', { name: 'Pôr participante' });
    expect(mais).toHaveAttribute('aria-disabled', 'true');
    expect(mais).toHaveAttribute('data-dica', 'Gravando a mudança na equipe…');
    // Quando
    await userEvent.click(mais);
    await userEvent.click(bolinhaDoBruno());
    // Então
    const menu = menuDe('Bruno Exemplo Souza, Participante · 10%');
    expect(within(menu).getAllByRole('menuitem').map(i => i.textContent?.trim())).toEqual(['Ver perfil']);
    expect(within(menu).getAllByText('Gravando a mudança na equipe…')).toHaveLength(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(m.aoPor).not.toHaveBeenCalled();
  });

  it('quando a pessoa escolhe alguém na busca do "+", então a tela o recebe para pôr como participante, e a lista mostra só os nomes', async () => {
    // Dado
    const m = mudar();
    montar(m);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Pôr participante' }));
    const achado = within(screen.getByRole('list', { name: 'Equipe' })).getByRole('button', { name: 'Mauro Teixeira Duarte' });
    expect(achado).toHaveTextContent(/^Mauro Teixeira Duarte$/);
    await userEvent.click(achado);
    // Então
    expect(m.aoPor).toHaveBeenCalledWith(EQUIPE[2]);
  });

  it('dado um cartão sem responsável, quando a pessoa clica na bolinha vazia, então escolhe um responsável direto, sem menu', async () => {
    // Dado
    const m = mudar();
    montar(m, [], null);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Sem responsável. Escolher o responsável' }));
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Trocar o responsável' })).getByRole('button', { name: 'Mauro Teixeira Duarte' }));
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

  it('dado um cartão com todos da equipe ativa dentro, quando a pessoa tira um participante pelo menu, então o foco vai à bolinha com "+", sem se perder', async () => {
    // Dado
    const m = mudar({ candidatos: () => [] });
    montar(m);
    // Quando
    await userEvent.click(bolinhaDoBruno());
    await userEvent.click(screen.getByRole('menuitem', { name: 'Tirar da tarefa' }));
    // Então
    expect(m.aoTirar).toHaveBeenCalledWith(bruno);
    await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Pôr participante' })).toHaveFocus());
  });
});

describe('Equipe do cartão com grupos da equipe (#378)', () => {
  const EQUIPE: Membro[] = [{ id: 'u-ana', nome: 'Ana Teste Lima', ativo: true }, { id: 'u-bruno', nome: 'Bruno Exemplo Souza', ativo: true }];
  const NUCLEO = { id: 'ga', nome: 'Núcleo Alfa', integrantes: ['u-bruno'] }, OUTRO = { id: 'gb', nome: 'Núcleo Beta', integrantes: ['u-ana'] };
  const mudar = (extra: Partial<MudarAEquipe> = {}): MudarAEquipe => ({
    por: 'Pôr colaborador', candidatos: () => [EQUIPE[1]], responsaveis: () => [EQUIPE[1]], tirar: () => 'Tirar da demanda',
    acoes: () => ACOES_NA_BOLINHA.participante, acoesDoResponsavel: ACOES_NA_BOLINHA.responsavel, perfil: () => null,
    aoPor: vi.fn(), aoTirar: vi.fn(), aoTrocarResponsavel: vi.fn(), aoTornarResponsavel: vi.fn(), ...extra
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

describe('Equipe do cartão sem responsável principal (#387: os responsáveis da pessoa)', () => {
  const EQUIPE: Membro[] = [{ id: 'u-ana', nome: 'Ana Teste Lima', ativo: true }, { id: 'u-bruno', nome: 'Bruno Exemplo Souza', ativo: true }];
  const ana = { id: 'u-ana', nome: 'Ana Teste Lima', papel: 'Responsável' };
  const bruno = { id: 'u-bruno', nome: 'Bruno Exemplo Souza', papel: 'Responsável' };
  const responsaveis = () => screen.getByRole('group', { name: 'Equipe' });
  const mudar = (extra: Partial<MudarALista> = {}): MudarALista => ({
    por: 'Pôr responsável', candidatos: () => [EQUIPE[1]], acoes: () => ACOES_NA_BOLINHA.responsavelDaPessoa, tirar: () => 'Tirar dos responsáveis',
    perfil: p => ({ para: '/equipe/perfil/?id=' + p.id }), aoPor: vi.fn(), aoTirar: vi.fn(), ...extra
  });

  it('dados dois responsáveis, quando quem só vê abre o cartão, então os dois são bolinhas iguais, com o nome na dica, sem a bolinha vazia nem o "+"', () => {
    // Quando
    render(<MemoryRouter><EquipeDoCartao semPrincipal participantes={[ana, bruno]} /></MemoryRouter>);
    // Então
    const bolinhas = within(responsaveis()).getAllByRole('img');
    expect(bolinhas.map(b => b.getAttribute('aria-label'))).toEqual(['Ana Teste Lima, Responsável', 'Bruno Exemplo Souza, Responsável']);
    expect(bolinhas[1]).toHaveAttribute('data-dica', 'Bruno Exemplo Souza · Responsável');
    expect(screen.queryByRole('img', { name: 'Sem responsável' })).not.toBeInTheDocument();
    expect(within(responsaveis()).queryByRole('button')).not.toBeInTheDocument();
  });

  it('dado ninguém na lista, quando quem só vê abre o cartão, então nada aparece (nem um grupo vazio)', () => {
    // Quando
    render(<MemoryRouter><EquipeDoCartao semPrincipal participantes={[]} /></MemoryRouter>);
    // Então
    expect(screen.queryByRole('group', { name: 'Equipe' })).not.toBeInTheDocument();
  });

  it('dado quem altera, quando a lista está vazia, então só aparece o "+" (sem a bolinha vazia de responsável)', () => {
    // Quando
    render(<MemoryRouter><EquipeDoCartao semPrincipal participantes={[]} mudar={mudar()} /></MemoryRouter>);
    // Então
    expect(within(responsaveis()).getAllByRole('button').map(b => b.getAttribute('aria-label'))).toEqual(['Pôr responsável']);
  });

  it('dado quem altera, quando escolhe alguém pelo "+", então a tela o recebe para pôr; e pelo menu da bolinha de um ("Tirar"), ele é tirado', async () => {
    // Dado
    const m = mudar();
    render(<MemoryRouter><EquipeDoCartao semPrincipal participantes={[ana]} mudar={m} /></MemoryRouter>);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Pôr responsável' }));
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Pôr responsável' })).getByRole('button', { name: 'Bruno Exemplo Souza' }));
    // Então
    expect(m.aoPor).toHaveBeenCalledWith(EQUIPE[1]);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Ana Teste Lima, Responsável' }));
    // Então: a pessoa não tem responsável principal, e o menu só tira ou abre o perfil.
    expect(within(screen.getByRole('menu', { name: 'Ana Teste Lima, Responsável' })).getAllByRole('menuitem').map(i => i.textContent?.trim()))
      .toEqual(['Tirar dos responsáveis', 'Ver perfil']);
    expect(m.aoTirar).not.toHaveBeenCalled();
    // Quando
    await userEvent.click(screen.getByRole('menuitem', { name: 'Tirar dos responsáveis' }));
    // Então
    expect(m.aoTirar).toHaveBeenCalledWith(ana);
  });
});

describe('Equipe do cartão: a função de cada participante da tarefa (#313)', () => {
  const executa = { id: 'u-bruno', nome: 'Bruno Exemplo Souza', papel: 'Participante · Executa', executa: true };
  const acompanha = { id: 'u-mauro', nome: 'Mauro Teixeira Duarte', papel: 'Participante · Acompanha' };
  const OPCOES = [{ id: 'f-exe', nome: 'Executa' }, { id: 'f-aco', nome: 'Acompanha' }];
  const mudar = (aoTrocar = vi.fn(), ocupado = false): MudarAEquipe => ({
    por: 'Pôr participante', candidatos: () => [], responsaveis: () => [], tirar: () => 'Tirar da tarefa',
    acoes: () => ACOES_NA_BOLINHA.participante, acoesDoResponsavel: ACOES_NA_BOLINHA.responsavel, perfil: () => null,
    aoPor: vi.fn(), aoTirar: vi.fn(), aoTrocarResponsavel: vi.fn(), aoTornarResponsavel: vi.fn(), ocupado,
    funcoes: { opcoes: OPCOES, de: p => p.id === 'u-bruno' ? 'f-exe' : 'f-aco', aoTrocar }
  });

  it('quando o cartão só é lido, então a função vem com o papel, e quem executa fica em destaque', () => {
    // Quando
    render(<MemoryRouter><EquipeDoCartao responsavel={ana} participantes={[executa, acompanha]} /></MemoryRouter>);
    // Então
    expect(within(grupo()).getByRole('img', { name: 'Bruno Exemplo Souza, Participante · Executa' })).toHaveClass('executa');
    expect(within(grupo()).getByRole('img', { name: 'Mauro Teixeira Duarte, Participante · Acompanha' })).not.toHaveClass('executa');
  });

  it('quando quem altera abre o menu de um participante, então vê as funções, com a dele marcada, e escolher outra avisa quem chama', async () => {
    // Dado
    const aoTrocar = vi.fn();
    render(<MemoryRouter><EquipeDoCartao responsavel={ana} participantes={[executa, acompanha]} mudar={mudar(aoTrocar)} /></MemoryRouter>);
    // Quando
    await userEvent.click(within(grupo()).getByRole('button', { name: 'Mauro Teixeira Duarte, Participante · Acompanha' }));
    const funcoes = within(screen.getByRole('menu')).getByRole('group', { name: 'Função de Mauro Teixeira Duarte' });
    // Então
    expect(within(funcoes).getByRole('menuitemradio', { name: 'Acompanha' })).toHaveAttribute('aria-checked', 'true');
    // Quando
    await userEvent.click(within(funcoes).getByRole('menuitemradio', { name: 'Executa' }));
    // Então
    expect(aoTrocar).toHaveBeenCalledWith(expect.objectContaining({ id: 'u-mauro' }), 'f-exe');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('quando quem altera abre o "+", então escolhe a função de quem entra (começa na padrão), e quem chama recebe a pessoa com a função', async () => {
    // Dado
    const carla = { id: 'u-carla', nome: 'Carla Teste Reis', ativo: true };
    const m: MudarAEquipe = { ...mudar(), candidatos: () => [carla], funcoes: { ...mudar().funcoes!, padrao: 'f-aco' } };
    render(<MemoryRouter><EquipeDoCartao responsavel={ana} participantes={[acompanha]} mudar={m} /></MemoryRouter>);
    // Quando
    await userEvent.click(within(grupo()).getByRole('button', { name: 'Pôr participante' }));
    const funcao = screen.getByRole('group', { name: ENTRA_COMO });
    // Então
    expect(within(funcao).getByRole('radio', { name: 'Acompanha' })).toBeChecked();
    // Quando
    await userEvent.click(within(funcao).getByRole('radio', { name: 'Executa' }));
    await userEvent.click(within(screen.getByRole('list', { name: 'Equipe' })).getByRole('button', { name: 'Carla Teste Reis' }));
    // Então
    expect(m.aoPor).toHaveBeenCalledWith(carla, 'f-exe');
  });

  it('quando outra mudança ainda grava, então as funções ficam desligadas, com o motivo', async () => {
    // Dado
    render(<MemoryRouter><EquipeDoCartao responsavel={ana} participantes={[acompanha]} mudar={mudar(vi.fn(), true)} /></MemoryRouter>);
    // Quando
    await userEvent.click(within(grupo()).getByRole('button', { name: 'Mauro Teixeira Duarte, Participante · Acompanha' }));
    // Então
    expect(within(screen.getByRole('menu')).getByRole('menuitemradio', { name: 'Executa' })).toBeDisabled();
  });
});
