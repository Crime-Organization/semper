// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Os andamentos do processo (#362): o tipo da lista pronta na caixa e no formulário, e o "⋯" com "Mudar" e "Excluir" à direita da
// caixa, que quem só lê o processo não vê.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AndamentoDeProcesso, DadosAcompanhamento, Membro, Processo } from '../../dados';
import { Avisos } from '../../ui/avisos';
import { Andamentos } from './Andamentos';

// A seção lança, muda e exclui andamentos (e desfaz); o mock declara exatamente essas operações.
const SD = vi.hoisted(() => ({
  processoAndamentoCriar: vi.fn<DadosAcompanhamento['processoAndamentoCriar']>(), processoAndamentoAtualizar: vi.fn<DadosAcompanhamento['processoAndamentoAtualizar']>(),
  processoAndamentoExcluir: vi.fn<DadosAcompanhamento['processoAndamentoExcluir']>(async () => {}), processoAndamentoRestaurar: vi.fn<DadosAcompanhamento['processoAndamentoRestaurar']>(async () => {})
}));
vi.mock('../../dados', () => ({ SD: SD satisfies Pick<DadosAcompanhamento, keyof typeof SD> }));
// Criar a tarefa da intimação passa pela peça comum do processo (tarefaDoProcesso.ts), que grava a tarefa e chama a ligação.
const criarTarefaLigada = vi.hoisted(() => vi.fn());
vi.mock('./tarefaDoProcesso', () => ({ criarTarefaLigada, arquivarTarefaCriada: vi.fn(), quemRecebe: (eu: string) => ({ eu, ativos: [eu] }) }));
const EQUIPE: Membro[] = [{ id: 'u-mauro', nome: 'Mauro Teixeira Duarte', usuario: 'mauro.duarte', ativo: true }];
vi.mock('../../ui/sessao', () => ({ useCtx: () => ({ perfil: { id: 'u-mauro' }, equipe: EQUIPE, ehAdmin: true, escritorio: { modulos: { tarefas: true } } }) }));

const andamento = (extra: Partial<AndamentoDeProcesso> = {}): AndamentoDeProcesso => ({
  id: 'a1', processo_id: 'p1', tipo: 'andamento', categoria: 'despacho', data: '2026-11-10', hora: null, local: null, texto: 'Cite-se.', tratada_em: null,
  tarefa_id: null, tarefa: null, criado_por: 'u-mauro', criado_em: '2026-11-10T10:00:00Z', atualizado_em: '2026-11-10T10:00:00Z', ...extra
});
const PROCESSO = { id: 'p1', numero: '0001234-97.2026.8.13.0024', titulo: null, orgao: 'TJMG', clientes: [], cliente_nome: '', responsavel_id: 'u-mauro', colaboradores: [] } as unknown as Processo;
const aoMudar = vi.fn(async () => {});
const montar = (lista: AndamentoDeProcesso[], somenteLer = false) => render(<MemoryRouter><Avisos />
  <Andamentos processo={PROCESSO} andamentos={lista} prazos={[]} orgao={null} somenteLer={somenteLer} aoMudar={aoMudar} /></MemoryRouter>);
const linhaDoTempo = () => screen.getByRole('list', { name: 'Andamentos do processo' });

