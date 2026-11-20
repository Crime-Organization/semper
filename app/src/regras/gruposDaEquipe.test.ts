// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Os nomes são inventados.
import { describe, expect, it } from 'vitest';
import { GRUPOS_POR_ITEM } from '../dados/limites';
import type { GrupoDaEquipe, Membro } from '../dados/tipos';
import {
  avisoDaExclusao, candidatosDeGrupo, dicaDosIntegrantes, estaPeloGrupo, filtroQueVale, FILTRO_DOS_MEUS_GRUPOS, gruposDoFiltro, INTEGRANTES_NA_DICA,
  integrantesAtivos, itensPorModulo, meusGrupos, textoDoGrupo
} from './gruposDaEquipe';

const membro = (id: string, nome: string, extra: Partial<Membro> = {}): Membro => ({ id, nome, ativo: true, ...extra });
const equipe = [membro('u1', 'Ana Exemplo'), membro('u2', 'Beto Teste'), membro('u3', 'Caio Fictício'), membro('u4', 'Davi Desativado', { ativo: false }),
  membro('u5', 'Gil Reservado', { reservada: true }), membro('u6', 'Ivo Excluído', { excluido: true })];
const grupo = (id: string, nome: string, integrantes: string[]): GrupoDaEquipe => ({ id, nome, integrantes });
const nucleoA = grupo('ga', 'Núcleo A', ['u1', 'u2']), nucleoB = grupo('gb', 'Núcleo Bê', ['u2', 'u3', 'u4']);

