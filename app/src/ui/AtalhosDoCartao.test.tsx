// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Os botões rápidos do cartão (#351): a linha com o que se acrescenta (Datas, Checklist, Anotação, Ligação), oferecida pelas seções
// com o "+" no título e pelo dado que se muda no lugar; cada botão abre a coisa ali mesmo.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { AtalhosDoCartao } from './AtalhosDoCartao';
import { DadoEditavel } from './base';
import { CriarNoCartao } from './ItensLigados';
import { GrupoDeSecoes, Recolhivel, usePedidoDeNovo } from './Recolhivel';
import { ComAtalhosDoCartao } from './registroDeAtalhos';

/** O conteúdo de uma seção como a dos prazos: a lista e, com o pedido do "+", o formulário do item novo. */
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
  comExpandirTudo?: boolean;
}

/** Um cartão de mentira: a linha na cabeça; os checklists (menu), a anotação (endereço) e o prazo (dado que se muda no lugar). */
function Cartao({ pode = true, aoPedirChecklist, comExpandirTudo }: PropsDoCartao) {
  return <MemoryRouter><ComAtalhosDoCartao><GrupoDeSecoes><CriarNoCartao pode={pode}>
    <header>
      <DadoEditavel nome="Prazo" titulo="Mudar o prazo" resumo="Sem prazo" lido="Sem prazo" inicial={() => ({ prazo: '' })} conferir={() => ({})}
        aoSalvar={pode ? () => undefined : undefined} atalho="datas" campos={({ rascunho, mudar }) =>
          <input aria-label="Prazo" value={rascunho.prazo} onChange={e => mudar({ prazo: e.target.value })} />} />
      <AtalhosDoCartao comExpandirTudo={comExpandirTudo} />
    </header>
    {/* Fora de ordem de propósito: a anotação antes dos checklists. */}
    <Recolhivel titulo="Anotações" icone="documentos" novo={{ para: '/documentos/nova/?tarefa=t1', rotulo: 'Nova anotação ligada a este item' }} atalho="anotacao">
      <p>As anotações</p>
    </Recolhivel>
    <Recolhivel titulo="Checklists" icone="check" novo={{ rotulo: 'Adicionar checklist', menu: true }} atalho="checklist">
      <ComFormulario aoPedir={aoPedirChecklist} />
    </Recolhivel>
    <Recolhivel titulo="Histórico" icone="relogio"><p>As mudanças</p></Recolhivel>
  </CriarNoCartao></GrupoDeSecoes></ComAtalhosDoCartao></MemoryRouter>;
}
const linha = () => screen.getByRole('group', { name: 'Acrescentar ao cartão' });
/** Se `a` vem antes de `b` na página. */
const antes = (a: Element, b: Element) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

describe('Os botões rápidos do cartão (#351)', () => {
  it('dado um cartão que pode ser alterado, quando abre, então a linha tem um botão para cada coisa oferecida, na ordem de sempre, com o que faz na dica', () => {
    // Quando
    render(<Cartao />);
    // Então
    expect(linha()).toHaveTextContent(/^DatasChecklistAnotação$/);
    expect(within(linha()).getByRole('button', { name: 'Datas' })).toHaveAttribute('title', 'Mudar o prazo');
    expect(within(linha()).getByRole('button', { name: 'Checklist' })).toHaveAttribute('title', 'Adicionar checklist');
    expect(within(linha()).getByRole('button', { name: 'Checklist' })).toHaveAttribute('aria-haspopup', 'menu');
    expect(within(linha()).getByRole('link', { name: 'Anotação' })).toHaveAttribute('title', 'Nova anotação ligada a este item');
  });

  it('dado o botão "Checklist", quando a pessoa clica nele, então a seção abre e quem está dentro atende o pedido, com o menu preso ao botão', async () => {
    // Dado
    const aoPedir = vi.fn();
    render(<Cartao aoPedirChecklist={aoPedir} />);
    expect(screen.getByRole('button', { name: /^Checklists/ })).toHaveAttribute('aria-expanded', 'false');
    // Quando
    await userEvent.click(within(linha()).getByRole('button', { name: 'Checklist' }));
    // Então
    expect(screen.getByRole('button', { name: /^Checklists/ })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('form', { name: 'Novo item' })).toBeInTheDocument();
    expect(aoPedir).toHaveBeenCalledWith(within(linha()).getByRole('button', { name: 'Checklist' }));
  });

  it('dado o botão "Anotação", quando a pessoa o vê, então é um link para o mesmo endereço do "+" da seção', () => {
    // Quando
    render(<Cartao />);
    // Então
    expect(within(linha()).getByRole('link', { name: 'Anotação' })).toHaveAttribute('href', '/documentos/nova/?tarefa=t1');
  });

  it('dado o botão "Datas", quando a pessoa clica nele, então o formulário do prazo abre ali mesmo', async () => {
    // Dado
    render(<Cartao />);
    // Quando
    await userEvent.click(within(linha()).getByRole('button', { name: 'Datas' }));
    // Então
    expect(screen.getByRole('group', { name: 'Mudar o prazo' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Prazo' })).toBeInTheDocument();
  });

  it('dado um cartão arquivado ou só para ler, quando abre, então não há botões rápidos', () => {
    // Quando
    render(<Cartao pode={false} />);
    // Então
    expect(screen.queryByRole('group', { name: 'Acrescentar ao cartão' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Checklist' })).toBeNull();
  });

  it('dado um cartão aberto, quando o item é arquivado (deixa de poder criar), então os botões somem na hora, sem erro', () => {
    // Dado
    const { rerender } = render(<Cartao />);
    expect(linha()).toBeInTheDocument();
    // Quando
    rerender(<Cartao pode={false} />);
    // Então
    expect(screen.queryByRole('group', { name: 'Acrescentar ao cartão' })).toBeNull();
    expect(screen.getByRole('heading', { name: /^Checklists/ })).toBeInTheDocument();
  });

  it('dado um cartão com seções, quando abre, então o "Expandir tudo" fica na linha, depois dos botões e antes da primeira seção, uma vez só', () => {
    // Quando
    render(<Cartao />);
    // Então
    const botoes = screen.getAllByRole('button', { name: /^(Expandir|Recolher) tudo$/ });
    expect(botoes).toHaveLength(1);
    expect(antes(linha(), botoes[0])).toBe(true);
    expect(antes(botoes[0], screen.getByRole('button', { name: /^Anotações/ }))).toBe(true);
  });

  it('dado um cartão só para ler, quando abre, então o "Expandir tudo" continua na linha, mesmo sem os botões', async () => {
    // Dado
    render(<Cartao pode={false} />);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Expandir tudo' }));
    // Então
    expect(screen.getByText('As mudanças')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^(Expandir|Recolher) tudo$/ })).toHaveLength(1);
  });

  it('dada a linha sem o "Expandir tudo" (a anotação), quando abre, então o botão continua acima da primeira seção', () => {
    // Quando
    render(<Cartao comExpandirTudo={false} />);
    // Então
    const expandir = screen.getByRole('button', { name: 'Expandir tudo' });
    expect(antes(linha(), expandir)).toBe(true);
    expect(linha().parentElement).not.toContainElement(expandir);
  });

  it('dada uma seção fora do registro (fora de um cartão), quando aparece, então nada quebra e o "+" continua no título', () => {
    // Quando
    render(<Recolhivel titulo="Checklists" icone="check" novo={{ rotulo: 'Adicionar checklist', menu: true }} atalho="checklist"><p>nada</p></Recolhivel>);
    // Então
    expect(screen.getByRole('button', { name: 'Adicionar checklist' })).toBeInTheDocument();
  });
});
