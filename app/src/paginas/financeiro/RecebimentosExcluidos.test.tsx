// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// A seção "Recebimentos excluídos" de "Contas, DAS e sócios" (#413): só para administradores, só leitura.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DadosFinanceiro, RecebimentoExcluido } from '../../dados';
import { RecebimentosExcluidos } from './RecebimentosExcluidos';

// Cada caso começa com a seção fechada: a escolha guardada (ui/preferencias.ts) não passa de um caso ao outro.
const SD = vi.hoisted(() => ({ financeiroExcluidos: vi.fn<DadosFinanceiro['financeiroExcluidos']>() }));
vi.mock('../../ui/preferencias', () => ({ lerPreferencia: <T,>(_chave: string, padrao: T) => padrao, salvarPreferencia: vi.fn() }));
const sessao = vi.hoisted(() => ({ ehAdmin: true, equipe: [{ id: 'u-1', nome: 'Pessoa Administradora' }] }));
vi.mock('../../dados', () => ({ SD }));
vi.mock('../../ui/sessao', () => ({ useCtx: () => sessao }));

const EXCLUIDOS: RecebimentoExcluido[] = [
  { id: 2, contrato_codigo: 'AA11-0004-2030', tipo: 'recebimento', parcela_numero: 1, data: '2030-03-10', valor: 40000, conta_nome: 'PJ', estornado: true,
    excluido_por: 'u-1', excluido_em: '2030-05-20T15:00:00Z' },
  { id: 1, contrato_codigo: 'AA11-0003-2030', tipo: 'parcela_importada', parcela_numero: 1, data: '2020-03-10', valor: 70000, conta_nome: null, estornado: false,
    excluido_por: 'u-1', excluido_em: '2030-05-19T15:00:00Z' }
];
const titulo = () => screen.findByRole('button', { name: /Recebimentos excluídos/ });

describe('Recebimentos excluídos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessao.ehAdmin = true;
    SD.financeiroExcluidos.mockResolvedValue(EXCLUIDOS);
  });

  it('dado um administrador, quando abre a seção, então vê cada recebimento com o contrato, a data, o valor, a conta e quem excluiu', async () => {
    // Dado
    render(<RecebimentosExcluidos />);
    // Quando
    await userEvent.click(await titulo());
    // Então
    const lista = within(screen.getByRole('list', { name: 'Recebimentos excluídos' }));
    const [estornado, importada] = lista.getAllByRole('listitem');
    expect(estornado).toHaveTextContent('10/03/2030 · Contrato AA11-0004-2030 · Parcela 1 · PJ');
    expect(estornado).toHaveTextContent('Estornado');
    expect(estornado).toHaveTextContent('400,00');
    expect(estornado).toHaveTextContent('Excluído por Pessoa Administradora em 20/05/2030');
    expect(importada).toHaveTextContent('Sem conta (não passou pelo Caixa)');
    expect(importada).toHaveTextContent('Importada como paga');
  });

  it('dado um administrador, quando a seção está fechada, então o título já mostra quantos são', async () => {
    // Quando
    render(<RecebimentosExcluidos />);
    // Então
    expect(await screen.findByText('2')).toBeTruthy();
  });

  it('dada a seção aberta, quando a pessoa olha as linhas, então não há botão para mudar nem para excluir', async () => {
    // Dado
    render(<RecebimentosExcluidos />);
    // Quando
    await userEvent.click(await titulo());
    // Então
    const lista = screen.getByRole('list', { name: 'Recebimentos excluídos' });
    expect(within(lista).queryAllByRole('button')).toEqual([]);
  });

  it('dado quem não é administrador, quando a página monta a seção, então ela nem aparece e nada é lido', () => {
    // Dado
    sessao.ehAdmin = false;
    // Quando
    render(<RecebimentosExcluidos />);
    // Então
    expect(screen.queryByRole('button', { name: /Recebimentos excluídos/ })).toBeNull();
    expect(SD.financeiroExcluidos).not.toHaveBeenCalled();
  });

  it('dado nenhum contrato excluído com dinheiro, quando abre a seção, então diz que não há nada', async () => {
    // Dado
    SD.financeiroExcluidos.mockResolvedValue([]);
    render(<RecebimentosExcluidos />);
    // Quando
    await userEvent.click(await titulo());
    // Então
    expect(await screen.findByText('Nenhum recebimento saiu com um contrato excluído.')).toBeTruthy();
  });
});
