// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import type { AnotacaoLista, CompromissoLista, ParcelaDoEscritorio, PrazoNaAgenda, PrazoNoPainel, ProcessoNoPainel } from '../dados/tipos';
import {
  agendaDoDia, anotacoesRecentes, blocosDoEscritorio, colunasEmAberto, comigo, emAndamentoPeloPrazo, emGrupos, fmtContagem, ITENS_POR_BLOCO, linhaDoEvento, nomeDaColuna, nomeDaParcela, parcelasDaSemana,
  pessoaDoEndereco, prazosDoPainel, prazosDosProcessosCompletos, processosDoPainel, quandoDoPrazo, SEM_COLUNA, situacaoNoPainel, situacoesEmAberto, totalEmAberto,
  vazioDasAnotacoes, verTodosDoBloco
} from './painelInicial';

const HOJE = '2026-11-18';
/** Um escritório com os módulos das tarefas e das demandas ligados. */
const MODULOS = { tarefas: true, demandas: true };

const daAgenda = (id: string, prazo: string, campos: Partial<PrazoNaAgenda> = {}): PrazoNaAgenda =>
  ({ origem: 'tarefas', id, codigo: 'C-' + id, titulo: 'Tarefa ' + id, prazo, responsavel_id: 'u1', hora: null, ...campos });
const processo = (id: string, campos: Partial<ProcessoNoPainel> = {}): ProcessoNoPainel =>
  ({ id, codigo: 'P-' + id, tipo: 'judicial', numero: '000' + id, titulo: null, cliente_nome: 'JOSÉ', responsavel_id: 'u1', colaboradores: [], clientes: [], ...campos });
const doProcesso = (id: string, final: string, p = processo('p1'), tarefa_id: string | null = null): PrazoNoPainel => ({ id, descricao: 'Contestação ' + id, final, tarefa_id, processo: p });
const compromisso = (id: string, campos: Partial<CompromissoLista> = {}): CompromissoLista => ({
  id, codigo: 'K-' + id, tipo: 'reuniao', titulo: 'Reunião ' + id, data: HOJE, hora: null, hora_fim: null, modalidade: null, local: null, geral: false,
  responsavel_id: 'u1', participantes: [], pessoa_nome: '', processo_id: null, processo_codigo: null, processo_numero: null, etapa_id: null, etapa_ordem: null,
  arquivado_em: null, criado_por: 'u1', criado_em: '2026-11-01T12:00:00Z', atualizado_em: '2026-11-01T12:00:00Z', ...campos
});

