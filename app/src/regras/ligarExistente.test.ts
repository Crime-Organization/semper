// Regras de ligar, no cartão de um item, outro que já existe (#341, etapa 2). Padrão Dado / Quando / Então: app/TESTES.md.
import { describe, expect, it } from 'vitest';
import { CLIENTES_MAXIMOS } from '../dados/limites';
import {
  acrescentar, CONTRATOS_DIFERENTES, DEMANDA_DE_OUTRO_CONTRATO, desfazerTarefaEmMaisUmaDemanda, ligacaoDeUm, listaDoItemCheia, motivoDaListaCheia, motivoDasTarefasDaDemanda,
  motivoDeContratoDiferente, PESSOA_NO_ITEM, semOId, TAREFA_DE_OUTRO_CONTRATO, TAREFA_DE_OUTRO_PROCESSO, tarefaEmMaisUmaDemanda, tarefaNaDemanda, tarefaNoPrazo, voltarOQueAindaE, type TarefaParaOPrazo
} from './ligarExistente';

const cheia = Array.from({ length: CLIENTES_MAXIMOS }, (_, i) => 'p' + i);

describe('Pôr uma pessoa na lista gravada no item', () => {
  it('dada uma lista com outra pessoa, quando acrescenta uma nova, então ela vai para o fim', () => {
    // Dado / Quando / Então
    expect(acrescentar(['a'], 'b')).toEqual({ lista: ['a', 'b'] });
  });

  it('dada uma lista que já tem a pessoa, quando acrescenta de novo, então não grava (já estava)', () => {
    // Dado / Quando / Então
    expect(acrescentar(['a', 'b'], 'b')).toEqual({ recusa: 'ja' });
  });

  it('dada uma lista cheia, quando acrescenta, então recusa; e a que já está nela continua "já estava"', () => {
    // Dado / Quando / Então
    expect(acrescentar(cheia, 'nova')).toEqual({ recusa: 'cheia' });
    expect(acrescentar(cheia, 'p0')).toEqual({ recusa: 'ja' });
  });

  it('dada uma lista em que outra pessoa entrou depois, quando o Desfazer tira a que a ligação pôs, então a outra fica', () => {
    // Dado / Quando / Então
    expect(semOId(['a', 'minha', 'de outro'], 'minha')).toEqual(['a', 'de outro']);
  });

  it.each([
    [CLIENTES_MAXIMOS - 1, ''],
    [CLIENTES_MAXIMOS, `Já tem ${CLIENTES_MAXIMOS} clientes, o máximo.`]
  ])('dado um item achado com %i clientes, quando aparece na busca, então o motivo de não escolher é "%s"', (quantos, motivo) => {
    // Dado / Quando / Então
    expect(motivoDaListaCheia(cheia.slice(0, quantos), 'clientes')).toBe(motivo);
  });
});

describe('Ligações de um só', () => {
  it.each([
    [null, 'gravar'],
    [undefined, 'gravar'],
    ['k1', 'ja'],
    ['k2', 'outro']
  ] as const)('dado um item ligado a %s, quando liga a k1, então o resultado é "%s"', (atual, esperado) => {
    // Dado / Quando / Então
    expect(ligacaoDeUm(atual, 'k1')).toBe(esperado);
  });
});

describe('O Desfazer dos campos de um só', () => {
  it('dados dois campos gravados pela ligação, quando outra pessoa mudou um deles depois, então só o outro volta ao de antes', () => {
    // Dado
    const gravado = { processo_id: 'p1', prazo: '2026-12-01' }, antes = { processo_id: null, prazo: '2026-12-20' };
    // Quando
    const volta = voltarOQueAindaE<TarefaParaOPrazo>({ processo_id: 'p1', prazo: '2026-12-05' }, gravado, antes);
    // Então
    expect(volta).toEqual({ processo_id: null });
  });

  it('dado um campo que a ligação não gravou, quando desfaz, então ele não entra no que volta', () => {
    // Dado / Quando / Então
    expect(voltarOQueAindaE<TarefaParaOPrazo>({ processo_id: 'p1', prazo: '2026-12-01' }, { prazo: '2026-12-01' }, { prazo: null })).toEqual({ prazo: null });
  });
});

