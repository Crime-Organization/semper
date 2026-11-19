// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import { depoisDeCriar, linhasDasPessoas, origemNoEndereco, processoDaTarefa, processoDoContrato, recusaDaOrigem, tarefaDoProcesso } from './origemDoCadastro';

const pessoa = (id: string) => ({ id, codigo: id, nome: id, arquivado_em: null }) as never;
const ORIGENS = ['demanda', 'contrato', 'tarefa'] as const;

describe('A origem do cadastro no endereço', () => {
  it('quando o endereço tem um dos parâmetros, então a origem é ele, com o id', () => {
    // Quando
    const o = origemNoEndereco(new URLSearchParams('contrato=k1&etapa=e1'), ORIGENS);
    // Então
    expect(o).toEqual({ tipo: 'contrato', id: 'k1' });
  });

  it('quando o endereço não tem nenhum, ou o parâmetro veio vazio, então não há origem', () => {
    // Então
    expect(origemNoEndereco(new URLSearchParams('cliente=p1'), ORIGENS)).toBeNull();
    expect(origemNoEndereco(new URLSearchParams('tarefa='), ORIGENS)).toBeNull();
  });

  it('quando o endereço tem dois, então vale o primeiro da lista', () => {
    // Então
    expect(origemNoEndereco(new URLSearchParams('tarefa=t1&demanda=d1'), ORIGENS)).toEqual({ tipo: 'demanda', id: 'd1' });
  });
});

describe('O que a origem traz para o cadastro', () => {
  it('quando a origem não tem pessoas, então fica a linha vazia, para escolher', () => {
    // Então
    expect(linhasDasPessoas([])).toEqual(['']);
  });

  it('dado um contrato com responsável ativo, quando nasce o processo, então ele traz os clientes e o responsável', () => {
    // Quando
    const c = processoDoContrato({ responsavel_id: 'u1', clientes: [pessoa('c1'), pessoa('c2')] }, ['u1', 'eu'], 'eu');
    // Então
    expect(c).toEqual({ responsavelId: 'u1', clientes: ['c1', 'c2'] });
  });

  it('dado um contrato cujo responsável saiu da equipe, quando nasce o processo, então o responsável é quem cadastra', () => {
    // Então
    expect(processoDoContrato({ responsavel_id: 'saiu', clientes: [] }, ['eu'], 'eu')).toEqual({ responsavelId: 'eu', clientes: [''] });
  });

  it('dada uma tarefa com pessoas, quando nasce o processo, então elas são os clientes', () => {
    // Então
    expect(processoDaTarefa({ pessoas: [pessoa('c1')] })).toEqual({ clientes: ['c1'] });
  });

  it('dado um processo com clientes, quando nasce a tarefa, então ela vem ligada a ele, com os clientes como pessoas', () => {
    // Então
    expect(tarefaDoProcesso({ id: 'p1', clientes: [pessoa('c1'), pessoa('c2')] }, false)).toEqual({ processoId: 'p1', pessoas: ['c1', 'c2'] });
  });

  it('dado um endereço que também traz pessoas por outro parâmetro, quando nasce a tarefa do processo, então ela vem ligada a ele, sem trocar as pessoas', () => {
    // Então
    expect(tarefaDoProcesso({ id: 'p1', clientes: [pessoa('c1')] }, true)).toEqual({ processoId: 'p1' });
  });
});

describe('Para onde a tela vai depois de criar', () => {
  it.each([
    ['veio de um cartão e ficou ligado a ele', '/contratos/?id=k1', true, '/contratos/?id=k1'],
    ['veio de um cartão, mas a ligação foi tirada no cadastro', '/contratos/?id=k1', false, '/tarefas/?id=t9'],
    ['não veio de nenhum cartão', null, true, '/tarefas/?id=t9']
  ])('quando %s, então vai ao cartão certo', (_caso, origem, ligado, destino) => {
    // Então
    expect(depoisDeCriar(origem, ligado, '/tarefas/?id=t9')).toBe(destino);
  });
});

describe('A origem que não aceita mais o item novo ligado', () => {
  it('dada uma origem ativa e sem o seu único ligado, quando se abre o cadastro, então ela aceita', () => {
    // Então
    expect(recusaDaOrigem({ arquivada: false, ocupada: false })).toBeNull();
    expect(recusaDaOrigem({})).toBeNull();
  });

  it.each([
    ['arquivada', { arquivada: true, ocupada: false }, 'arquivada'],
    ['que já tem o seu único ligado (a tarefa com processo)', { arquivada: false, ocupada: true }, 'ocupada'],
    ['arquivada e com o seu único ligado', { arquivada: true, ocupada: true }, 'arquivada']
  ] as const)('dada uma origem %s, quando se abre o cadastro, então ela recusa, com o motivo', (_caso, estado, recusa) => {
    // Então
    expect(recusaDaOrigem(estado)).toBe(recusa);
  });
});
