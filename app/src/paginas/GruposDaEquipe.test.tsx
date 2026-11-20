// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Os nomes são inventados.
// A seção "Grupos da equipe" de Equipe e acessos e o painel de cada grupo (#378).
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GrupoDaEquipe as Grupo } from '../dados';
import { GrupoDaEquipe } from './GrupoDaEquipe';
import { GruposDaEquipe } from './GruposDaEquipe';

const { SD, feito, avisar, falha, confirmar, pedirTexto, sessao } = vi.hoisted(() => ({
  SD: {
    grupoDaEquipeCriar: vi.fn(), grupoDaEquipeRenomear: vi.fn(), grupoDaEquipeIncluir: vi.fn(), grupoDaEquipeTirar: vi.fn(),
    grupoDaEquipeContarItens: vi.fn(), grupoDaEquipeExcluir: vi.fn()
  },
  feito: vi.fn(), avisar: vi.fn(), falha: vi.fn(), confirmar: vi.fn(), pedirTexto: vi.fn(),
  sessao: { grupos: [] as Grupo[], recarregar: vi.fn() }
}));
vi.mock('../dados', () => ({ SD }));
vi.mock('../ui/avisos', () => ({ feito, avisar, falha }));
vi.mock('../ui/janela', () => ({ confirmar, pedirTexto }));
const EQUIPE = [
  { id: 'u-ana', nome: 'Ana Exemplo', ativo: true },
  { id: 'u-beto', nome: 'Beto Teste', ativo: true },
  { id: 'u-caio', nome: 'Caio Fictício', ativo: true }
];
vi.mock('../ui/sessao', () => {
  const ctx = () => ({ perfil: { id: 'u-ana', papel: 'admin' }, equipe: EQUIPE, grupos: sessao.grupos, ehAdmin: true });
  return { useCtx: ctx, useSessao: () => ({ ctx: ctx(), recarregar: sessao.recarregar }) };
});

const NUCLEO: Grupo = { id: 'ga', nome: 'Núcleo Alfa', integrantes: ['u-ana'] };

describe('Grupos da equipe em Equipe e acessos (#378)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessao.grupos = [];
    SD.grupoDaEquipeContarItens.mockResolvedValue([]);
  });

  it('dado um escritório sem grupos, quando a seção aparece, então diz para que serve um grupo e oferece "Novo grupo"', () => {
    // Quando
    render(<MemoryRouter><GruposDaEquipe /></MemoryRouter>);
    // Então
    const secao = screen.getByRole('region', { name: 'Grupos da equipe' });
    expect(secao).toHaveTextContent('Nenhum grupo ainda.');
    expect(within(secao).getByRole('button', { name: 'Novo grupo' })).toBeInTheDocument();
  });

  it('quando a administradora cria um grupo, então ele é gravado com o nome pedido e o painel dele abre', async () => {
    // Dado
    pedirTexto.mockResolvedValue('Núcleo Alfa');
    SD.grupoDaEquipeCriar.mockResolvedValue('ga');
    sessao.recarregar.mockImplementation(async () => { sessao.grupos = [{ ...NUCLEO, integrantes: [] }]; });
    const { rerender } = render(<MemoryRouter><GruposDaEquipe /></MemoryRouter>);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Novo grupo' }));
    rerender(<MemoryRouter><GruposDaEquipe /></MemoryRouter>);
    // Então
    expect(SD.grupoDaEquipeCriar).toHaveBeenCalledWith('Núcleo Alfa');
    expect(await screen.findByRole('dialog', { name: 'Grupo Núcleo Alfa' })).toBeInTheDocument();
  });

  it('dado um grupo, quando a tabela aparece, então mostra quem está, em quantos itens e o botão que abre o grupo', async () => {
    // Dado
    sessao.grupos = [{ ...NUCLEO, integrantes: ['u-ana', 'u-beto'] }];
    SD.grupoDaEquipeContarItens.mockResolvedValue([{ modulo: 'demandas', quantos: 5 }, { modulo: 'tarefas', quantos: 1 }]);
    // Quando
    render(<MemoryRouter><GruposDaEquipe /></MemoryRouter>);
    // Então
    const linha = screen.getByRole('row', { name: /Núcleo Alfa/ });
    expect(linha).toHaveTextContent('2 pessoas');
    expect(await within(linha).findByText('5 demandas e 1 tarefa')).toBeInTheDocument();
    await userEvent.click(within(linha).getByRole('button', { name: 'Abrir o grupo Núcleo Alfa' }));
    expect(screen.getByRole('dialog', { name: 'Grupo Núcleo Alfa' })).toBeInTheDocument();
  });

  it('dado um grupo, quando a contagem dos itens falha, então o erro aparece e a tabela e o painel dizem que não foi possível contar', async () => {
    // Dado
    sessao.grupos = [NUCLEO];
    const erro = new Error('Sem conexão');
    SD.grupoDaEquipeContarItens.mockRejectedValue(erro);
    // Quando
    render(<MemoryRouter><GruposDaEquipe /></MemoryRouter>);
    // Então
    const linha = screen.getByRole('row', { name: /Núcleo Alfa/ });
    expect(await within(linha).findByText('Não foi possível contar os itens.')).toBeInTheDocument();
    expect(falha).toHaveBeenCalledWith(erro);
    await userEvent.click(within(linha).getByRole('button', { name: 'Abrir o grupo Núcleo Alfa' }));
    expect(within(screen.getByRole('dialog', { name: 'Grupo Núcleo Alfa' })).getByText('Não foi possível contar os itens.')).toBeInTheDocument();
  });
});

