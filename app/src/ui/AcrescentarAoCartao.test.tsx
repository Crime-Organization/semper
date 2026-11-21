// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// A bolinha "Acrescentar ao cartão" (#399): um botão redondo só, com o menu do que o cartão tem (quantas há) e do que se acrescenta,
// oferecido pelas seções com `atalho` e pelo dado que se muda no lugar; o ver leva até a coisa, o "+" abre o mesmo do "+" da seção.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { AcrescentarAoCartao } from './AcrescentarAoCartao';
import { DadoEditavel } from './base';
import { CriarNoCartao } from './ItensLigados';
import { GrupoDeSecoes, Recolhivel, usePedidoDeNovo } from './Recolhivel';
import { ComAtalhosDoCartao } from './registroDeAtalhos';

/** O conteúdo de uma seção como a dos checklists: a lista e, com o pedido do "+", o formulário do item novo. */
function ComFormulario({ aoPedir = () => {} }: { aoPedir?: (botao: HTMLElement) => void }) {
  const [novo, setNovo] = useState(false);
  usePedidoDeNovo(botao => { setNovo(true); aoPedir(botao); });
  return novo ? <form aria-label="Novo item"><label>O que é<input /></label></form> : <p>Os itens</p>;
}

interface PropsDoCartao {
  /** O cartão deixa criar (falso: arquivado ou só para ler). */
  pode?: boolean;
  /** Quem atende o pedido do checklist (o menu). */
  aoPedirChecklist?: (botao: HTMLElement) => void;
  /** Quantos checklists a seção diz que há. */
  checklists?: number;
}

/** Um cartão de mentira: a bolinha no topo; o prazo (dado que se muda no lugar), a anotação (endereço) e os checklists (menu). */
function Cartao({ pode = true, aoPedirChecklist, checklists = 2 }: PropsDoCartao) {
  return <MemoryRouter><ComAtalhosDoCartao><GrupoDeSecoes><CriarNoCartao pode={pode}>
    <header>
      <AcrescentarAoCartao />
      <DadoEditavel nome="Prazo" titulo="Mudar o prazo" resumo="Sem prazo" lido="Sem prazo" inicial={() => ({ prazo: '' })} conferir={() => ({})}
        aoSalvar={pode ? () => undefined : undefined} atalho="datas" campos={({ rascunho, mudar }) =>
          <input aria-label="Prazo" value={rascunho.prazo} onChange={e => mudar({ prazo: e.target.value })} />} />
    </header>
    {/* Fora de ordem de propósito: a anotação antes dos checklists. */}
    <Recolhivel titulo="Anotações" icone="documentos" contador={0} novo={{ para: '/documentos/nova/?tarefa=t1', rotulo: 'Nova anotação ligada a este item' }} atalho="anotacao">
      <p>As anotações</p>
    </Recolhivel>
    <Recolhivel titulo="Checklists" icone="check" contador={checklists} novo={{ rotulo: 'Adicionar checklist', menu: true }} atalho="checklist">
      <ComFormulario aoPedir={aoPedirChecklist} />
    </Recolhivel>
    <Recolhivel titulo="Histórico" icone="relogio"><p>As mudanças</p></Recolhivel>
  </CriarNoCartao></GrupoDeSecoes></ComAtalhosDoCartao></MemoryRouter>;
}
const bolinha = () => screen.getByRole('button', { name: 'Acrescentar ao cartão' });
const menu = () => screen.getByRole('menu', { name: 'Acrescentar ao cartão' });
async function abrirMenu() {
  await userEvent.click(bolinha());
  return menu();
}

