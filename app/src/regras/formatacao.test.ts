// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import { alternarLista, alternarMarca, blocosDoTexto, pedacosDaLinha, type Escolha } from './formatacao';

const so = (texto: string) => ({ texto, marcas: [] });

describe('Negrito e itálico na linha (#293)', () => {
  it('dada "Juntar **procuração** e *comprovante*", quando lê, então "procuração" é negrito, "comprovante" é itálico, e as marcas somem', () => {
    // Quando
    const p = pedacosDaLinha('Juntar **procuração** e *comprovante*');
    // Então
    expect(p).toEqual([so('Juntar '), { texto: 'procuração', marcas: ['negrito'] }, so(' e '), { texto: 'comprovante', marcas: ['italico'] }]);
  });

  it('dadas as marcas do Trello com sublinhado, quando lê, então também valem', () => {
    // Então
    expect(pedacosDaLinha('__a__ e _b_')).toEqual([{ texto: 'a', marcas: ['negrito'] }, so(' e '), { texto: 'b', marcas: ['italico'] }]);
  });

  it('dado itálico dentro do negrito, quando lê, então o trecho tem os dois', () => {
    // Então
    expect(pedacosDaLinha('**muito *mesmo***')).toEqual([{ texto: 'muito ', marcas: ['negrito'] }, { texto: 'mesmo', marcas: ['negrito', 'italico'] }]);
  });

  it.each([
    ['**urgente'], ['contrato_final_v2.pdf'], ['joao_silva@exemplo.com'], ['5 * 3 * 2'], ['nota** solta'], ['a*b*c'], ['** espaço **']
  ])('dado "%s", quando lê, então fica como foi escrito', texto => {
    // Então
    expect(pedacosDaLinha(texto)).toEqual([so(texto)]);
  });

  it('dado texto parecido com código de página, quando lê, então é só texto', () => {
    // Então
    expect(pedacosDaLinha('<script>alert(1)</script> <img src=x onerror=alert(1)>')).toEqual([so('<script>alert(1)</script> <img src=x onerror=alert(1)>')]);
  });
});

describe('Listas e quebras de linha (#293)', () => {
  it('dada uma descrição com linhas que começam com "- ", quando lê, então elas viram uma lista, e o resto fica como texto', () => {
    // Quando
    const b = blocosDoTexto('Levar:\n- RG\n- **CPF**\nAté sexta.');
    // Então
    expect(b).toEqual([
      { tipo: 'texto', linhas: [[so('Levar:')]] },
      { tipo: 'lista', linhas: [[so('RG')], [{ texto: 'CPF', marcas: ['negrito'] }]] },
      { tipo: 'texto', linhas: [[so('Até sexta.')]] }
    ]);
  });

  it('dada uma linha em branco antes e depois da lista, quando lê, então ela só separa, sem virar uma linha vazia a mais', () => {
    // Quando
    const b = blocosDoTexto('Levar:\n\n- RG\n\nAté sexta.\n\n\nFim');
    // Então
    expect(b).toEqual([
      { tipo: 'texto', linhas: [[so('Levar:')]] },
      { tipo: 'lista', linhas: [[so('RG')]] },
      { tipo: 'texto', linhas: [[so('Até sexta.')], [], [], [so('Fim')]] }
    ]);
  });

  it('dada uma descrição antiga com linhas em branco, quando lê, então as quebras ficam iguais', () => {
    // Quando
    const b = blocosDoTexto('Primeira\r\n\r\nTerceira');
    // Então
    expect(b).toEqual([{ tipo: 'texto', linhas: [[so('Primeira')], [], [so('Terceira')]] }]);
  });
});

/** Escreve a escolha como texto: [ e ] marcam o trecho escolhido. */
const ver = ({ texto, inicio, fim }: Escolha) => texto.slice(0, inicio) + '[' + texto.slice(inicio, fim) + ']' + texto.slice(fim);
const escolha = (comColchetes: string): Escolha => {
  const inicio = comColchetes.indexOf('['), fim = comColchetes.indexOf(']') - 1;
  return { texto: comColchetes.replace('[', '').replace(']', ''), inicio, fim };
};

describe('Botões B, I e lista (#293)', () => {
  it.each([
    ['negrito', 'Juntar [procuração] já', 'Juntar **[procuração]** já'],
    ['negrito', 'Juntar **[procuração]** já', 'Juntar [procuração] já'],
    ['negrito', 'Juntar [**procuração**] já', 'Juntar [procuração] já'],
    ['italico', 'Juntar [comprovante]', 'Juntar *[comprovante]*'],
    ['italico', 'Juntar *[comprovante]*', 'Juntar [comprovante]'],
    ['italico', '**[forte]**', '***[forte]***'],
    ['negrito', 'Nada escolhido: []', 'Nada escolhido: **[]**']
  ] as const)('dada a marca %s e "%s", quando aperta o botão, então fica "%s"', (marca, antes, depois) => {
    // Quando
    const r = alternarMarca(escolha(antes), marca);
    // Então
    expect(ver(r)).toBe(depois);
  });

  it('dadas duas linhas escolhidas, quando aperta o botão de lista, então as duas viram itens; apertando de novo, voltam', () => {
    // Dado
    const antes = escolha('Levar:\n[RG\nCPF]');
    // Quando
    const lista = alternarLista(antes);
    // Então
    expect(lista.texto).toBe('Levar:\n- RG\n- CPF');
    // Quando
    const volta = alternarLista(lista);
    // Então
    expect(volta.texto).toBe('Levar:\nRG\nCPF');
  });

  it('dado o cursor numa linha, sem trecho escolhido, quando aperta o botão de lista, então só essa linha vira item', () => {
    // Quando
    const r = alternarLista(escolha('Um\nDo[]is\nTrês'));
    // Então
    expect(r.texto).toBe('Um\n- Dois\nTrês');
  });
});