describe('Painel da página inicial', () => {
  describe('Dados os módulos do escritório', () => {
    it('quando o escritório não tem o Financeiro ligado, então o bloco das parcelas não aparece, e os de prazos e Pessoas sim', () => {
      // Quando
      const blocos = blocosDoEscritorio({ tarefas: true, demandas: true, financeiro: false });
      // Então
      expect(blocos).toEqual(['prazos', 'tarefas', 'demandas', 'pessoas']);
    });

    it('quando todos os módulos estão ligados, então os prazos e a agenda vêm primeiro (é a ordem no celular)', () => {
      // Quando
      const blocos = blocosDoEscritorio({ compromissos: true, tarefas: true, demandas: true, processos: true, anotacoes: true, financeiro: true });
      // Então
      expect(blocos).toEqual(['prazos', 'agenda', 'tarefas', 'demandas', 'processos', 'anotacoes', 'parcelas', 'pessoas']);
    });

    it('quando o escritório não tem a Agenda ligada, então o bloco dos prazos fica sem o "Ver na agenda", que levaria a uma página fora do menu', () => {
      // Quando
      const semAgenda = verTodosDoBloco('prazos', { tarefas: true });
      const comAgenda = verTodosDoBloco('prazos', { compromissos: true });
      // Então
      expect(semAgenda).toBeNull();
      expect(comAgenda).toMatchObject({ rotulo: 'Ver na agenda', para: '/agenda/?pessoa=eu' });
      expect(verTodosDoBloco('pessoas', {})).toMatchObject({ para: '/pessoas/' });
    });
  });

  describe('Dado o endereço da página do módulo', () => {
    it.each([
      ['eu', 'u1'],
      [null, 'u9'],
      ['outro', 'u9']
    ])('quando o endereço traz pessoa=%s, então o filtro abre em %s', (doEndereco, esperado) => {
      // Quando
      const pessoa = pessoaDoEndereco(doEndereco, 'u1', 'u9');
      // Então
      expect(pessoa).toBe(esperado);
    });

    it('quando o painel monta o "Ver todos", então o endereço pede a pessoa logada', () => {
      // Quando / Então
      expect(comigo('/tarefas/')).toBe('/tarefas/?pessoa=eu');
    });
  });

  describe('Dados prazos de tarefas, demandas e processos', () => {
    it.each([
      ['2026-11-17', 'vencidos'],
      ['2026-11-18', 'hoje'],
      ['2026-11-25', 'semana'],
      ['2026-11-26', null]
    ])('quando o prazo é %s, então ele fica no grupo %s', (data, grupo) => {
      // Quando / Então
      expect(situacaoNoPainel(data, HOJE)).toBe(grupo);
    });

    it('quando há prazos de origens e dias diferentes, então ficam juntos na ordem do prazo, sem os que passam da semana', () => {
      // Dado
      const agenda = [daAgenda('t1', '2026-11-20'), daAgenda('d1', '2026-11-18', { origem: 'demandas', hora: '14:00' }), daAgenda('t2', '2026-11-18')];
      const processos = [doProcesso('z1', '2026-11-10'), doProcesso('z2', '2026-12-01')];
      // Quando
      const prazos = prazosDoPainel(agenda, processos, HOJE, MODULOS);
      // Então: o vencido primeiro; no mesmo dia, o sem hora antes do com hora
      expect(prazos.map(p => p.chave)).toEqual(['processos-z1', 'tarefas-t2', 'demandas-d1', 'tarefas-t1']);
      expect(prazos.map(p => p.para)).toEqual(['/processos/judicial/?id=p1', '/tarefas/?id=t2', '/demandas/?id=d1', '/tarefas/?id=t1']);
    });

    it('quando o mesmo prazo vem duas vezes, então aparece uma só', () => {
      // Quando
      const prazos = prazosDoPainel([daAgenda('t1', HOJE), daAgenda('t1', HOJE)], [], HOJE, MODULOS);
      // Então
      expect(prazos).toHaveLength(1);
    });

    it('quando um prazo de processo tem a tarefa de cumprir ligada e ela já está na lista, então o prazo aparece uma vez só, pela tarefa', () => {
      // Dado: a tarefa t1 é a de cumprir o prazo z1 (mesma data); o prazo z2 tem tarefa, mas ela não está na lista (concluída ou de outra pessoa)
      const agenda = [daAgenda('t1', '2026-11-20')];
      const processos = [doProcesso('z1', '2026-11-20', processo('p1'), 't1'), doProcesso('z2', '2026-11-21', processo('p1'), 't9'), doProcesso('z3', '2026-11-22')];
      // Quando
      const prazos = prazosDoPainel(agenda, processos, HOJE, MODULOS);
      // Então
      expect(prazos.map(p => p.chave)).toEqual(['tarefas-t1', 'processos-z2', 'processos-z3']);
    });

    it('quando o escritório não tem as Demandas ligadas, então os prazos das demandas ficam de fora', () => {
      // Dado
      const agenda = [daAgenda('t1', HOJE), daAgenda('d1', HOJE, { origem: 'demandas' })];
      // Quando
      const prazos = prazosDoPainel(agenda, [], HOJE, { tarefas: true });
      // Então
      expect(prazos.map(p => p.chave)).toEqual(['tarefas-t1']);
    });

    it.each([
      ['todos vieram', { vencidos: 2, aVencer: 1, total_vencidos: 2, total_a_vencer: 1 }, true],
      ['faltaram vencidos', { vencidos: 2, aVencer: 1, total_vencidos: 5, total_a_vencer: 1 }, false],
      ['faltaram a vencer e o último que veio é desta semana', { vencidos: 0, aVencer: 2, total_vencidos: 0, total_a_vencer: 9 }, false]
    ])('quando o painel de Processos traz os prazos e %s, então a leitura está completa: %s', (_caso, c, completa) => {
      // Dado
      const prazos = [...Array.from({ length: c.vencidos }, (_, i) => doProcesso('v' + i, '2026-11-10')), ...Array.from({ length: c.aVencer }, (_, i) => doProcesso('a' + i, '2026-11-20'))];
      // Quando / Então
      expect(prazosDosProcessosCompletos({ prazos, total_vencidos: c.total_vencidos, total_a_vencer: c.total_a_vencer }, HOJE)).toBe(completa);
    });

    it('quando faltaram prazos a vencer, mas o último que veio já passa da semana do painel, então a leitura está completa para o painel', () => {
      // Dado
      const prazos = [doProcesso('a1', '2026-11-20'), doProcesso('a2', '2026-12-30')];
      // Quando / Então
      expect(prazosDosProcessosCompletos({ prazos, total_vencidos: 0, total_a_vencer: 40 }, HOJE)).toBe(true);
    });

    it('quando os prazos são separados em grupos, então só aparecem os grupos com algum, em atraso primeiro', () => {
      // Dado
      const prazos = prazosDoPainel([daAgenda('t1', '2026-11-16'), daAgenda('t2', '2026-11-22')], [], HOJE, MODULOS);
      // Quando
      const grupos = emGrupos(prazos, p => p.data, HOJE);
      // Então
      expect(grupos.map(g => [g.titulo, g.selo, g.itens.length])).toEqual([['Em atraso', 'erro', 1], ['Próximos 7 dias', 'arq', 1]]);
    });

    it('quando o prazo é mostrado, então a linha diz a origem, quanto falta e a data com a hora', () => {
      // Quando / Então
      expect(quandoDoPrazo({ origem: 'demandas', data: '2026-11-20', hora: '14:00:00' }, HOJE)).toBe('Demanda · Faltam 2 dias · 20/11/2026 às 14:00');
      expect(quandoDoPrazo({ origem: 'processos', data: '2026-11-16', hora: null }, HOJE)).toBe('Processo · Vencido há 2 dias · 16/11/2026');
    });
  });

  describe('Dados os compromissos do dia', () => {
    it('quando a pessoa está em alguns e outros são da Agenda geral, então ficam os dela e os gerais, em ordem de hora, os sem hora primeiro', () => {
      // Dado
      const lista = [
        compromisso('a', { hora: '14:00:00' }), compromisso('b', { responsavel_id: 'u2' }), compromisso('c', { responsavel_id: 'u2', participantes: ['u1'], hora: '09:00:00' }),
        compromisso('d', { responsavel_id: 'u2', geral: true, hora: '11:00:00' }), compromisso('e', { data: '2026-11-19' }), compromisso('f', { hora: null })
      ];
      // Quando
      const agenda = agendaDoDia(lista, 'u1', HOJE);
      // Então
      expect(agenda.map(c => c.id)).toEqual(['f', 'c', 'd', 'a']);
    });
  });

  describe('Dadas as colunas do quadro', () => {
    const colunas = [
      { id: 'c1', nome: 'Para fazer', marco: 'inicio' as const }, { id: 'c2', nome: 'Fazendo', marco: null }, { id: 'c3', nome: 'Aguardando', marco: null },
      { id: 'c4', nome: 'Concluído', marco: 'concluido' as const }
    ];

    it('quando o painel escolhe as colunas a ler, então a das concluídas fica de fora', () => {
      // Quando
      const abertas = colunasEmAberto(colunas);
      // Então
      expect(abertas.map(c => c.id)).toEqual(['c1', 'c2', 'c3']);
    });

    it('quando chegam as primeiras de cada coluna em aberto, então ficam juntas na ordem do prazo, sem prazo no fim, até o limite do bloco', () => {
      // Dado
      const item = (id: string, prazo: string | null, prazo_hora: string | null = null) => ({ id, prazo, prazo_hora });
      const porColuna = [[item('a', '2026-11-25'), item('b', null)], [item('c', '2026-11-19', '10:00'), item('d', '2026-11-30')], [item('e', '2026-11-19')]];
      // Quando
      const itens = emAndamentoPeloPrazo(porColuna, 4);
      // Então
      expect(itens.map(i => i.id)).toEqual(['e', 'c', 'a', 'd']);
    });

    it('quando as contagens chegam, então ficam na ordem do quadro, só as com itens e sem as concluídas, com os de fora do quadro no fim', () => {
      // Quando
      const situacoes = situacoesEmAberto(colunas, [{ etapa_id: 'c3', n: 2 }, { etapa_id: 'c1', n: 1 }, { etapa_id: 'c4', n: 9 }, { etapa_id: null, n: 3 }], 'Sem situação');
      // Então
      expect(situacoes).toEqual([{ chave: 'c1', nome: 'Para fazer', n: 1 }, { chave: 'c3', nome: 'Aguardando', n: 2 }, { chave: SEM_COLUNA, nome: 'Sem situação', n: 3 }]);
      expect(totalEmAberto(situacoes)).toBe(6);
    });

    it('quando o item está fora do quadro, então o nome da coluna é o de sem situação', () => {
      // Quando / Então
      expect(nomeDaColuna(colunas, 'c2', 'Sem situação')).toBe('Fazendo');
      expect(nomeDaColuna(colunas, null, 'Sem situação')).toBe('Sem situação');
    });
  });

  describe('Dados os processos da pessoa', () => {
    it('quando alguns têm prazo ou audiência marcada, então vêm primeiro, pela data, e depois os mais recentes, sem repetir', () => {
      // Dado
      const recentes = [processo('r1', { titulo: 'Recente' }), processo('p2'), processo('r2')];
      const prazos = [doProcesso('z1', '2026-11-25', processo('p1')), doProcesso('z2', '2026-11-20', processo('p2'))];
      const marcados = [{ data: '2026-11-22', tipo: 'audiencia' as const, categoria: 'audiencia' as const, processo: processo('p3', { tipo: 'administrativo' }) }];
      // Quando
      const lista = processosDoPainel(recentes, prazos, marcados);
      // Então
      expect(lista.map(p => p.id)).toEqual(['p2', 'p3', 'p1', 'r1', 'r2']);
      expect(linhaDoEvento(lista[0].proximo!)).toBe('Prazo: Contestação z2 · 20/11/2026');
      expect(lista[1]).toMatchObject({ para: '/processos/administrativo/?id=p3', proximo: { rotulo: 'Audiência' } });
      expect(lista[3]).toMatchObject({ titulo: 'Recente · JOSÉ · 000r1', proximo: null });
    });

    it('quando há mais processos do que cabem, então o bloco mostra só os primeiros', () => {
      // Quando
      const lista = processosDoPainel(Array.from({ length: ITENS_POR_BLOCO + 3 }, (_, i) => processo('p' + i)), [], []);
      // Então
      expect(lista).toHaveLength(ITENS_POR_BLOCO);
    });
  });

  describe('Dadas as anotações que a pessoa vê', () => {
    it('quando algumas são dela (criou, é responsável ou participa), então ficam só essas, as alteradas por último primeiro', () => {
      // Dado
      const anotacao = (id: string, campos: Partial<AnotacaoLista>) => ({ id, criado_por: 'u2', responsavel_id: 'u2', participantes: [] as string[], atualizado_em: '2026-11-10T10:00:00Z', ...campos });
      const lista = [anotacao('a', { criado_por: 'u1' }), anotacao('b', {}), anotacao('c', { participantes: ['u1'], atualizado_em: '2026-11-17T10:00:00Z' }), anotacao('d', { responsavel_id: 'u1', atualizado_em: '2026-11-12T10:00:00Z' })];
      // Quando
      const minhas = anotacoesRecentes(lista, 'u1');
      // Então
      expect(minhas.map(a => a.id)).toEqual(['c', 'd', 'a']);
    });

    it.each([
      [true, 'Nenhuma anotação sua ainda.'],
      [false, 'Nenhuma anotação sua entre as alteradas por último.']
    ])('quando nenhuma das lidas é da pessoa e a leitura chegou ao fim: %s, então o bloco diz "%s"', (completa, texto) => {
      // Quando / Então
      expect(vazioDasAnotacoes(completa)).toBe(texto);
    });
  });

  describe('Dadas as parcelas do período', () => {
    const parcela = (id: string, vencimento: string, campos: Partial<ParcelaDoEscritorio> = {}) => ({ id, numero: 1, vencimento, recebida_em: null as string | null, ...campos });

    it('quando há recebidas, atrasadas e de depois da semana, então ficam as não recebidas até o fim da semana, pelo vencimento', () => {
      // Dado
      const lista = [parcela('a', '2026-11-24'), parcela('b', '2026-11-10'), parcela('c', '2026-11-19', { recebida_em: '2026-11-17' }), parcela('d', '2026-12-02')];
      // Quando
      const semana = parcelasDaSemana(lista, HOJE);
      // Então
      expect(semana.map(p => p.id)).toEqual(['b', 'a']);
    });

    it.each([
      [{ numero: 2, total_parcelas: 10 }, 'Parcela 2/10'],
      [{ numero: 3, total_parcelas: null }, 'Parcela 3']
    ])('quando a parcela é %j, então o nome dela é "%s"', (p, nome) => {
      // Quando / Então
      expect(nomeDaParcela(p)).toBe(nome);
    });
  });

  describe('Dado o número de um bloco', () => {
    it.each([
      [12, true, '12'],
      [1500, true, '1.500'],
      [50, false, '50+']
    ])('quando há %s itens e a leitura chegou ao fim: %s, então o número é "%s"', (n, completa, texto) => {
      // Quando / Então
      expect(fmtContagem(n, completa)).toBe(texto);
    });
  });
});
