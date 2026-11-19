// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import { CLIENTES_MAXIMOS, ITENS_DA_ANOTACAO } from '../dados/limites';
import { RecusaDaLigacao } from './ligarExistente';
import {
  aoSalvarPelaOrigem, avisoDaLigacaoQueFalhou, clientesDaOrigem, CONTRATO_FORA_DA_TAREFA, motivoDasTarefasParaOContratoNovo, motivoDoContratoDaTarefa,
  origemDaAnotacao, origemDaDemanda, origemDaTarefa, origemDoProcesso, origemRecusada, processoDeOrigemLigado, TAREFA_DA_DEMANDA_EM_CONTRATO,
  textoDaOrigem
} from './nascerLigado';
describe('Os clientes que o item novo herda da origem', () => {
  it('dadas as pessoas da origem, quando o cadastro abre, então elas vêm na mesma ordem, sem repetir', () => {
    // Dado
    const pessoas = [{ id: 'p1', nome: 'Ana' }, { id: 'p2', nome: 'Bia' }, { id: 'p1', nome: 'Ana' }];
    // Quando
    const clientes = clientesDaOrigem(pessoas);
    // Então
    expect(clientes.map(p => p.id)).toEqual(['p1', 'p2']);
  });

  it('dada uma origem com mais pessoas do que o cadastro aceita, quando ele abre, então vêm só as primeiras, até o máximo', () => {
    // Dado
    const pessoas = Array.from({ length: CLIENTES_MAXIMOS + 2 }, (_, i) => ({ id: 'p' + i }));
    // Quando
    const clientes = clientesDaOrigem(pessoas);
    // Então
    expect(clientes).toHaveLength(CLIENTES_MAXIMOS);
    expect(clientes[0].id).toBe('p0');
  });

  it('dada uma origem sem pessoas, quando o cadastro abre, então não vem nenhum cliente', () => {
    // Dado / Quando / Então
    expect(clientesDaOrigem([])).toEqual([]);
  });
});

describe('O contrato da demanda que nasce de uma tarefa', () => {
  it.each([
    ['a tarefa não tem contrato', null, 'k2'],
    ['a demanda fica com o contrato da tarefa', 'k1', 'k1'],
    ['a demanda fica sem contrato', 'k1', '']
  ])('dado que %s, quando se confere, então a tarefa pode ficar na demanda', (_caso, daTarefa, escolhido) => {
    // Dado / Quando / Então
    expect(motivoDoContratoDaTarefa(daTarefa, escolhido)).toBe('');
  });

  it('dada uma tarefa com contrato, quando a demanda escolhe outro, então avisa que a tarefa não fica nela', () => {
    // Dado / Quando / Então
    expect(motivoDoContratoDaTarefa('k1', 'k2')).toBe(CONTRATO_FORA_DA_TAREFA);
  });
});


describe('O contrato que nasce de uma demanda', () => {
  it('dada uma demanda cujas tarefas não têm contrato, quando se confere, então ela pode ficar no contrato novo', () => {
    // Dado / Quando / Então
    expect(motivoDasTarefasParaOContratoNovo([null, null])).toBe('');
    expect(motivoDasTarefasParaOContratoNovo([])).toBe('');
  });

  it('dada uma demanda com uma tarefa já num contrato, quando se confere, então avisa que ela não fica no contrato novo', () => {
    // Dado / Quando / Então
    expect(motivoDasTarefasParaOContratoNovo([null, 'k1'])).toBe(TAREFA_DA_DEMANDA_EM_CONTRATO);
  });
});

