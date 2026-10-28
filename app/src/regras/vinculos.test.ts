// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import type { Vinculo, VinculoTipo } from '../dados/tipos';
import { exigeDescricao, lerVinculo, opcoesDeVinculo, pontasDoVinculo } from './vinculos';

const tipos: VinculoTipo[] = [
  { id: 't1', escritorio_id: null, nome: 'Cônjuge', inverso: 'Cônjuge', ordem: 10 },
  { id: 't2', escritorio_id: null, nome: 'Representante legal de', inverso: 'Representado(a) por', ordem: 60 },
  { id: 't3', escritorio_id: 'e1', nome: 'Inventariante de', inverso: 'Espólio com inventariante', ordem: 500 }
];
const pessoa = (id: string, nome: string) => ({ id, nome, codigo: id.toUpperCase(), tipo: 'pf' as const });

describe('Vínculos entre pessoas', () => {
  describe('Dado que João é representante legal da Padaria X', () => {
    const v: Vinculo = { id: 'v1', pessoa_de: 'joao', pessoa_para: 'padaria', tipo_id: 't2', descricao: null, criado_por: null, criado_em: '',
      de: pessoa('joao', 'JOÃO'), para: pessoa('padaria', 'PADARIA X'), tipo: tipos[1] };

    it('quando se olha o cartão do João, então ele aparece como "Representante legal de" a padaria', () => {
      // Quando
      const lido = lerVinculo(v, 'joao');
      // Então
      expect(lido).toEqual({ rotulo: 'Representante legal de', outra: v.para });
    });

    it('quando se olha o cartão da padaria, então ela aparece como "Representado(a) por" João', () => {
      // Quando
      const lido = lerVinculo(v, 'padaria');
      // Então
      expect(lido).toEqual({ rotulo: 'Representado(a) por', outra: v.de });
    });
  });

  describe('Dados os tipos de vínculo do escritório', () => {
    it('quando se escolhe um vínculo, então cada tipo aparece nos dois sentidos e os simétricos uma vez só', () => {
      // Quando
      const rotulos = opcoesDeVinculo(tipos).map(o => o.rotulo);
      // Então
      expect(rotulos).toEqual(['Cônjuge', 'Representante legal de', 'Representado(a) por', 'Inventariante de', 'Espólio com inventariante']);
    });

    it('quando o escritório criou um tipo próprio, então os dois sentidos dele são marcados como próprios', () => {
      // Quando
      const proprias = opcoesDeVinculo(tipos).filter(o => o.proprio);
      // Então
      expect(proprias).toHaveLength(2);
    });

    it('quando a escolha é "Representante legal de" a padaria, então João fica na ponta de origem', () => {
      // Dado
      const [, representante] = opcoesDeVinculo(tipos);
      // Quando
      const pontas = pontasDoVinculo(representante, 'joao', 'padaria');
      // Então
      expect(pontas).toEqual({ de: 'joao', para: 'padaria' });
    });

    it('quando a escolha, no cartão da padaria, é "Representado(a) por" João, então João continua na ponta de origem', () => {
      // Dado
      const [, , representado] = opcoesDeVinculo(tipos);
      // Quando
      const pontas = pontasDoVinculo(representado, 'padaria', 'joao');
      // Então
      expect(pontas).toEqual({ de: 'joao', para: 'padaria' });
    });
  });

  it.each([
    ['Outro', true],
    ['Cônjuge', false]
  ])('quando o vínculo é "%s", então pedir descrição dá %s', (rotulo, exige) => {
    // Quando
    const resultado = exigeDescricao(rotulo);
    // Então
    expect(resultado).toBe(exige);
  });
});
