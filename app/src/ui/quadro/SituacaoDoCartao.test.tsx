// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// A linha da Situação do cartão (#397): o rótulo com o ícone, o menu largo e, à direita, o que vai com ele (o ✓ Concluir da tarefa e
// da demanda). O rótulo é só para ver: o menu tem o nome dele para o leitor de tela.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SituacaoDoCartao } from './SituacaoDoCartao';

describe('A linha da Situação do cartão (#397)', () => {
  it('dado o cartão com a Situação, quando abre, então a linha mostra o rótulo "Situação" antes do menu, só para ver', () => {
    // Quando
    render(<SituacaoDoCartao><select aria-label="Situação da tarefa"><option>PARA FAZER</option></select></SituacaoDoCartao>);
    // Então
    const menu = screen.getByRole('combobox', { name: 'Situação da tarefa' });
    const rotulo = screen.getByText('Situação');
    expect(rotulo).toHaveAttribute('aria-hidden', 'true');
    expect(rotulo.querySelector('svg')).not.toBeNull();
    expect(rotulo.compareDocumentPosition(menu) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('dado o que vai com a Situação (o Concluir), quando abre, então fica na mesma linha, depois do menu e junto dele (os dois descem juntos quando não cabem)', () => {
    // Quando
    render(<SituacaoDoCartao acao={<button type="button" aria-label="Concluir" />}><select aria-label="Situação da tarefa" /></SituacaoDoCartao>);
    // Então
    const menu = screen.getByRole('combobox', { name: 'Situação da tarefa' });
    const concluir = screen.getByRole('button', { name: 'Concluir' });
    expect(menu.compareDocumentPosition(concluir) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText('Situação').parentElement).toContainElement(concluir);
    expect(concluir.parentElement).toContainElement(menu);
    expect(concluir.parentElement).not.toContainElement(screen.getByText('Situação'));
  });

  it('dado um título próprio (a Etapa do atendimento, na pessoa), quando abre, então ele é o rótulo da linha', () => {
    // Quando
    render(<SituacaoDoCartao titulo="Etapa do atendimento"><select aria-label="Etapa do atendimento" /></SituacaoDoCartao>);
    // Então
    expect(screen.getByText('Etapa do atendimento')).toBeInTheDocument();
    expect(screen.queryByText('Situação')).toBeNull();
  });

  it('dada a seta do menu, quando a linha abre, então o estilo recebe o mesmo tamanho dela (a folga do texto vem de um lugar só)', () => {
    // Quando
    render(<SituacaoDoCartao><select aria-label="Situação da tarefa" /></SituacaoDoCartao>);
    // Então
    const linha = screen.getByText('Situação').parentElement!;
    const seta = screen.getByRole('combobox', { name: 'Situação da tarefa' }).parentElement!.querySelector('svg')!;
    expect(linha.style.getPropertyValue('--situacao-icone')).toBe(`${seta.getAttribute('width')}px`);
  });
});