describe('A origem do item novo', () => {
  const tarefa = { id: 't1', codigo: 'T1', titulo: 'Renovar a procuração', arquivado_em: null };
  const processo = { id: 'pr1', codigo: 'PR1', tipo: 'administrativo' as const, numero: '123', titulo: null, cliente_nome: 'JOSÉ DA SILVA TESTE', arquivado_em: null };

  it('dada uma tarefa ativa, quando ela é a origem, então o aviso diz que a demanda nasce dela e a volta é ao cartão dela', () => {
    // Dado / Quando
    const o = origemDaTarefa(tarefa);
    // Então
    expect(textoDaOrigem(o)).toEqual(['Esta demanda nasce da tarefa', ', que fica ligada a ela.']);
    expect(o).toMatchObject({ codigo: 'T1', nome: 'Renovar a procuração', cartao: '/tarefas/?id=t1', arquivada: false });
  });

  it('dado um processo sem nome, quando ele é a origem do contrato, então o nome é o dos clientes e a volta é ao cartão do tipo dele', () => {
    // Dado / Quando
    const o = origemDoProcesso(processo, 'contrato');
    // Então
    expect(textoDaOrigem(o)).toEqual(['Este contrato nasce do processo', ' e fica ligado a ele.']);
    expect(o).toMatchObject({ nome: 'JOSÉ DA SILVA TESTE', cartao: '/processos/administrativo/?id=pr1' });
  });

  it.each([
    ['a tarefa', () => origemDaTarefa({ ...tarefa, arquivado_em: '2026-11-01' }), 'A tarefa'],
    ['a demanda', () => origemDaDemanda({ id: 'd1', codigo: 'D1', titulo: 'Notificar', arquivado_em: '2026-11-01' }), 'A demanda'],
    ['o processo', () => origemDoProcesso({ ...processo, arquivado_em: '2026-11-01' }, 'demanda'), 'O processo']
  ])('dado que %s de origem está arquivada, quando o cadastro abre, então o aviso diz que ela não vale', (_caso, origem, antes) => {
    // Dado / Quando
    const o = origem();
    // Então
    expect(o.arquivada).toBe(true);
    expect(textoDaOrigem(o)[0]).toBe(antes);
    expect(textoDaOrigem(o)[1]).toMatch(/arquivad[ao]: .* não leva nada/);
  });
});

describe('Ao salvar o item nascido de uma origem', () => {
  const doCriado = '/demandas/?id=d-nova';

  it('dada uma origem ativa e nada que impeça, quando salva, então liga e volta ao cartão de origem', () => {
    // Dado / Quando / Então
    expect(aoSalvarPelaOrigem(origemDaTarefa({ id: 't1', codigo: 'T1', titulo: 'Renovar', arquivado_em: null }), '', doCriado))
      .toEqual({ liga: true, volta: '/tarefas/?id=t1' });
  });

  it('dada uma origem cuja ligação já foi avisada como impedida, quando salva, então não liga e abre o cartão do item novo', () => {
    // Dado / Quando / Então
    expect(aoSalvarPelaOrigem(origemDaTarefa({ id: 't1', codigo: 'T1', titulo: 'Renovar', arquivado_em: null }), CONTRATO_FORA_DA_TAREFA, doCriado))
      .toEqual({ liga: false, volta: doCriado });
  });

  it('dada uma origem arquivada, quando salva, então não liga e abre o cartão do item novo', () => {
    // Dado / Quando / Então
    expect(aoSalvarPelaOrigem(origemDaTarefa({ id: 't1', codigo: 'T1', titulo: 'Renovar', arquivado_em: '2026-11-01' }), '', doCriado))
      .toEqual({ liga: false, volta: doCriado });
  });

  it('dado um cadastro sem origem, quando salva, então abre o cartão do item novo', () => {
    // Dado / Quando / Então
    expect(aoSalvarPelaOrigem(null, '', doCriado)).toEqual({ liga: false, volta: doCriado });
  });
});

describe('O processo de origem depois de gravar o item novo', () => {
  const processos = [{ id: 'p1' }, { id: 'p-origem' }];
  const certo: PromiseSettledResult<unknown> = { status: 'fulfilled', value: undefined };
  const falhou: PromiseSettledResult<unknown> = { status: 'rejected', reason: new Error('sem acesso') };

  it('dado o processo de origem entre os escolhidos, quando a ligação dele dá certo, então ele ficou ligado', () => {
    // Dado / Quando / Então
    expect(processoDeOrigemLigado('p-origem', processos, [falhou, certo])).toBe(true);
  });

  it('dado o processo de origem entre os escolhidos, quando a ligação dele falha, então ele não ficou ligado', () => {
    // Dado / Quando / Então
    expect(processoDeOrigemLigado('p-origem', processos, [certo, falhou])).toBe(false);
  });

  it('dado que a pessoa tirou o processo de origem no cadastro, quando os outros ficam ligados, então ele não ficou', () => {
    // Dado / Quando / Então
    expect(processoDeOrigemLigado('p-origem', [{ id: 'p1' }], [certo])).toBe(false);
  });
});

