// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import type { Membro } from '../dados/tipos';
import { inserirMencao, mencaoNegada, mencaoSendoDigitada, mencoesNoTexto, membrosParaMencionar, MOTIVO_SEM_MENCAO, trechosDoComentario } from './comentarios';

const EQUIPE: Membro[] = [
  { id: 'u-mateus', nome: 'Mateus Freitas Gonçalves', usuario: 'mateus.goncalves', funcao: 'advogado', ativo: true },
  { id: 'u-ana', nome: 'Ana Teste Lima', usuario: 'ana.lima', funcao: 'advogado', ativo: true },
  { id: 'u-bruno', nome: 'Bruno Exemplo Souza', usuario: 'bruno.souza', funcao: 'estagiario', ativo: true },
  { id: 'u-carla', nome: 'Carla Fictícia Rocha', usuario: 'carla.rocha', funcao: 'administrativo', ativo: false }
];
const ids = (ms: Membro[]) => ms.map(m => m.id);

describe('Menções no comentário', () => {
  it('quando o texto marca colegas, então as menções vêm sem repetir, com maiúscula e com o ponto da frase', () => {
    // Quando
    const marcados = mencoesNoTexto('Ligar amanhã, @ana.lima. Cópia para @Mateus.Goncalves e @ana.lima', EQUIPE);
    // Então
    expect(ids(marcados).sort()).toEqual(['u-ana', 'u-mateus']);
  });

  it.each([
    ['um e-mail', 'Escrever para joao@ana.lima'],
    ['alguém que não é da equipe', 'Falar com @fulano'],
    ['alguém desativado', 'Pedir a @carla.rocha']
  ])('quando o texto tem %s, então não há menção', (_caso, texto) => {
    // Quando
    const marcados = mencoesNoTexto(texto, EQUIPE);
    // Então
    expect(marcados).toEqual([]);
  });

  it('quando o comentário é mostrado, então cada menção vira um trecho próprio, e o resto do texto continua igual', () => {
    // Quando
    const trechos = trechosDoComentario('Oi @ana.lima, veja com @bruno.souza.', EQUIPE);
    // Então
    expect(trechos.map(t => [t.texto, t.membro?.id ?? null])).toEqual([
      ['Oi ', null], ['@ana.lima', 'u-ana'], [', veja com ', null], ['@bruno.souza', 'u-bruno'], ['.', null]
    ]);
  });
});

describe('Quem pode ser mencionado', () => {
  it.each([
    ['um advogado', 'u-ana', 'contratos', null],
    ['um estagiário', 'u-bruno', 'contratos', 'em contratos, só advogados'],
    ['um estagiário', 'u-bruno', 'pessoas', null]
  ] as const)('quando %s é mencionado nos cartões de %s, então o motivo para não poder é %s', (_caso, id, modulo, motivo) => {
    // Quando
    const r = MOTIVO_SEM_MENCAO[modulo](EQUIPE.find(m => m.id === id)!);
    // Então
    expect(r).toBe(motivo);
  });

  it('quando alguém que não é advogado aparece num comentário de contrato, então a mensagem diz quem e por quê', () => {
    // Então
    expect(mencaoNegada('Bruno Exemplo Souza')).toBe('Não é possível mencionar Bruno Exemplo Souza em contratos: só advogados podem ser mencionados.');
  });
});

describe('Lista do @ enquanto se digita', () => {
  it.each([
    ['acabou de digitar o @', 'Oi @', 4, { inicio: 3, termo: '' }],
    ['digitou parte do nome', 'Oi @an', 6, { inicio: 3, termo: 'an' }],
    ['está no meio de um e-mail', 'joao@an', 7, null],
    ['já passou da menção', 'Oi @ana.lima veja', 17, null]
  ])('quando a pessoa %s, então a lista do @ %s', (_caso, texto, cursor, esperado) => {
    // Quando
    const r = mencaoSendoDigitada(texto, cursor);
    // Então
    expect(r).toEqual(esperado);
  });

  it('quando o termo é parte do nome, sem acento, então aparecem só os colegas ativos que combinam', () => {
    // Quando
    const achados = membrosParaMencionar(EQUIPE, 'goncalves', 8);
    const semTermo = membrosParaMencionar(EQUIPE, '', 8);
    // Então
    expect(ids(achados)).toEqual(['u-mateus']);
    expect(ids(semTermo)).toEqual(['u-mateus', 'u-ana', 'u-bruno']);
  });

  it.each([
    ['no fim do texto', 'Oi @an', 6, 'Oi @ana.lima '],
    ['antes de um espaço', 'Oi @an tudo bem', 6, 'Oi @ana.lima tudo bem']
  ])('quando a pessoa escolhe um colega %s, então o "@termo" vira "@usuario", com um espaço só, e o cursor fica depois dele', (_caso, texto, cursor, esperado) => {
    // Quando
    const r = inserirMencao(texto, 3, cursor, 'ana.lima');
    // Então
    expect(r).toEqual({ texto: esperado, cursor: 13 });
  });
});
