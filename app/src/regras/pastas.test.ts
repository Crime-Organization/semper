// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import { TAMANHO_PASTA } from '../dados/limites';
import {
  arvoreDePastas, caminhoDaPasta, destinosDaPasta, enderecoDaPasta, erroAoMoverPasta, erroDoNomeDaPasta, nomeDaPasta, PASTA_DENTRO_DELA, PASTA_REPETIDA,
  pastasDescendentes, pastasEmOrdem, textoDoCaminho, type PastaDaArvore
} from './pastas';

const pasta = (id: string, nome: string, pasta_mae_id: string | null = null): PastaDaArvore => ({ id, nome, pasta_mae_id });
// Escritório › POPs › Financeiro; Escritório › Atas; Modelos (no primeiro nível).
const ESCRITORIO = pasta('esc', 'Escritório'), POPS = pasta('pops', 'POPs', 'esc'), FINANCEIRO = pasta('fin', 'Financeiro', 'pops');
const ATAS = pasta('atas', 'Atas', 'esc'), MODELOS = pasta('mod', 'Modelos');
const TODAS = [FINANCEIRO, MODELOS, POPS, ESCRITORIO, ATAS];

describe('Pastas dos documentos', () => {
  it('dada a lista plana, quando monta a árvore, então cada pasta fica dentro da mãe, em ordem alfabética e com o nível', () => {
    // Quando
    const arvore = arvoreDePastas(TODAS);
    // Então
    expect(arvore.map(n => n.pasta.nome)).toEqual(['Escritório', 'Modelos']);
    expect(arvore[0].filhas.map(n => n.pasta.nome)).toEqual(['Atas', 'POPs']);
    expect(arvore[0].filhas[1].filhas.map(n => [n.pasta.nome, n.nivel])).toEqual([['Financeiro', 2]]);
  });

  it('dada uma pasta cuja mãe não veio na lista, quando monta a árvore, então ela aparece no primeiro nível', () => {
    // Então
    expect(arvoreDePastas([POPS, FINANCEIRO]).map(n => n.pasta.nome)).toEqual(['POPs']);
  });

  it('dada uma lista com um ciclo (que o banco não deixa existir), quando monta a árvore, então cada pasta aparece uma vez e nada trava', () => {
    // Dado
    const ciclo = [pasta('a', 'A', 'b'), pasta('b', 'B', 'a')];
    // Quando
    const ordem = pastasEmOrdem(ciclo).map(n => n.pasta.id);
    // Então
    expect(ordem).toEqual(['a', 'b']);
    expect(caminhoDaPasta(ciclo, 'a').map(p => p.id)).toEqual(['b', 'a']);
  });

  it('quando lista as pastas para um seletor, então vêm na ordem de leitura, a mãe antes das filhas', () => {
    // Então
    expect(pastasEmOrdem(TODAS).map(n => `${n.nivel}:${n.pasta.nome}`)).toEqual(['0:Escritório', '1:Atas', '1:POPs', '2:Financeiro', '0:Modelos']);
  });

  it('dada uma subpasta, quando pede o caminho, então vem do primeiro nível até ela, e escrito com "›"', () => {
    // Então
    expect(caminhoDaPasta(TODAS, 'fin').map(p => p.nome)).toEqual(['Escritório', 'POPs', 'Financeiro']);
    expect(textoDoCaminho(TODAS, 'fin')).toBe('Escritório › POPs › Financeiro');
    expect(textoDoCaminho(TODAS, 'fin', ' / ')).toBe('Escritório / POPs / Financeiro');
    expect(textoDoCaminho(TODAS, null)).toBe('');
    expect(caminhoDaPasta(TODAS, 'nao-existe')).toEqual([]);
  });

  it('dada uma pasta, quando pede as descendentes, então vêm ela e as que ficam dentro dela, em qualquer nível', () => {
    // Então
    expect(pastasDescendentes(TODAS, 'esc').sort()).toEqual(['atas', 'esc', 'fin', 'pops']);
    expect(pastasDescendentes(TODAS, 'mod')).toEqual(['mod']);
  });

  it.each([
    ['vazio', '   ', null, 'Dê um nome à pasta.'],
    ['longo demais', 'x'.repeat(TAMANHO_PASTA + 1), null, `O nome da pasta pode ter até ${TAMANHO_PASTA} caracteres.`],
    ['igual ao de uma irmã, sem acento e em minúsculas', 'escritorio', null, PASTA_REPETIDA],
    ['igual ao de uma irmã dentro de outra pasta', ' pops ', 'esc', PASTA_REPETIDA],
    ['igual ao de uma pasta em outro lugar', 'Financeiro', null, ''],
    ['novo', 'Clientes', 'esc', '']
  ] as const)('quando o nome da pasta é %s, então o erro é o certo', (_caso, nome, mae, erro) => {
    // Então
    expect(erroDoNomeDaPasta(nome, TODAS, mae)).toBe(erro);
  });

  it('dada uma pasta sendo renomeada, quando o nome é o dela mesma, então não conta como repetido', () => {
    // Então
    expect(erroDoNomeDaPasta('POPS', TODAS, 'esc', 'pops')).toBe('');
    expect(nomeDaPasta('  POPs   do   escritório ')).toBe('POPs do escritório');
  });

  it('quando o nome vem colado com espaços não separáveis (NBSP) nas pontas e no meio, então eles saem como os comuns, como no banco', () => {
    // Então
    expect(nomeDaPasta('  Colada  da web  ')).toBe('Colada da web');
    expect(erroDoNomeDaPasta('  ', TODAS, null)).toBe('Dê um nome à pasta.');
  });

  it('dadas pastas em mais de 100 níveis, quando se pede o caminho da mais funda, então ele vem inteiro, desde o primeiro nível', () => {
    // Dado
    const NIVEIS = 105;
    const fundas = Array.from({ length: NIVEIS }, (_, i) => pasta(`n${i + 1}`, `N${i + 1}`, i ? `n${i}` : null));
    // Então
    expect(textoDoCaminho(fundas, `n${NIVEIS}`).split(' › ')).toHaveLength(NIVEIS);
    expect(textoDoCaminho(fundas, `n${NIVEIS}`).startsWith('N1 › N2 › ')).toBe(true);
  });

  it.each([
    ['para dentro dela mesma', 'pops', 'pops', PASTA_DENTRO_DELA],
    ['para dentro de uma subpasta dela', 'esc', 'fin', PASTA_DENTRO_DELA],
    ['para onde já há uma com o mesmo nome', 'fin', null, ''],
    ['para o primeiro nível', 'pops', null, ''],
    ['para dentro de outra pasta', 'mod', 'atas', '']
  ] as const)('quando a pasta é levada %s, então o erro é o certo', (_caso, id, destino, erro) => {
    // Então
    expect(erroAoMoverPasta(TODAS, id, destino)).toBe(erro);
  });

  it('dada uma pasta irmã com o mesmo nome no destino, quando a pasta é levada para lá, então é recusado', () => {
    // Dado
    const lista = [...TODAS, pasta('outro-fin', 'financeiro', 'esc')];
    // Então
    expect(erroAoMoverPasta(lista, 'fin', 'esc')).toBe(PASTA_REPETIDA);
  });

  it('dada uma pasta, quando lista para onde ela pode ir, então ficam de fora ela mesma e as subpastas dela', () => {
    // Então
    expect(destinosDaPasta(TODAS, 'pops').map(n => n.pasta.nome)).toEqual(['Escritório', 'Atas', 'Modelos']);
  });

  it('dada uma pasta, quando pede o endereço dela, então é a página Documentos já mostrando a pasta', () => {
    // Então
    expect(enderecoDaPasta('p-1')).toBe('/documentos/?pasta=p-1');
  });
});
