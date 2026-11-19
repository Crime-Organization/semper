// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import { cadastroNaAnotacao, modulosDoNovo, PARAMETRO_DA_ANOTACAO_DE_ORIGEM, pessoaUnica } from './novoNaAnotacao';

describe('Os itens do "+ Novo…" da anotação', () => {
  it('dado o escritório com todos os módulos ligados, quando o menu abre, então ele tem um item por módulo, sem o processo', () => {
    // Dado
    const ligaveis = ['pessoas', 'processos', 'contratos', 'demandas', 'tarefas', 'compromissos'] as const;
    // Quando
    const itens = modulosDoNovo(ligaveis);
    // Então
    expect(itens).toEqual(['tarefas', 'demandas', 'compromissos', 'pessoas', 'contratos']);
  });

  it('dado o escritório sem Demandas nem Contratos, quando o menu abre, então eles não aparecem, e as pessoas sim', () => {
    // Dado / Quando
    const itens = modulosDoNovo(['pessoas', 'tarefas', 'compromissos']);
    // Então
    expect(itens).toEqual(['tarefas', 'compromissos', 'pessoas']);
  });
});

describe('A pessoa que já vem no cadastro', () => {
  it('dada uma anotação com uma pessoa só, ativa, quando o cadastro abre, então ela vem', () => {
    // Dado / Quando / Então
    expect(pessoaUnica([{ modulo: 'pessoas', id: 'p1', arquivado_em: null }, { modulo: 'tarefas', id: 't1', arquivado_em: null }])).toBe('p1');
  });

  it.each([
    ['nenhuma pessoa', [{ modulo: 'tarefas' as const, id: 't1', arquivado_em: null }]],
    ['duas pessoas', [{ modulo: 'pessoas' as const, id: 'p1', arquivado_em: null }, { modulo: 'pessoas' as const, id: 'p2', arquivado_em: null }]],
    ['a pessoa única arquivada', [{ modulo: 'pessoas' as const, id: 'p1', arquivado_em: '2026-11-01' }]]
  ])('dada uma anotação com %s, quando o cadastro abre, então nenhuma pessoa vem', (_caso, itens) => {
    // Dado / Quando / Então
    expect(pessoaUnica(itens)).toBeNull();
  });
});

describe('O endereço do cadastro aberto pelo "+ Novo…"', () => {
  const comPessoa = [{ modulo: 'pessoas' as const, id: 'p1', arquivado_em: null }];

  it.each([
    ['tarefas', '/tarefas/nova/', 'pessoa'],
    ['demandas', '/demandas/nova/', 'cliente'],
    ['compromissos', '/agenda/novo/', 'pessoa'],
    ['contratos', '/contratos/novo/', 'cliente']
  ] as const)('dada a anotação com uma pessoa, quando se escolhe %s, então o cadastro leva a anotação e a pessoa', (modulo, cadastro, pessoa) => {
    // Dado / Quando
    const endereco = new URL(cadastroNaAnotacao(modulo, 'an1', comPessoa), 'http://x');
    // Então
    expect(endereco.pathname).toBe(cadastro);
    expect(endereco.searchParams.get(PARAMETRO_DA_ANOTACAO_DE_ORIGEM)).toBe('an1');
    expect(endereco.searchParams.get(pessoa)).toBe('p1');
  });

  it('dada a anotação sem pessoa, quando se escolhe Demanda, então o cadastro leva só a anotação', () => {
    // Dado / Quando
    const endereco = cadastroNaAnotacao('demandas', 'an1', []);
    // Então
    expect(endereco).toBe('/demandas/nova/?anotacao=an1');
  });

  it('dada a anotação, quando se escolhe Pessoa, então abre o cadastro de pessoa com a anotação de origem', () => {
    // Dado / Quando
    const endereco = cadastroNaAnotacao('pessoas', 'an1', comPessoa);
    // Então
    expect(endereco).toBe('/pessoas/nova/?anotacao=an1');
  });
});
