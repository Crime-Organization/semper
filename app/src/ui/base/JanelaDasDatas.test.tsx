// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// A janela das datas do cartão (#422), pelo início e prazo da tarefa (InicioEPrazo): no cartão, só o resumo; ao clicar, a janela
// que flutua sobre o cartão, com o calendário do mês, o início, a entrega com a caixa de marcar, a hora, o lembrete, Salvar e Remover.
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CAMPOS_DO_PRAZO, errosDosCampos, type InicioEPrazoGravados } from '../../regras/datasNoCartao';
import { TAREFA_VAZIA, validarTarefa } from '../../regras/tarefa';
import { Avisos } from '../avisos';
import { InicioEPrazo } from './InicioEPrazo';

const COM_PRAZO: InicioEPrazoGravados = { data_inicio: '2026-11-18', prazo: '2026-11-30', prazo_hora: '14:00:00', lembrete: 60 };
const SEM_PRAZO: InicioEPrazoGravados = { data_inicio: '2026-11-18', prazo: null, prazo_hora: null, lembrete: null };

/** As datas num cartão: o que é salvo passa a ser o que o cartão mostra. */
function Cartao({ inicial = COM_PRAZO, aoSalvar = vi.fn(), podeMudar = true }: { inicial?: InicioEPrazoGravados; aoSalvar?: (g: InicioEPrazoGravados) => unknown; podeMudar?: boolean }) {
  const [valor, setValor] = useState(inicial);
  return <>
    <Avisos />
    <InicioEPrazo nomeDoPrazo="Prazo" valor={valor} conferirPrazo={c => errosDosCampos(validarTarefa, TAREFA_VAZIA, c, CAMPOS_DO_PRAZO)}
      aoSalvar={podeMudar ? async g => { await aoSalvar(g); setValor(g); } : undefined} />
    <button type="button">Outro lugar</button>
  </>;
}
const datas = () => screen.getByRole('button', { name: /^Datas: / });
const janela = () => screen.getByRole('dialog', { name: 'Mudar as datas' });
const dentro = () => within(janela());
const prazo = () => dentro().getByRole('textbox', { name: 'Prazo' });
const inicio = () => dentro().getByRole('textbox', { name: 'Data de início' });
const entrega = () => dentro().getByRole('checkbox', { name: 'Data de entrega' });
const dia = (nome: RegExp) => within(dentro().getByRole('group', { name: 'Calendário' })).getByRole('button', { name: nome });

beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-18T15:00:00.000Z')); });
afterEach(() => vi.useRealTimers());

