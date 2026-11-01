// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import type { Etiqueta } from '../dados/tipos';
import { erroDaEtiqueta, etiquetasNaOrdem, nomeDaEtiqueta, podeMudarEtiqueta, textoDaEtiqueta } from './etiquetas';

const etiqueta = (id: string, cor: Etiqueta['cor'], texto: string | null): Etiqueta => ({ id, cor, texto, criado_por: 'u-ana' });
const URGENTE = etiqueta('e1', 'vermelho', 'Urgência do cliente'), VERDE = etiqueta('e2', 'verde', null);

describe('Etiquetas', () => {
  it.each([['  Urgência   do  cliente ', 'Urgência do cliente'], ['   ', null], ['', null]])('quando o texto digitado é "%s", então fica guardado como %j', (digitado, guardado) => {
    // Então
    expect(textoDaEtiqueta(digitado)).toBe(guardado);
  });

  it('quando a etiqueta é só de cor, então o nome dela diz a cor', () => {
    // Então
    expect(nomeDaEtiqueta(URGENTE)).toBe('Urgência do cliente');
    expect(nomeDaEtiqueta(VERDE)).toBe('Só cor: Verde');
  });

  it('quando as etiquetas são listadas, então vêm as com texto em ordem alfabética e depois as só de cor, na ordem da paleta', () => {
    // Dado
    const lista = [etiqueta('a', 'cinza', null), etiqueta('b', 'azul', 'Zebra'), etiqueta('c', 'vermelho', null), etiqueta('d', 'azul', 'Árvore')];
    // Então
    expect(etiquetasNaOrdem(lista).map(e => e.id)).toEqual(['d', 'b', 'c', 'a']);
  });

  it.each([
    ['o mesmo texto, com outra cor', { cor: 'azul', texto: 'Urgência do cliente' }, 'Já existe uma etiqueta com esse texto.'],
    ['o mesmo texto, sem acento e em maiúsculas', { cor: 'azul', texto: 'URGENCIA DO CLIENTE' }, 'Já existe uma etiqueta com esse texto.'],
    ['só cor, numa cor que já tem', { cor: 'verde', texto: null }, 'Já existe uma etiqueta só de cor em verde.'],
    ['texto longo demais', { cor: 'azul', texto: 'x'.repeat(41) }, 'O texto da etiqueta pode ter até 40 caracteres.']
  ] as const)('quando a etiqueta nova tem %s, então avisa e não deixa criar', (_caso, nova, erro) => {
    // Então
    expect(erroDaEtiqueta({ ...nova }, [URGENTE, VERDE])).toBe(erro);
  });

  it('quando a etiqueta é nova de verdade, então pode criar; só de cor, em outra cor, também', () => {
    // Então
    expect(erroDaEtiqueta({ cor: 'vermelho', texto: 'Prioridade' }, [URGENTE, VERDE])).toBeNull();
    expect(erroDaEtiqueta({ cor: 'azul', texto: null }, [URGENTE, VERDE])).toBeNull();
  });

  it('quando a etiqueta é editada sem mudar o texto, então ela não conta como repetida', () => {
    // Então
    expect(erroDaEtiqueta({ cor: 'azul', texto: 'Urgência do cliente' }, [URGENTE, VERDE], 'e1')).toBeNull();
    expect(erroDaEtiqueta({ cor: 'verde', texto: null }, [URGENTE, VERDE], 'e2')).toBeNull();
  });

  it.each([
    ['quem criou', 'u-ana', false, true], ['um administrador', 'u-outro', true, true], ['outra pessoa', 'u-outro', false, false]
  ])('quando quem tenta mudar é %s, então a resposta é a certa', (_caso, perfil, ehAdmin, pode) => {
    // Então
    expect(podeMudarEtiqueta(URGENTE, perfil, ehAdmin)).toBe(pode);
  });
});