describe('Andamentos do processo (#362)', () => {
  beforeEach(() => {
    Object.values(SD).forEach(f => f.mockClear());
    aoMudar.mockClear();
  });

  it('dado um despacho e um andamento de antes, sem tipo da lista, quando a seção mostra, então cada caixa tem o seu tipo', () => {
    // Quando
    montar([andamento(), andamento({ id: 'a2', categoria: null, tipo: 'intimacao', texto: 'Intimação antiga' })]);
    // Então
    const caixas = within(linhaDoTempo()).getAllByRole('listitem');
    expect(caixas.map(c => c.getAttribute('aria-label'))).toEqual(['Despacho de 10/11/2026', 'Intimação de 10/11/2026']);
    expect(within(caixas[0]).getByText('Despacho')).toBeInTheDocument();
    expect(within(caixas[1]).getByText('Intimação')).toBeInTheDocument();
    expect(within(caixas[1]).getByText('A tratar')).toBeInTheDocument();
  });

  it('quando a pessoa abre o "⋯" de um andamento, então o menu tem só "Mudar" e "Excluir", e eles saíram da caixa', async () => {
    // Dado
    montar([andamento()]);
    const caixa = within(linhaDoTempo()).getByRole('listitem', { name: 'Despacho de 10/11/2026' });
    expect(within(caixa).queryByRole('button', { name: /Mudar|Excluir/ })).not.toBeInTheDocument();
    // Quando
    await userEvent.click(within(caixa).getByRole('button', { name: 'Ações do andamento: Despacho de 10/11/2026' }));
    // Então
    const menu = screen.getByRole('menu', { name: 'Ações do andamento: Despacho de 10/11/2026' });
    expect(within(menu).getAllByRole('menuitem').map(b => b.textContent?.trim())).toEqual(['Mudar', 'Excluir']);
    expect(within(caixa).getByRole('button', { name: /^Ações do andamento/ })).toHaveAttribute('aria-expanded', 'true');
  });

  it('quando a pessoa escolhe "Mudar" no menu, então o formulário abre com o tipo do andamento, e salvar grava o par novo', async () => {
    // Dado
    SD.processoAndamentoAtualizar.mockResolvedValue(andamento({ categoria: 'sentenca' }));
    montar([andamento()]);
    await userEvent.click(screen.getByRole('button', { name: 'Ações do andamento: Despacho de 10/11/2026' }));
    // Quando
    await userEvent.click(screen.getByRole('menuitem', { name: 'Mudar' }));
    const form = screen.getByRole('form', { name: 'Mudar andamento' });
    // Então
    expect(within(form).getByLabelText(/^Tipo/)).toHaveValue('despacho');
    // Quando
    await userEvent.selectOptions(within(form).getByLabelText(/^Tipo/), 'Sentença');
    await userEvent.click(within(form).getByRole('button', { name: 'Salvar andamento' }));
    // Então
    expect(SD.processoAndamentoAtualizar).toHaveBeenCalledWith('a1', expect.objectContaining({ tipo: 'andamento', categoria: 'sentenca' }));
  });

  it('quando a pessoa escolhe "Excluir" no menu, então o andamento sai, sem pedir confirmação, com o Desfazer no aviso', async () => {
    // Dado
    montar([andamento()]);
    await userEvent.click(screen.getByRole('button', { name: 'Ações do andamento: Despacho de 10/11/2026' }));
    // Quando
    await userEvent.click(screen.getByRole('menuitem', { name: 'Excluir' }));
    // Então
    expect(SD.processoAndamentoExcluir).toHaveBeenCalledWith('a1');
    const aviso = await screen.findByText('Andamento excluído.');
    expect(within(aviso).getByRole('button', { name: 'Desfazer' })).toBeInTheDocument();
  });

  it('quando lança um andamento, então escolhe o tipo na lista pronta e grava o par que combina', async () => {
    // Dado
    SD.processoAndamentoCriar.mockResolvedValue(andamento({ id: 'novo', categoria: 'intimacao', tipo: 'intimacao' }));
    montar([]);
    await userEvent.click(screen.getByRole('button', { name: 'Novo andamento' }));
    const form = screen.getByRole('form', { name: 'Novo andamento' });
    // Quando
    await userEvent.selectOptions(within(form).getByLabelText(/^Tipo/), 'Intimação');
    await userEvent.type(within(form).getByLabelText(/O que aconteceu/), 'Para contestar');
    await userEvent.click(within(form).getByRole('button', { name: 'Lançar andamento' }));
    // Então
    expect(SD.processoAndamentoCriar).toHaveBeenCalledWith('p1', expect.objectContaining({ tipo: 'intimacao', categoria: 'intimacao', texto: 'Para contestar' }));
    expect(await screen.findByText('Intimação lançada.')).toBeInTheDocument();
  });

  it('quando tenta lançar sem escolher o tipo, então a lista só tem os seis tipos, nada vai para o banco e o campo pede o tipo', async () => {
    // Dado
    montar([]);
    await userEvent.click(screen.getByRole('button', { name: 'Novo andamento' }));
    const form = screen.getByRole('form', { name: 'Novo andamento' });
    const tipo = within(form).getByLabelText(/^Tipo/);
    expect(tipo).toHaveValue('');
    expect(within(tipo).getAllByRole('option').filter(o => !(o as HTMLOptionElement).disabled).map(o => o.textContent))
      .toEqual(['Despacho', 'Decisão', 'Sentença', 'Intimação', 'Petição', 'Audiência']);
    // Quando
    await userEvent.type(within(form).getByLabelText(/O que aconteceu/), 'Cite-se.');
    await userEvent.click(within(form).getByRole('button', { name: 'Lançar andamento' }));
    // Então
    expect(SD.processoAndamentoCriar).not.toHaveBeenCalled();
    expect(within(form).getByText('Escolha o tipo do andamento.')).toBeInTheDocument();
  });

  it('dado um andamento de antes, sem tipo da lista, quando a pessoa o muda, então a lista mostra o tipo que ele já tem, com o nome da caixa', async () => {
    // Dado
    montar([andamento({ categoria: null, texto: 'Juntada' })]);
    await userEvent.click(screen.getByRole('button', { name: 'Ações do andamento: Andamento de 10/11/2026' }));
    // Quando
    await userEvent.click(screen.getByRole('menuitem', { name: 'Mudar' }));
    // Então
    const tipo = within(screen.getByRole('form', { name: 'Mudar andamento' })).getByLabelText(/^Tipo/);
    expect(tipo).toHaveValue('andamento');
    expect(within(tipo).getByRole('option', { selected: true })).toHaveTextContent('Andamento');
  });

  it('dado quem só lê o processo, quando a seção mostra, então lê os andamentos, mas não vê o "⋯" nem o "Novo andamento"', () => {
    // Quando
    montar([andamento()], true);
    // Então
    expect(within(linhaDoTempo()).getByText('Cite-se.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Ações do andamento/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Novo andamento' })).not.toBeInTheDocument();
  });

  it('dada uma intimação a tratar, quando a seção mostra, então as ações dela são só ícones, com o nome de sempre e a explicação na dica (#423)', () => {
    // Quando
    montar([andamento({ tipo: 'intimacao', categoria: null, texto: 'Intime-se.' })]);
    // Então
    const caixa = within(within(linhaDoTempo()).getByRole('listitem', { name: 'Intimação de 10/11/2026' }));
    for (const [nome, dica] of [['Criar tarefa', 'Criar a tarefa de tratar esta intimação'], ['Lançar prazo', 'Lançar o prazo que nasce desta intimação'],
      ['Não precisa de tarefa', 'Marcar que esta intimação não precisa de tarefa']]) {
      const botao = caixa.getByRole('button', { name: nome });
      expect(botao).toHaveTextContent('');
      expect(botao).toHaveAttribute('data-dica', dica);
    }
  });

  it('dada uma intimação a tratar, quando a pessoa clica no ícone de criar tarefa, então a tarefa é criada e ligada como antes', async () => {
    // Dado
    const tarefaCriar = vi.fn(async () => ({ id: 't1', codigo: 'T1A2' }));
    SD.processoAndamentoAtualizar.mockResolvedValue(undefined as never);
    criarTarefaLigada.mockImplementation(async (_dados: unknown, ligar: (id: string) => Promise<unknown>) => { const r = await tarefaCriar(); await ligar(r.id); return r; });
    montar([andamento({ tipo: 'intimacao', categoria: null, texto: 'Intime-se.' })]);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Criar tarefa' }));
    // Então
    expect(tarefaCriar).toHaveBeenCalledOnce();
    expect(SD.processoAndamentoAtualizar).toHaveBeenCalledWith('a1', expect.objectContaining({ tarefa_id: 't1' }));
    expect(aoMudar).toHaveBeenCalled();
  });
});
