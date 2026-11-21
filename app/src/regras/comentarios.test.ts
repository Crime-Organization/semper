// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import type { ItemDaAnotacao, Membro } from '../dados/tipos';
import {
  codigosNoTexto, inserirMencao, itemSendoDigitado, itensPeloCodigo, mencaoNegada, mencaoSendoDigitada, mencoesNoTexto, membrosParaMencionar, modulosParaMencionar,
  MOSTRAR_ITEM_MENCIONADO, MOTIVO_SEM_MENCAO, ordenarItensParaMencionar, situacaoDaMencaoDeItem, trechosDoComentario
} from './comentarios';

const EQUIPE: Membro[] = [
  { id: 'u-mauro', nome: 'Mauro Teixeira Duarte', usuario: 'mauro.duarte', funcao: 'advogado', ativo: true },
  { id: 'u-ana', nome: 'Ana Teste Lima', usuario: 'ana.lima', funcao: 'advogado', ativo: true },
  { id: 'u-bruno', nome: 'Bruno Exemplo Souza', usuario: 'bruno.souza', funcao: 'estagiario', ativo: true },
  { id: 'u-carla', nome: 'Carla Fictícia Rocha', usuario: 'carla.rocha', funcao: 'administrativo', ativo: false }
];
const ids = (ms: Membro[]) => ms.map(m => m.id);

