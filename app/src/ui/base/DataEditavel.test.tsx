// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Desde a #395, a data que se muda no lugar (o início, a assinatura) é o mesmo formulário pequeno do prazo: Cancelar e Salvar, o
// calendário só quando a pessoa pede, sair do campo não grava, e a data errada fica marcada no próprio campo.
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Avisos } from '../avisos';
import { erroDaDataDeInicio } from '../../regras/dataDeInicio';
import { DataEditavel } from './DataEditavel';

/** A data de início num cartão: o que é salvo passa a ser a data mostrada. */
function Cartao({ aoSalvar = vi.fn(), podeMudar = true, inicial = '2026-11-18', conferir = erroDaDataDeInicio }:
  { aoSalvar?: (iso: string | null) => unknown; podeMudar?: boolean; inicial?: string | null; conferir?: (texto: string) => string }) {
  const [valor, setValor] = useState<string | null>(inicial);
  return <>
    <Avisos />
    <DataEditavel nome="Data de início" valor={valor} semData="Ainda não" conferir={conferir}
      aoSalvar={podeMudar ? iso => { setValor(iso); return aoSalvar(iso); } : undefined} />
    <button type="button">Outro lugar</button>
  </>;
}
const data = () => screen.getByRole('button', { name: /^Data de início: / });
const formulario = () => screen.getByRole('group', { name: 'Mudar a data de início' });
const campo = () => within(formulario()).getByRole('textbox', { name: 'Data de início' });
const salvar = () => within(formulario()).getByRole('button', { name: 'Salvar' });

beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-18T15:00:00.000Z')); });
afterEach(() => vi.useRealTimers());

describe('Data que se muda no próprio lugar (#357, #395)', () => {
  it('dado quem pode alterar, quando clica na data, então abre o formulário com o campo e o foco nele, sem o calendário, e com Cancelar e Salvar', async () => {
    // Dado
    render(<Cartao />);
    // Quando
    await userEvent.click(data());
    // Então
    expect(campo()).toHaveValue('18/11/2026');
    expect(campo()).toHaveFocus();
    expect(screen.queryByRole('dialog', { name: 'Calendário' })).not.toBeInTheDocument();
    expect(within(formulario()).getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
    expect(salvar()).toBeInTheDocument();
  });

  it('quando a pessoa abre o calendário e escolhe outro dia, então só o rascunho muda; Salvar grava, e o cartão mostra a data nova', async () => {
    // Dado
    const aoSalvar = vi.fn();
    render(<Cartao aoSalvar={aoSalvar} />);
    await userEvent.click(data());
    // Quando
    await userEvent.click(campo());
    await userEvent.click(within(formulario()).getByRole('button', { name: /^quarta-feira, 25 de novembro de 2026/ }));
    // Então
    expect(campo()).toHaveValue('25/11/2026');
    expect(aoSalvar).not.toHaveBeenCalled();
    // Quando
    await userEvent.click(salvar());
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
    await userEvent.clear(campo());
    await userEvent.type(campo(), '01122026{Enter}');
    // Então
    await vi.waitFor(() => expect(aoSalvar).toHaveBeenCalledWith('2026-12-01'));
  });

  it.each([
    ['apaga a data', '', 'Informe a data de início.'],
    ['escreve uma data que não existe', '31022026', 'Data inexistente.']
  ])('quando a pessoa %s e aperta Enter, então o erro aparece embaixo do campo, que fica marcado, e nada é gravado', async (_caso, texto, erro) => {
    // Dado
    const aoSalvar = vi.fn();
    render(<Cartao aoSalvar={aoSalvar} />);
    await userEvent.click(data());
    // Quando
    await userEvent.clear(campo());
    if (texto) await userEvent.type(campo(), texto);
    await userEvent.keyboard('{Enter}');
    // Então
    expect(within(formulario()).getByRole('alert')).toHaveTextContent(erro);
    expect(campo()).toHaveAttribute('aria-invalid', 'true');
    expect(campo()).toHaveAccessibleDescription(erro);
    expect(aoSalvar).not.toHaveBeenCalled();
  });

  it('quando a pessoa escreve outra data e sai do campo (clica em outro lugar), então nada é gravado, e o formulário continua aberto com o que ela escreveu', async () => {
    // Dado
    const aoSalvar = vi.fn();
    render(<Cartao aoSalvar={aoSalvar} />);
    await userEvent.click(data());
    // Quando
    await userEvent.clear(campo());
    await userEvent.type(campo(), '08082027');
    await userEvent.click(screen.getByRole('button', { name: 'Outro lugar' }));
    // Então
    expect(aoSalvar).not.toHaveBeenCalled();
    expect(campo()).toHaveValue('08/08/2027');
  });

  it('quando a pessoa aperta Esc com o calendário aberto, então só ele fecha; o segundo Esc desfaz, e a data volta a ser lida', async () => {
    // Dado
    const aoSalvar = vi.fn();
    render(<Cartao aoSalvar={aoSalvar} />);
    await userEvent.click(data());
    await userEvent.keyboard('{ArrowDown}{ArrowRight}');
    // Quando
    await userEvent.keyboard('{Escape}');
    // Então
    expect(screen.queryByRole('dialog', { name: 'Calendário' })).not.toBeInTheDocument();
    expect(campo()).toBeInTheDocument();
    // Quando
    await userEvent.keyboard('{Escape}');
    // Então
    expect(screen.queryByRole('group', { name: 'Mudar a data de início' })).not.toBeInTheDocument();
    expect(data()).toHaveTextContent('18/11/2026');
    expect(aoSalvar).not.toHaveBeenCalled();
  });

  it('dado uma data que pode ficar vazia (a assinatura do contrato), quando a pessoa a apaga e salva, então grava nada, e o cartão diz que ainda não há', async () => {
    // Dado
    const aoSalvar = vi.fn();
    render(<Cartao aoSalvar={aoSalvar} conferir={() => ''} />);
    await userEvent.click(data());
    // Quando
    await userEvent.clear(campo());
    await userEvent.click(salvar());
    // Então
    await vi.waitFor(() => expect(aoSalvar).toHaveBeenCalledWith(null));
    expect(data()).toHaveTextContent('Ainda não');
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
    const doAparelho = () => within(formulario()).getByLabelText<HTMLInputElement>('Data de início');

    it('quando a pessoa toca na data, então o campo do aparelho aparece com o foco; e o dia escolhido nele é gravado no Salvar', async () => {
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
      await userEvent.click(salvar());
      // Então
      await vi.waitFor(() => expect(aoSalvar).toHaveBeenCalledWith('2026-12-24'));
      expect(data()).toHaveTextContent('24/12/2026');
      expect(screen.queryByRole('group', { name: 'Mudar a data de início' })).not.toBeInTheDocument();
    });

    it('quando a pessoa toca em Cancelar sem escolher, então o formulário fecha e a data continua a mesma', async () => {
      // Dado
      const aoSalvar = vi.fn();
      render(<Cartao aoSalvar={aoSalvar} />);
      await userEvent.click(data());
      // Quando
      await userEvent.click(within(formulario()).getByRole('button', { name: 'Cancelar' }));
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
