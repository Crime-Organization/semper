// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ModuloComentado } from '../dados/tipos';
import { Icone, ICONE_DO_MODULO } from './Icone';

describe('O ícone de cada módulo (#300)', () => {
  it('dado cada módulo, quando o ícone dele aparece, então há um desenho', () => {
    for (const modulo of Object.keys(ICONE_DO_MODULO) as ModuloComentado[]) {
      // Quando
      const { container, unmount } = render(<Icone nome={ICONE_DO_MODULO[modulo]} />);
      // Então
      expect(container.querySelector('svg')?.innerHTML).not.toBe('');
      unmount();
    }
  });

  it('dados os compromissos e as anotações, quando se pega o ícone, então são o do calendário e o dos documentos, como no menu', () => {
    // Então
    expect(ICONE_DO_MODULO.compromissos).toBe('calendario');
    expect(ICONE_DO_MODULO.anotacoes).toBe('documentos');
  });
});
