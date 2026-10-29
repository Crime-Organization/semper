// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import { MARCOS, podeExcluirColuna } from './quadro';

describe('Colunas-marco', () => {
  it.each([
    ['um administrador', 'uma coluna comum', true, null, true],
    ['um administrador', 'a coluna-marco do contrato assinado', true, 'assinado', false],
    ['um usuário comum', 'uma coluna comum', false, null, false]
  ] as const)('quando %s tenta excluir %s, então a exclusão é %s', (_quem, _coluna, ehAdmin, marco, esperado) => {
    // Quando
    const pode = podeExcluirColuna({ marco }, ehAdmin);
    // Então
    expect(pode).toBe(esperado);
  });

  it('quando o quadro mostra uma coluna-marco, então há um nome e uma explicação para cada marco', () => {
    // Então
    expect(Object.values(MARCOS).every(m => m.rotulo && m.explicacao.includes('não excluída'))).toBe(true);
  });
});
