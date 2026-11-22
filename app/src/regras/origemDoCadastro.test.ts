// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import {
  cadastroComVolta, cartaoDeOrigem, depoisDeCriar, estadoDaVolta, linhasDasPessoas, origemNoEndereco, processoDaTarefa, processoDoContrato, recusaDaOrigem,
  tarefaDoProcesso, voltaDoMenu
} from './origemDoCadastro';

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

// Para onde o cadastro volta depois de gravar, pela marca do "+ Novo …" das seções.

/** O endereço que o "+ Novo …" da seção abre, lido como o cadastro lê. */
const doNovo = (busca: string) => new URLSearchParams(busca + '&volta=cartao');
const sempreLigada = () => true;

describe('O endereço do "+ Novo …" de uma seção', () => {
  it('dado a origem e o id, quando monta o endereço, então ele leva a origem e a marca da volta', () => {
    // Dado / Quando
    const endereco = cadastroComVolta('/processos/novo/', 'demanda', 'd 1');
    // Então
    expect(endereco).toBe('/processos/novo/?demanda=d+1&volta=cartao');
  });

  it('dado o endereço montado, quando o cadastro grava, então volta ao cartão da origem', () => {
    // Dado
    const params = new URLSearchParams(cadastroComVolta('/contratos/novo/', 'cliente', 'p1').split('?')[1]);
    // Quando / Então
    expect(cartaoDeOrigem(params, { cliente: sempreLigada })).toBe('/pessoas/?id=p1');
  });
});

describe('O cartão de onde o cadastro foi aberto', () => {
  it('dado o cadastro aberto pelo cartão da pessoa (?cliente=), quando grava com ela entre os clientes, então volta ao cartão dela', () => {
    // Dado
    const params = doNovo('cliente=p1');
    // Quando / Então
    expect(cartaoDeOrigem(params, { cliente: id => ['p1', 'p2'].includes(id) })).toBe('/pessoas/?id=p1');
  });

  it('dado o cadastro aberto pelo cartão da demanda (?demanda=), quando grava e liga, então volta ao cartão dela', () => {
    // Dado
    const params = doNovo('demanda=d1');
    // Quando / Então
    expect(cartaoDeOrigem(params, { demanda: sempreLigada, cliente: sempreLigada })).toBe('/demandas/?id=d1');
  });

  it('dado o endereço com duas origens, quando grava, então vale a primeira da ordem pedida', () => {
    // Dado
    const params = doNovo('cliente=p1&demanda=d1');
    // Quando / Então
    expect(cartaoDeOrigem(params, { demanda: sempreLigada, cliente: sempreLigada })).toBe('/demandas/?id=d1');
    expect(cartaoDeOrigem(params, { cliente: sempreLigada, demanda: sempreLigada })).toBe('/pessoas/?id=p1');
  });

  it('dado o cadastro aberto sem origem (ou com uma que este cadastro não aceita), quando grava, então não há cartão de origem', () => {
    // Dado / Quando / Então
    expect(cartaoDeOrigem(doNovo(''), { cliente: sempreLigada })).toBeNull();
    expect(cartaoDeOrigem(doNovo('demanda=d1'), { cliente: sempreLigada })).toBeNull();
    expect(cartaoDeOrigem(doNovo('cliente='), { cliente: sempreLigada })).toBeNull();
  });

  it('dado o cadastro aberto sem a marca da volta (o "Criar o processo?" da demanda concluída), quando grava, então segue para o item novo', () => {
    // Dado
    const params = new URLSearchParams('demanda=d1');
    // Quando / Então
    expect(cartaoDeOrigem(params, { demanda: sempreLigada })).toBeNull();
    expect(cartaoDeOrigem(new URLSearchParams('demanda=d1&volta=outra'), { demanda: sempreLigada })).toBeNull();
  });

  it('dado que a pessoa trocou o cliente que veio pronto, quando grava, então não volta ao cartão dela, onde o item não aparece', () => {
    // Dado
    const params = doNovo('cliente=p1');
    const gravados = ['p9'];
    // Quando / Então
    expect(cartaoDeOrigem(params, { cliente: id => gravados.includes(id) })).toBeNull();
  });

  it('dado uma demanda que não existe ou uma ligação que falhou, quando grava, então não volta à demanda', () => {
    // Dado
    const params = doNovo('demanda=nao-existe');
    // Quando / Então
    expect(cartaoDeOrigem(params, { demanda: () => false, cliente: sempreLigada })).toBeNull();
  });

  it('dado a primeira origem que não ficou ligada e a segunda que ficou, quando grava, então volta à segunda', () => {
    // Dado
    const params = doNovo('demanda=d1&cliente=p1');
    // Quando / Então
    expect(cartaoDeOrigem(params, { demanda: () => false, cliente: sempreLigada })).toBe('/pessoas/?id=p1');
  });
});

describe('A volta pelo "+" do menu lateral (#404)', () => {
  const CADASTRO = '/agenda/novo/';

  it('dado o "+" clicado na tela de Tarefas, quando o cadastro grava, então volta para Tarefas, com a busca e o cartão abertos', () => {
    // Dado
    const estado = estadoDaVolta('/tarefas/?id=t1#comentarios');
    // Quando / Então
    expect(voltaDoMenu(estado, CADASTRO)).toBe('/tarefas/?id=t1#comentarios');
  });

  it('dado o cadastro aberto sem o "+" do menu (pelo endereço ou por outro botão), quando grava, então não há volta', () => {
    // Então
    expect(voltaDoMenu(null, CADASTRO)).toBeNull();
    expect(voltaDoMenu(undefined, CADASTRO)).toBeNull();
    expect(voltaDoMenu({ outro: 'x' }, CADASTRO)).toBeNull();
    expect(voltaDoMenu({ volta: 3 }, CADASTRO)).toBeNull();
  });

  it('dado um endereço de fora do sistema no estado, quando grava, então não há volta', () => {
    // Então
    expect(voltaDoMenu({ volta: '//outro-site.com/' }, CADASTRO)).toBeNull();
    expect(voltaDoMenu({ volta: 'https://outro-site.com/' }, CADASTRO)).toBeNull();
    expect(voltaDoMenu({ volta: 'inicio/' }, CADASTRO)).toBeNull();
  });

  it('dado o "+" clicado já dentro do mesmo cadastro, quando grava, então não volta ao formulário', () => {
    // Então
    expect(voltaDoMenu(estadoDaVolta('/agenda/novo/?pessoa=p1'), CADASTRO)).toBeNull();
    expect(voltaDoMenu(estadoDaVolta('/agenda/novo'), CADASTRO)).toBeNull();
  });

  it('dado o "+" clicado na própria Agenda, quando grava, então volta para a Agenda', () => {
    // Então
    expect(voltaDoMenu(estadoDaVolta('/agenda/'), CADASTRO)).toBe('/agenda/');
  });
});
