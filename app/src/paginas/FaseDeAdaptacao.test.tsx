// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SD } from '../dados';
import { falha } from '../ui/avisos';
import { FaseDeAdaptacao } from './FaseDeAdaptacao';

const sessao = vi.hoisted(() => ({ modulos: {} as Record<string, boolean>, recarregar: vi.fn(async () => undefined) }));
vi.mock('../ui/sessao', () => ({ useSessao: () => ({ ctx: { escritorio: { modulos: sessao.modulos } }, recarregar: sessao.recarregar }) }));
vi.mock('../ui/avisos', () => ({ falha: vi.fn(), avisar: vi.fn() }));

const opcao = () => screen.getByRole('checkbox', { name: /Toda a equipe vê e edita tudo/ });

describe('Fase de adaptação em Configurações', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.mocked(falha).mockClear(); sessao.recarregar.mockClear(); sessao.modulos = {}; });

  it('dada a fase desligada, quando o administrador liga, então grava e relê o escritório', async () => {
    // Dado
    const definir = vi.spyOn(SD, 'faseDeAdaptacaoDefinir').mockResolvedValue();
    render(<FaseDeAdaptacao />);
    expect(opcao()).not.toBeChecked();
    // Quando
    await userEvent.click(opcao());
    // Então
    await waitFor(() => expect(definir).toHaveBeenCalledWith(true));
    await waitFor(() => expect(sessao.recarregar).toHaveBeenCalled());
    expect(opcao()).toBeChecked();
  });

  it('dada a fase ligada, quando o administrador desliga, então grava desligada', async () => {
    // Dado
    sessao.modulos = { equipe_edita_tudo: true };
    const definir = vi.spyOn(SD, 'faseDeAdaptacaoDefinir').mockResolvedValue();
    render(<FaseDeAdaptacao />);
    expect(opcao()).toBeChecked();
    // Quando
    await userEvent.click(opcao());
    // Então
    await waitFor(() => expect(definir).toHaveBeenCalledWith(false));
  });

  it('dado o banco fora do ar, quando o administrador liga, então a caixinha volta e o erro aparece', async () => {
    // Dado
    const erro = new Error('sem rede');
    vi.spyOn(SD, 'faseDeAdaptacaoDefinir').mockRejectedValue(erro);
    render(<FaseDeAdaptacao />);
    // Quando
    await userEvent.click(opcao());
    // Então
    await waitFor(() => expect(falha).toHaveBeenCalledWith(erro));
    expect(opcao()).not.toBeChecked();
  });
});
