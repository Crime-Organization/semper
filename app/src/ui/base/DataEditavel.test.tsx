// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Uma data só do cartão (a assinatura do contrato), que se muda na janela das datas (#422): a caixa de marcar, o calendário,
// Salvar e Remover. Quem só lê vê a data comum.
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { erroDaAssinatura } from '../../regras/contrato';
import { Avisos } from '../avisos';
import { DataEditavel } from './DataEditavel';

/** A assinatura num cartão: o que é salvo passa a ser a data mostrada. */
function Cartao({ aoSalvar = vi.fn(), podeMudar = true, inicial = '2026-02-02' }: { aoSalvar?: (iso: string | null) => unknown; podeMudar?: boolean; inicial?: string | null }) {
  const [valor, setValor] = useState<string | null>(inicial);
  return <>
    <Avisos />
    <DataEditavel nome="Data da assinatura" rotulo="Assinado em" valor={valor} semData="Ainda não" conferir={erroDaAssinatura}
      aoSalvar={podeMudar ? iso => { setValor(iso); return aoSalvar(iso); } : undefined} />
  </>;
}
const data = () => screen.getByRole('button', { name: /^Data da assinatura: / });
const janela = () => within(screen.getByRole('dialog', { name: 'Mudar a data da assinatura' }));
const campo = () => janela().getByRole('textbox', { name: 'Data da assinatura' });

beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-18T15:00:00.000Z')); });
afterEach(() => vi.useRealTimers());

describe('Uma data só do cartão, na janela das datas (#357, #422)', () => {
  it('dado quem pode alterar, quando clica na data, escolhe outro dia no calendário e salva, então grava e o cartão mostra a data nova', async () => {
    // Dado
    const aoSalvar = vi.fn();
    render(<Cartao aoSalvar={aoSalvar} />);
    // Quando
    await userEvent.click(data());
    expect(janela().getByRole('checkbox', { name: 'Assinado em' })).toBeChecked();
    expect(campo()).toHaveValue('02/02/2026');
    await userEvent.click(within(janela().getByRole('group', { name: 'Calendário' })).getByRole('button', { name: /^segunda-feira, 9 de fevereiro de 2026/ }));
    await userEvent.click(janela().getByRole('button', { name: 'Salvar' }));
    // Então
    await vi.waitFor(() => expect(aoSalvar).toHaveBeenCalledWith('2026-02-09'));
    expect(data()).toHaveTextContent('09/02/2026');
  });

  it('dado um contrato assinado, quando a pessoa usa o Remover, então a assinatura sai e o cartão diz que ainda não', async () => {
    // Dado
    const aoSalvar = vi.fn();
    render(<Cartao aoSalvar={aoSalvar} />);
    await userEvent.click(data());
    // Quando
    await userEvent.click(janela().getByRole('button', { name: 'Remover' }));
    // Então
    await vi.waitFor(() => expect(aoSalvar).toHaveBeenCalledWith(null));
    expect(data()).toHaveTextContent('Ainda não');
  });

  it('dada uma data que não existe, quando a pessoa salva, então o erro aparece e nada é gravado', async () => {
    // Dado
    const aoSalvar = vi.fn();
    render(<Cartao aoSalvar={aoSalvar} />);
    await userEvent.click(data());
    // Quando
    fireEvent.change(campo(), { target: { value: '31/02/2026' } });
    await userEvent.click(janela().getByRole('button', { name: 'Salvar' }));
    // Então
    expect(janela().getByRole('alert')).toHaveTextContent('Data inexistente.');
    expect(aoSalvar).not.toHaveBeenCalled();
  });

  it('dado quem só lê, quando olha a data, então é só texto', () => {
    // Quando
    render(<Cartao podeMudar={false} inicial={null} />);
    // Então
    expect(screen.getByText('Ainda não')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