describe('Grupos da equipe (#378)', () => {
  it('dada uma pessoa em dois grupos, quando se pergunta pelos grupos dela, então vêm os dois; quem não está em nenhum, nenhum', () => {
    // Então
    expect(meusGrupos([nucleoA, nucleoB], 'u2')).toEqual(['ga', 'gb']);
    expect(meusGrupos([nucleoA, nucleoB], 'u9')).toEqual([]);
    expect(meusGrupos(undefined, 'u2')).toEqual([]);
  });

  it.each([
    [['ga'], ['ga', 'gb'], true],
    [['gc'], ['ga'], false],
    [[], ['ga'], false],
    [undefined, ['ga'], false],
    [['ga'], [], false]
  ] as const)('dado o item com %j e a pessoa nos grupos %j, então ela está pelo grupo: %s', (doItem, meus, esperado) => {
    // Então
    expect(estaPeloGrupo(doItem, meus)).toBe(esperado);
  });

  it('dado um grupo com um desativado, uma conta reservada e um excluído, então só os ativos participam e contam', () => {
    // Dado
    const todos = grupo('gt', 'Núcleo Todos', ['u1', 'u4', 'u5', 'u6']);
    // Então
    expect(integrantesAtivos(todos, equipe).map(m => m.id)).toEqual(['u1']);
    expect(textoDoGrupo(todos, equipe)).toBe('Núcleo Todos · 1 pessoa');
    expect(textoDoGrupo(nucleoB, equipe)).toBe('Núcleo Bê · 2 pessoas');
  });

  it('dado um grupo, quando se mostra a dica, então ela traz os nomes em ordem e por extenso', () => {
    // Então
    expect(dicaDosIntegrantes(nucleoB, equipe)).toBe('Núcleo Bê · 2 pessoas: Beto Teste e Caio Fictício');
    expect(dicaDosIntegrantes(grupo('gv', 'Núcleo Vazio', []), equipe)).toBe('Núcleo Vazio · ninguém ainda');
  });

  it('dado um grupo com mais pessoas do que cabem na dica, então ela mostra as primeiras e "e mais N"', () => {
    // Dado
    const muitos = Array.from({ length: INTEGRANTES_NA_DICA + 16 }, (_, i) => membro(`m${String(i).padStart(2, '0')}`, `Pessoa ${String(i).padStart(2, '0')}`));
    const grande = grupo('gg', 'Núcleo Grande', muitos.map(m => m.id));
    // Quando
    const dica = dicaDosIntegrantes(grande, muitos);
    // Então
    expect(dica).toBe(`Núcleo Grande · ${muitos.length} pessoas: Pessoa 00, Pessoa 01, Pessoa 02, Pessoa 03, Pessoa 04 e mais 16`);
  });

  it('dado um termo sem acento, quando se buscam grupos para pôr no item, então vêm os que combinam e ainda não estão nele', () => {
    // Então
    expect(candidatosDeGrupo([nucleoA, nucleoB], 'nucleo', ['ga']).map(g => g.id)).toEqual(['gb']);
    expect(candidatosDeGrupo([nucleoA, nucleoB], 'BÊ', []).map(g => g.id)).toEqual(['gb']);
    expect(candidatosDeGrupo([nucleoA, nucleoB], '', []).map(g => g.id)).toEqual(['ga', 'gb']);
    expect(candidatosDeGrupo(undefined, '', [])).toEqual([]);
  });

  it('dado um item com o máximo de grupos, então nenhum grupo mais é oferecido', () => {
    // Dado
    const cheio = Array.from({ length: GRUPOS_POR_ITEM }, (_, i) => `g${i}`);
    // Então
    expect(candidatosDeGrupo([nucleoA], '', cheio)).toEqual([]);
  });

  it('dado o filtro "Grupo da equipe", então ele vira os ids dos grupos; vazio, nenhum filtro', () => {
    // Então
    expect(gruposDoFiltro(FILTRO_DOS_MEUS_GRUPOS, ['ga', 'gb'])).toEqual(['ga', 'gb']);
    expect(gruposDoFiltro('gb', ['ga'])).toEqual(['gb']);
    expect(gruposDoFiltro(undefined, ['ga'])).toBeNull();
    expect(gruposDoFiltro('', ['ga'])).toBeNull();
  });

  it('dado um filtro guardado de um grupo que não existe mais, então ele volta a "Todos os grupos"', () => {
    // Então
    expect(filtroQueVale('gx', [nucleoA])).toBeUndefined();
    expect(filtroQueVale('ga', [nucleoA])).toBe('ga');
    expect(filtroQueVale(FILTRO_DOS_MEUS_GRUPOS, [])).toBe(FILTRO_DOS_MEUS_GRUPOS);
    expect(filtroQueVale(undefined, [nucleoA])).toBeUndefined();
  });

  it('dada a contagem dos itens do grupo, então ela é dita em português, no singular e no plural', () => {
    // Então
    expect(itensPorModulo([{ modulo: 'demandas', quantos: 5 }, { modulo: 'tarefas', quantos: 7 }])).toBe('5 demandas e 7 tarefas');
    expect(itensPorModulo([{ modulo: 'processos', quantos: 1 }, { modulo: 'anotacoes', quantos: 2 }, { modulo: 'contratos', quantos: 1 }]))
      .toBe('1 processo, 2 documentos e 1 contrato');
  });

  it('dado um grupo em 12 itens, quando se vai excluí-lo, então o aviso diz quantos, em quais módulos, e que não dá para desfazer', () => {
    // Então
    expect(avisoDaExclusao('Núcleo A', [{ modulo: 'demandas', quantos: 5 }, { modulo: 'tarefas', quantos: 7 }])).toBe(
      'Excluir o grupo Núcleo A? Ele está em 12 itens, contando os arquivados (5 demandas e 7 tarefas). Quem participa só pelo grupo deixa de ver esses itens. '
      + 'As pessoas continuam na equipe. Não dá para desfazer.');
    expect(avisoDaExclusao('Núcleo A', [{ modulo: 'compromissos', quantos: 1 }])).toContain('Ele está em 1 item, contando os arquivados (1 compromisso). Quem participa só pelo grupo deixa de ver esse item.');
    expect(avisoDaExclusao('Núcleo A', [])).toBe('Excluir o grupo Núcleo A? Ele não está em nenhum item. As pessoas continuam na equipe. Não dá para desfazer.');
  });
});
