// Aviso na caixa de Mensagens para quem entra num item (#377). Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import type { InclusaoDaMensagem, ItemDaInclusao, ModuloDoPedido } from '../dados/tipos';
import { AVISO_DA_MUDANCA, avisoDaMudanca, enderecoDaInclusao, INCLUSAO_DO_MODULO, mudancasDaEquipe, nomeDoItemDaInclusao, rotulosDaInclusao, type MudancaDePapel, type SequenciaDeMudancas } from './inclusao';
import { AVISO_DESFEITO, MINUTO, SEGUNDO } from '../ui/tempos';

const item = (extra: Partial<ItemDaInclusao> = {}): ItemDaInclusao => ({ id: 'i1', codigo: 'F00D1234', nome: 'Pedir documentos', tipo_do_processo: null, ...extra });
const inclusao = (extra: Partial<InclusaoDaMensagem> = {}): InclusaoDaMensagem =>
  ({ modulo: 'demandas', entrou_como: 'participante', incluido_por: 'u-ana', item: item(), ...extra });

describe('Aviso ao ser incluído: as palavras (#377)', () => {
  it.each([
    ['tarefas', 'incluiu você na tarefa', 'pôs você como responsável pela tarefa', 'Agora você é participante da tarefa.', 'Você não faz mais parte desta tarefa.'],
    ['demandas', 'incluiu você na demanda', 'pôs você como responsável pela demanda', 'Agora você é colaborador da demanda.', 'Você não faz mais parte desta demanda.'],
    ['processos', 'incluiu você no processo', 'pôs você como responsável pelo processo', 'Agora você é colaborador do processo.', 'Você não faz mais parte deste processo.'],
    ['compromissos', 'incluiu você no compromisso', 'pôs você como responsável pelo compromisso', 'Agora você é participante do compromisso.', 'Você não faz mais parte deste compromisso.'],
    ['contratos', 'incluiu você no contrato', 'pôs você como responsável pelo contrato', 'Agora você é participante do contrato.', 'Você não faz mais parte deste contrato.'],
    ['anotacoes', 'compartilhou com você a anotação', 'pôs você como responsável pela anotação', 'Agora a anotação está compartilhada com você.', 'Esta anotação não está mais compartilhada com você.']
  ] as const)('dado um aviso em %s, quando a caixa o mostra, então diz o que quem incluiu fez e o que mudou', (modulo, participante, responsavel, agora, naoFazMais) => {
    // Quando
    const m = INCLUSAO_DO_MODULO[modulo as ModuloDoPedido];
    // Então
    expect(m.acao).toEqual({ participante, responsavel });
    expect(m.agora).toEqual({ participante: agora, responsavel: 'Agora você é o responsável.' });
    expect(m.naoFazMais).toBe(naoFazMais);
  });

  it('dado um item sem título, quando a caixa o mostra, então usa o código', () => {
    // Quando / Então
    expect(nomeDoItemDaInclusao(item({ nome: null }))).toBe('F00D1234');
    expect(nomeDoItemDaInclusao(item({ nome: '' }))).toBe('F00D1234');
    expect(nomeDoItemDaInclusao(item())).toBe('Pedir documentos');
  });

  it.each([
    ['tarefas', null, '/tarefas/?id=i1'],
    ['demandas', null, '/demandas/?id=i1'],
    ['processos', 'judicial', '/processos/judicial/?id=i1'],
    ['processos', 'administrativo', '/processos/administrativo/?id=i1'],
    ['compromissos', null, '/agenda/?id=i1'],
    ['contratos', null, '/contratos/?id=i1'],
    ['anotacoes', null, '/documentos/?id=i1']
  ] as const)('dado um aviso em %s (%s), quando a pessoa clica nele, então vai ao cartão do item', (modulo, tipo, esperado) => {
    // Quando / Então
    expect(enderecoDaInclusao(modulo, item({ tipo_do_processo: tipo }))).toBe(esperado);
  });

  it('dado o aviso com o item, quando monta os rótulos, então eles têm quem incluiu e o item, e o botão começa pelo texto visível', () => {
    // Quando
    const r = rotulosDaInclusao(inclusao(), 'Ana Teste Lima', 'não lido');
    // Então
    expect(r).toEqual({ linha: 'Aviso não lido: Ana Teste Lima incluiu você na demanda Pedir documentos',
      marcarLida: 'Marcar como lida a mensagem de Ana Teste Lima sobre a demanda Pedir documentos' });
    expect(rotulosDaInclusao(inclusao({ entrou_como: 'responsavel', modulo: 'processos' }), 'Ana Teste Lima', 'lido').linha)
      .toBe('Aviso lido: Ana Teste Lima pôs você como responsável pelo processo Pedir documentos');
  });

  it('dado o aviso de um item de que a pessoa não faz mais parte, quando monta os rótulos, então eles não têm nada do item nem quem incluiu', () => {
    // Quando
    const r = rotulosDaInclusao(inclusao({ item: null }), 'Ana Teste Lima', 'não lido');
    // Então
    expect(r).toEqual({ linha: 'Aviso não lido: Você não faz mais parte desta demanda',
      marcarLida: 'Marcar como lida a mensagem de uma demanda de que você não faz mais parte' });
    expect(JSON.stringify(r)).not.toContain('Ana');
  });
});