describe('A tarefa e a demanda', () => {
  const MAXIMOS = { demandas: 2, contratos: 2 };

  it('dada uma tarefa nova sem pessoas e sem contrato, quando nasce numa demanda de um contrato, então leva os clientes e o contrato', () => {
    // Dado / Quando
    const dados = tarefaNaDemanda({ pessoas: [], contrato_id: null }, { id: 'd1', clientes: ['c1', 'c2'], contrato_id: 'k1' });
    // Então
    expect(dados).toEqual({ demanda_id: 'd1', pessoas: ['c1', 'c2'], contrato_id: 'k1' });
    expect(tarefaNaDemanda({ pessoas: ['x'], contrato_id: 'k1' }, { id: 'd1', clientes: ['c1'], contrato_id: 'k1' })).toEqual({ demanda_id: 'd1' });
  });

  it('dada uma tarefa sem nada, quando entra numa demanda de um contrato, então leva os clientes e o contrato, e o Desfazer tira os três', () => {
    // Dado
    const t = { demanda_ids: [], pessoas: [], contrato_ids: [] }, d = { id: 'd1', clientes: ['c1', 'c2'], contrato_id: 'k1' };
    // Quando
    const r = tarefaEmMaisUmaDemanda(t, d, MAXIMOS);
    // Então
    expect(r).toEqual({ dados: { demanda_ids: ['d1'], pessoas: ['c1', 'c2'], contrato_ids: ['k1'] }, demandaId: 'd1', contratoId: 'k1', pessoas: ['c1', 'c2'] });
    if ('recusa' in r) throw new Error('não devia recusar');
    expect(desfazerTarefaEmMaisUmaDemanda({ demanda_ids: ['d1'], pessoas: ['c1', 'c2'], contrato_ids: ['k1'] }, r)).toEqual({ demanda_ids: [], pessoas: [], contrato_ids: [] });
  });

  it('dada uma tarefa de outra demanda e de outro contrato (#283), quando entra em mais uma, então fica nas duas e nos dois contratos; o Desfazer tira só o que entrou', () => {
    // Dado
    const t = { demanda_ids: ['d0'], pessoas: ['x'], contrato_ids: ['k0'] };
    // Quando
    const r = tarefaEmMaisUmaDemanda(t, { id: 'd1', clientes: ['c1'], contrato_id: 'k1' }, MAXIMOS);
    // Então
    expect(r).toMatchObject({ dados: { demanda_ids: ['d0', 'd1'], contrato_ids: ['k0', 'k1'] }, pessoas: [] });
    if ('recusa' in r) throw new Error('não devia recusar');
    expect(desfazerTarefaEmMaisUmaDemanda({ demanda_ids: ['d0', 'd1'], pessoas: ['x'], contrato_ids: ['k0', 'k1'] }, r)).toEqual({ demanda_ids: ['d0'], contrato_ids: ['k0'] });
  });

  it('dada uma tarefa que já tem o contrato da demanda, quando entra nela, então só a demanda muda, e o Desfazer só a tira', () => {
    // Dado / Quando
    const r = tarefaEmMaisUmaDemanda({ demanda_ids: [], pessoas: ['x'], contrato_ids: ['k1'] }, { id: 'd1', clientes: ['c1'], contrato_id: 'k1' }, MAXIMOS);
    // Então
    expect(r).toEqual({ dados: { demanda_ids: ['d1'] }, demandaId: 'd1', contratoId: null, pessoas: [] });
    if ('recusa' in r) throw new Error('não devia recusar');
    expect(desfazerTarefaEmMaisUmaDemanda({ demanda_ids: ['d1'], pessoas: ['x'], contrato_ids: ['k1'] }, r)).toEqual({ demanda_ids: [] });
  });

  it('dada uma tarefa que já está na demanda ou que já tem o máximo de demandas, quando liga, então é recusado', () => {
    // Dado / Quando / Então
    expect(tarefaEmMaisUmaDemanda({ demanda_ids: ['d1'], pessoas: [], contrato_ids: [] }, { id: 'd1', clientes: [], contrato_id: null }, MAXIMOS)).toEqual({ recusa: 'ja' });
    expect(tarefaEmMaisUmaDemanda({ demanda_ids: ['d1', 'd2'], pessoas: [], contrato_ids: [] }, { id: 'd3', clientes: [], contrato_id: null }, MAXIMOS)).toEqual({ recusa: 'cheia' });
  });

  it('dada uma tarefa que levou os clientes e o contrato da demanda, quando outra pessoa pôs alguém e tirou o contrato depois, então o Desfazer não mexe nisso', () => {
    // Dado
    const r = tarefaEmMaisUmaDemanda({ demanda_ids: [], pessoas: [], contrato_ids: [] }, { id: 'd1', clientes: ['c1', 'c2'], contrato_id: 'k1' }, MAXIMOS);
    if ('recusa' in r) throw new Error('não devia recusar');
    // Quando
    const volta = desfazerTarefaEmMaisUmaDemanda({ demanda_ids: ['d1'], pessoas: ['c1', 'c2', 'de outro'], contrato_ids: ['k2'] }, r);
    // Então
    expect(volta).toEqual({ demanda_ids: [], pessoas: ['de outro'] });
  });

  it('dada uma tarefa que outra pessoa já tirou da demanda, quando desfaz, então nada volta', () => {
    // Dado
    const r = tarefaEmMaisUmaDemanda({ demanda_ids: [], pessoas: [], contrato_ids: [] }, { id: 'd1', clientes: ['c1'], contrato_id: 'k1' }, MAXIMOS);
    if ('recusa' in r) throw new Error('não devia recusar');
    // Quando / Então
    expect(desfazerTarefaEmMaisUmaDemanda({ demanda_ids: ['d2'], pessoas: ['c1'], contrato_ids: ['k1'] }, r)).toBeNull();
  });

  it.each([
    [[null, 'k1'], ''],
    [[], ''],
    [['k1', 'k2'], TAREFA_DE_OUTRO_CONTRATO]
  ] as const)('dadas tarefas da demanda com os contratos %j, quando liga a demanda a k1, então o motivo de não ligar é "%s"', (contratos, motivo) => {
    // Dado / Quando / Então
    expect(motivoDasTarefasDaDemanda(contratos, 'k1')).toBe(motivo);
  });

  it.each([
    [null, 'k1', ''],
    ['k1', null, ''],
    ['k1', 'k1', ''],
    ['k1', 'k2', CONTRATOS_DIFERENTES]
  ])('dados o contrato %s e o contrato %s, então o motivo de não ligar é "%s"', (um, outro, motivo) => {
    // Dado / Quando / Então
    expect(motivoDeContratoDiferente(um, outro)).toBe(motivo);
  });

  it('dado outro texto de recusa, quando os contratos são diferentes, então o motivo é esse texto', () => {
    // Dado / Quando / Então
    expect(motivoDeContratoDiferente('k1', 'k2', DEMANDA_DE_OUTRO_CONTRATO)).toBe(DEMANDA_DE_OUTRO_CONTRATO);
  });
});

