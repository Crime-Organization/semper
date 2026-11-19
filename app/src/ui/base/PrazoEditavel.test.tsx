// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Avisos } from '../avisos';
import { CAMPOS_DO_PRAZO, errosDosCampos, prazoAoGravar, type CamposDoPrazo, type PrazoGravado } from '../../regras/datasNoCartao';
import { TAREFA_VAZIA, validarTarefa } from '../../regras/tarefa';
import { PrazoEditavel } from './PrazoEditavel';

const conferir = (c: CamposDoPrazo) => errosDosCampos(validarTarefa, TAREFA_VAZIA, c, CAMPOS_DO_PRAZO);

/** O prazo num cartão: o que é salvo passa a ser o prazo mostrado. */
function Cartao({ inicial = { prazo: '2026-11-20', prazo_hora: null, lembrete: null }, aoSalvar = vi.fn(), podeMudar = true }:
  { inicial?: PrazoGravado; aoSalvar?: (c: CamposDoPrazo) => unknown; podeMudar?: boolean }) {
  const [valor, setValor] = useState<PrazoGravado>(inicial);
  return <>
    <Avisos />
    <PrazoEditavel nome="Prazo" valor={valor} conferir={conferir}
      aoSalvar={podeMudar ? async c => { await aoSalvar(c); setValor(prazoAoGravar(c)); } : undefined} />
  </>;
}
const prazo = () => screen.getByRole('button', { name: /^Prazo: / });
const formulario = () => screen.getByRole('group', { name: 'Mudar o prazo' });

beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-18T15:00:00.000Z')); });
afterEach(() => vi.useRealTimers());

