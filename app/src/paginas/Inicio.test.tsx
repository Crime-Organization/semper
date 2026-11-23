// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// O painel da página inicial (#319, #402): os números do dia, os gráficos, os blocos, o que cada um diz quando não há nada, o painel
// sem nada que diz por onde começar, o filtro só para o administrador, o bloco das parcelas só para quem vê o Financeiro, o aviso de
// erro só no bloco que falhou e a busca do alto, que abre a busca geral.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AnotacaoLista, Coluna, CompromissoLista, Dados, GraficosDeTarefas, PainelDeProcessos, ParcelaDoEscritorio, PrazoNaAgenda, TarefaLista } from '../dados';
import { hojeNaAgenda } from '../regras/agenda';
import { somarDias } from '../regras/prazos';
import { buscaGeralAberta } from '../ui/fontesDaBuscaGeral';
import Inicio from './Inicio';

type Falsas = Pick<Dados, 'prazosDoPeriodo' | 'processosPainel' | 'compromissosDoPeriodo' | 'colunasListar' | 'tarefasDaEtapa' | 'demandasDaEtapa'
  | 'processosListar' | 'anotacoesListar' | 'parcelasDoPeriodo' | 'pessoasResumo' | 'tarefasGraficos' | 'mensagensNaoLidas' | 'salvarPreferencia'>;
const SD = vi.hoisted(() => ({}) as { [K in keyof Falsas]: ReturnType<typeof vi.fn<Falsas[K]>> });
vi.mock('../dados', () => ({ SD }));
const MODULOS = { pessoas: true, compromissos: true, tarefas: true, demandas: true, processos: true, anotacoes: true, financeiro: true };
const sessao = vi.hoisted(() => ({ modulos: {} as Record<string, boolean>, ehAdmin: false }));
const EQUIPE = vi.hoisted(() => [{ id: 'u1', nome: 'Mauro Teste' }, { id: 'u2', nome: 'Ana Teste' }]);
vi.mock('../ui/sessao', () => ({
  useCtx: () => ({ perfil: { id: 'u1', nome: 'Mauro Teste' }, equipe: EQUIPE, ehAdmin: sessao.ehAdmin, escritorio: { modulos: sessao.modulos } }),
  useSessao: () => ({ ctx: { perfil: { id: 'u1' }, equipe: [], escritorio: { modulos: sessao.modulos } } })
}));

const HOJE = hojeNaAgenda();
const COLUNAS: Coluna[] = [
  { id: 'c1', nome: 'Para fazer', ordem: 1, criado_por: null, oculta: false, marco: 'inicio' },
  { id: 'c2', nome: 'Fazendo', ordem: 2, criado_por: null, oculta: false, marco: null },
  { id: 'c3', nome: 'Concluída', ordem: 3, criado_por: null, oculta: false, marco: 'concluido' }
];
const PAINEL_VAZIO: PainelDeProcessos = {
  prazos: [], total_vencidos: 0, total_a_vencer: 0, marcados: [], total_marcados: 0, intimacoes: [], total_intimacoes: 0, ultimos: [], parados: [], total_parados: 0, dias_parado: 30, fases: []
};
const prazo = (id: string, data: string): PrazoNaAgenda => ({ origem: 'tarefas', id, codigo: 'C-' + id, titulo: 'Prazo ' + id, prazo: data, responsavel_id: 'u1', hora: null });
const tarefa = (id: string, titulo: string, etapa_id: string, prazo: string | null = null): TarefaLista => ({
  id, codigo: 'T-' + id, titulo, prazo, prazo_hora: null, data_inicio: HOJE, responsavel_id: 'u1', participantes: [], diligencia: false, pessoa_nome: '', demanda_codigo: null, contrato_codigo: null,
  etapa_id, etapa_ordem: 1, arquivado_em: null, criado_por: 'u1', criado_em: HOJE, atualizado_em: HOJE, equipe_da_demanda: null
});
const compromisso = (id: string, titulo: string, hora: string | null): CompromissoLista => ({
  id, codigo: 'K-' + id, tipo: 'reuniao', titulo, data: HOJE, hora, hora_fim: null, modalidade: null, local: null, geral: false, responsavel_id: 'u1', participantes: [], pessoa_nome: '',
  processo_id: null, processo_codigo: null, processo_numero: null, etapa_id: null, etapa_ordem: null, arquivado_em: null, criado_por: 'u1', criado_em: HOJE, atualizado_em: HOJE
});
const parcela: ParcelaDoEscritorio = {
  id: 'pa1', contrato_id: 'k1', numero: 2, vencimento: somarDias(HOJE, 3), valor: 150000, recebimento_id: null, recebida_em: null, recebido: null,
  contrato_codigo: 'MA11-001/26', cliente_nome: 'MARIA EXEMPLO', responsavel_id: 'u1', total_parcelas: 5
};

