// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// A Situação do cartão (#351): um menu compacto, no topo, sem título nem linha própria; o nome vai na dica e no rótulo do menu.
// O "Expandir tudo" das seções, que ficava na linha dela (#389), foi para a linha dos botões rápidos (veja AtalhosDoCartao.test.tsx).
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SituacaoDoCartao } from './SituacaoDoCartao';

describe('Situação do cartão, num menu compacto (#351)', () => {
  it('dado o cartão com a Situação, quando abre, então há o menu, sem o título "Situação" numa linha própria, e o nome fica na dica', () => {
    // Quando
    render(<SituacaoDoCartao><select aria-label="Situação da tarefa"><option>PARA FAZER</option></select></SituacaoDoCartao>);
    // Então
    const menu = screen.getByRole('combobox', { name: 'Situação da tarefa' });
    expect(screen.queryByRole('heading')).toBeNull();
    expect(menu.closest('[title]')).toHaveAttribute('title', 'Situação');
  });

  it('dado o que vai ao lado (o Concluir da tarefa), quando abre, então fica logo depois do menu', () => {
    // Quando
    render(<SituacaoDoCartao acao={<button type="button">Concluir</button>}><select aria-label="Situação da tarefa" /></SituacaoDoCartao>);
    // Então
    const menu = screen.getByRole('combobox', { name: 'Situação da tarefa' });
    const concluir = screen.getByRole('button', { name: 'Concluir' });
    expect(menu.compareDocumentPosition(concluir) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(menu.closest('[title]')).not.toContainElement(concluir);
  });

  it('dado um título próprio (a Etapa do atendimento, na pessoa), quando abre, então ele vai na dica no lugar de "Situação"', () => {
    // Quando
    render(<SituacaoDoCartao titulo="Etapa do atendimento"><select aria-label="Etapa do atendimento" /></SituacaoDoCartao>);
    // Então
    expect(screen.getByRole('combobox', { name: 'Etapa do atendimento' }).closest('[title]')).toHaveAttribute('title', 'Etapa do atendimento');
  });
});