describe('Painel de um grupo da equipe (#378)', () => {
  beforeEach(() => vi.clearAllMocks());
  const montar = (aoMudar = vi.fn(async () => {}), aoExcluir = vi.fn(async () => {})) => {
    render(<MemoryRouter><GrupoDaEquipe g={NUCLEO} itens={[{ modulo: 'demandas', quantos: 2 }]} aoMudar={aoMudar} aoExcluir={aoExcluir} /></MemoryRouter>);
    return { aoMudar, aoExcluir };
  };

  it('quando a administradora renomeia o grupo, então grava o nome novo', async () => {
    // Dado
    const { aoMudar } = montar();
    const campo = screen.getByRole('textbox', { name: 'Nome' });
    // Quando
    await userEvent.clear(campo);
    await userEvent.type(campo, 'Núcleo Novo');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar nome' }));
    // Então
    expect(SD.grupoDaEquipeRenomear).toHaveBeenCalledWith('ga', 'Núcleo Novo');
    expect(aoMudar).toHaveBeenCalled();
  });

  it('quando a administradora põe uma pessoa, então só ela é gravada, com o Desfazer; enquanto grava, a escolha fica desligada', async () => {
    // Dado
    let terminar = () => {};
    SD.grupoDaEquipeIncluir.mockImplementationOnce(() => new Promise<void>(r => { terminar = r; }));
    montar();
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar integrante' }));
    await userEvent.click(screen.getByRole('button', { name: 'Beto Teste' }));
    // Então
    expect(SD.grupoDaEquipeIncluir).toHaveBeenCalledWith('ga', 'u-beto');
    expect(screen.getByRole('button', { name: 'Tirar Ana Exemplo' })).toBeDisabled();
    await act(async () => terminar());
    expect(feito).toHaveBeenCalledWith('Beto Teste agora está no grupo Núcleo Alfa.', 'inclusão no grupo', expect.any(Function));
  });

  it('quando a administradora tira uma pessoa, então só ela sai, com o Desfazer', async () => {
    // Dado
    montar();
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Tirar Ana Exemplo' }));
    // Então
    expect(SD.grupoDaEquipeTirar).toHaveBeenCalledWith('ga', 'u-ana');
    expect(feito).toHaveBeenCalledWith('Ana Exemplo saiu do grupo Núcleo Alfa.', 'saída do grupo', expect.any(Function));
  });

  it('quando a administradora exclui o grupo, então a pergunta diz em quantos itens ele está e, confirmada, exclui', async () => {
    // Dado
    SD.grupoDaEquipeContarItens.mockResolvedValue([{ modulo: 'demandas', quantos: 5 }, { modulo: 'tarefas', quantos: 7 }]);
    confirmar.mockResolvedValue(true);
    const { aoExcluir } = montar();
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Excluir o grupo' }));
    // Então
    expect(confirmar).toHaveBeenCalledWith('Excluir o grupo Núcleo Alfa?',
      'Ele está em 12 itens, contando os arquivados (5 demandas e 7 tarefas). Quem participa só pelo grupo deixa de ver esses itens. As pessoas continuam na equipe. Não dá para desfazer.',
      'Excluir o grupo', true);
    expect(SD.grupoDaEquipeExcluir).toHaveBeenCalledWith('ga');
    expect(aoExcluir).toHaveBeenCalled();
  });

  it('dada a pergunta de excluir, quando a administradora desiste, então nada é excluído', async () => {
    // Dado
    SD.grupoDaEquipeContarItens.mockResolvedValue([]);
    confirmar.mockResolvedValue(false);
    montar();
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Excluir o grupo' }));
    // Então
    expect(SD.grupoDaEquipeExcluir).not.toHaveBeenCalled();
  });
});
