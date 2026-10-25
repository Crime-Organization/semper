import { describe, expect, it } from 'vitest';
import type { Vinculo, VinculoTipo } from '../dados/tipos';
import { exigeDescricao, lerVinculo, opcoesDeVinculo, pontasDoVinculo } from './vinculos';

const tipos: VinculoTipo[] = [
  { id: 't1', escritorio_id: null, nome: 'Cônjuge', inverso: 'Cônjuge', ordem: 10 },
  { id: 't2', escritorio_id: null, nome: 'Representante legal de', inverso: 'Representado(a) por', ordem: 60 },
  { id: 't3', escritorio_id: 'e1', nome: 'Inventariante de', inverso: 'Espólio com inventariante', ordem: 500 }
];
const pessoa = (id: string, nome: string) => ({ id, nome, codigo: id.toUpperCase(), tipo: 'pf' as const });

describe('vínculos entre pessoas', () => {
  it('mostra o vínculo certo em cada uma das duas pessoas', () => {
    const v: Vinculo = { id: 'v1', pessoa_de: 'joao', pessoa_para: 'padaria', tipo_id: 't2', descricao: null, criado_por: null, criado_em: '',
      de: pessoa('joao', 'JOÃO'), para: pessoa('padaria', 'PADARIA X'), tipo: tipos[1] };
    expect(lerVinculo(v, 'joao')).toEqual({ rotulo: 'Representante legal de', outra: v.para });
    expect(lerVinculo(v, 'padaria')).toEqual({ rotulo: 'Representado(a) por', outra: v.de });
  });
  it('oferece cada tipo nos dois sentidos, e os simétricos uma vez só', () => {
    expect(opcoesDeVinculo(tipos).map(o => o.rotulo)).toEqual(
      ['Cônjuge', 'Representante legal de', 'Representado(a) por', 'Inventariante de', 'Espólio com inventariante']);
    expect(opcoesDeVinculo(tipos).filter(o => o.proprio)).toHaveLength(2);
  });
  it('põe cada pessoa na ponta certa conforme a escolha', () => {
    const [, representante, representado] = opcoesDeVinculo(tipos);
    expect(pontasDoVinculo(representante, 'joao', 'padaria')).toEqual({ de: 'joao', para: 'padaria' });
    expect(pontasDoVinculo(representado, 'padaria', 'joao')).toEqual({ de: 'joao', para: 'padaria' });
  });
  it('pede descrição no vínculo "Outro"', () => {
    expect(exigeDescricao('Outro')).toBe(true);
    expect(exigeDescricao('Cônjuge')).toBe(false);
  });
});
