// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { AcoesDosLigados, CriarNoCartao, ItensLigados } from './ItensLigados';
import { Recolhivel } from './Recolhivel';

describe('Itens ligados a um cadastro', () => {
  it('quando há itens, então cada um é um link para o item, com o código, o título e o detalhe', () => {
    // Quando
    render(<MemoryRouter><ItensLigados vazio="Nada ligado." itens={[
      { id: 'k1', para: '/contratos/?id=k1', codigo: 'MA96-0001-2026', titulo: 'Registro de marca', detalhe: 'Cliente · Em negociação' },
      { id: 'k2', para: '/contratos/?id=k2', codigo: 'MA96-0002-2026', titulo: 'Oposição', detalhe: 'Participante · Encerrado', selo: 'Arquivado' }
    ]} /></MemoryRouter>);
    // Então
    const links = screen.getAllByRole('link');
    expect(links.map(l => l.getAttribute('href'))).toEqual(['/contratos/?id=k1', '/contratos/?id=k2']);
    expect(links[0]).toHaveTextContent('MA96-0001-2026Registro de marcaCliente · Em negociação');
    expect(links[1]).toHaveTextContent('Arquivado');
  });

  it('quando não há itens, então mostra o aviso de vazio', () => {
    // Quando
    render(<MemoryRouter><ItensLigados vazio="Nenhum contrato ligado a esta pessoa." itens={[]} /></MemoryRouter>);
    // Então
    expect(screen.getByText('Nenhum contrato ligado a esta pessoa.')).toBeInTheDocument();
    expect(screen.queryByRole('link')).toBeNull();
  });
});

describe('O atalho para criar um item ligado', () => {
  const NOVA = { para: '/tarefas/nova/?contrato=k1', rotulo: 'Nova tarefa deste contrato' };

  it('dado itens na lista, quando aparece, então o atalho é só o "+", com o nome para o leitor de tela', () => {
    // Quando
    render(<MemoryRouter><ItensLigados vazio="Nada." novo={NOVA} itens={[{ id: 't1', para: '/tarefas/?id=t1', titulo: 'Protocolar' }]} /></MemoryRouter>);
    // Então
    const mais = screen.getByRole('link', { name: 'Nova tarefa deste contrato' });
    expect(mais).toHaveAttribute('href', NOVA.para);
    expect(mais).not.toHaveTextContent('Nova tarefa');
  });

  it('dado a lista vazia, quando aparece, então mostra o texto de vazio e o botão com o nome escrito', () => {
    // Quando
    render(<MemoryRouter><ItensLigados vazio="Nenhuma tarefa ligada a este contrato." novo={NOVA} itens={[]} /></MemoryRouter>);
    // Então
    expect(screen.getByText('Nenhuma tarefa ligada a este contrato.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Nova tarefa deste contrato' })).toHaveTextContent('Nova tarefa deste contrato');
  });
});

describe('O cartão só para ler (#376)', () => {
  const NOVA = { para: '/tarefas/nova/?contrato=k1', rotulo: 'Nova tarefa deste contrato' };
  const tudo = <>
    <Recolhivel titulo="Tarefas" icone="tarefas" novo={NOVA}><p>dentro</p></Recolhivel>
    <ItensLigados vazio="Nenhuma tarefa." novo={NOVA} itens={[]} />
    <AcoesDosLigados novo={{ para: NOVA.para, rotulo: 'Nova tarefa' }}><button type="button">Ligar tarefa existente</button></AcoesDosLigados>
  </>;

  it('dado o cartão que deixa criar, quando aparece, então o "+" do título, o da lista e o "+ Nova tarefa" de baixo levam ao cadastro', () => {
    // Quando
    render(<MemoryRouter><CriarNoCartao pode>{tudo}</CriarNoCartao></MemoryRouter>);
    // Então
    expect(screen.getAllByRole('link', { name: 'Nova tarefa deste contrato' })).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'Nova tarefa' })).toHaveAttribute('href', NOVA.para);
  });

  it('dado o cartão arquivado (ou de quem só lê), quando aparece, então nenhum atalho de criar aparece, e o resto continua', () => {
    // Quando
    render(<MemoryRouter><CriarNoCartao pode={false}>{tudo}</CriarNoCartao></MemoryRouter>);
    // Então
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByRole('button', { name: 'Tarefas' })).toBeInTheDocument();
    expect(screen.getByText('Nenhuma tarefa.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ligar tarefa existente' })).toBeInTheDocument();
  });

  it('dado o cartão arquivado e uma seção que só tinha o "+ Novo …" embaixo, quando aparece, então não sobra a linha vazia dos botões', () => {
    // Quando
    const { container } = render(<MemoryRouter><CriarNoCartao pode={false}><AcoesDosLigados novo={NOVA} /></CriarNoCartao></MemoryRouter>);
    // Então
    expect(container).toBeEmptyDOMElement();
  });

  it('dado uma seção fora de qualquer cartão, quando tem o atalho, então ele aparece (cada seção decide)', () => {
    // Quando
    render(<MemoryRouter><Recolhivel titulo="Tarefas" icone="tarefas" novo={NOVA}><p>dentro</p></Recolhivel></MemoryRouter>);
    // Então
    expect(screen.getByRole('link', { name: 'Nova tarefa deste contrato' })).toHaveAttribute('href', NOVA.para);
  });
});