describe('Menções no comentário', () => {
  it('quando o texto marca colegas, então as menções vêm sem repetir, com maiúscula e com o ponto da frase', () => {
    // Quando
    const marcados = mencoesNoTexto('Ligar amanhã, @ana.lima. Cópia para @Mauro.Duarte e @ana.lima', EQUIPE);
    // Então
    expect(ids(marcados).sort()).toEqual(['u-ana', 'u-mauro']);
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
    const achados = membrosParaMencionar(EQUIPE, 'duarte', 8);
    const semTermo = membrosParaMencionar(EQUIPE, '', 8);
    // Então
    expect(ids(achados)).toEqual(['u-mauro']);
    expect(ids(semTermo)).toEqual(['u-mauro', 'u-ana', 'u-bruno']);
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

describe('Menções de itens pelo código, com ! (#297)', () => {
  const item = (modulo: ItemDaAnotacao['modulo'], id: string, codigo: string, nome: string, arquivado_em: string | null = null): ItemDaAnotacao =>
    ({ modulo, id, codigo, nome, arquivado_em });

  it('quando o texto chama itens com !, então vêm os códigos, em maiúsculas, sem repetir, e o ! do fim da frase não conta', () => {
    // Quando
    const codigos = codigosNoTexto('Urgente! Fazer !D3A1F09C e !c0ffee12, depois !D3A1F09C.', 'Contrato !HE62-0163-2026! Isso!F00D1234 não');
    // Então
    expect(codigos).toEqual(['C0FFEE12', 'D3A1F09C', 'HE62-0163-2026']);
  });

  it.each([
    ['um ! no fim da frase', 'Urgente!'],
    ['um ! seguido de espaço', 'Atenção ! veja'],
    ['um ! com uma palavra que não é código', 'Veja !marca agora'],
    ['um código mais comprido', 'Veja !D3A1F09C1'],
    ['um ! grudado numa palavra', 'abc!D3A1F09C']
  ])('quando o texto tem %s, então não há menção de item', (_caso, texto) => {
    // Quando
    const codigos = codigosNoTexto(texto);
    // Então
    expect(codigos).toEqual([]);
  });

  it('quando o comentário é mostrado, então cada item chamado vira um trecho próprio, junto das menções de pessoas', () => {
    // Quando
    const trechos = trechosDoComentario('Oi @ana.lima, faça !d3a1f09c e !HE62-0163-2026.', EQUIPE);
    // Então
    expect(trechos.map(t => [t.texto, t.membro?.id ?? null, t.codigo ?? null])).toEqual([
      ['Oi ', null, null], ['@ana.lima', 'u-ana', null], [', faça ', null, null], ['!d3a1f09c', null, 'D3A1F09C'], [' e ', null, null],
      ['!HE62-0163-2026', null, 'HE62-0163-2026'], ['.', null, null]
    ]);
  });

  it.each([
    ['acabou de digitar o !', 'Oi !', 4, null],
    ['terminou a frase com !', 'Urgente!', 8, null],
    ['pôs um espaço depois do !', 'Oi ! ', 5, null],
    ['digitou o começo do código', 'Oi !D3', 6, { inicio: 3, termo: 'D3' }],
    ['digitou uma palavra do título', 'Veja !marca', 11, { inicio: 5, termo: 'marca' }],
    ['digitou o número do contrato', '!HE62-01', 8, { inicio: 0, termo: 'HE62-01' }],
    ['já passou da menção', 'Oi !D3A1F09C veja', 17, null]
  ])('quando a pessoa %s, então a lista do ! recebe %j', (_caso, texto, cursor, esperado) => {
    // Quando
    const r = itemSendoDigitado(texto, cursor);
    // Então
    expect(r).toEqual(esperado);
  });

  it('quando a pessoa escolhe um item, então o "!termo" vira "!CODIGO", com um espaço, e o cursor fica depois dele', () => {
    // Quando
    const r = inserirMencao('Veja !marca hoje', 5, 11, 'D3A1F09C', '!');
    // Então
    expect(r).toEqual({ texto: 'Veja !D3A1F09C hoje', cursor: 15 });
  });

  it('quando a busca acha itens, então o de código igual vem primeiro, depois os de código que começa com o termo, sem repetir e até o limite', () => {
    // Dado
    const achados = [
      item('tarefas', 't1', 'AAAA0001', 'Revisar D3A1'), item('demandas', 'd2', 'D3A1F000', 'Outra'), item('demandas', 'd1', 'D3A1F09C', 'Registro'),
      item('demandas', 'd2', 'D3A1F000', 'Outra'), item('pessoas', 'p1', 'BBBB0002', 'Pessoa D3A1')
    ];
    // Quando
    const pelosCodigos = ordenarItensParaMencionar(achados, 'd3a1f0', 3);
    const exato = ordenarItensParaMencionar(achados, 'D3A1F09C', 2);
    // Então
    expect(pelosCodigos.map(i => i.id)).toEqual(['d2', 'd1', 't1']);
    expect(exato.map(i => i.id)).toEqual(['d1', 't1']);
  });

  it('dado os itens que voltaram da consulta, quando cada menção é mostrada, então só o item visto abre, e o que não voltou não mostra título', () => {
    // Dado
    const consultados = itensPeloCodigo(['D3A1F09C', '7B42C0DE', 'ffff0000'],
      [item('demandas', 'd1', 'D3A1F09C', 'Registro de marca'), item('demandas', 'd2', '7B42C0DE', 'Busca', '2026-11-01T00:00:00Z')]);
    // Quando
    const situacoes = ['d3a1f09c', '7B42C0DE', 'FFFF0000', 'ABCD1234'].map(c => situacaoDaMencaoDeItem(consultados, c));
    // Então
    expect(situacoes).toEqual(['aberto', 'arquivado', 'indisponivel', 'semConsulta']);
    expect(situacaoDaMencaoDeItem(undefined, 'D3A1F09C')).toBe('semConsulta');
    expect(MOSTRAR_ITEM_MENCIONADO.aberto.explicacao(consultados.get('D3A1F09C')!)).toBe('Abrir Demanda D3A1F09C: Registro de marca');
    expect(MOSTRAR_ITEM_MENCIONADO.arquivado).toMatchObject({ abre: true, aviso: 'arquivado' });
    expect(MOSTRAR_ITEM_MENCIONADO.indisponivel).toMatchObject({ abre: false, aviso: 'sem acesso ou excluído' });
    expect(MOSTRAR_ITEM_MENCIONADO.indisponivel.explicacao(undefined)).not.toContain('Busca');
  });

  it('dado um escritório sem contratos e sem processos, quando a lista do ! procura, então ela vai só às tarefas, demandas e pessoas', () => {
    // Quando
    const modulos = modulosParaMencionar({ tarefas: true, demandas: true, contratos: false });
    // Então
    expect(modulos).toEqual(['tarefas', 'demandas', 'pessoas']);
    expect(modulosParaMencionar(undefined)).toEqual(['pessoas']);
  });
});