/** Meio-dia de hoje em Brasília (15h em UTC). */
const MEIO_DIA = HOJE + 'T15:00:00.000Z';
const SEM_GRAFICOS: GraficosDeTarefas = { tarefas: [], tempos: [] };
/** Um dia sem nada em nenhum módulo. */
function diaVazio() {
  SD.tarefasGraficos = vi.fn(async () => SEM_GRAFICOS);
  SD.mensagensNaoLidas = vi.fn(async () => 0);
  SD.prazosDoPeriodo = vi.fn(async () => []);
  SD.processosPainel = vi.fn(async () => PAINEL_VAZIO);
  SD.compromissosDoPeriodo = vi.fn(async () => []);
  SD.colunasListar = vi.fn(async () => COLUNAS);
  SD.tarefasDaEtapa = vi.fn(async () => ({ linhas: [], total: 0 }));
  SD.demandasDaEtapa = vi.fn(async () => ({ linhas: [], total: 0 }));
  SD.processosListar = vi.fn(async () => ({ linhas: [], total: 0 }));
  SD.anotacoesListar = vi.fn(async () => ({ linhas: [], total: 0 }));
  SD.parcelasDoPeriodo = vi.fn(async () => []);
  SD.pessoasResumo = vi.fn(async () => ({ total: 0, minhas: 0, mes: 0, arquivadas: 0, recentes: [] }));
}
/** A pessoa com uma tarefa em andamento (o painel não está vazio: mostra os números, os gráficos e as listas). */
function comUmaTarefa() {
  SD.tarefasGraficos = vi.fn(async () => ({ tarefas: [{ id: 't3', etapa_id: 'c2', concluida_em: null, arquivado_em: null }], tempos: [] }));
}
/** Um dia com prazos, compromissos, tarefas, demandas e uma parcela. */
function diaCheio() {
  diaVazio();
  SD.prazosDoPeriodo = vi.fn(async (de: string) => de === HOJE ? [prazo('t2', somarDias(HOJE, 2))] : [prazo('t1', somarDias(HOJE, -1))]);
  SD.compromissosDoPeriodo = vi.fn(async () => [compromisso('k2', 'Audiência do José', '14:00:00'), compromisso('k1', 'Reunião de equipe', '09:00:00')]);
  SD.tarefasDaEtapa = vi.fn(async (etapa: string | null) => etapa === 'c2' ? { linhas: [tarefa('t3', 'Emitir a GRU', 'c2')], total: 1 }
    : etapa === 'c3' ? { linhas: [tarefa('t9', 'Organizar a pasta', 'c3')], total: 1 } : { linhas: [], total: 0 });
  SD.demandasDaEtapa = vi.fn(async (etapa: string | null) => ({ linhas: [], total: etapa === 'c1' ? 3 : 0 }));
  SD.parcelasDoPeriodo = vi.fn(async () => [parcela]);
  SD.pessoasResumo = vi.fn(async () => ({ total: 28, minhas: 10, mes: 4, arquivadas: 2, recentes: [] }));
  SD.tarefasGraficos = vi.fn(async () => ({
    tarefas: [{ id: 't1', etapa_id: 'c1', concluida_em: null, arquivado_em: null }, { id: 't3', etapa_id: 'c2', concluida_em: null, arquivado_em: null },
      { id: 't9', etapa_id: 'c3', concluida_em: MEIO_DIA, arquivado_em: null }],
    tempos: [{ inicio: MEIO_DIA, segundos: 5400 }]
  }));
  SD.mensagensNaoLidas = vi.fn(async () => 4);
}
const montar = () => render(<MemoryRouter><Inicio /></MemoryRouter>);
/** O bloco (um cartão do painel): aparece depois que o painel lê os números do alto. */
const bloco = (titulo: string) => screen.findByRole('region', { name: titulo });