describe('As datas do cartão numa janela própria (#422)', () => {
  it('dado o cartão, quando a pessoa o lê, então vê só o resumo curto, sem formulário dentro do cartão', () => {
    // Quando
    render(<Cartao />);
    // Então
    expect(datas()).toHaveTextContent('Início 18/11/2026 · Entrega 30/11/2026 às 14:00');
    expect(datas()).toHaveTextContent('1 hora antes');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('quando a pessoa clica em "Datas", então a janela abre com o nome e o X, o calendário (sem o "Hoje", #431), o início, a entrega com a caixa marcada, a hora numa lista, o lembrete, Salvar e Remover', async () => {
    // Dado
    render(<Cartao />);
    // Quando
    await userEvent.click(datas());
    // Então
    expect(dentro().getByRole('group', { name: 'Calendário' })).toBeInTheDocument();
    expect(dentro().getByText('Datas')).toBeInTheDocument();
    expect(dentro().getByRole('button', { name: 'Fechar' })).toBeInTheDocument();
    // A regra mudou na #431: o "Hoje" sozinho numa linha deixava a janela alta; o dia de hoje fica marcado na grade
    expect(dentro().queryByRole('button', { name: 'Hoje' })).not.toBeInTheDocument();
    expect(inicio()).toHaveValue('18/11/2026');
    expect(entrega()).toBeChecked();
    expect(prazo()).toHaveValue('30/11/2026');
    expect(prazo()).toHaveFocus();
    expect(dentro().getByRole('combobox', { name: 'Hora do prazo' })).toHaveValue('14:00');
    expect(dentro().getByRole('combobox', { name: 'Lembrete' })).toHaveValue('60');
    expect(dentro().getByRole('button', { name: 'Salvar' })).toBeInTheDocument();
    expect(dentro().getByRole('button', { name: 'Remover' })).toBeInTheDocument();
    expect(datas()).toHaveAttribute('aria-expanded', 'true');
  });

  it('dada a janela aberta, quando a pessoa escolhe um dia no calendário e salva, então o dia vai para a entrega, é gravado, e a janela fecha', async () => {
    // Dado
    const aoSalvar = vi.fn();
    render(<Cartao aoSalvar={aoSalvar} />);
    await userEvent.click(datas());
    // Quando
    await userEvent.click(dia(/^quarta-feira, 25 de novembro de 2026/));
    // Então: só o rascunho muda
    expect(prazo()).toHaveValue('25/11/2026');
    expect(aoSalvar).not.toHaveBeenCalled();
    // Quando
    await userEvent.click(dentro().getByRole('button', { name: 'Salvar' }));
    // Então
    await vi.waitFor(() => expect(aoSalvar).toHaveBeenCalledWith({ data_inicio: '2026-11-18', prazo: '2026-11-25', prazo_hora: '14:00', lembrete: 60 }));
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(datas()).toHaveTextContent('Entrega 25/11/2026 às 14:00');
    expect(datas()).toHaveFocus();
  });

  it('dada a janela aberta, quando a pessoa clica no início e escolhe um dia, então o calendário passa a escrever no início', async () => {
    // Dado
    const aoSalvar = vi.fn();
    render(<Cartao aoSalvar={aoSalvar} />);
    await userEvent.click(datas());
    // Quando
    await userEvent.click(inicio());
    await userEvent.click(dia(/^sexta-feira, 20 de novembro de 2026/));
    await userEvent.click(dentro().getByRole('button', { name: 'Salvar' }));
    // Então
    await vi.waitFor(() => expect(aoSalvar).toHaveBeenCalledWith(expect.objectContaining({ data_inicio: '2026-11-20', prazo: '2026-11-30' })));
  });

  it('dada uma tarefa sem prazo, quando a pessoa marca a entrega, então ela começa hoje, a hora e o lembrete se ligam, e Salvar grava', async () => {
    // Dado
    const aoSalvar = vi.fn();
    render(<Cartao inicial={SEM_PRAZO} aoSalvar={aoSalvar} />);
    expect(datas()).toHaveTextContent('Início 18/11/2026 · Sem prazo');
    await userEvent.click(datas());
    expect(entrega()).not.toBeChecked();
    expect(entrega()).toHaveFocus();
    expect(prazo()).toBeDisabled();
    expect(dentro().queryByRole('button', { name: 'Remover' })).not.toBeInTheDocument();
    // Quando
    await userEvent.click(entrega());
    // Então
    expect(prazo()).toHaveValue('18/11/2026');
    expect(dentro().getByLabelText('Hora do prazo')).toBeEnabled();
    // Quando
    await userEvent.selectOptions(dentro().getByRole('combobox', { name: 'Lembrete' }), '1440');
    await userEvent.click(dentro().getByRole('button', { name: 'Salvar' }));
    // Então
    await vi.waitFor(() => expect(aoSalvar).toHaveBeenCalledWith({ data_inicio: '2026-11-18', prazo: '2026-11-18', prazo_hora: null, lembrete: 1440 }));
  });

  it('dado um prazo, quando a pessoa usa o Remover, então o prazo sai inteiro (com a hora e o lembrete), o início fica, e a janela fecha', async () => {
    // Dado
    const aoSalvar = vi.fn();
    render(<Cartao aoSalvar={aoSalvar} />);
    await userEvent.click(datas());
    // Quando
    await userEvent.click(dentro().getByRole('button', { name: 'Remover' }));
    // Então
    await vi.waitFor(() => expect(aoSalvar).toHaveBeenCalledWith({ data_inicio: '2026-11-18', prazo: null, prazo_hora: null, lembrete: null }));
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(datas()).toHaveTextContent('Início 18/11/2026 · Sem prazo');
  });

  it('dada uma mudança na janela, quando a pessoa aperta Esc ou clica fora, então a janela fecha e nada muda', async () => {
    // Dado
    const aoSalvar = vi.fn();
    render(<Cartao aoSalvar={aoSalvar} />);
    await userEvent.click(datas());
    fireEvent.change(prazo(), { target: { value: '01/12/2026' } });
    // Quando
    await userEvent.keyboard('{Escape}');
    // Então
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(datas()).toHaveFocus();
    // Quando: abre de novo, muda e clica fora
    await userEvent.click(datas());
    expect(prazo()).toHaveValue('30/11/2026');
    fireEvent.change(prazo(), { target: { value: '01/12/2026' } });
    await userEvent.click(screen.getByRole('button', { name: 'Outro lugar' }));
    // Então
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(aoSalvar).not.toHaveBeenCalled();
    expect(datas()).toHaveTextContent('Entrega 30/11/2026');
  });

  it('dado um prazo que não existe, quando a pessoa salva, então o erro aparece, o campo fica marcado, nada é gravado e a janela fica aberta', async () => {
    // Dado
    const aoSalvar = vi.fn();
    render(<Cartao aoSalvar={aoSalvar} />);
    await userEvent.click(datas());
    // Quando
    fireEvent.change(prazo(), { target: { value: '31/02/2027' } });
    await userEvent.keyboard('{Enter}');
    // Então
    expect(dentro().getByRole('alert')).toHaveTextContent('Data inexistente.');
    expect(prazo()).toHaveAttribute('aria-invalid', 'true');
    expect(aoSalvar).not.toHaveBeenCalled();
    expect(janela()).toBeInTheDocument();
  });

  it('dada uma gravação que falha, quando a pessoa salva, então o erro aparece e a janela continua aberta com o que ela escreveu', async () => {
    // Dado
    const aoSalvar = vi.fn().mockRejectedValue(new Error('Sem conexão.'));
    render(<Cartao aoSalvar={aoSalvar} />);
    await userEvent.click(datas());
    await userEvent.click(dia(/^quarta-feira, 25 de novembro de 2026/));
    // Quando
    await userEvent.click(dentro().getByRole('button', { name: 'Salvar' }));
    // Então
    await vi.waitFor(() => expect(screen.getAllByText('Sem conexão.').length).toBeGreaterThan(0));
    expect(prazo()).toHaveValue('25/11/2026');
  });

  it('dada uma mudança na janela, quando a pessoa clica no X, então a janela fecha, nada muda e o foco volta às datas (#431)', async () => {
    // Dado
    const aoSalvar = vi.fn();
    render(<Cartao aoSalvar={aoSalvar} />);
    await userEvent.click(datas());
    await userEvent.click(dia(/^quarta-feira, 25 de novembro de 2026/));
    // Quando
    await userEvent.click(dentro().getByRole('button', { name: 'Fechar' }));
    // Então
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(aoSalvar).not.toHaveBeenCalled();
    expect(datas()).toHaveFocus();
    expect(datas()).toHaveTextContent('Entrega 30/11/2026');
  });

  it('dada a entrega, quando a pessoa escolhe a hora, então escolhe numa lista de horários de 15 em 15 minutos, e Salvar grava (#431)', async () => {
    // Dado
    const aoSalvar = vi.fn();
    render(<Cartao aoSalvar={aoSalvar} />);
    await userEvent.click(datas());
    const hora = dentro().getByRole('combobox', { name: 'Hora do prazo' });
    // Então
    expect(within(hora).getByRole('option', { name: 'Sem hora' })).toBeInTheDocument();
    expect(within(hora).getByRole('option', { name: '14:15' })).toBeInTheDocument();
    expect(within(hora).getByRole('option', { name: '23:59' })).toBeInTheDocument();
    // Quando
    await userEvent.selectOptions(hora, '16:45');
    await userEvent.click(dentro().getByRole('button', { name: 'Salvar' }));
    // Então
    await vi.waitFor(() => expect(aoSalvar).toHaveBeenCalledWith({ data_inicio: '2026-11-18', prazo: '2026-11-30', prazo_hora: '16:45', lembrete: 60 }));
  });

  it('dada a janela, quando a pessoa a vê, então o nome de cada data marca a caixa dela, e Salvar vem antes de Remover (#431)', async () => {
    // Dado
    render(<Cartao />);
    await userEvent.click(datas());
    // Quando: o clique no nome "Data de entrega" desmarca a caixa
    await userEvent.click(dentro().getByText('Data de entrega'));
    // Então
    expect(entrega()).not.toBeChecked();
    expect(prazo()).toBeDisabled();
    expect(dentro().getByRole('combobox', { name: 'Hora do prazo' })).toBeDisabled();
    const botoes = dentro().getAllByRole('button', { name: /^(Salvar|Remover)$/ }).map(b => b.textContent);
    expect(botoes).toEqual(['Salvar', 'Remover']);
  });

  it('dado quem só lê o cartão, quando olha as datas, então vê o resumo como texto, sem botão nem janela', () => {
    // Quando
    render(<Cartao podeMudar={false} />);
    // Então
    expect(screen.getByText('18/11/2026')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Datas/ })).not.toBeInTheDocument();
  });
});