describe('O aviso da ligação que falhou depois de gravar', () => {
  it('dada uma falha do banco ou da rede, quando a ligação falha, então o aviso diz qual ligação faltou, o motivo e que se pode ligar pelo cartão', () => {
    // Dado
    const erro = new Error('Falha na conexão.');
    // Quando
    const aviso = avisoDaLigacaoQueFalhou('demanda no contrato', 'D3A1F09C', erro);
    // Então
    expect(aviso).toBe('Não foi possível ligar a demanda D3A1F09C ao contrato novo: Falha na conexão. Ligue pelo cartão.');
  });

  it('dada a recusa de uma regra, quando a ligação falha, então o aviso diz só o motivo, sem mandar ligar pelo cartão (que recusaria igual)', () => {
    // Dado
    const erro = new RecusaDaLigacao('Esta demanda já está ligada a outro contrato.');
    // Quando
    const aviso = avisoDaLigacaoQueFalhou('demanda no contrato', 'D3A1F09C', erro);
    // Então
    expect(aviso).toBe('Não foi possível ligar a demanda D3A1F09C ao contrato novo: Esta demanda já está ligada a outro contrato.');
  });

  it('dado um erro sem texto, quando a ligação falha, então o aviso fica só com a ligação que faltou', () => {
    // Dado / Quando
    const aviso = avisoDaLigacaoQueFalhou('tarefa na demanda', 'T1', undefined);
    // Então
    expect(aviso).toBe('Não foi possível ligar a tarefa T1 à demanda nova. Ligue pelo cartão.');
  });
});

describe('A anotação como origem do item novo (o "+ Novo…" da seção "Ligada a")', () => {
  const anotacao = (arquivado_em: string | null = null) => ({ id: 'an1', codigo: 'AN-0001', titulo: 'Reunião com o cliente', arquivado_em });

  it('dada uma anotação ativa, com lugar e que a pessoa altera, quando a tarefa nasce dela, então fica ligada e a tela volta à anotação', () => {
    // Dado
    const origem = origemDaAnotacao(anotacao(), 2, 'tarefa', true);
    // Quando
    const salvar = aoSalvarPelaOrigem(origem, '', '/tarefas/?id=t9');
    // Então
    expect(textoDaOrigem(origem)).toEqual(['Esta tarefa nasce da anotação', ' e fica ligada a ela.']);
    expect(origemRecusada(origem)).toBe(false);
    expect(salvar).toEqual({ liga: true, volta: '/documentos/?id=an1' });
  });

  it.each([
    ['arquivada', anotacao('2026-11-01'), 0, true, 'A anotação', ' está arquivada: o contrato novo não fica ligado a ela.'],
    ['só para ler', anotacao(), 0, false, 'Você só pode ler a anotação', ': o contrato novo não fica ligado a ela.'],
    ['cheia', anotacao(), ITENS_DA_ANOTACAO, true, 'A anotação', ` já está ligada a ${ITENS_DA_ANOTACAO} itens, o máximo: o contrato novo não fica ligado a ela.`]
  ])('dada uma anotação %s, quando o contrato nasce dela, então o aviso diz que ele não fica ligado e a tela vai ao contrato novo',
    (_caso, a, itens, ligaNela, antes, depois) => {
      // Dado
      const origem = origemDaAnotacao(a, itens, 'contrato', ligaNela);
      // Quando
      const salvar = aoSalvarPelaOrigem(origem, '', '/contratos/?id=k9');
      // Então
      expect(origemRecusada(origem)).toBe(true);
      expect(textoDaOrigem(origem)).toEqual([antes, depois]);
      expect(salvar).toEqual({ liga: false, volta: '/contratos/?id=k9' });
    });

  it('dada uma anotação arquivada que a pessoa também não altera, quando o aviso é montado, então ele diz que ela está arquivada', () => {
    // Dado / Quando
    const origem = origemDaAnotacao(anotacao('2026-11-01'), 0, 'demanda', false);
    // Então
    expect(textoDaOrigem(origem)[1]).toBe(' está arquivada: a demanda nova não fica ligada a ela.');
  });

  it('dado um compromisso que não conseguiu ser ligado, quando o aviso do pé é montado, então ele diz a anotação e o compromisso novo', () => {
    // Dado / Quando
    const aviso = avisoDaLigacaoQueFalhou('anotação: compromisso', 'AN-0001', undefined);
    // Então
    expect(aviso).toBe('Não foi possível ligar a anotação AN-0001 ao compromisso novo. Ligue pelo cartão.');
  });
});
