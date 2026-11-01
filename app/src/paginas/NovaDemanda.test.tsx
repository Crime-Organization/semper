// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// O banco fictício sempre entra como administrador; aqui a demanda é editada também por quem não é.
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SD, type Demanda } from '../dados';
import { feito } from '../ui/avisos';
import NovaDemanda from './NovaDemanda';

vi.mock('../ui/avisos', async original => ({ ...await original<typeof import('../ui/avisos')>(), feito: vi.fn() }));
const sessao = vi.hoisted(() => ({ ehAdmin: false }));
vi.mock('../ui/sessao', () => ({
  useCtx: () => ({
    perfil: { id: 'u-bruno' }, ehAdmin: sessao.ehAdmin,
    equipe: [{ id: 'u-bruno', nome: 'Bruno Exemplo Souza', ativo: true }, { id: 'u-ana', nome: 'Ana Teste Lima', ativo: true }]
  })
}));

const demanda = (extra: Partial<Demanda>) => ({
  id: 'd1', codigo: 'D1', titulo: 'Registro de marca', descricao: null, prazo: null, responsavel_id: 'u-bruno', colaboradores: [], clientes: [], contrato_id: null,
  contrato_codigo: null, criado_por: 'u-ana', ...extra
}) as unknown as Demanda;

/** Abre a demanda para editar, passa a responsabilidade à Ana e salva. */
async function passarParaAna(d: Demanda) {
  vi.spyOn(SD, 'demandaObter').mockResolvedValue(d);
  const gravar = vi.spyOn(SD, 'demandaAtualizar').mockResolvedValue({ id: d.id, codigo: d.codigo });
  render(<MemoryRouter><NovaDemanda edicao={{ id: d.id, aoTerminar: () => undefined }} /></MemoryRouter>);
  await userEvent.selectOptions(await screen.findByLabelText(/Responsável/), 'Ana Teste Lima');
  await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
  await waitFor(() => expect(gravar).toHaveBeenCalled());
  return gravar;
}

describe('Passar a demanda a outro responsável', () => {
  beforeEach(() => {
    sessao.ehAdmin = false;
    vi.mocked(feito).mockClear();
    vi.spyOn(SD, 'contratosListar').mockResolvedValue({ linhas: [], total: 0 });
  });

  it('quando quem passa não é administrador nem criou a demanda, então continua entre os colaboradores e a tela avisa', async () => {
    // Quando
    const gravar = await passarParaAna(demanda({}));
    // Então
    expect(gravar).toHaveBeenCalledWith('d1', expect.objectContaining({ responsavel_id: 'u-ana', colaboradores: ['u-bruno'] }));
    await waitFor(() => expect(vi.mocked(feito).mock.calls[0][0]).toMatch(/Você continua entre os colaboradores/));
  });

  it.each([
    ['é administrador', true, 'u-ana'],
    ['criou a demanda', false, 'u-bruno']
  ])('quando quem passa %s, então sai de fato, sem aviso', async (_caso, ehAdmin, criadoPor) => {
    // Dado
    sessao.ehAdmin = ehAdmin;
    // Quando
    const gravar = await passarParaAna(demanda({ criado_por: criadoPor }));
    // Então
    expect(gravar).toHaveBeenCalledWith('d1', expect.objectContaining({ responsavel_id: 'u-ana', colaboradores: [] }));
    await waitFor(() => expect(vi.mocked(feito).mock.calls[0][0]).toBe('Demanda atualizada.'));
  });
});
