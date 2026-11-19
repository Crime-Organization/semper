// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Compromisso } from '../dados';
import { Avisos } from '../ui/avisos';
import { QuandoDoCompromisso } from './QuandoDoCompromisso';

const reuniao: Pick<Compromisso, 'tipo' | 'data' | 'hora' | 'hora_fim'> = { tipo: 'reuniao', data: '2026-11-20', hora: '14:00:00', hora_fim: null };
const formulario = () => screen.getByRole('group', { name: 'Mudar a data e o horário' });

beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-18T15:00:00.000Z')); });
afterEach(() => vi.useRealTimers());

describe('Data e horário do compromisso no próprio lugar (#361)', () => {
  it('dado quem muda o compromisso, quando escolhe outro dia, a hora e o fim e salva, então grava como o banco guarda', async () => {
    // Dado
    const aoSalvar = vi.fn();
    render(<><Avisos /><QuandoDoCompromisso c={reuniao} aoSalvar={aoSalvar} /></>);
    expect(screen.getByRole('button', { name: /^Data e horário: 20\/11\/2026 · 14:00/ })).toBeInTheDocument();
    // Quando
    await userEvent.click(screen.getByRole('button', { name: /^Data e horário/ }));
    await userEvent.click(screen.getByRole('button', { name: /^quinta-feira, 26 de novembro de 2026/ }));
    fireEvent.change(within(formulario()).getByLabelText('Hora do compromisso'), { target: { value: '15:00' } });
    fireEvent.change(within(formulario()).getByLabelText('Até'), { target: { value: '16:30' } });
    await userEvent.click(within(formulario()).getByRole('button', { name: 'Salvar' }));
    // Então
    await vi.waitFor(() => expect(aoSalvar).toHaveBeenCalledWith({ data: '2026-11-26', hora: '15:00', hora_fim: '16:30' }));
  });

  it('dada uma reunião, quando a pessoa tira a hora e salva, então pede a hora, como o cadastro, e não grava', async () => {
    // Dado
    const aoSalvar = vi.fn();
    render(<QuandoDoCompromisso c={reuniao} aoSalvar={aoSalvar} />);
    await userEvent.click(screen.getByRole('button', { name: /^Data e horário/ }));
    // Quando
    fireEvent.change(within(formulario()).getByLabelText('Hora do compromisso'), { target: { value: '' } });
    await userEvent.click(within(formulario()).getByRole('button', { name: 'Salvar' }));
    // Então
    expect(screen.getByRole('alert')).toHaveTextContent('Informe a hora.');
    expect(aoSalvar).not.toHaveBeenCalled();
  });

  it('dado quem só vê o compromisso, quando olha a data, então é só texto', () => {
    // Quando
    render(<QuandoDoCompromisso c={reuniao} />);
    // Então
    expect(screen.getByText('20/11/2026 · 14:00')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
