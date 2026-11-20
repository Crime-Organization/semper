// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Os nomes são inventados.
import { describe, expect, it, vi } from 'vitest';
import { filtroDeGrupo } from './filtroDeGrupo';

const nucleoA = { id: 'ga', nome: 'Núcleo A', integrantes: ['u1'] }, nucleoB = { id: 'gb', nome: 'Núcleo Bê', integrantes: ['u2'] };

describe('Filtro "Grupo da equipe" de demandas e tarefas (#378)', () => {
  it('dado um escritório sem grupos, quando a página monta os filtros, então não há filtro de grupo', () => {
    // Então
    expect(filtroDeGrupo([], 'u1', '', () => {})).toEqual([]);
    expect(filtroDeGrupo(undefined, 'u1', '', () => {})).toEqual([]);
  });

  it('dada uma pessoa num grupo, quando o filtro é montado, então oferece todos, os dela e cada grupo', () => {
    // Quando
    const [filtro] = filtroDeGrupo([nucleoA, nucleoB], 'u1', 'gb', () => {});
    // Então
    expect(filtro.rotulo).toBe('Grupo da equipe');
    expect(filtro.valor).toBe('gb');
    expect(filtro.opcoes).toEqual([['', 'Todos os grupos'], ['meus', 'Dos meus grupos'], ['ga', 'Núcleo A'], ['gb', 'Núcleo Bê']]);
  });

  it('dada uma pessoa fora de todos os grupos, quando o filtro é montado, então não há "Dos meus grupos"', () => {
    // Quando
    const [filtro] = filtroDeGrupo([nucleoA, nucleoB], 'u9', undefined, () => {});
    // Então
    expect(filtro.valor).toBe('');
    expect(filtro.opcoes.map(([, texto]) => texto)).toEqual(['Todos os grupos', 'Núcleo A', 'Núcleo Bê']);
  });

  it('quando a pessoa escolhe um grupo, então o filtro avisa qual', () => {
    // Dado
    const aoMudar = vi.fn();
    // Quando
    filtroDeGrupo([nucleoA], 'u1', '', aoMudar)[0].aoMudar('ga');
    // Então
    expect(aoMudar).toHaveBeenCalledWith('ga');
  });
});
