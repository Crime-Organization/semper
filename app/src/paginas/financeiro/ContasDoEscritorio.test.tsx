// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// As contas do Financeiro seguem o padrão dos arquivados (#347): "Desarquivar" com a caixa aberta (no lugar do antigo
// "Reativar") e, na arquivada que nunca teve lançamento, a lixeira, com a confirmação em dois cliques.
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ContaFinanceira, DadosFinanceiro } from '../../dados';
import { CONTA_COM_LANCAMENTOS } from '../../regras/caixa';
import { ContasDoEscritorio } from './Formularios';

const SD = vi.hoisted(() => ({
  financeiroContaAtualizar: vi.fn<DadosFinanceiro['financeiroContaAtualizar']>(),
  financeiroContaExcluir: vi.fn<DadosFinanceiro['financeiroContaExcluir']>(),
  financeiroArquivadasComLancamentos: vi.fn<DadosFinanceiro['financeiroArquivadasComLancamentos']>()
}));
const avisos = vi.hoisted(() => ({ feito: vi.fn(), falha: vi.fn(), avisar: vi.fn() }));
vi.mock('../../dados', () => ({ SD }));
vi.mock('../../ui/avisos', () => avisos);

const conta = (id: string, nome: string, arquivada: boolean): ContaFinanceira =>
  ({ id, nome, tem_das: false, saldo_inicial: 0, saldo_inicial_em: '2026-01-01', arquivada_em: arquivada ? '2026-11-01T10:00:00Z' : null });
const ATIVA = conta('c1', 'PJ', false), VAZIA = conta('c2', 'ANTIGA', true), COM_LANCAMENTOS = conta('c3', 'PF', true);
const linha = (nome: string) => within(screen.getByRole('listitem', { name: (_n, el) => el.textContent?.startsWith(nome) ?? false }));
const icone = (botao: HTMLElement) => botao.querySelector('svg')?.getAttribute('data-icone');

function montar() {
  const aoMudar = vi.fn();
  const { rerender } = render(<ContasDoEscritorio contas={[ATIVA, VAZIA, COM_LANCAMENTOS]} hoje="2026-11-20" aoMudar={aoMudar} />);
  const trocarContas = (contas: ContaFinanceira[]) => rerender(<ContasDoEscritorio contas={contas} hoje="2026-11-20" aoMudar={aoMudar} />);
  return { aoMudar, trocarContas };
}