describe('Aviso ao ser incluído: o papel de cada pessoa (#377)', () => {
  it('dado um item novo, quando é criado com responsável e participantes, então cada um entra no seu papel, inclusive quem criou', () => {
    // Quando
    const mudancas = mudancasDaEquipe(null, { responsavel_id: 'u-bruno', equipe: ['u-ana', 'u-carla'] });
    // Então
    expect(mudancas).toEqual([
      { perfil: 'u-bruno', antes: 'nenhum', agora: 'responsavel' }, { perfil: 'u-ana', antes: 'nenhum', agora: 'participante' },
      { perfil: 'u-carla', antes: 'nenhum', agora: 'participante' }
    ]);
  });

  it('dado alguém no responsável e na lista ao mesmo tempo, quando salva, então aparece uma vez só, como responsável', () => {
    // Quando / Então
    expect(mudancasDaEquipe({ responsavel_id: 'u-ana', equipe: [] }, { responsavel_id: 'u-bruno', equipe: ['u-bruno', 'u-bruno'] }))
      .toEqual([{ perfil: 'u-ana', antes: 'responsavel', agora: 'nenhum' }, { perfil: 'u-bruno', antes: 'nenhum', agora: 'responsavel' }]);
  });

  it('dado o participante que passa a responsável e o responsável que passa a participante, então os dois trocam de papel', () => {
    // Quando / Então
    expect(mudancasDaEquipe({ responsavel_id: 'u-ana', equipe: ['u-bruno'] }, { responsavel_id: 'u-bruno', equipe: ['u-ana'] }))
      .toEqual([{ perfil: 'u-ana', antes: 'responsavel', agora: 'participante' }, { perfil: 'u-bruno', antes: 'participante', agora: 'responsavel' }]);
  });

  it('dada uma mudança que não mexe na equipe, então ninguém muda de papel; e quem é retirado sai', () => {
    // Quando / Então
    expect(mudancasDaEquipe({ responsavel_id: 'u-ana', equipe: ['u-bruno'] }, { responsavel_id: 'u-ana', equipe: ['u-bruno'] })).toEqual([]);
    expect(mudancasDaEquipe({ responsavel_id: 'u-ana', equipe: ['u-bruno'] }, { responsavel_id: 'u-ana', equipe: [] }))
      .toEqual([{ perfil: 'u-bruno', antes: 'participante', agora: 'nenhum' }]);
  });

  it('dada cada mudança de papel, então só passar a responsável e entrar na equipe vindo de fora avisam', () => {
    // Então
    expect(AVISO_DA_MUDANCA).toEqual({
      nenhum: { nenhum: null, participante: 'participante', responsavel: 'responsavel' },
      participante: { nenhum: null, participante: null, responsavel: 'responsavel' },
      responsavel: { nenhum: null, participante: null, responsavel: null }
    });
  });
});

