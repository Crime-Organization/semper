// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// O banco fictício sempre entra como administrador; aqui a página abre também como quem não é.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DadosTempo, Membro } from '../dados';
import MeuTempo from './MeuTempo';

// A página usa só a soma do tempo por tarefa; o mock declara exatamente essa operação.
const SD = vi.hoisted(() => ({ tempoPorTarefa: vi.fn<DadosTempo['tempoPorTarefa']>() }));
vi.mock('../dados', () => ({ SD: SD satisfies Pick<DadosTempo, 'tempoPorTarefa'> }));
// Quem está logado é o Mateus; se é administrador, cada caso diz.
const sessao = vi.hoisted(() => ({ ehAdmin: false }));
const EQUIPE: Membro[] = [
  { id: 'u-mateus', nome: 'Mateus Freitas Gonçalves', ativo: true },
  { id: 'u-bruno', nome: 'Bruno Exemplo Souza', ativo: true }
];
vi.mock('../ui/sessao', () => ({ useSessao: () => ({ ctx: { perfil: { id: 'u-mateus' }, equipe: EQUIPE, ehAdmin: sessao.ehAdmin } }) }));

const abrir = () => render(<MemoryRouter><MeuTempo /></MemoryRouter>);

describe('Meu tempo trabalhado', () => {
  beforeEach(() => {
    sessao.ehAdmin = false;
    SD.tempoPorTarefa.mockReset();
    SD.tempoPorTarefa.mockResolvedValue([
      { tarefa_id: 't1', codigo: 'A1', titulo: 'Peticionar', demanda_codigo: null, arquivada: false, segundos: 90 },
      { tarefa_id: 't2', codigo: 'B2', titulo: 'Revisar', demanda_codigo: 'D1', arquivada: true, segundos: 90 }
    ]);
  });

  it('quando quem abre não é administrador, então não há como escolher outra pessoa, e vem só o próprio tempo', async () => {
    // Quando
    abrir();
    // Então
    await screen.findByRole('table', { name: 'Tempo por tarefa' });
    expect(screen.queryByLabelText('De quem')).toBeNull();
    expect(SD.tempoPorTarefa.mock.calls.every(([perfil]) => perfil === 'u-mateus')).toBe(true);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Meu tempo trabalhado.');
  });

  it('quando o administrador escolhe outra pessoa, então vem o tempo dela, com o nome no título', async () => {
    // Dado
    sessao.ehAdmin = true;
    abrir();
    await screen.findByRole('table', { name: 'Tempo por tarefa' });
    // Quando
    await userEvent.selectOptions(screen.getByLabelText('De quem'), 'u-bruno');
    // Então
    expect(SD.tempoPorTarefa).toHaveBeenLastCalledWith('u-bruno', expect.any(String), expect.any(String));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Tempo de Bruno Exemplo Souza.');
  });

  it('quando as tarefas têm segundos quebrados, então cada linha mostra os segundos, e a soma das linhas bate com o total', async () => {
    // Quando
    abrir();
    // Então: 1 min 30 s + 1 min 30 s = 3 min (só minutos, apareceria "1 min" + "1 min" = "3 min")
    const tabela = await screen.findByRole('table', { name: 'Tempo por tarefa' });
    expect(within(tabela).getByRole('row', { name: /Peticionar/ }).textContent).toContain('0:01:30');
    expect(within(tabela).getByRole('row', { name: /Revisar/ }).textContent).toContain('arquivada');
    expect(within(tabela).getByRole('row', { name: /Total/ }).textContent).toContain('0:03:00');
    expect(screen.getByRole('status').textContent).toBe('Total: 0:03:00');
  });
});