describe('A bolinha "Acrescentar ao cartão" (#399)', () => {
  it('dado um cartão que pode ser alterado, quando a pessoa abre o menu, então há uma linha para cada coisa oferecida, na ordem de sempre, com quantas há e o "+" de cada uma', async () => {
    // Dado
    render(<Cartao />);
    expect(bolinha()).toHaveAttribute('aria-haspopup', 'menu');
    expect(bolinha()).toHaveAttribute('aria-expanded', 'false');
    // Quando
    const m = await abrirMenu();
    // Então
    expect(bolinha()).toHaveAttribute('aria-expanded', 'true');
    expect(within(m).getAllByRole('menuitem').map(i => i.getAttribute('aria-label'))).toEqual([
      'Ver datas', 'Mudar o prazo', 'Ver checklists (2)', 'Adicionar checklist', 'Ver anotações (0)', 'Nova anotação ligada a este item'
    ]);
    expect(within(m).getByRole('menuitem', { name: 'Ver checklists (2)' })).toHaveTextContent('Checklists2');
    expect(within(m).getByRole('menuitem', { name: 'Adicionar checklist' })).toHaveAttribute('aria-haspopup', 'menu');
    expect(within(m).getByRole('menuitem', { name: 'Nova anotação ligada a este item' })).toHaveAttribute('href', '/documentos/nova/?tarefa=t1');
    // E a seção sem `atalho` (o histórico) não entra
    expect(within(m).queryByRole('menuitem', { name: /histórico/i })).toBeNull();
  });

  it('dado o menu aberto, quando a pessoa escolhe ver os checklists, então o menu fecha, a seção abre e o foco vai ao título dela', async () => {
    // Dado
    render(<Cartao />);
    const secao = screen.getByRole('button', { name: /^Checklists/ });
    const rolar = vi.fn();
    secao.closest('section')!.scrollIntoView = rolar;
    expect(secao).toHaveAttribute('aria-expanded', 'false');
    const m = await abrirMenu();
    // Quando
    await userEvent.click(within(m).getByRole('menuitem', { name: 'Ver checklists (2)' }));
    // Então
    expect(screen.queryByRole('menu')).toBeNull();
    expect(secao).toHaveAttribute('aria-expanded', 'true');
    expect(secao).toHaveFocus();
    expect(rolar).toHaveBeenCalled();
    expect(screen.getByText('Os itens')).toBeInTheDocument();
  });

  it('dado o menu aberto, quando a pessoa escolhe "Adicionar checklist", então a seção abre e quem está dentro atende o pedido, com o menu do item novo preso à bolinha', async () => {
    // Dado
    const aoPedir = vi.fn();
    render(<Cartao aoPedirChecklist={aoPedir} />);
    const m = await abrirMenu();
    // Quando
    await userEvent.click(within(m).getByRole('menuitem', { name: 'Adicionar checklist' }));
    // Então
    expect(screen.getByRole('button', { name: /^Checklists/ })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('form', { name: 'Novo item' })).toBeInTheDocument();
    expect(aoPedir).toHaveBeenCalledWith(bolinha());
  });

  it('dado o menu aberto, quando a pessoa escolhe mudar o prazo, então o formulário do prazo abre ali mesmo', async () => {
    // Dado
    render(<Cartao />);
    const m = await abrirMenu();
    // Quando
    await userEvent.click(within(m).getByRole('menuitem', { name: 'Mudar o prazo' }));
    // Então
    expect(screen.getByRole('group', { name: 'Mudar o prazo' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Prazo' })).toHaveFocus();
  });

  it('dado um cartão arquivado ou só para ler, quando a pessoa abre o menu, então ele só tem o ver de cada coisa, sem o "+"', async () => {
    // Dado
    render(<Cartao pode={false} />);
    // Quando
    const m = await abrirMenu();
    // Então
    expect(within(m).getAllByRole('menuitem').map(i => i.getAttribute('aria-label'))).toEqual(['Ver datas', 'Ver checklists (2)', 'Ver anotações (0)']);
  });

  it('dado um cartão aberto, quando o item é arquivado (deixa de poder criar), então o "+" das linhas some na hora, sem erro', async () => {
    // Dado
    const { rerender } = render(<Cartao />);
    // Quando
    rerender(<Cartao pode={false} />);
    // Então
    const m = await abrirMenu();
    expect(within(m).queryByRole('menuitem', { name: 'Adicionar checklist' })).toBeNull();
  });

  it('dada a contagem que muda (um checklist novo), quando a pessoa abre o menu, então ele mostra a de agora', async () => {
    // Dado
    const { rerender } = render(<Cartao />);
    // Quando
    rerender(<Cartao checklists={3} />);
    // Então
    const m = await abrirMenu();
    expect(within(m).getByRole('menuitem', { name: 'Ver checklists (3)' })).toBeInTheDocument();
  });

  it('dado quem usa o teclado, quando abre o menu, anda com as setas e aperta Esc, então o foco passa pelas ações e volta à bolinha', async () => {
    // Dado
    render(<Cartao />);
    bolinha().focus();
    // Quando
    await userEvent.keyboard('{Enter}');
    // Então
    expect(screen.getByRole('menuitem', { name: 'Ver datas' })).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Ver checklists (2)' })).toHaveFocus();
    await userEvent.keyboard('{ArrowUp}');
    expect(screen.getByRole('menuitem', { name: 'Mudar o prazo' })).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(bolinha()).toHaveFocus();
  });

  it('dado um cartão sem nada a oferecer (fora do registro), quando abre, então a bolinha não aparece e a seção continua com o "+" no título', () => {
    // Quando
    render(<MemoryRouter><AcrescentarAoCartao />
      <Recolhivel titulo="Checklists" icone="check" novo={{ rotulo: 'Adicionar checklist', menu: true }} atalho="checklist"><p>nada</p></Recolhivel>
    </MemoryRouter>);
    // Então
    expect(screen.queryByRole('button', { name: 'Acrescentar ao cartão' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Adicionar checklist' })).toBeInTheDocument();
  });
});