describe('Prazo que se muda no próprio lugar do cartão (#361)', () => {
  it('dado um prazo com hora e lembrete, quando o cartão o mostra, então mostra o prazo, a hora e o sino com o lembrete', () => {
    // Quando
    render(<Cartao inicial={{ prazo: '2026-11-20', prazo_hora: '14:00:00', lembrete: 60 }} />);
    // Então
    expect(prazo()).toHaveTextContent('20/11/2026 às 14:00');
    expect(prazo()).toHaveTextContent('Lembrete: 1 hora antes');
    expect(prazo()).toHaveAccessibleName('Prazo: 20/11/2026 às 14:00, lembrete: 1 hora antes. Clique para mudar');
  });

  it('dado quem pode alterar, quando clica no prazo, então abre o calendário, a hora e o sino do lembrete', async () => {
    // Dado
    render(<Cartao />);
    // Quando
    await userEvent.click(prazo());
    // Então
    const calendario = screen.getByRole('dialog', { name: 'Calendário' });
    expect(within(calendario).getByLabelText('Hora')).toBeInTheDocument();
    expect(within(formulario()).getByRole('textbox', { name: 'Prazo' })).toHaveValue('20/11/2026');
    expect(within(formulario()).getByLabelText('Hora do prazo')).toHaveValue('');
    // A hora de fora do calendário tem um nome só dela: o leitor de tela não anuncia dois campos "Hora".
    expect(within(formulario()).getByLabelText('Hora do prazo')).toHaveAccessibleName('Hora do prazo');
    expect(within(formulario()).getByLabelText('Lembrete')).toHaveValue('');
  });

  it('quando a pessoa escolhe o dia, a hora e o lembrete e salva, então grava tudo junto e o cartão mostra o prazo novo', async () => {
    // Dado
    const aoSalvar = vi.fn();
    render(<Cartao aoSalvar={aoSalvar} />);
    await userEvent.click(prazo());
    // Quando
    await userEvent.click(screen.getByRole('button', { name: /^quarta-feira, 25 de novembro de 2026/ }));
    fireEvent.change(within(formulario()).getByLabelText('Hora do prazo'), { target: { value: '09:30' } });
    await userEvent.selectOptions(within(formulario()).getByLabelText('Lembrete'), '1 dia antes');
    await userEvent.click(within(formulario()).getByRole('button', { name: 'Salvar' }));
    // Então
    await vi.waitFor(() => expect(aoSalvar).toHaveBeenCalledWith({ prazo: '25/11/2026', hora: '09:30', lembrete: 1440 }));
    expect(prazo()).toHaveTextContent('25/11/2026 às 09:30');
    expect(prazo()).toHaveTextContent('1 dia antes');
    expect(screen.queryByRole('group', { name: 'Mudar o prazo' })).not.toBeInTheDocument();
  });

  it('quando a pessoa escreve o prazo à mão e aperta Enter, então salva', async () => {
    // Dado
    const aoSalvar = vi.fn();
    render(<Cartao aoSalvar={aoSalvar} />);
    await userEvent.click(prazo());
    const campo = within(formulario()).getByRole('textbox', { name: 'Prazo' });
    // Quando
    await userEvent.clear(campo);
    await userEvent.type(campo, '01122026{Enter}');
    // Então
    await vi.waitFor(() => expect(aoSalvar).toHaveBeenCalledWith({ prazo: '01/12/2026', hora: '', lembrete: null }));
  });

  it('quando a pessoa apaga o prazo e deixa o lembrete, então a mensagem do cadastro aparece e nada é gravado', async () => {
    // Dado
    const aoSalvar = vi.fn();
    render(<Cartao inicial={{ prazo: '2026-11-20', prazo_hora: null, lembrete: 30 }} aoSalvar={aoSalvar} />);
    await userEvent.click(prazo());
    // Quando
    await userEvent.clear(within(formulario()).getByRole('textbox', { name: 'Prazo' }));
    await userEvent.click(within(formulario()).getByRole('button', { name: 'Salvar' }));
    // Então
    expect(screen.getByRole('alert')).toHaveTextContent('Informe o prazo para marcar o lembrete');
    expect(within(formulario()).getByLabelText('Lembrete')).toHaveAttribute('aria-invalid', 'true');
    expect(within(formulario()).getByLabelText('Lembrete')).toHaveAccessibleDescription(/Informe o prazo para marcar o lembrete/);
    expect(aoSalvar).not.toHaveBeenCalled();
  });

  it('quando a pessoa não muda nada e salva, então só fecha, sem gravar', async () => {
    // Dado
    const aoSalvar = vi.fn();
    render(<Cartao aoSalvar={aoSalvar} />);
    await userEvent.click(prazo());
    // Quando
    await userEvent.click(within(formulario()).getByRole('button', { name: 'Salvar' }));
    // Então
    expect(aoSalvar).not.toHaveBeenCalled();
    expect(prazo()).toBeInTheDocument();
  });

  it('quando a gravação falha, então o erro aparece e o formulário continua aberto', async () => {
    // Dado
    render(<Cartao aoSalvar={() => Promise.reject(new Error('Sem conexão.'))} />);
    await userEvent.click(prazo());
    // Quando
    await userEvent.selectOptions(within(formulario()).getByLabelText('Lembrete'), 'Na hora do prazo');
    await userEvent.click(within(formulario()).getByRole('button', { name: 'Salvar' }));
    // Então
    expect(await screen.findByText('Sem conexão.')).toBeInTheDocument();
    expect(formulario()).toBeInTheDocument();
  });

  it('dado um cartão sem prazo, quando o cartão o mostra, então diz "Sem prazo", sem o sino', () => {
    // Quando
    render(<Cartao inicial={{ prazo: null }} />);
    // Então
    expect(prazo()).toHaveTextContent(/^Sem prazo$/);
  });

  it('dado quem só lê, quando vê o prazo, então é só texto, sem botão nem campo', async () => {
    // Dado
    render(<Cartao inicial={{ prazo: '2026-11-20', prazo_hora: '14:00:00', lembrete: 0 }} podeMudar={false} />);
    // Quando
    await userEvent.click(screen.getByText('20/11/2026 às 14:00'));
    // Então
    expect(screen.getByText('Na hora do prazo')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
});
