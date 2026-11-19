// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Campo, propsDoCampo } from '.';
import { CampoDataHora, type PropsCampoDataHora } from './CampoDataHora';

/** O campo num formulário, dentro do <Campo>, com a data e a hora guardadas pela tela (como os cadastros fazem). */
function Formulario({ erro, ...resto }: Partial<PropsCampoDataHora> & { erro?: string }) {
  const [valor, setValor] = useState('');
  const [hora, setHora] = useState('');
  return <Campo rotulo="Prazo" para="prazo" dica="Opcional." erro={erro}>
    <CampoDataHora {...propsDoCampo('prazo', { dica: true, erro })} valor={valor} aoMudar={setValor} hora={hora} aoMudarHora={setHora} {...resto} />
    <output aria-label="Guardado">{valor} {hora}</output>
  </Campo>;
}
const data = () => screen.getByRole('textbox', { name: 'Prazo' });
const hora = () => screen.getByLabelText('Hora');

beforeEach(() => {
  // Hoje: quarta-feira, 18/11/2026, ao meio-dia de Brasília. Só o relógio é simulado: as esperas da tela correm normalmente.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-18T15:00:00.000Z'));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('Campo de data e hora numa caixa só (#299)', () => {
  it('dado o computador, quando a pessoa escreve a data e a hora, então as duas são guardadas, cada uma no seu campo', async () => {
    // Dado
    render(<Formulario />);
    // Quando
    await userEvent.type(data(), '25112026');
    fireEvent.change(hora(), { target: { value: '14:30' } });
    // Então
    expect(screen.getByLabelText('Guardado')).toHaveTextContent('25/11/2026 14:30');
  });

  it('dado o computador, quando a pessoa escolhe um dia no calendário, então o calendário fecha e o foco vai para a hora', async () => {
    // Dado
    render(<Formulario />);
    await userEvent.click(data());
    // Quando
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Calendário' })).getByRole('button', { name: /^sexta-feira, 27 de novembro de 2026$/ }));
    // Então
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(hora()).toHaveFocus());
    expect(data()).toHaveValue('27/11/2026');
  });

  it('dado o calendário aberto, quando a pessoa olha embaixo dele, então não há outra hora: ela fica ao lado da data', async () => {
    // Dado
    render(<Formulario />);
    // Quando
    await userEvent.click(data());
    // Então
    expect(within(screen.getByRole('dialog', { name: 'Calendário' })).queryByLabelText('Hora')).not.toBeInTheDocument();
    expect(screen.getAllByLabelText('Hora')).toHaveLength(1);
  });

  it('dado o aparelho de toque, quando o campo aparece, então a data é a do aparelho e a hora continua ao lado', () => {
    // Dado
    vi.stubGlobal('matchMedia', (consulta: string) => ({ matches: consulta === '(pointer: coarse)', addEventListener: () => {}, removeEventListener: () => {} }));
    // Quando
    render(<Formulario />);
    // Então
    expect(screen.getByLabelText('Prazo')).toHaveAttribute('type', 'date');
    expect(hora()).toHaveAttribute('type', 'time');
  });

  it('dado um erro na hora, quando o campo aparece, então a hora fica marcada e lê a mensagem, e a hora obrigatória é avisada', () => {
    // Quando
    render(<Formulario erro="Informe o prazo para pôr a hora" horaComErro horaObrigatoria rotuloDaHora="Hora da audiência" />);
    // Então
    const daAudiencia = screen.getByLabelText('Hora da audiência');
    expect(daAudiencia).toHaveAttribute('aria-invalid', 'true');
    expect(daAudiencia).toHaveAttribute('aria-required', 'true');
    expect(daAudiencia).toHaveAccessibleDescription(/Informe o prazo para pôr a hora/);
  });

  it('dado o que vem junto, quando o campo aparece, então fica logo depois da caixa', () => {
    // Quando
    render(<Formulario junto={<button type="button">Lembrete</button>} />);
    // Então
    expect(screen.getByRole('button', { name: 'Lembrete' })).toBeInTheDocument();
  });
});