describe('Aviso ao ser incluído: o desfazer e as mudanças seguidas (#377)', () => {
  const INICIO = 1_000_000;
  /** Uma pessoa passa pelos papéis, cada mudança `intervalo` depois da anterior; devolve o aviso que vale depois de cada uma. */
  function sequencia(papeis: MudancaDePapel['antes'][], intervalo = 5 * SEGUNDO) {
    let anterior: SequenciaDeMudancas | undefined;
    return papeis.slice(1).map((agora, i) => {
      const r = avisoDaMudanca({ perfil: 'u-bruno', antes: papeis[i], agora }, anterior, INICIO + i * intervalo);
      anterior = r.sequencia;
      return r.aviso;
    });
  }

  it('dado Bruno na demanda, quando Ana o tira e desfaz logo, então ele não recebe "incluiu você"', () => {
    // Quando / Então
    expect(sequencia(['participante', 'nenhum', 'participante'])).toEqual([null, null]);
  });

  it('dado Bruno incluído, quando Ana desfaz e refaz logo, então o aviso some e volta', () => {
    // Quando / Então
    expect(sequencia(['nenhum', 'participante', 'nenhum', 'participante'])).toEqual(['participante', null, 'participante']);
  });

  it('dado o participante posto como responsável, quando Ana desfaz logo, então não vale aviso nenhum (ele continua só participante)', () => {
    // Quando / Então
    expect(sequencia(['participante', 'responsavel', 'participante'])).toEqual(['responsavel', null]);
  });

  it('dado o responsável trocado por outro, quando Ana desfaz logo, então quem volta a ser o responsável não recebe aviso', () => {
    // Quando / Então
    expect(sequencia(['responsavel', 'nenhum', 'responsavel'])).toEqual([null, null]);
    expect(sequencia(['responsavel', 'participante', 'responsavel'])).toEqual([null, null]);
  });

  it('dado Bruno posto como responsável, quando logo passa a participante, então vale o aviso de participante', () => {
    // Quando / Então
    expect(sequencia(['nenhum', 'responsavel', 'participante'])).toEqual(['responsavel', 'participante']);
  });

  it('dadas mudanças seguidas a menos do tempo do desfazer uma da outra, então continuam a mesma sequência, mesmo passando dele no total', () => {
    // Dado
    const passo = AVISO_DESFEITO - SEGUNDO;
    const primeira = avisoDaMudanca({ perfil: 'u-bruno', antes: 'participante', agora: 'nenhum' }, undefined, INICIO);
    const segunda = avisoDaMudanca({ perfil: 'u-bruno', antes: 'nenhum', agora: 'responsavel' }, primeira.sequencia, INICIO + passo);
    // Quando
    const terceira = avisoDaMudanca({ perfil: 'u-bruno', antes: 'responsavel', agora: 'participante' }, segunda.sequencia, INICIO + 2 * passo);
    // Então
    expect(terceira).toEqual({ sequencia: { papel_de_antes: 'participante', desde: INICIO, em: INICIO + 2 * passo }, aviso: null });
  });

  it('dado Bruno tirado da demanda, quando entra de novo passado o tempo do desfazer, então começa outra sequência e ele recebe o aviso', () => {
    // Quando / Então
    expect(sequencia(['participante', 'nenhum', 'participante'], 2 * MINUTO)).toEqual([null, 'participante']);
    const r = avisoDaMudanca({ perfil: 'u-bruno', antes: 'nenhum', agora: 'participante' }, { papel_de_antes: 'participante', desde: INICIO, em: INICIO }, INICIO + AVISO_DESFEITO);
    expect(r.sequencia).toEqual({ papel_de_antes: 'nenhum', desde: INICIO + AVISO_DESFEITO, em: INICIO + AVISO_DESFEITO });
  });
});