describe('As contas do escritório', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    SD.financeiroArquivadasComLancamentos.mockResolvedValue([COM_LANCAMENTOS.id]);
    SD.financeiroContaAtualizar.mockResolvedValue();
    SD.financeiroContaExcluir.mockResolvedValue();
  });

  it('quando a pessoa olha a lista, então a ativa tem Arquivar com a caixa fechada e a arquivada tem Desarquivar com a caixa aberta', async () => {
    // Quando
    montar();
    // Então
    expect(icone(screen.getByRole('button', { name: 'Arquivar a conta PJ' }))).toBe('arquivo');
    expect(icone(screen.getByRole('button', { name: 'Desarquivar a conta ANTIGA' }))).toBe('arquivoAberto');
    expect(screen.queryByRole('button', { name: /Reativar/ })).toBeNull();
  });

  it('quando a pessoa desarquiva uma conta, então ela volta e a página é avisada', async () => {
    // Dado
    const { aoMudar } = montar();
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Desarquivar a conta ANTIGA' }));
    // Então
    expect(SD.financeiroContaAtualizar).toHaveBeenCalledWith(VAZIA.id, { arquivada_em: null });
    expect(avisos.feito).toHaveBeenCalledWith('Conta ANTIGA desarquivada.', expect.any(String), expect.any(Function));
    expect(aoMudar).toHaveBeenCalledOnce();
  });

  it('quando a arquivada nunca teve lançamento, então tem a lixeira, que só exclui no segundo clique', async () => {
    // Dado
    const { aoMudar } = montar();
    const excluir = await waitFor(() => linha('ANTIGA').getByRole('button', { name: 'Excluir a conta ANTIGA' }));
    expect(icone(excluir)).toBe('lixeira');
    // Quando: o primeiro clique só pede a confirmação
    await userEvent.click(excluir);
    // Então
    expect(SD.financeiroContaExcluir).not.toHaveBeenCalled();
    // Quando
    await userEvent.click(linha('ANTIGA').getByRole('button', { name: 'Confirmar exclusão de ANTIGA' }));
    // Então
    expect(SD.financeiroContaExcluir).toHaveBeenCalledWith(VAZIA.id);
    expect(avisos.avisar).toHaveBeenCalledWith('Conta ANTIGA excluída definitivamente.');
    expect(aoMudar).toHaveBeenCalledOnce();
  });

  it('quando a arquivada tem lançamentos, então não há lixeira, e o SEMPER explica por quê; a ativa também não tem lixeira', async () => {
    // Quando
    montar();
    // Então
    expect(await linha('PF').findByText(CONTA_COM_LANCAMENTOS)).toBeTruthy();
    expect(linha('PF').queryByRole('button', { name: /Excluir/ })).toBeNull();
    expect(linha('PJ').queryByRole('button', { name: /Excluir/ })).toBeNull();
    expect(linha('ANTIGA').queryByText(CONTA_COM_LANCAMENTOS)).toBeNull();
  });

  it('quando o banco recusa a exclusão, então o SEMPER mostra o motivo e nada muda na página', async () => {
    // Dado
    const recusa = new Error('A conta não pode ser excluída: há repasses do caixa ligados a ela.');
    SD.financeiroContaExcluir.mockRejectedValue(recusa);
    const { aoMudar } = montar();
    // Quando
    await userEvent.click(await waitFor(() => linha('ANTIGA').getByRole('button', { name: 'Excluir a conta ANTIGA' })));
    await userEvent.click(linha('ANTIGA').getByRole('button', { name: 'Confirmar exclusão de ANTIGA' }));
    // Então
    expect(avisos.falha).toHaveBeenCalledWith(recusa);
    expect(aoMudar).not.toHaveBeenCalled();
  });

  it('dado duas arquivadas sem lançamento, quando a pessoa ouve os botões, então cada lixeira diz qual conta exclui', async () => {
    // Dado
    const OUTRA = conta('c4', 'RESERVA', true);
    SD.financeiroArquivadasComLancamentos.mockResolvedValue([]);
    render(<ContasDoEscritorio contas={[VAZIA, OUTRA]} hoje="2026-11-20" aoMudar={vi.fn()} />);
    // Quando
    const lixeiras = await screen.findAllByRole('button', { name: /^Excluir/ });
    // Então
    // A lixeira é só o ícone (#423): o que o leitor de tela ouve é o nome do botão.
    expect(lixeiras[0]).toHaveAccessibleName('Excluir a conta ANTIGA');
    expect(lixeiras[1]).toHaveAccessibleName('Excluir a conta RESERVA');
    expect(lixeiras.map(icone)).toEqual(['lixeira', 'lixeira']);
  });

  it('dado a lista carregada, quando uma conta com lançamentos acaba de ser arquivada, então ela não ganha a lixeira enquanto a nova lista não chega', async () => {
    // Dado
    const { trocarContas } = montar();
    await waitFor(() => linha('ANTIGA').getByRole('button', { name: 'Excluir a conta ANTIGA' }));
    SD.financeiroArquivadasComLancamentos.mockReturnValue(new Promise(() => {}));
    // Quando: a PJ, que tem lançamentos, volta arquivada, e a consulta nova ainda não respondeu
    trocarContas([{ ...ATIVA, arquivada_em: '2026-11-20T10:00:00Z' }, VAZIA, COM_LANCAMENTOS]);
    // Então: nem lixeira nem explicação, em nenhuma conta
    expect(screen.queryByRole('button', { name: /Excluir/ })).toBeNull();
    expect(screen.queryByText(CONTA_COM_LANCAMENTOS)).toBeNull();
  });
});
