// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// O banco fictício sempre entra como administrador; aqui a página abre também como quem não é.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Dados, Membro } from '../dados';
import Pessoas from './Pessoas';

// Ao abrir, a página lista as pessoas, as colunas e os grupos do quadro e as etiquetas; o mock declara exatamente essas operações.
const SD = vi.hoisted(() => ({
  pessoasListar: vi.fn<Dados['pessoasListar']>(),
  colunasListar: vi.fn<Dados['colunasListar']>(),
  sugestoesListar: vi.fn<Dados['sugestoesListar']>(),
  gruposListar: vi.fn<Dados['gruposListar']>(),
  etiquetasListar: vi.fn<Dados['etiquetasListar']>()
}));
vi.mock('../dados', () => ({ SD: SD satisfies Pick<Dados, 'pessoasListar' | 'colunasListar' | 'sugestoesListar' | 'gruposListar' | 'etiquetasListar'> }));
const sessao = vi.hoisted(() => ({ ehAdmin: false }));
const EQUIPE: Membro[] = [{ id: 'u-mateus', nome: 'Mateus Exemplo Gonçalves', ativo: true }];
vi.mock('../ui/sessao', () => {
  const ctx = () => ({ perfil: { id: 'u-mateus' }, equipe: EQUIPE, ehAdmin: sessao.ehAdmin, escritorio: null });
  return { useCtx: ctx, useSessao: () => ({ ctx: ctx() }) };
});

const abrir = () => render(<MemoryRouter initialEntries={['/pessoas/']}>
  <Routes>
    <Route path="/pessoas/" element={<Pessoas />} />
    <Route path="/pessoas/importar/" element={<p>Tela de importação</p>} />
  </Routes>
</MemoryRouter>);

describe('Pessoas: importar', () => {
  beforeEach(() => {
    sessao.ehAdmin = false;
    SD.pessoasListar.mockReset().mockResolvedValue({ linhas: [], total: 0 });
    SD.colunasListar.mockReset().mockResolvedValue([]);
    SD.sugestoesListar.mockReset().mockResolvedValue([]);
    SD.gruposListar.mockReset().mockResolvedValue([]);
    SD.etiquetasListar.mockReset().mockResolvedValue([]);
  });

  it('quando quem abre não é administrador, então não há o menu "Mais ações" (nem exportar, nem importar)', async () => {
    // Quando
    abrir();
    // Então
    await screen.findByRole('heading', { name: /Pessoas/ });
    expect(screen.queryByRole('button', { name: 'Mais ações' })).toBeNull();
  });

  it('quando o administrador escolhe "Importar pessoas" no menu, então abre a importação', async () => {
    // Dado
    sessao.ehAdmin = true;
    abrir();
    // Quando
    await userEvent.click(await screen.findByRole('button', { name: 'Mais ações' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Importar pessoas' }));
    // Então
    expect(await screen.findByText('Tela de importação')).toBeInTheDocument();
  });

  it('quando escolhe "Importadas" em "Situação do cadastro", então a lista pede só as importadas', async () => {
    // Dado
    abrir();
    await userEvent.click(await screen.findByRole('button', { name: /Filtros/ }));
    // Quando
    await userEvent.selectOptions(screen.getByLabelText('Situação do cadastro'), 'importadas');
    // Então
    expect(SD.pessoasListar).toHaveBeenLastCalledWith(expect.objectContaining({ marca: 'importadas', pagina: 0 }));
  });
});
