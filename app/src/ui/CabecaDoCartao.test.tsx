// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// A cabeça dos cartões (#397): de cima para baixo, o topo, o título, os dados e a descrição; sem dados, a descrição logo depois do
// título. Desde a #399, sem a linha de botões rápidos (virou o "+" do topo, AcrescentarAoCartao).
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DATAS_VAZIAS } from '../regras/janelaDasDatas';
import { DatasDoCartao } from './base';
import { CabecaDoCartao } from './CabecaDoCartao';
import { ComAtalhosDoCartao } from './registroDeAtalhos';

/** Um dado que oferece a linha "Datas" ao menu do cartão, como o prazo. */
const Prazo = () => <DatasDoCartao nome="Prazo" titulo="Mudar o prazo" resumo="Sem prazo" lido="Sem prazo" entrega={{ rotulo: 'Entrega', nome: 'Prazo', opcional: true }}
  inicial={() => DATAS_VAZIAS} conferir={() => ({})} aoSalvar={() => undefined} atalho="datas" />;

/** Para os blocos na ordem em que estão na página. */
const emOrdem = (...nos: Element[]) => nos.every((no, i) => i === 0 || !!(nos[i - 1].compareDocumentPosition(no) & Node.DOCUMENT_POSITION_FOLLOWING));

function Cabeca({ dados = true, descricao = true }) {
  return <ComAtalhosDoCartao><CabecaDoCartao
    topo={<p>A linha de cima</p>}
    titulo={<h2>O título</h2>}
    dados={dados && <div role="group" aria-label="Datas"><Prazo /></div>}
    descricao={descricao && <p>A descrição</p>} /></ComAtalhosDoCartao>;
}

describe('A cabeça do cartão (#397, #399)', () => {
  it('dado um cartão com dados e descrição, quando abre, então a ordem é: topo, título, dados e descrição, sem a linha de botões rápidos', () => {
    // Quando
    render(<Cabeca />);
    // Então
    expect(emOrdem(screen.getByText('A linha de cima'), screen.getByRole('heading', { name: 'O título' }), screen.getByRole('group', { name: 'Datas' }),
      screen.getByText('A descrição'))).toBe(true);
    expect(screen.queryByRole('group', { name: 'Acrescentar ao cartão' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Datas' })).toBeNull();
  });

  it('dado um cartão sem dados (o processo), quando abre, então a descrição vem logo depois do título', () => {
    // Quando
    render(<Cabeca dados={false} />);
    // Então
    expect(emOrdem(screen.getByRole('heading', { name: 'O título' }), screen.getByText('A descrição'))).toBe(true);
  });

  it('dado um cartão sem descrição, quando abre, então não sobra o lugar dela: os dados são o último bloco', () => {
    // Quando
    const { container } = render(<Cabeca descricao={false} />);
    // Então
    const cabeca = container.querySelector('header')!;
    expect(cabeca.lastElementChild).toContainElement(screen.getByRole('group', { name: 'Datas' }));
  });
});
