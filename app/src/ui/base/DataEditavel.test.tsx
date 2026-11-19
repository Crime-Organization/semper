// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Avisos } from '../avisos';
import { erroDaDataDeInicio } from '../../regras/dataDeInicio';
import { DataEditavel } from './DataEditavel';

/** A data de início num cartão: o que é salvo passa a ser a data mostrada. */
function Cartao({ aoSalvar = vi.fn(), podeMudar = true }: { aoSalvar?: (iso: string) => unknown; podeMudar?: boolean }) {
  const [valor, setValor] = useState('2026-11-18');
  return <>
    <Avisos />
    <DataEditavel nome="Data de início" valor={valor} conferir={erroDaDataDeInicio}
      aoSalvar={podeMudar ? iso => { setValor(iso); return aoSalvar(iso); } : undefined} />
    <button type="button">Outro lugar</button>
  </>;
}
const data = () => screen.getByRole('button', { name: /^Data de início: / });
const campo = () => screen.getByRole('textbox', { name: 'Data de início' });

beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-18T15:00:00.000Z')); });
afterEach(() => vi.useRealTimers());

describe('Data que se muda no próprio lugar (#357)', () => {
  it('dado quem pode alterar, quando clica na data, então ela vira o campo, com o calendário aberto e o foco no dia dela', async () => {
    // Dado
    render(<Cartao />);
    // Quando
    await userEvent.click(data());
    // Então
    const calendario = screen.getByRole('dialog', { name: 'Calendário' });
    expect(campo()).toHaveValue('18/11/2026');
    expect(within(calendario).getByRole('button', { name: /^quarta-feira, 18 de novembro de 2026/ })).toHaveFocus();
  });

  it('quando a pessoa escolhe outro dia no calendário, então salva na hora, e o cartão mostra a data nova', async () => {
    // Dado
    const aoSalvar = vi.fn();
    render(<Cartao aoSalvar={aoSalvar} />);
    await userEvent.click(data());
    // Quando
    await userEvent.click(screen.getByRole('button', { name: /^quarta-feira, 25 de novembro de 2026/ }));
    // Então
    await vi.waitFor(() => expect(aoSalvar).toHaveBeenCalledWith('2026-11-25'));
    expect(data()).toHaveTextContent('25/11/2026');
  });

  it('quando a pessoa escreve a data à mão e aperta Enter, então salva', async () => {
    // Dado
    const aoSalvar = vi.fn();
    render(<Cartao aoSalvar={aoSalvar} />);
    await userEvent.click(data());
    // Quando
    await userEvent.click(campo());
    await userEvent.clear(campo());
    await userEvent.type(campo(), '01122026{Enter}');
    // Então
    await vi.waitFor(() => expect(aoSalvar).toHaveBeenCalledWith('2026-12-01'));
  });

  it('quando a pessoa apaga a data e aperta Enter, então o aviso diz por quê, e o campo continua aberto', async () => {
    // Dado
    const aoSalvar = vi.fn();
    render(<Cartao aoSalvar={aoSalvar} />);
    await userEvent.click(data());
    // Quando
    await userEvent.click(campo());
    await userEvent.clear(campo());
    await userEvent.keyboard('{Enter}');
    // Então
    expect(await screen.findByText('Informe a data de início.')).toBeInTheDocument();
    expect(campo()).toBeInTheDocument();
    expect(aoSalvar).not.toHaveBeenCalled();
  });

  it('quando a pessoa aperta Esc, então nada muda e a data volta a ser lida', async () => {
    // Dado
    const aoSalvar = vi.fn();
    render(<Cartao aoSalvar={aoSalvar} />);
    await userEvent.click(data());
    // Quando
    await userEvent.keyboard('{ArrowRight}{Escape}');
    // Então
    expect(screen.queryByRole('textbox', { name: 'Data de início' })).not.toBeInTheDocument();
    expect(data()).toHaveTextContent('18/11/2026');
    expect(aoSalvar).not.toHaveBeenCalled();
  });

  it('dado quem só lê, quando vê a data, então ela não vira campo', () => {
    // Dado
    render(<Cartao podeMudar={false} />);
    // Então
    expect(screen.getByText('18/11/2026')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Data de início/ })).not.toBeInTheDocument();
  });

  describe('Dado um celular', () => {
    beforeEach(() => {
      vi.stubGlobal('matchMedia', (consulta: string) => ({ matches: consulta === '(pointer: coarse)', addEventListener: () => {}, removeEventListener: () => {} }));
    });
    afterEach(() => vi.unstubAllGlobals());
    const doAparelho = () => screen.getByLabelText<HTMLInputElement>('Data de início');

    it('quando a pessoa toca na data, então o campo do aparelho aparece com o foco; e escolher um dia salva na hora', async () => {
      // Dado
      const aoSalvar = vi.fn();
      render(<Cartao aoSalvar={aoSalvar} />);
      // Quando
      await userEvent.click(data());
      // Então
      expect(doAparelho()).toHaveAttribute('type', 'date');
      expect(doAparelho()).toHaveFocus();
      // Quando
      fireEvent.change(doAparelho(), { target: { value: '2026-12-24' } });
      // Então
      await vi.waitFor(() => expect(aoSalvar).toHaveBeenCalledWith('2026-12-24'));
      expect(data()).toHaveTextContent('24/12/2026');
      expect(screen.queryByLabelText('Data de início')).not.toBeInTheDocument();
    });

    it('quando a pessoa sai do campo sem escolher, então ele fecha e a data continua a mesma', async () => {
      // Dado
      const aoSalvar = vi.fn();
      render(<Cartao aoSalvar={aoSalvar} />);
      await userEvent.click(data());
      // Quando
      await userEvent.click(screen.getByRole('button', { name: 'Outro lugar' }));
      // Então
      expect(data()).toHaveTextContent('18/11/2026');
      expect(aoSalvar).not.toHaveBeenCalled();
    });

    it('quando a pessoa aperta Esc num teclado ligado ao tablet, então nada muda', async () => {
      // Dado
      const aoSalvar = vi.fn();
      render(<Cartao aoSalvar={aoSalvar} />);
      await userEvent.click(data());
      // Quando
      fireEvent.keyDown(doAparelho(), { key: 'Escape' });
      // Então
      expect(data()).toHaveTextContent('18/11/2026');
      expect(aoSalvar).not.toHaveBeenCalled();
    });
  });
});