describe('O prazo do processo e a tarefa que o cumpre', () => {
  it('dada uma tarefa sem processo e com outra data, quando liga ao prazo, então ganha o processo e o último dia do prazo', () => {
    // Dado / Quando / Então
    expect(tarefaNoPrazo({ processo_id: null, prazo: '2026-12-20' }, 'p1', '2026-12-01')).toEqual({ dados: { processo_id: 'p1', prazo: '2026-12-01' } });
  });

  it('dada uma tarefa deste processo com o mesmo dia, quando liga ao prazo, então nada muda nela', () => {
    // Dado / Quando / Então
    expect(tarefaNoPrazo({ processo_id: 'p1', prazo: '2026-12-01' }, 'p1', '2026-12-01')).toEqual({ dados: {} });
  });

  it('dada uma tarefa de outro processo (ligada a ele depois da busca), quando liga ao prazo, então é recusado', () => {
    // Dado / Quando / Então
    expect(tarefaNoPrazo({ processo_id: 'p2', prazo: null }, 'p1', '2026-12-01')).toEqual({ recusa: TAREFA_DE_OUTRO_PROCESSO });
  });
});

describe('Os textos de pôr uma pessoa num item', () => {
  it.each(['demandas', 'processos', 'tarefas', 'compromissos'] as const)('dado o item de %s, quando a lista enche, então o cartão diz o máximo; antes disso, nada', modulo => {
    // Dado / Quando / Então
    expect(listaDoItemCheia(modulo, cheia.slice(1))).toBeUndefined();
    expect(listaDoItemCheia(modulo, cheia)).toBe(PESSOA_NO_ITEM[modulo].cheio);
    expect(PESSOA_NO_ITEM[modulo].cheio).toContain(String(CLIENTES_MAXIMOS));
  });

  it('dado o nome do item ou da pessoa, então o aviso diz quem foi ligado a quê', () => {
    // Dado / Quando / Então
    expect(PESSOA_NO_ITEM.demandas.noCartaoDaPessoa('Registro de marca')).toBe('Pessoa ligada como cliente da demanda Registro de marca.');
    expect(PESSOA_NO_ITEM.compromissos.noCartaoDoItem('JOSÉ')).toBe('Pessoa ligada: JOSÉ.');
  });
});
