// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// A Situação do cartão (#389): o "Expandir tudo" das seções fica na linha do menu, à direita, e não acima da primeira seção.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { GrupoDeSecoes, Recolhivel } from '../Recolhivel';
import { SituacaoDoCartao } from './SituacaoDoCartao';

/** O cartão de mentira: a Situação (se `comSituacao`) no cabeçalho e duas seções abaixo, no grupo do cartão. */
function Cartao({ comSituacao = true, comSecoes = true }: { comSituacao?: boolean; comSecoes?: boolean }) {
  return <GrupoDeSecoes>
    <header>{comSituacao && <SituacaoDoCartao><select aria-label="Situação da tarefa"><option>Para fazer</option></select></SituacaoDoCartao>}</header>
    {comSecoes && <>
      <Recolhivel titulo="Checklists" icone="lista"><p>Os itens</p></Recolhivel>
      <Recolhivel titulo="Histórico" icone="relogio"><p>As mudanças</p></Recolhivel>
    </>}
  </GrupoDeSecoes>;
}
/** Se `a` vem antes de `b` na página. */
const antes = (a: Element, b: Element) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

describe('Situação do cartão com o "Expandir tudo" (#389)', () => {
  it('dado um cartão com a Situação e seções, quando abre, então o botão aparece uma vez só, logo depois do menu e antes da primeira seção', () => {
    // Quando
    render(<Cartao />);
    // Então
    expect(screen.getByRole('heading', { name: 'Situação', level: 3 })).toBeInTheDocument();
    const botoes = screen.getAllByRole('button', { name: /^(Expandir|Recolher) tudo$/ });
    expect(botoes).toHaveLength(1);
    const menu = screen.getByRole('combobox', { name: 'Situação da tarefa' });
    expect(menu.nextElementSibling).toContainElement(botoes[0]);
    expect(antes(botoes[0], screen.getByRole('button', { name: 'Checklists' }))).toBe(true);
  });

  it('dado o botão na linha da Situação, quando a pessoa clica nele, então todas as seções abrem e ele passa a "Recolher tudo"', async () => {
    // Dado
    render(<Cartao />);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Expandir tudo' }));
    // Então
    expect(screen.getByText('Os itens')).toBeInTheDocument();
    expect(screen.getByText('As mudanças')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Recolher tudo' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('dado um cartão com a Situação, quando ela sai (o cartão em edição), então o botão volta para cima da primeira seção', () => {
    // Dado
    const { rerender } = render(<Cartao />);
    // Quando
    rerender(<Cartao comSituacao={false} />);
    // Então
    const botoes = screen.getAllByRole('button', { name: 'Expandir tudo' });
    expect(botoes).toHaveLength(1);
    expect(antes(botoes[0], screen.getByRole('button', { name: 'Checklists' }))).toBe(true);
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('dado um cartão com a Situação e sem seções que recolhem, quando abre, então não há botão', () => {
    // Quando
    render(<Cartao comSecoes={false} />);
    // Então
    expect(screen.getByRole('combobox', { name: 'Situação da tarefa' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^(Expandir|Recolher) tudo$/ })).toBeNull();
  });

  it('dado um título próprio (a Etapa do atendimento, na pessoa), quando abre, então ele aparece no lugar de "Situação"', () => {
    // Quando
    render(<GrupoDeSecoes><SituacaoDoCartao titulo="Etapa do atendimento"><select aria-label="Etapa do atendimento" /></SituacaoDoCartao></GrupoDeSecoes>);
    // Então
    expect(screen.getByRole('heading', { name: 'Etapa do atendimento', level: 3 })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Situação' })).toBeNull();
  });
});
