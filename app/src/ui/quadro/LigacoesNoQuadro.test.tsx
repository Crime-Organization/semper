// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LigacoesNoQuadro } from './LigacoesNoQuadro';

describe('Ligações no cartão do quadro (#300)', () => {
  describe('Dado um cartão ligado a uma demanda e a um contrato', () => {
    const ligacoes = [{ modulo: 'demandas', codigo: 'D3A1F09C' }, { modulo: 'contratos', codigo: 'MA96-0001-2026' }] as const;

    it('quando a miniatura aparece, então mostra o código do cartão e só o código de cada ligação, sem as palavras', () => {
      // Quando
      const { container } = render(<LigacoesNoQuadro codigo="C0FFEE12" ligacoes={ligacoes} />);
      // Então
      expect(container).toHaveTextContent('C0FFEE12D3A1F09CMA96-0001-2026');
      expect(container).not.toHaveTextContent(/demanda|contrato/i);
    });

    it('quando a pessoa usa um leitor de tela, então cada ligação é dita com o tipo e o código', () => {
      // Quando
      render(<LigacoesNoQuadro codigo="C0FFEE12" ligacoes={ligacoes} />);
      // Então
      expect(screen.getByRole('img', { name: 'Demanda D3A1F09C' })).toBeInTheDocument();
      expect(screen.getByRole('img', { name: 'Contrato MA96-0001-2026' })).toBeInTheDocument();
    });

    it('quando a pessoa passa o mouse numa ligação, então a dica diz o tipo e o código', () => {
      // Quando
      render(<LigacoesNoQuadro codigo="C0FFEE12" ligacoes={ligacoes} />);
      // Então
      expect(screen.getByRole('img', { name: 'Demanda D3A1F09C' })).toHaveAttribute('title', 'Demanda D3A1F09C');
      expect(screen.getByRole('img', { name: 'Contrato MA96-0001-2026' })).toHaveAttribute('title', 'Contrato MA96-0001-2026');
    });

    it('quando a miniatura aparece, então cada ligação tem o desenho do ícone do módulo', () => {
      // Quando
      render(<LigacoesNoQuadro ligacoes={ligacoes} />);
      // Então
      for (const nome of ['Demanda D3A1F09C', 'Contrato MA96-0001-2026']) expect(screen.getByRole('img', { name: nome }).querySelector('svg')).not.toBeNull();
    });
  });

  it('dado um cartão sem ligação, quando a miniatura aparece, então mostra só o código dele, sem imagens', () => {
    // Quando
    const { container } = render(<LigacoesNoQuadro codigo="C0FFEE12" ligacoes={[{ modulo: 'demandas', codigo: null }]} />);
    // Então
    expect(container).toHaveTextContent('C0FFEE12');
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('dado um cartão sem código e sem ligação, quando a miniatura aparece, então a linha não aparece', () => {
    // Quando
    const { container } = render(<LigacoesNoQuadro ligacoes={[{ modulo: 'contratos', codigo: null }]} />);
    // Então
    expect(container).toBeEmptyDOMElement();
  });
});
