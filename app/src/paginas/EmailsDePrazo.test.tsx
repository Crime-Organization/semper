// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SD } from '../dados';
import { falha } from '../ui/avisos';
import { iniciarPreferencias, lerPreferencia } from '../ui/preferencias';
import { EmailsDePrazo } from './EmailsDePrazo';

vi.mock('../ui/avisos', () => ({ falha: vi.fn() }));

const diario = () => screen.getByRole('checkbox', { name: /Aviso às 7h/ });

describe('E-mails de prazo em Minha conta', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.mocked(falha).mockClear(); iniciarPreferencias({}); });

  it('dado quem nunca mexeu, quando abre a tela, então os três e-mails estão ligados', () => {
    // Quando
    render(<EmailsDePrazo />);
    // Então
    expect(diario()).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Resumo da semana/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Lembretes que eu marcar/ })).toBeChecked();
  });

  it('quando a pessoa desliga o e-mail dos lembretes, então grava a chave que o banco lê', async () => {
    // Dado
    const salvar = vi.spyOn(SD, 'salvarPreferencia').mockResolvedValue();
    render(<EmailsDePrazo />);
    // Quando
    await userEvent.click(screen.getByRole('checkbox', { name: /Lembretes que eu marcar/ }));
    // Então
    await waitFor(() => expect(salvar).toHaveBeenCalledWith('email_lembretes', false));
  });

  it('dado quem já desligou, quando abre a tela, então a caixinha vem desmarcada', () => {
    // Dado
    iniciarPreferencias({ email_prazos_diario: false });
    // Quando
    render(<EmailsDePrazo />);
    // Então
    expect(diario()).not.toBeChecked();
  });

  it('quando a pessoa desliga o e-mail, então a escolha é gravada', async () => {
    // Dado
    const salvar = vi.spyOn(SD, 'salvarPreferencia').mockResolvedValue();
    render(<EmailsDePrazo />);
    // Quando
    await userEvent.click(diario());
    // Então
    await waitFor(() => expect(salvar).toHaveBeenCalledWith('email_prazos_diario', false));
    await waitFor(() => expect(lerPreferencia('email_prazos_diario', true)).toBe(false));
    expect(diario()).not.toBeChecked();
    expect(falha).not.toHaveBeenCalled();
  });

  it('dado o banco fora do ar, quando a pessoa desliga o e-mail, então a caixinha volta e o erro aparece', async () => {
    // Dado
    const erro = new Error('sem rede');
    vi.spyOn(SD, 'salvarPreferencia').mockRejectedValue(erro);
    render(<EmailsDePrazo />);
    // Quando
    await userEvent.click(diario());
    // Então
    await waitFor(() => expect(falha).toHaveBeenCalledWith(erro));
    expect(diario()).toBeChecked();
    expect(lerPreferencia('email_prazos_diario', true)).toBe(true);
  });
});
