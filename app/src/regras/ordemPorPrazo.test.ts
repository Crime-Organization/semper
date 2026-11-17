// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import { compararPeloPrazo, type ComPrazo, type SentidoDoPrazo } from './ordemPorPrazo';

const item = (id: string, prazo: string | null, prazo_hora: string | null = null) => ({ id, prazo, prazo_hora });
const ITENS = [
  item('sem-prazo', null), item('dia-20-15h', '2026-11-20', '15:00'), item('dia-18', '2026-11-18'), item('dia-20-9h', '2026-11-20', '09:00'),
  item('outro-sem-prazo', null, '10:00'), item('dia-20', '2026-11-20'), item('dia-25', '2026-12-25')
];
const ordenar = (sentido: SentidoDoPrazo) => ITENS.toSorted((a: ComPrazo, b: ComPrazo) => compararPeloPrazo(a, b, sentido)).map(x => x.id);

describe('Ordem pelo prazo (#291)', () => {
  it('dado itens com e sem prazo, quando ordena pelo mais próximo, então vão da data mais próxima à mais distante, e os sem prazo ficam no fim', () => {
    // Quando
    const ids = ordenar(1);
    // Então
    expect(ids).toEqual(['dia-18', 'dia-20', 'dia-20-9h', 'dia-20-15h', 'dia-25', 'sem-prazo', 'outro-sem-prazo']);
  });

  it('dado itens com e sem prazo, quando ordena pelo mais distante, então a ordem se inverte, e os sem prazo continuam no fim', () => {
    // Quando
    const ids = ordenar(-1);
    // Então
    expect(ids).toEqual(['dia-25', 'dia-20-15h', 'dia-20-9h', 'dia-20', 'dia-18', 'outro-sem-prazo', 'sem-prazo']);
  });

  it('dado dois prazos no mesmo dia, um com hora e outro sem, quando ordena pelo mais próximo, então o sem hora vem antes, e a hora mais cedo antes da mais tarde', () => {
    // Então
    expect(compararPeloPrazo(item('a', '2026-11-20'), item('b', '2026-11-20', '08:00'))).toBeLessThan(0);
    expect(compararPeloPrazo(item('a', '2026-11-20', '08:00'), item('b', '2026-11-20', '14:30'))).toBeLessThan(0);
    expect(compararPeloPrazo(item('a', '2026-11-20', '08:00'), item('b', '2026-11-20', '08:00'))).toBe(0);
  });

  it('dado dois itens sem prazo, quando compara, então só a hora conta, como no banco, e sem hora nenhuma ficam empatados', () => {
    // Então
    expect(compararPeloPrazo(item('a', null), item('b', null, '09:00'))).toBeLessThan(0);
    expect(compararPeloPrazo(item('a', null), item('b', null))).toBe(0);
    expect(compararPeloPrazo(item('a', null), item('b', null), -1)).toBe(0);
  });
});
