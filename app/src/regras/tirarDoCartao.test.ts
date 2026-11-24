// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import {
  devolverNaLista, podeTirarADemandaDaTarefa, podeTirarAPessoa, podeTirarOContratoDaDemanda, PESSOA_TIRADA, saiPeloCartaoDaPessoa, TIRAR_DA_TAREFA
} from './tirarDoCartao';

describe('Quem pode sair de uma lista de pessoas pelo "x" (#424)', () => {
  it('dado o processo com um cliente só, quando se pergunta, então ele não sai (o processo precisa de um cliente)', () => {
    expect(podeTirarAPessoa('processos', 1)).toBe(false);
    expect(podeTirarAPessoa('processos', 2)).toBe(true);
  });

  it('dada a demanda, a tarefa ou o compromisso com uma pessoa só, quando se pergunta, então ela sai (eles podem ficar sem)', () => {
    expect(podeTirarAPessoa('demandas', 1)).toBe(true);
    expect(podeTirarAPessoa('tarefas', 1)).toBe(true);
    expect(podeTirarAPessoa('compromissos', 1)).toBe(true);
  });

  it('dado cada item, quando a pessoa sai, então o aviso diz de onde', () => {
    expect(PESSOA_TIRADA.processos('Ana')).toBe('Cliente tirado do processo: Ana.');
    expect(PESSOA_TIRADA.tarefas('Ana')).toBe('Pessoa tirada da tarefa: Ana.');
  });
});

describe('A tarefa e as demandas dela (#424)', () => {
  it('dada a tarefa numa demanda só, quando se pergunta, então ela não sai pelo "x" (sem demanda, quem escolhe o grupo é o lápis)', () => {
    expect(podeTirarADemandaDaTarefa(1)).toBe(false);
  });

  it('dada a tarefa em duas demandas, quando se pergunta, então ela sai de uma', () => {
    expect(podeTirarADemandaDaTarefa(2)).toBe(true);
  });

  it('dado cada lista da tarefa, quando se monta o "x", então o texto nomeia o item pelo código', () => {
    expect(TIRAR_DA_TAREFA.demandas.oQue('D-12')).toBe('a demanda D-12');
    expect(TIRAR_DA_TAREFA.contratos.feito('C-3')).toBe('Tarefa tirada do contrato C-3.');
  });
});

describe('O contrato da demanda (#424)', () => {
  it('dada a demanda que nasceu de um objeto do contrato, quando se pergunta, então o contrato não sai pelo "x"', () => {
    expect(podeTirarOContratoDaDemanda({ objeto: 'Registro de marca' })).toBe(false);
  });

  it('dada a demanda ligada ao contrato depois, quando se pergunta, então o contrato sai', () => {
    expect(podeTirarOContratoDaDemanda({ objeto: null })).toBe(true);
  });
});

describe('O Desfazer de tirar da lista (#424)', () => {
  it('dado o item tirado do meio, quando se desfaz, então ele volta ao mesmo lugar', () => {
    expect(devolverNaLista(['a', 'c'], 'b', 1)).toEqual(['a', 'b', 'c']);
  });

  it('dada a lista que encolheu depois, quando se desfaz, então ele volta ao fim', () => {
    expect(devolverNaLista(['a'], 'b', 3)).toEqual(['a', 'b']);
  });

  it('dado o item que outra pessoa já pôs de volta, quando se desfaz, então nada muda', () => {
    expect(devolverNaLista(['a', 'b'], 'b', 0)).toBeNull();
  });

  it('dada a lista que encheu enquanto isso, quando se desfaz, então nada muda', () => {
    expect(devolverNaLista(['a', 'c'], 'b', 1, 2)).toBeNull();
  });
});

describe('A pessoa sai de um item pelo cartão dela (#424)', () => {
  it('dada a pessoa cliente da demanda, quando se pergunta, então ela sai pelo "x"', () => {
    expect(saiPeloCartaoDaPessoa('demandas', ['cliente'])).toBe(true);
  });

  it('dada a pessoa que está na tarefa só pela equipe, quando se pergunta, então não há "x" (ela sai pelo topo da tarefa)', () => {
    expect(saiPeloCartaoDaPessoa('tarefas', ['responsavel'])).toBe(false);
    expect(saiPeloCartaoDaPessoa('tarefas', ['pessoa', 'participante'])).toBe(true);
  });
});
