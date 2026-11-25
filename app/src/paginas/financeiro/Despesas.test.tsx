// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// As despesas do escritório a pagar (#439), na aba Obrigações do Financeiro.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DadosDespesas, DespesaDoEscritorio } from '../../dados';
import { DespesasDoEscritorio } from './Despesas';

const SD = vi.hoisted(() => ({
  financeiroDespesaCriar: vi.fn<DadosDespesas['financeiroDespesaCriar']>(),
  financeiroDespesaMudar: vi.fn<DadosDespesas['financeiroDespesaMudar']>(),
  financeiroDespesaPagar: vi.fn<DadosDespesas['financeiroDespesaPagar']>(),
  financeiroDespesaDesfazerPagamento: vi.fn<DadosDespesas['financeiroDespesaDesfazerPagamento']>(),
  financeiroDespesaExcluir: vi.fn<DadosDespesas['financeiroDespesaExcluir']>(),
  financeiroDespesaRestaurar: vi.fn<DadosDespesas['financeiroDespesaRestaurar']>(),
  financeiroDespesaHistorico: vi.fn<DadosDespesas['financeiroDespesaHistorico']>()
}));
const avisos = vi.hoisted(() => ({ avisar: vi.fn(), falha: vi.fn(), feito: vi.fn() }));
vi.mock('../../dados', () => ({ SD }));
vi.mock('../../ui/avisos', async original => ({ ...(await original<typeof import('../../ui/avisos')>()), ...avisos }));
vi.mock('../../ui/preferencias', () => ({ lerPreferencia: <T,>(_chave: string, padrao: T) => padrao, salvarPreferencia: vi.fn() }));
vi.mock('../../ui/sessao', () => ({ useCtx: () => ({ ehAdmin: true, equipe: [], perfil: { id: 'u-1' } }) }));

const HOJE = '2030-03-10';
const A_PAGAR: DespesaDoEscritorio = { id: 'd-1', descricao: 'Conta de luz', valor: 25000, vencimento: '2030-03-15', paga_em: null, repeticao: null };
const PAGA: DespesaDoEscritorio = { id: 'd-2', descricao: 'Aluguel', valor: 150000, vencimento: '2030-03-05', paga_em: '2030-03-04', repeticao: null };
const MENSAL: DespesaDoEscritorio = { id: 'd-3', descricao: 'DAS', valor: 90000, vencimento: '2030-03-20', paga_em: null, repeticao: { frequencia: 'mes', intervalo: 1, ate: null, vezes: null } };

function abrir(lista: DespesaDoEscritorio[] = [A_PAGAR, PAGA, MENSAL]) {
  const aoMudar = vi.fn();
  render(<MemoryRouter><DespesasDoEscritorio lista={lista} periodo="2030-03" hoje={HOJE} aoMudar={aoMudar} /></MemoryRouter>);
  return aoMudar;
}

