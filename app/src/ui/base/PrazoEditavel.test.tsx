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

  it('dado quem pode alterar, quando clica no prazo, então abre o formulário com o foco no prazo, a hora ao lado, no mesmo campo, e o sino do lembrete, sem o calendário (#299, #395)', async () => {
    // Dado
    render(<Cartao />);
    // Quando
    await userEvent.click(prazo());
    // Então: o calendário só abre quando a pessoa pede (#395)
    expect(screen.queryByRole('dialog', { name: 'Calendário' })).not.toBeInTheDocument();
    expect(within(formulario()).getByRole('textbox', { name: 'Prazo' })).toHaveFocus();
    expect(within(formulario()).getByRole('textbox', { name: 'Prazo' })).toHaveValue('20/11/2026');
    expect(within(formulario()).getByLabelText('Hora do prazo')).toHaveValue('');
    expect(within(formulario()).getAllByLabelText(/^Hora/)).toHaveLength(1);
    expect(within(formulario()).getByRole('button', { name: 'Lembrete: Sem lembrete' })).toBeInTheDocument();
    expect(within(formulario()).queryByRole('combobox')).not.toBeInTheDocument();
    // Quando: a pessoa clica no campo
    await userEvent.click(within(formulario()).getByRole('textbox', { name: 'Prazo' }));
    // Então: o calendário abre dentro do formulário, antes de Cancelar e Salvar (empurra os dois, não os cobre); a hora não fica
    // embaixo dele, nem o "Pronto": ela fica ao lado do prazo, como no cadastro.
    const calendario = within(formulario()).getByRole('dialog', { name: 'Calendário' });
    expect(within(calendario).queryByLabelText(/Hora/)).not.toBeInTheDocument();
    expect(within(calendario).queryByRole('button', { name: 'Pronto' })).not.toBeInTheDocument();
    const salvar = within(formulario()).getByRole('button', { name: 'Salvar' });
    expect(calendario.compareDocumentPosition(salvar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('quando a pessoa escolhe o dia no calendário, então ele fecha e o foco vai para a hora, ao lado', async () => {
    // Dado
    render(<Cartao />);
    await userEvent.click(prazo());
    await userEvent.click(within(formulario()).getByRole('textbox', { name: 'Prazo' }));
    // Quando
    await userEvent.click(screen.getByRole('button', { name: /^quarta-feira, 25 de novembro de 2026/ }));
    // Então
    expect(screen.queryByRole('dialog', { name: 'Calendário' })).not.toBeInTheDocument();
    await vi.waitFor(() => expect(within(formulario()).getByLabelText('Hora do prazo')).toHaveFocus());
  });

  it('dado o calendário aberto, quando a pessoa aperta Tab no último botão dele, então o foco vai para a hora, e Shift+Tab no primeiro volta ao prazo (#395)', async () => {
    // Dado
    render(<Cartao />);
    await userEvent.click(prazo());
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('button', { name: /^sexta-feira, 20 de novembro de 2026/ })).toHaveFocus();
    // Quando
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Hoje' })).toHaveFocus();
    await userEvent.tab();
    // Então
    expect(within(formulario()).getByLabelText('Hora do prazo')).toHaveFocus();
    expect(screen.queryByRole('dialog', { name: 'Calendário' })).not.toBeInTheDocument();
    // Quando: de novo, para trás
    await userEvent.click(within(formulario()).getByRole('textbox', { name: 'Prazo' }));
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.tab({ shift: true });
    await userEvent.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Mês anterior' })).toHaveFocus();
    await userEvent.tab({ shift: true });
    // Então
    expect(within(formulario()).getByRole('textbox', { name: 'Prazo' })).toHaveFocus();
  });

  it('quando a pessoa escolhe o dia, a hora e o lembrete e salva, então grava tudo junto e o cartão mostra o prazo novo', async () => {
    // Dado
    const aoSalvar = vi.fn();
    render(<Cartao aoSalvar={aoSalvar} />);
    await userEvent.click(prazo());
    await userEvent.click(within(formulario()).getByRole('textbox', { name: 'Prazo' }));
    // Quando
    await userEvent.click(screen.getByRole('button', { name: /^quarta-feira, 25 de novembro de 2026/ }));
    fireEvent.change(within(formulario()).getByLabelText('Hora do prazo'), { target: { value: '09:30' } });
    await userEvent.click(within(formulario()).getByRole('button', { name: /^Lembrete:/ }));
    await userEvent.click(screen.getByRole('menuitemradio', { name: '1 dia antes' }));
    expect(within(formulario()).getByRole('button', { name: 'Lembrete: 1 dia antes' })).toBeInTheDocument();
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

  it.each([
    ['o lembrete', { prazo: '2026-11-20', prazo_hora: null, lembrete: 1440 as const }],
    ['a hora', { prazo: '2026-11-20', prazo_hora: '14:00:00', lembrete: null }]
  ])('dado um prazo com %s, quando a pessoa apaga a data e salva, então o prazo sai inteiro (com a hora e o lembrete) e o cartão diz "Sem prazo" (#395)', async (_caso, inicial) => {
    // Dado
    const aoSalvar = vi.fn();
    render(<Cartao inicial={inicial} aoSalvar={aoSalvar} />);
    await userEvent.click(prazo());
    // Quando
    await userEvent.clear(within(formulario()).getByRole('textbox', { name: 'Prazo' }));
    await userEvent.click(within(formulario()).getByRole('button', { name: 'Salvar' }));
    // Então: nenhuma mensagem pedindo o prazo de volta; o que se grava é sem prazo, sem hora e sem lembrete
    await vi.waitFor(() => expect(aoSalvar).toHaveBeenCalled());
    expect(prazoAoGravar(aoSalvar.mock.calls[0][0])).toEqual({ prazo: null, prazo_hora: null, lembrete: null });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(prazo()).toHaveTextContent('Sem prazo');
  });

  it('dado as opções do sino abertas, quando a pessoa aperta Esc, então só o menu fecha: o prazo continua aberto para mudar', async () => {
    // Dado
    render(<Cartao />);
    await userEvent.click(prazo());
    await userEvent.click(within(formulario()).getByRole('button', { name: /^Lembrete:/ }));
    // Quando
    await userEvent.keyboard('{Escape}');
    // Então
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(formulario()).toBeInTheDocument();
    expect(within(formulario()).getByRole('button', { name: /^Lembrete:/ })).toHaveFocus();
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
    await userEvent.click(within(formulario()).getByRole('button', { name: /^Lembrete:/ }));
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Na hora do prazo' }));
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
