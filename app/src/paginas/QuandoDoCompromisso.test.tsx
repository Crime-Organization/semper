// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Compromisso, RepeticaoCompromisso } from '../dados';
import { Avisos } from '../ui/avisos';
import { QuandoDoCompromisso } from './QuandoDoCompromisso';

const reuniao: Pick<Compromisso, 'tipo' | 'data' | 'hora' | 'hora_fim' | 'repeticao'> = { tipo: 'reuniao', data: '2026-11-20', hora: '14:00:00', hora_fim: null };
const janela = () => within(screen.getByRole('dialog', { name: 'Mudar a data e o horário' }));

beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-18T15:00:00.000Z')); });
afterEach(() => vi.useRealTimers());

describe('Data e horário do compromisso na janela das datas (#361, #422)', () => {
  it('dado quem muda o compromisso, quando clica na data, então a janela abre com o calendário, a data, a hora (exigida na reunião) e o "Até", sem a caixa de marcar nem o Remover', async () => {
    // Dado
    render(<QuandoDoCompromisso c={reuniao} aoSalvar={vi.fn()} />);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: /^Data e horário/ }));
    // Então
    expect(janela().getByRole('group', { name: 'Calendário' })).toBeInTheDocument();
    expect(janela().getByRole('textbox', { name: 'Data' })).toHaveValue('20/11/2026');
    expect(janela().getByRole('textbox', { name: 'Data' })).toHaveFocus();
    expect(janela().getByLabelText('Hora do compromisso')).toHaveValue('14:00');
    expect(janela().getByLabelText('Hora do compromisso')).toHaveAttribute('aria-required', 'true');
    expect(janela().getByLabelText('Até')).toHaveValue('');
    expect(janela().queryByRole('checkbox')).not.toBeInTheDocument();
    expect(janela().queryByRole('button', { name: 'Remover' })).not.toBeInTheDocument();
    expect(janela().queryByText('Repetição')).not.toBeInTheDocument();
  });

  it('dado quem muda o compromisso, quando escolhe outro dia, a hora e o fim e salva, então grava como o banco guarda', async () => {
    // Dado
    const aoSalvar = vi.fn();
    render(<><Avisos /><QuandoDoCompromisso c={reuniao} aoSalvar={aoSalvar} /></>);
    expect(screen.getByRole('button', { name: /^Data e horário: 20\/11\/2026 · 14:00/ })).toBeInTheDocument();
    // Quando
    await userEvent.click(screen.getByRole('button', { name: /^Data e horário/ }));
    await userEvent.click(within(janela().getByRole('group', { name: 'Calendário' })).getByRole('button', { name: /^quinta-feira, 26 de novembro de 2026/ }));
    fireEvent.change(janela().getByLabelText('Hora do compromisso'), { target: { value: '15:00' } });
    fireEvent.change(janela().getByLabelText('Até'), { target: { value: '16:30' } });
    await userEvent.click(janela().getByRole('button', { name: 'Salvar' }));
    // Então
    await vi.waitFor(() => expect(aoSalvar).toHaveBeenCalledWith({ data: '2026-11-26', hora: '15:00', hora_fim: '16:30' }));
  });

  it('dada uma reunião, quando a pessoa tira a hora e salva, então pede a hora, como o cadastro, e não grava', async () => {
    // Dado
    const aoSalvar = vi.fn();
    render(<QuandoDoCompromisso c={reuniao} aoSalvar={aoSalvar} />);
    await userEvent.click(screen.getByRole('button', { name: /^Data e horário/ }));
    // Quando
    fireEvent.change(janela().getByLabelText('Hora do compromisso'), { target: { value: '' } });
    await userEvent.click(janela().getByRole('button', { name: 'Salvar' }));
    // Então
    expect(screen.getByRole('alert')).toHaveTextContent('Informe a hora.');
    expect(aoSalvar).not.toHaveBeenCalled();
  });

  it('dado um compromisso que se repete, quando a janela abre, então diz como ele se repete, só para ler', async () => {
    // Dado
    const repeticao: RepeticaoCompromisso = { id: 'r1', inicio: '2026-11-20', frequencia: 'semana', intervalo: 1, ate: null, vezes: null };
    render(<QuandoDoCompromisso c={{ ...reuniao, repeticao }} aoSalvar={vi.fn()} />);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: /^Data e horário/ }));
    // Então
    expect(janela().getByText('Repetição')).toBeInTheDocument();
    expect(janela().getByText(/semana/i)).toBeInTheDocument();
  });

  it('dado quem só vê o compromisso, quando olha a data, então é só texto', () => {
    // Quando
    render(<QuandoDoCompromisso c={reuniao} />);
    // Então
    expect(screen.getByText('20/11/2026 · 14:00')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
