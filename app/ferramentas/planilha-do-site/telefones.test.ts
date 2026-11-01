// Testes dos telefones do conversor da planilha do site. Padrão Dado / Quando / Então: veja app/TESTES.md. Só dados fictícios.
import { describe, expect, it } from 'vitest';
import { chave, extrair, formatar, lerTodos, normalizar } from './telefones';

describe('Telefones da planilha do site', () => {
  describe('Separar os números de um texto', () => {
    it.each([
      ['(38) 9 9999-9999 / (38) 3222-0000', ['(38) 9 9999-9999', '(38) 3222-0000']],
      ['38 99999-0000 e 38 3222-0000', ['38 99999-0000', '38 3222-0000']],
      ['(38) 99999-0000 (38) 3222-0000', ['(38) 99999-0000', '(38) 3222-0000']],
      ['+55 38 99999-0000:::+55 38 3222-0000', ['+55 38 99999-0000', '+55 38 3222-0000']],
      ['sem número', []]
    ])('quando o texto é "%s", então os números são %j', (texto, numeros) => {
      // Quando
      const resultado = extrair(texto);
      // Então
      expect(resultado).toEqual(numeros);
    });
  });

  describe('Corrigir o formato', () => {
    it('quando o celular antigo vem sem o 9, então ganha o 9 e a correção é anotada', () => {
      // Quando
      const t = normalizar('(38) 8999-0000');
      // Então
      expect(t.valido).toBe(true);
      expect(formatar(t)).toBe('(38) 98999-0000');
      expect(t.correcoes).toContain('acrescentado o 9 do celular');
    });

    it.each([['(00) 0000-0000'], ['0'], ['9999-9999'], ['5500000000000']])('quando o número é o preenchimento %s, então é lixo', bruto => {
      // Quando
      const t = normalizar(bruto);
      // Então
      expect(t.lixo).toBe(true);
    });

    it('quando o número é estrangeiro, então fica como veio e não serve para comparar', () => {
      // Quando
      const t = normalizar('+1 555 123 4567');
      // Então
      expect(t.estrangeiro).toBe(true);
      expect(formatar(t)).toBe('+1 555 123 4567');
      expect(chave(t)).toBeNull();
    });

    it.each([['+55 38 99999-0000'], ['038 99999-0000'], ['0 15 38 99999-0000'], ['38999990000']])(
      'quando o número é %s, então vira (38) 99999-0000', bruto => {
        // Quando
        const t = normalizar(bruto);
        // Então
        expect(formatar(t)).toBe('(38) 99999-0000');
        expect(chave(t)).toBe('38999990000');
      });

    it('quando o DDD não existe, então o número é inválido e fica como veio', () => {
      // Quando
      const t = normalizar('(20) 3222-0000');
      // Então
      expect(t.valido).toBe(false);
      expect(t.problema).toBe('DDD inexistente');
      expect(formatar(t)).toBe('(20) 3222-0000');
    });
  });

  describe('Vários números do mesmo contato', () => {
    it('quando um número vem sem DDD, então ganha o DDD dos outros números', () => {
      // Quando
      const [primeiro, segundo] = lerTodos(['(38) 3222-0000', '99999-0000']);
      // Então
      expect(formatar(primeiro)).toBe('(38) 3222-0000');
      expect(formatar(segundo)).toBe('(38) 99999-0000');
    });

    it('quando nenhum número tem DDD, então o sem DDD fica inválido', () => {
      // Quando
      const [t] = lerTodos(['99999-0000']);
      // Então
      expect(t.valido).toBe(false);
      expect(t.problema).toBe('sem DDD');
    });
  });
});