describe('Painel da página inicial', () => {
  beforeEach(() => {
    sessao.modulos = { ...MODULOS };
    sessao.ehAdmin = false;
    SD.salvarPreferencia = vi.fn(async () => {});
    buscaGeralAberta.mudar(false);
  });

  it('quando a pessoa entra num dia com trabalho, então vê os prazos, a agenda em ordem de hora e as tarefas em andamento, cada um com link que abre o cartão', async () => {
    // Dado
    diaCheio();
    // Quando
    montar();
    // Então
    expect(screen.getByRole('heading', { name: 'Olá, Mauro.', level: 1 })).toBeInTheDocument();
    const prazos = await bloco('Prazos');
    expect(await within(prazos).findByRole('link', { name: /Prazo t1/ })).toHaveAttribute('href', '/tarefas/?id=t1');
    expect(within(within(prazos).getByRole('region', { name: 'Em atraso' })).getByText('Prazo t1')).toBeInTheDocument();
    expect(within(within(prazos).getByRole('region', { name: 'Próximos 7 dias' })).getByText('Prazo t2')).toBeInTheDocument();
    const agenda = within(await bloco('Agenda de hoje')).getAllByRole('link').filter(l => l.getAttribute('href')?.startsWith('/agenda/?id='));
    expect(agenda.map(l => l.textContent)).toEqual([expect.stringContaining('Reunião de equipe'), expect.stringContaining('Audiência do José')]);
    const tarefas = await bloco('Tarefas em andamento');
    expect(await within(tarefas).findByRole('link', { name: /Emitir a GRU/ })).toHaveAttribute('href', '/tarefas/?id=t3');
    expect(within(tarefas).queryByText('Organizar a pasta')).not.toBeInTheDocument();
    expect(within(tarefas).getByRole('link', { name: 'Ver todas' })).toHaveAttribute('href', '/tarefas/?pessoa=eu');
  });

  it('quando a pessoa tem muitas tarefas concluídas, de prazo mais antigo, e uma em andamento, então o bloco mostra a em andamento', async () => {
    // Dado: 40 tarefas na coluna das concluídas, todas com prazo antes da que está em "Fazendo"
    diaVazio();
    comUmaTarefa();
    const concluidas = Array.from({ length: 40 }, (_, i) => tarefa('f' + i, 'Concluída ' + i, 'c3', somarDias(HOJE, -30)));
    SD.tarefasDaEtapa = vi.fn(async (etapa: string | null) => etapa === 'c3' ? { linhas: concluidas, total: concluidas.length }
      : etapa === 'c2' ? { linhas: [tarefa('t3', 'Emitir a GRU', 'c2', somarDias(HOJE, 2))], total: 1 } : { linhas: [], total: 0 });
    // Quando
    montar();
    // Então
    const tarefas = await bloco('Tarefas em andamento');
    expect(await within(tarefas).findByRole('link', { name: /Emitir a GRU/ })).toHaveAttribute('href', '/tarefas/?id=t3');
    expect(within(tarefas).queryByText(/Concluída/)).not.toBeInTheDocument();
    expect(SD.tarefasDaEtapa.mock.calls.map(([etapa]) => etapa)).not.toContain('c3');
  });

  it('quando o escritório não tem a Agenda ligada, então o bloco dos prazos aparece sem o link para a agenda', async () => {
    // Dado
    diaCheio();
    sessao.modulos = { ...MODULOS, compromissos: false };
    // Quando
    montar();
    // Então
    const prazos = await bloco('Prazos');
    await within(prazos).findByText('Prazo t1');
    expect(within(prazos).queryByRole('link', { name: 'Ver na agenda' })).not.toBeInTheDocument();
  });

  it('quando nenhuma das anotações lidas é da pessoa, mas há mais do que o painel leu, então o bloco não diz que ela não tem nenhuma', async () => {
    // Dado: as alteradas por último são de outra pessoa, e há outras além delas
    diaVazio();
    comUmaTarefa();
    const deOutra = { id: 'a1', codigo: 'A-1', titulo: 'De outra', criado_por: 'u2', responsavel_id: 'u2', participantes: [], atualizado_em: HOJE } as unknown as AnotacaoLista;
    SD.anotacoesListar = vi.fn(async () => ({ linhas: [deOutra], total: 80 }));
    // Quando
    montar();
    // Então
    expect(await within(await bloco('Anotações recentes')).findByText('Nenhuma anotação sua entre as alteradas por último.')).toBeInTheDocument();
  });

  it('quando a pessoa tem demandas, então o bloco conta por situação, com os nomes em maiúsculas como no quadro (#386) e link para a lista dela', async () => {
    // Dado
    diaCheio();
    // Quando
    montar();
    // Então
    const fases = await within(await screen.findByRole('region', { name: 'Demandas por fase' })).findByRole('list', { name: 'Demandas em aberto em cada fase do quadro' });
    expect(within(fases).getByRole('link', { name: '3 PARA FAZER' })).toHaveAttribute('href', '/demandas/?pessoa=eu');
  });

  it('quando quem entra vê o Financeiro, então vê as parcelas da semana', async () => {
    // Dado
    diaCheio();
    // Quando
    montar();
    // Então
    expect(await within(await bloco('Parcelas da semana')).findByRole('link', { name: /Parcela 2\/5/ })).toHaveAttribute('href', '/contratos/?id=k1');
  });

  it('quando o escritório não tem o Financeiro ligado, então o bloco das parcelas não aparece e as parcelas nem são lidas', async () => {
    // Dado
    diaCheio();
    sessao.modulos = { ...MODULOS, financeiro: false };
    // Quando
    montar();
    // Então
    await within(await bloco('Prazos')).findByText('Prazo t1');
    expect(screen.queryByRole('region', { name: 'Parcelas da semana' })).not.toBeInTheDocument();
    expect(SD.parcelasDoPeriodo).not.toHaveBeenCalled();
  });

  it('quando é um dia sem nada além de uma tarefa concluída, então cada bloco diz que não há nada, em vez de sumir', async () => {
    // Dado: o painel tem algo (uma tarefa concluída hoje), mas nenhuma lista tem itens
    diaVazio();
    SD.tarefasGraficos = vi.fn(async () => ({ tarefas: [{ id: 't9', etapa_id: 'c3', concluida_em: MEIO_DIA, arquivado_em: null }], tempos: [] }));
    // Quando
    montar();
    // Então
    const vazios: [string, string][] = [
      ['Prazos', 'Nenhum prazo vencido, para hoje ou para os próximos 7 dias.'], ['Agenda de hoje', 'Nenhum compromisso hoje.'],
      ['Tarefas em andamento', 'Nenhuma tarefa em andamento com você.'], ['Demandas por fase', 'Nenhuma demanda em aberto com você.'],
      ['Processos', 'Nenhum processo com você.'], ['Anotações recentes', 'Nenhuma anotação sua ainda.'],
      ['Parcelas da semana', 'Nenhuma parcela vencida ou a vencer nos próximos 7 dias.'], ['Pessoas', 'Nenhuma pessoa cadastrada ainda.']
    ];
    for (const [titulo, texto] of vazios) expect(await within(await screen.findByRole('region', { name: titulo })).findByText(texto)).toBeInTheDocument();
  });

  it('quando a pessoa ainda não tem nada em nenhum módulo, então o painel diz por onde começar, sem números nem gráficos zerados', async () => {
    // Dado
    diaVazio();
    // Quando
    montar();
    // Então
    expect(await screen.findByText('Seu painel começa aqui.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Criar tarefa' })).toHaveAttribute('href', '/tarefas/nova/');
    expect(screen.getByRole('link', { name: 'Marcar compromisso' })).toHaveAttribute('href', '/agenda/novo/');
    expect(screen.queryByRole('group', { name: 'Números do dia' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Ritmo' })).not.toBeInTheDocument();
  });

  it('quando a pessoa entra num dia com trabalho, então os números do dia vêm no alto, cada um levando à lista dele', async () => {
    // Dado
    diaCheio();
    // Quando
    montar();
    // Então
    const numeros = await screen.findByRole('group', { name: 'Números do dia' });
    const numero = (nome: RegExp) => within(numeros).getByRole('link', { name: nome });
    expect(numero(/Tarefas a fazer/)).toHaveTextContent('2');
    expect(numero(/Tarefas a fazer/)).toHaveAttribute('href', '#inicio-tarefas');
    expect(numero(/Prazos vencidos/)).toHaveTextContent('1');
    expect(numero(/Prazos vencidos/)).toHaveAttribute('href', '#inicio-prazos');
    expect(numero(/Prazos de hoje/)).toHaveTextContent('0');
    expect(numero(/Compromissos de hoje/)).toHaveTextContent('2');
    expect(numero(/Compromissos de hoje/)).toHaveAttribute('href', '#inicio-agenda');
    expect(numero(/Mensagens não lidas/)).toHaveTextContent('4');
    expect(numero(/Mensagens não lidas/)).toHaveAttribute('href', '/mensagens/');
    expect(numero(/Demandas em aberto/)).toHaveAttribute('href', '#inicio-demandas');
    expect(await bloco('Tarefas em andamento')).toHaveAttribute('id', 'inicio-tarefas');
  });

  it('quando a pessoa entra num dia com trabalho, então vê as tarefas por situação e o ritmo, que troca para 30 dias', async () => {
    // Dado
    diaCheio();
    montar();
    // Então
    const situacoes = await screen.findByRole('list', { name: 'Tarefas em cada situação' });
    expect(within(situacoes).getAllByRole('link').map(l => l.textContent)).toEqual(['1 A fazer', '1 Fazendo', '0 Aguardando', '1 Concluídas na semana']);
    expect(within(situacoes).getAllByRole('link')[0]).toHaveAttribute('href', '/tarefas/?pessoa=eu');
    const ritmo = await bloco('Ritmo');
    const tempo = within(ritmo).getByRole('table', { name: 'Tempo registrado nas tarefas em cada um dos últimos 7 dias' });
    expect(within(tempo).getByRole('row', { name: /hoje/ })).toHaveTextContent('1 h 30 min');
    // Quando
    await userEvent.click(within(ritmo).getByRole('button', { name: '30 dias' }));
    // Então
    expect(within(ritmo).getByRole('button', { name: '30 dias' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(within(ritmo).getByRole('table', { name: 'Tarefas concluídas em cada um dos últimos 30 dias' })).getAllByRole('row')).toHaveLength(31);
  });

  it('quando quem entra não é administrador, então não há o filtro, e o painel é o trabalho dela', async () => {
    // Dado
    diaCheio();
    // Quando
    montar();
    // Então
    await screen.findByRole('group', { name: 'Números do dia' });
    expect(screen.queryByRole('combobox', { name: 'Mostrar' })).not.toBeInTheDocument();
    expect(screen.getByText('O seu trabalho: o que é seu e aquilo de que você participa.')).toBeInTheDocument();
    expect(SD.tarefasGraficos).toHaveBeenCalledWith(expect.objectContaining({ pessoa: 'u1' }));
  });

  it('quando o administrador escolhe a equipe toda ou uma pessoa, então os números, os gráficos e as listas leem esse trabalho', async () => {
    // Dado
    diaCheio();
    sessao.ehAdmin = true;
    montar();
    const filtro = await screen.findByRole('combobox', { name: 'Mostrar' });
    // Quando
    await userEvent.selectOptions(filtro, 'equipe');
    // Então
    expect(await screen.findByText('O trabalho da equipe toda.')).toBeInTheDocument();
    await vi.waitFor(() => expect(SD.tarefasGraficos).toHaveBeenLastCalledWith(expect.objectContaining({ pessoa: null })));
    await vi.waitFor(() => expect(within(screen.getByRole('region', { name: 'Tarefas em andamento' })).getByRole('link', { name: 'Ver todas' })).toHaveAttribute('href', '/tarefas/?pessoa=todos'));
    expect(SD.tarefasDaEtapa).toHaveBeenLastCalledWith(null, { situacao: 'ativas', ordem: 'prazo' }, 0, expect.any(Number));
    // Quando
    await userEvent.selectOptions(filtro, 'u2');
    // Então
    expect(await screen.findByText('O trabalho de Ana Teste.')).toBeInTheDocument();
    await vi.waitFor(() => expect(SD.tarefasGraficos).toHaveBeenLastCalledWith(expect.objectContaining({ pessoa: 'u2' })));
    expect(SD.prazosDoPeriodo).toHaveBeenLastCalledWith(expect.any(String), expect.any(String), { pessoa: 'u2' });
  });

  it('quando um bloco não consegue carregar, então o aviso aparece só nele, e os outros mostram o que têm', async () => {
    // Dado
    diaCheio();
    SD.tarefasDaEtapa = vi.fn(async () => { throw new Error('Sem conexão com o banco.'); });
    // Quando
    montar();
    // Então
    expect(await within(await bloco('Tarefas em andamento')).findByRole('alert')).toHaveTextContent('Sem conexão com o banco.');
    expect(await within(await bloco('Prazos')).findByText('Prazo t1')).toBeInTheDocument();
    expect(within(await bloco('Prazos')).queryByRole('alert')).not.toBeInTheDocument();
  });

  it('quando a pessoa clica na busca do alto, então a busca geral abre', async () => {
    // Dado
    diaVazio();
    montar();
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Buscar em todo o SEMPER' }));
    // Então
    expect(buscaGeralAberta.ler()).toBe(true);
  });
});
