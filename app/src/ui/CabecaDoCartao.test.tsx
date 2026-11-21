// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// A cabeça dos cartões (#397): de cima para baixo, o topo, o título, os dados (com os botões rápidos no fim) e a descrição; sem
// dados, a descrição logo depois do título e os botões rápidos depois dela; em edição, sem os botões rápidos.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DadoEditavel } from './base';
import { CabecaDoCartao } from './CabecaDoCartao';
import { ComAtalhosDoCartao } from './registroDeAtalhos';

/** Um dado que oferece o botão rápido "Datas", como o prazo. */
const Prazo = () => <DadoEditavel nome="Prazo" titulo="Mudar o prazo" resumo="Sem prazo" lido="Sem prazo" inicial={() => ({ prazo: '' })}
  conferir={() => ({})} aoSalvar={() => undefined} atalho="datas" campos={() => null} />;

/** Para os blocos na ordem em que estão na página. */
const emOrdem = (...nos: Element[]) => nos.every((no, i) => i === 0 || !!(nos[i - 1].compareDocumentPosition(no) & Node.DOCUMENT_POSITION_FOLLOWING));

function Cabeca({ dados = true, descricao = true, editando = false }) {
  return <ComAtalhosDoCartao><CabecaDoCartao editando={editando}
    topo={<p>A linha de cima</p>}
    titulo={<h2>O título</h2>}
    dados={dados && <div role="group" aria-label="Datas"><Prazo /></div>}
    descricao={descricao && <p>A descrição</p>} />{!dados && <Prazo />}</ComAtalhosDoCartao>;
}

describe('A cabeça do cartão (#397)', () => {
  it('dado um cartão com dados e descrição, quando abre, então a ordem é: topo, título, dados, botões rápidos e descrição', () => {
    // Quando
    render(<Cabeca />);
    // Então
    expect(emOrdem(screen.getByText('A linha de cima'), screen.getByRole('heading', { name: 'O título' }), screen.getByRole('group', { name: 'Datas' }),
      screen.getByRole('group', { name: 'Acrescentar ao cartão' }), screen.getByText('A descrição'))).toBe(true);
  });

  it('dado um cartão sem dados (o processo), quando abre, então a descrição vem logo depois do título, e os botões rápidos depois dela', () => {
    // Quando
    render(<Cabeca dados={false} />);
    // Então
    expect(emOrdem(screen.getByRole('heading', { name: 'O título' }), screen.getAllByText('A descrição')[0],
      screen.getByRole('group', { name: 'Acrescentar ao cartão' }))).toBe(true);
  });

  it('dado um cartão sem descrição, quando abre, então não sobra o lugar dela', () => {
    // Quando
    const { container } = render(<Cabeca descricao={false} />);
    // Então
    const cabeca = container.querySelector('header')!;
    expect(cabeca.lastElementChild).toContainElement(screen.getByRole('group', { name: 'Acrescentar ao cartão' }));
  });

  it('dado o cartão em edição, quando abre, então não há os botões rápidos, e os dados continuam no lugar deles', () => {
    // Quando
    render(<Cabeca editando />);
    // Então
    expect(screen.queryByRole('group', { name: 'Acrescentar ao cartão' })).toBeNull();
    expect(emOrdem(screen.getByRole('heading', { name: 'O título' }), screen.getByRole('group', { name: 'Datas' }), screen.getByText('A descrição'))).toBe(true);
  });
});