describe('Despesas do escritório', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    SD.financeiroDespesaCriar.mockResolvedValue({ id: 'nova', ids: ['n-2', 'n-3'] });
    SD.financeiroDespesaPagar.mockResolvedValue();
    SD.financeiroDespesaExcluir.mockResolvedValue(['d-3', 'd-4']);
    SD.financeiroDespesaHistorico.mockResolvedValue([]);
  });

  it('dadas despesas pagas e a pagar, quando abre, então cada uma mostra o vencimento, o valor e a situação, e o total é só do que falta pagar', () => {
    // Quando
    abrir();
    // Então
    const tabela = within(screen.getByRole('table', { name: 'Despesas do escritório' }));
    const [, luz, aluguel, das] = tabela.getAllByRole('row');
    expect(luz).toHaveTextContent('Conta de luz15/03/2030R$ 250,00A pagar');
    expect(aluguel).toHaveTextContent('Paga em 04/03/2030');
    expect(das).toHaveTextContent('Todo mês, sem data para terminar');
    expect(within(aluguel).getByRole('button', { name: 'Desfazer pagamento' })).toBeTruthy();
    expect(within(luz).getByRole('button', { name: 'Marcar como paga: Conta de luz, vence em 15/03/2030' })).toBeTruthy();
    expect(tabela.getByRole('row', { name: /Total a pagar/ })).toHaveTextContent('R$ 1.150,00');
  });

  it('dado nenhum vencimento no mês, quando abre, então diz que não há despesa', () => {
    // Quando
    abrir([]);
    // Então
    expect(screen.getByText('Nenhuma despesa neste mês.')).toBeTruthy();
  });

  it('quando cadastra uma despesa de todo mês, três vezes, então grava a regra e avisa quantas datas nasceram', async () => {
    // Dado
    const aoMudar = abrir();
    await userEvent.click(screen.getByRole('button', { name: 'Nova despesa' }));
    const form = within(screen.getByRole('form', { name: 'Nova despesa' }));
    // Quando
    await userEvent.type(form.getByLabelText(/Descrição/), 'Salário');
    await userEvent.type(form.getByLabelText(/Valor/), '3000,00');
    await userEvent.selectOptions(form.getByLabelText(/Repetir/), 'Todo mês');
    await userEvent.click(form.getByRole('radio', { name: 'Depois de algumas vezes' }));
    await userEvent.type(form.getByLabelText(/Quantas vezes/), '3');
    await userEvent.click(form.getByRole('button', { name: 'Cadastrar despesa' }));
    // Então
    expect(SD.financeiroDespesaCriar).toHaveBeenCalledWith({ descricao: 'Salário', valor: 300000, vencimento: HOJE }, { frequencia: 'mes', intervalo: 1, ate: null, vezes: 3 });
    expect(avisos.feito).toHaveBeenCalledWith('Despesa cadastrada, com mais 2 datas da repetição.', 'cadastro da despesa', expect.any(Function));
    expect(aoMudar).toHaveBeenCalled();
  });

  it('quando cadastra sem descrição nem valor, então mostra o que falta e não grava', async () => {
    // Dado
    abrir();
    await userEvent.click(screen.getByRole('button', { name: 'Nova despesa' }));
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Cadastrar despesa' }));
    // Então
    expect(screen.getByText('Diga do que se trata.')).toBeTruthy();
    expect(screen.getByText('Informe o valor.')).toBeTruthy();
    expect(SD.financeiroDespesaCriar).not.toHaveBeenCalled();
  });

  it('quando marca como paga, então grava o dia do pagamento e oferece desfazer', async () => {
    // Dado
    const aoMudar = abrir();
    await userEvent.click(screen.getByRole('button', { name: 'Marcar como paga: Conta de luz, vence em 15/03/2030' }));
    // Quando
    await userEvent.click(within(screen.getByRole('form', { name: /Marcar como paga/ })).getByRole('button', { name: 'Confirmar' }));
    // Então
    expect(SD.financeiroDespesaPagar).toHaveBeenCalledWith('d-1', HOJE);
    expect(avisos.feito).toHaveBeenCalledWith('Despesa marcada como paga.', 'marcação de paga', expect.any(Function));
    expect(aoMudar).toHaveBeenCalled();
  });

  it('dada uma despesa que se repete, quando a abre e exclui esta e as seguintes, então pede a confirmação e avisa que a repetição parou', async () => {
    // Dado
    abrir();
    await userEvent.click(screen.getByRole('button', { name: 'Abrir a despesa: DAS, vence em 20/03/2030' }));
    const janela = within(await screen.findByRole('dialog', { name: 'Despesa' }));
    expect(janela.getByText('Todo mês, sem data para terminar')).toBeTruthy();
    // Quando
    await userEvent.click(janela.getByRole('button', { name: /Excluir esta e as seguintes/ }));
    await userEvent.click(janela.getByRole('button', { name: /Confirmar: excluir esta e as seguintes/ }));
    // Então
    expect(SD.financeiroDespesaExcluir).toHaveBeenCalledWith('d-3', true);
    expect(avisos.feito).toHaveBeenCalledWith('2 despesas excluídas. A repetição parou.', 'exclusão da despesa', expect.any(Function));
  });

  it('dada uma despesa que se repete, quando a muda nesta e nas seguintes, então grava com as seguintes e avisa sem desfazer', async () => {
    // Dado
    SD.financeiroDespesaMudar.mockResolvedValue(4);
    abrir();
    await userEvent.click(screen.getByRole('button', { name: 'Abrir a despesa: DAS, vence em 20/03/2030' }));
    const janela = within(await screen.findByRole('dialog', { name: 'Despesa' }));
    await userEvent.click(janela.getByRole('button', { name: /Mudar despesa/ }));
    // Quando
    const valor = janela.getByLabelText(/Valor/);
    await userEvent.clear(valor);
    await userEvent.type(valor, '950,00');
    await userEvent.click(janela.getByRole('radio', { name: 'Esta e as seguintes' }));
    await userEvent.click(janela.getByRole('button', { name: 'Salvar despesa' }));
    // Então
    expect(SD.financeiroDespesaMudar).toHaveBeenCalledWith('d-3', { descricao: 'DAS', valor: 95000, vencimento: '2030-03-20' }, true);
    expect(avisos.avisar).toHaveBeenCalledWith('4 despesas mudadas na repetição.');
    expect(avisos.feito).not.toHaveBeenCalled();
  });
});
