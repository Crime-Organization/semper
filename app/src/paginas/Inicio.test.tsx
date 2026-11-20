// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// O painel da página inicial (#319): os blocos, o que cada um diz quando não há nada, o bloco das parcelas só para quem vê o
// Financeiro, o aviso de erro só no bloco que falhou e a busca do alto, que abre a busca geral.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AnotacaoLista, Coluna, CompromissoLista, Dados, PainelDeProcessos, ParcelaDoEscritorio, PrazoNaAgenda, TarefaLista } from '../dados';
import { hojeNaAgenda } from '../regras/agenda';
import { somarDias } from '../regras/prazos';
import { buscaGeralAberta } from '../ui/fontesDaBuscaGeral';
import Inicio from './Inicio';

type Falsas = Pick<Dados, 'prazosDoPeriodo' | 'processosPainel' | 'compromissosDoPeriodo' | 'colunasListar' | 'tarefasDaEtapa' | 'demandasDaEtapa'
  | 'processosListar' | 'anotacoesListar' | 'parcelasDoPeriodo' | 'pessoasResumo'>;
const SD = vi.hoisted(() => ({}) as { [K in keyof Falsas]: ReturnType<typeof vi.fn<Falsas[K]>> });
vi.mock('../dados', () => ({ SD }));
const MODULOS = { pessoas: true, compromissos: true, tarefas: true, demandas: true, processos: true, anotacoes: true, financeiro: true };
const sessao = vi.hoisted(() => ({ modulos: {} as Record<string, boolean> }));
vi.mock('../ui/sessao', () => ({
  useCtx: () => ({ perfil: { id: 'u1', nome: 'Mateus Teste' }, equipe: [], ehAdmin: false, escritorio: { modulos: sessao.modulos } }),
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
  id, codigo: 'T-' + id, titulo, prazo, prazo_hora: null, data_inicio: HOJE, responsavel_id: 'u1', participantes: [], pessoa_nome: '', demanda_codigo: null, contrato_codigo: null,
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

/** Um dia sem nada em nenhum módulo. */
function diaVazio() {
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
}
const montar = () => render(<MemoryRouter><Inicio /></MemoryRouter>);
const bloco = (titulo: string) => screen.getByRole('region', { name: titulo });

describe('Painel da página inicial', () => {
  beforeEach(() => {
    sessao.modulos = { ...MODULOS };
    buscaGeralAberta.mudar(false);
  });

  it('quando a pessoa entra num dia com trabalho, então vê os prazos, a agenda em ordem de hora e as tarefas em andamento, cada um com link que abre o cartão', async () => {
    // Dado
    diaCheio();
    // Quando
    montar();
    // Então
    expect(screen.getByRole('heading', { name: 'Olá, Mateus.', level: 1 })).toBeInTheDocument();
    const prazos = bloco('Prazos');
    expect(await within(prazos).findByRole('link', { name: /Prazo t1/ })).toHaveAttribute('href', '/tarefas/?id=t1');
    expect(within(within(prazos).getByRole('region', { name: 'Em atraso' })).getByText('Prazo t1')).toBeInTheDocument();
    expect(within(within(prazos).getByRole('region', { name: 'Próximos 7 dias' })).getByText('Prazo t2')).toBeInTheDocument();
    const agenda = within(bloco('Agenda de hoje')).getAllByRole('link').filter(l => l.getAttribute('href')?.startsWith('/agenda/?id='));
    expect(agenda.map(l => l.textContent)).toEqual([expect.stringContaining('Reunião de equipe'), expect.stringContaining('Audiência do José')]);
    const tarefas = bloco('Tarefas em andamento');
    expect(await within(tarefas).findByRole('link', { name: /Emitir a GRU/ })).toHaveAttribute('href', '/tarefas/?id=t3');
    expect(within(tarefas).queryByText('Organizar a pasta')).not.toBeInTheDocument();
    expect(within(tarefas).getByRole('link', { name: 'Ver todas' })).toHaveAttribute('href', '/tarefas/?pessoa=eu');
  });

  it('quando a pessoa tem muitas tarefas concluídas, de prazo mais antigo, e uma em andamento, então o bloco mostra a em andamento', async () => {
    // Dado: 40 tarefas na coluna das concluídas, todas com prazo antes da que está em "Fazendo"
    diaVazio();
    const concluidas = Array.from({ length: 40 }, (_, i) => tarefa('f' + i, 'Concluída ' + i, 'c3', somarDias(HOJE, -30)));
    SD.tarefasDaEtapa = vi.fn(async (etapa: string | null) => etapa === 'c3' ? { linhas: concluidas, total: concluidas.length }
      : etapa === 'c2' ? { linhas: [tarefa('t3', 'Emitir a GRU', 'c2', somarDias(HOJE, 2))], total: 1 } : { linhas: [], total: 0 });
    // Quando
    montar();
    // Então
    const tarefas = bloco('Tarefas em andamento');
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
    const prazos = bloco('Prazos');
    await within(prazos).findByText('Prazo t1');
    expect(within(prazos).queryByRole('link', { name: 'Ver na agenda' })).not.toBeInTheDocument();
  });

  it('quando nenhuma das anotações lidas é da pessoa, mas há mais do que o painel leu, então o bloco não diz que ela não tem nenhuma', async () => {
    // Dado: as alteradas por último são de outra pessoa, e há outras além delas
    diaVazio();
    const deOutra = { id: 'a1', codigo: 'A-1', titulo: 'De outra', criado_por: 'u2', responsavel_id: 'u2', participantes: [], atualizado_em: HOJE } as unknown as AnotacaoLista;
    SD.anotacoesListar = vi.fn(async () => ({ linhas: [deOutra], total: 80 }));
    // Quando
    montar();
    // Então
    expect(await within(bloco('Anotações recentes')).findByText('Nenhuma anotação sua entre as alteradas por último.')).toBeInTheDocument();
  });

  it('quando a pessoa tem demandas, então o bloco conta por situação, com os nomes em maiúsculas como no quadro (#386) e link para a lista dela', async () => {
    // Dado
    diaCheio();
    // Quando
    montar();
    // Então
    const situacoes = await within(bloco('Suas demandas')).findByRole('list', { name: 'Demandas por situação' });
    expect(within(situacoes).getByRole('link', { name: '3 PARA FAZER' })).toHaveAttribute('href', '/demandas/?pessoa=eu');
  });

  it('quando quem entra vê o Financeiro, então vê as parcelas da semana', async () => {
    // Dado
    diaCheio();
    // Quando
    montar();
    // Então
    expect(await within(bloco('Parcelas da semana')).findByRole('link', { name: /Parcela 2\/5/ })).toHaveAttribute('href', '/contratos/?id=k1');
  });

  it('quando o escritório não tem o Financeiro ligado, então o bloco das parcelas não aparece e as parcelas nem são lidas', async () => {
    // Dado
    diaCheio();
    sessao.modulos = { ...MODULOS, financeiro: false };
    // Quando
    montar();
    // Então
    await within(bloco('Prazos')).findByText('Prazo t1');
    expect(screen.queryByRole('region', { name: 'Parcelas da semana' })).not.toBeInTheDocument();
    expect(SD.parcelasDoPeriodo).not.toHaveBeenCalled();
  });

  it('quando é um dia sem nada, então cada bloco diz que não há nada, em vez de sumir', async () => {
    // Dado
    diaVazio();
    // Quando
    montar();
    // Então
    const vazios: [string, string][] = [
      ['Prazos', 'Nenhum prazo vencido, para hoje ou para os próximos 7 dias.'], ['Agenda de hoje', 'Nenhum compromisso hoje.'],
      ['Tarefas em andamento', 'Nenhuma tarefa em andamento com você.'], ['Suas demandas', 'Nenhuma demanda em aberto com você.'],
      ['Seus processos', 'Nenhum processo com você.'], ['Anotações recentes', 'Nenhuma anotação sua ainda.'],
      ['Parcelas da semana', 'Nenhuma parcela vencida ou a vencer nos próximos 7 dias.'], ['Pessoas', 'Nenhuma pessoa cadastrada ainda.']
    ];
    for (const [titulo, texto] of vazios) expect(await within(bloco(titulo)).findByText(texto)).toBeInTheDocument();
  });

  it('quando um bloco não consegue carregar, então o aviso aparece só nele, e os outros mostram o que têm', async () => {
    // Dado
    diaCheio();
    SD.tarefasDaEtapa = vi.fn(async () => { throw new Error('Sem conexão com o banco.'); });
    // Quando
    montar();
    // Então
    expect(await within(bloco('Tarefas em andamento')).findByRole('alert')).toHaveTextContent('Sem conexão com o banco.');
    expect(await within(bloco('Prazos')).findByText('Prazo t1')).toBeInTheDocument();
    expect(within(bloco('Prazos')).queryByRole('alert')).not.toBeInTheDocument();
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
