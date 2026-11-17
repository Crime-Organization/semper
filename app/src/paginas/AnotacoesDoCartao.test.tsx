// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AnotacaoLigada, DadosAnotacoes, DadosSessao } from '../dados';
import { sinalizarMudanca } from '../ui/avisos';
import { iniciarPreferencias } from '../ui/preferencias';
import { AnotacoesDoCartao } from './AnotacoesDoCartao';

// A seção lê as anotações do item, e abrir a seção guarda a preferência; o mock declara exatamente essas operações.
const { anotacoesDoItem, salvarPreferencia } = vi.hoisted(() => ({
  anotacoesDoItem: vi.fn<DadosAnotacoes['anotacoesDoItem']>(), salvarPreferencia: vi.fn<DadosSessao['salvarPreferencia']>(async () => {})
}));
vi.mock('../dados', () => ({ SD: { anotacoesDoItem, salvarPreferencia } satisfies Pick<DadosAnotacoes & DadosSessao, 'anotacoesDoItem' | 'salvarPreferencia'> }));
// O módulo Documentos está ligado no escritório, salvo quando o caso diz que não.
const sessao = vi.hoisted(() => ({ anotacoes: true }));
vi.mock('../ui/sessao', () => ({ useCtx: () => ({ perfil: { id: 'u-mateus' }, equipe: [], ehAdmin: false, escritorio: { modulos: { anotacoes: sessao.anotacoes } } }) }));

const ligada = (id: string, titulo: string, campos: Partial<AnotacaoLigada> = {}): AnotacaoLigada => ({
  id, codigo: 'C-' + id, titulo, criado_por: 'u-mateus', criado_em: '2026-11-10T12:00:00Z', atualizado_em: '2026-11-16T12:00:00Z', arquivado_em: null, ...campos
});
const montar = (props: Partial<Parameters<typeof AnotacoesDoCartao>[0]> = {}) =>
  render(<MemoryRouter><AnotacoesDoCartao modulo="demandas" id="d1" {...props} /></MemoryRouter>);
const titulo = () => screen.getByRole('button', { name: /^Anotações/ });

describe('Anotações no cartão de um item', () => {
  beforeEach(() => {
    iniciarPreferencias({});
    sessao.anotacoes = true;
    anotacoesDoItem.mockReset();
    anotacoesDoItem.mockResolvedValue([ligada('a1', 'Estratégia da defesa'), ligada('a2', 'Ata antiga', { arquivado_em: '2026-11-12T12:00:00Z' })]);
  });

  it('quando o cartão abre, então a seção vem fechada e já mostra quantas anotações estão ligadas ao item', async () => {
    // Quando
    montar();
    // Então
    await vi.waitFor(() => expect(titulo()).toHaveTextContent('2'));
    expect(titulo()).toHaveAttribute('aria-expanded', 'false');
    expect(anotacoesDoItem).toHaveBeenCalledWith('demandas', 'd1');
  });

  it('quando a pessoa abre a seção, então cada anotação abre o cartão dela em Documentos, e a arquivada vem marcada', async () => {
    // Dado
    montar();
    await vi.waitFor(() => expect(titulo()).toHaveTextContent('2'));
    // Quando
    await userEvent.click(titulo());
    // Então
    const lista = screen.getByRole('list', { name: 'Anotações ligadas' });
    expect(within(lista).getByRole('link', { name: /Estratégia da defesa/ })).toHaveAttribute('href', '/documentos/?id=a1');
    expect(within(lista).getByRole('link', { name: /Ata antiga/ })).toHaveTextContent('Arquivada');
  });

  it('então o "+" leva ao cadastro de anotação já ligada ao item; no cartão só para ler, ele não aparece', async () => {
    // Dado / Quando
    const { unmount } = montar({ modulo: 'processos', id: 'pr9' });
    // Então
    expect(screen.getByRole('link', { name: 'Nova anotação ligada a este item' })).toHaveAttribute('href', '/documentos/nova/?processo=pr9');
    unmount();
    // Quando
    montar({ somenteLer: true });
    // Então
    await vi.waitFor(() => expect(titulo()).toHaveTextContent('2'));
    expect(screen.queryByRole('link', { name: 'Nova anotação ligada a este item' })).not.toBeInTheDocument();
  });

  it('dado o item sem anotações, quando a seção abre, então ela diz que não há nenhuma', async () => {
    // Dado
    anotacoesDoItem.mockResolvedValue([]);
    iniciarPreferencias({ 'tarefas.cartao.anotacoes': true });
    // Quando
    montar({ modulo: 'tarefas', id: 't1' });
    // Então
    expect(await screen.findByText('Nenhuma anotação ligada a esta tarefa.')).toBeInTheDocument();
  });

  it('quando algo muda (a janela do cadastro fechou), então a seção lê de novo e o número acompanha', async () => {
    // Dado
    montar();
    await vi.waitFor(() => expect(titulo()).toHaveTextContent('2'));
    anotacoesDoItem.mockResolvedValue([ligada('a3', 'Nova'), ligada('a1', 'Estratégia da defesa'), ligada('a2', 'Ata antiga')]);
    // Quando
    sinalizarMudanca();
    // Então
    await vi.waitFor(() => expect(titulo()).toHaveTextContent('3'));
  });

  it('dado o módulo Documentos desligado no escritório, então a seção não aparece nem lê nada', () => {
    // Dado
    sessao.anotacoes = false;
    // Quando
    montar();
    // Então
    expect(screen.queryByRole('button', { name: /^Anotações/ })).not.toBeInTheDocument();
    expect(anotacoesDoItem).not.toHaveBeenCalled();
  });
});
