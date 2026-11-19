// @vitest-environment jsdom
// Os pedidos para participar (#363) e os avisos de quem entrou num item (#377) na caixa de Mensagens. Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SD, type InclusaoDaMensagem, type Mensagem, type PedidoDaMensagem } from '../dados';
import { avisar, falha } from '../ui/avisos';
import Mensagens from './Mensagens';

const EQUIPE = [{ id: 'u-ana', nome: 'Ana Teste Lima' }, { id: 'u-bruno', nome: 'Bruno Exemplo Souza' }];
vi.mock('../ui/sessao', () => ({ useCtx: () => ({ perfil: { id: 'u-ana' }, equipe: EQUIPE, ehAdmin: true, escritorio: { modulos: {} } }) }));
vi.mock('../ui/avisos', () => ({ avisar: vi.fn(), falha: vi.fn() }));

const pedido = (extra: Partial<PedidoDaMensagem> = {}): PedidoDaMensagem => ({
  id: 'p1', modulo: 'tarefas', item_id: 't1', item_codigo: 'F00D1234', pedido_por: 'u-bruno', situacao: 'pendente', respondido_por: null, tipo_do_processo: null, ...extra
});
const mensagem = (tipo: 'pedido' | 'resposta', p: PedidoDaMensagem): Mensagem =>
  ({ id: 'm-' + tipo, tipo, criado_em: '2026-11-18T12:00:00Z', lido_em: null, comentario: null, prazo: null, pedido: p, inclusao: null });

function montar(lista: Mensagem[]) {
  const listar = vi.spyOn(SD, 'mensagensListar').mockResolvedValue(lista);
  vi.spyOn(SD, 'mensagensNaoLidas').mockResolvedValue(lista.length);
  render(<MemoryRouter><Mensagens /></MemoryRouter>);
  return listar;
}

describe('Mensagens: pedir para participar (#363)', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.mocked(avisar).mockClear(); vi.mocked(falha).mockClear(); });

  it('dado um pedido para quem aprova, quando a caixa abre, então mostra quem pediu, o item com link e os botões "Aprovar" e "Recusar"', async () => {
    // Quando
    montar([mensagem('pedido', pedido())]);
    // Então
    const item = await screen.findByRole('listitem', { name: /Pedido para participar não lida de Bruno Exemplo Souza/ });
    expect(item).toHaveTextContent('Bruno Exemplo Souza pediu para participar da tarefa F00D1234');
    expect(item).toHaveTextContent('Ao aprovar, Bruno Exemplo Souza entra como participante.');
    expect(within(item).getByRole('link', { name: 'F00D1234' })).toHaveAttribute('href', '/tarefas/?id=t1');
    expect(within(item).getByRole('button', { name: 'Aprovar o pedido de Bruno Exemplo Souza' })).toBeInTheDocument();
    expect(within(item).getByRole('button', { name: 'Recusar o pedido de Bruno Exemplo Souza' })).toBeInTheDocument();
  });

  it('dado um pedido, quando quem aprova clica em "Aprovar", então o banco recebe a resposta, o aviso confirma e a caixa recarrega', async () => {
    // Dado
    const listar = montar([mensagem('pedido', pedido({ modulo: 'contratos' }))]);
    const responder = vi.spyOn(SD, 'participacaoResponder').mockResolvedValue();
    // Quando
    await userEvent.click(await screen.findByRole('button', { name: 'Aprovar o pedido de Bruno Exemplo Souza' }));
    // Então
    expect(responder).toHaveBeenCalledWith('p1', true);
    expect(avisar).toHaveBeenCalledWith('Pedido aprovado: Bruno Exemplo Souza entra como participante, com 0% da divisão.');
    await waitFor(() => expect(listar.mock.calls.length).toBeGreaterThanOrEqual(2));
  });

  it('dado um pedido já respondido por outra pessoa, quando quem aprova clica em "Recusar", então vê o motivo e a caixa recarrega', async () => {
    // Dado
    const listar = montar([mensagem('pedido', pedido())]);
    vi.spyOn(SD, 'participacaoResponder').mockRejectedValue(new Error('Este pedido já foi respondido.'));
    // Quando
    await userEvent.click(await screen.findByRole('button', { name: 'Recusar o pedido de Bruno Exemplo Souza' }));
    // Então
    expect(falha).toHaveBeenCalledWith(new Error('Este pedido já foi respondido.'));
    await waitFor(() => expect(listar.mock.calls.length).toBeGreaterThanOrEqual(2));
  });

  it('dada a resposta aprovada, quando quem pediu abre a caixa, então ela leva ao cartão e diz o que mudou', async () => {
    // Quando
    montar([mensagem('resposta', pedido({ situacao: 'aprovado', respondido_por: 'u-ana', modulo: 'processos', tipo_do_processo: 'judicial' }))]);
    // Então
    const item = await screen.findByRole('listitem', { name: /Resposta não lida: Ana Teste Lima aprovou seu pedido/ });
    expect(item).toHaveTextContent('Ana Teste Lima aprovou seu pedido para participar do processo F00D1234');
    expect(item).toHaveTextContent('Agora você é colaborador do processo.');
    expect(within(item).getByRole('link')).toHaveAttribute('href', '/processos/judicial/?id=t1');
  });

  it('dada a resposta recusada, quando quem pediu abre a caixa, então ela avisa, sem link para o item', async () => {
    // Quando
    montar([mensagem('resposta', pedido({ situacao: 'recusado', respondido_por: 'u-ana' }))]);
    // Então
    const item = await screen.findByRole('listitem', { name: /Resposta não lida: Ana Teste Lima recusou seu pedido/ });
    expect(item).toHaveTextContent('Você continua sem acesso a este item.');
    expect(within(item).queryByRole('link')).not.toBeInTheDocument();
  });

  it('dado um pedido que a pessoa não pode mais ver (deixou de aprovar), quando a caixa abre, então avisa que não está disponível, sem "Aprovar" nem "Recusar"', async () => {
    // Quando
    montar([{ ...mensagem('pedido', pedido()), pedido: null }]);
    // Então
    const item = await screen.findByRole('listitem', { name: /Pedido não lida que não está mais disponível/ });
    expect(item).toHaveTextContent('Este pedido para participar não está mais disponível.');
    expect(within(item).queryByRole('button', { name: /Aprovar/ })).not.toBeInTheDocument();
    expect(within(item).queryByRole('button', { name: /Recusar/ })).not.toBeInTheDocument();
  });
});

const inclusao = (extra: Partial<InclusaoDaMensagem> = {}): InclusaoDaMensagem => ({
  modulo: 'demandas', entrou_como: 'participante', incluido_por: 'u-ana',
  item: { id: 'd1', codigo: 'D3A1F09C', nome: 'Busca de anterioridade', tipo_do_processo: null }, ...extra
});
const avisoDeInclusao = (i: InclusaoDaMensagem): Mensagem =>
  ({ id: 'm-inclusao', tipo: 'inclusao', criado_em: '2026-11-19T12:00:00Z', lido_em: null, comentario: null, prazo: null, pedido: null, inclusao: i });

describe('Mensagens: aviso de quem entrou num item (#377)', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('dada a inclusão numa demanda, quando a caixa abre, então mostra quem incluiu, a demanda com link e o que mudou', async () => {
    // Quando
    montar([avisoDeInclusao(inclusao())]);
    // Então
    const item = await screen.findByRole('listitem', { name: 'Aviso não lido: Ana Teste Lima incluiu você na demanda Busca de anterioridade' });
    expect(item).toHaveTextContent('Ana Teste Lima incluiu você na demanda Busca de anterioridade');
    expect(item).toHaveTextContent('Agora você é colaborador da demanda.');
    expect(within(item).getByRole('link')).toHaveAttribute('href', '/demandas/?id=d1');
    expect(within(item).getByRole('button', { name: 'Marcar como lida a mensagem de Ana Teste Lima sobre a demanda Busca de anterioridade' })).toHaveTextContent('Marcar como lida');
  });

  it('dada a responsabilidade de uma tarefa, quando a caixa abre, então diz que a pessoa agora é a responsável', async () => {
    // Quando
    montar([avisoDeInclusao(inclusao({ modulo: 'tarefas', entrou_como: 'responsavel', item: { id: 't1', codigo: 'F00D1234', nome: null, tipo_do_processo: null } }))]);
    // Então
    const item = await screen.findByRole('listitem', { name: /Aviso não lido: Ana Teste Lima pôs você como responsável pela tarefa F00D1234/ });
    expect(item).toHaveTextContent('Agora você é o responsável.');
    expect(within(item).getByRole('link')).toHaveAttribute('href', '/tarefas/?id=t1');
  });

  it('dado o aviso de um processo administrativo, quando a caixa abre, então o link vai à página dos processos administrativos', async () => {
    // Quando
    montar([avisoDeInclusao(inclusao({ modulo: 'processos', item: { id: 'p1', codigo: 'EEEE0001', nome: 'Marca nova', tipo_do_processo: 'administrativo' } }))]);
    // Então
    const item = await screen.findByRole('listitem', { name: /incluiu você no processo Marca nova/ });
    expect(within(item).getByRole('link')).toHaveAttribute('href', '/processos/administrativo/?id=p1');
    expect(item).toHaveTextContent('Agora você é colaborador do processo.');
  });

  it('dado o aviso de quem foi retirado da demanda, quando a caixa abre, então diz que não faz mais parte, sem o item, sem link e sem quem incluiu', async () => {
    // Quando
    montar([avisoDeInclusao(inclusao({ item: null }))]);
    // Então
    const item = await screen.findByRole('listitem', { name: 'Aviso não lido: Você não faz mais parte desta demanda' });
    expect(item).toHaveTextContent('Você não faz mais parte desta demanda.');
    expect(item).not.toHaveTextContent('Busca de anterioridade');
    expect(item).not.toHaveTextContent('Ana Teste Lima');
    expect(within(item).queryByRole('link')).not.toBeInTheDocument();
    expect(within(item).getByRole('button', { name: 'Marcar como lida a mensagem de uma demanda de que você não faz mais parte' })).toBeInTheDocument();
  });

  it('dada a anotação que deixou de ser compartilhada, quando a caixa abre, então diz isso com as palavras da anotação', async () => {
    // Quando
    montar([avisoDeInclusao(inclusao({ modulo: 'anotacoes', item: null }))]);
    // Então
    expect(await screen.findByRole('listitem', { name: /Esta anotação não está mais compartilhada com você/ })).toBeInTheDocument();
  });

  it('dado quem incluiu que não está mais na equipe, quando a caixa abre, então aparece "Usuário removido"', async () => {
    // Quando
    montar([avisoDeInclusao(inclusao({ incluido_por: 'u-saiu' }))]);
    // Então
    expect(await screen.findByRole('listitem', { name: /Usuário removido incluiu você na demanda/ })).toBeInTheDocument();
  });

  it('dado o aviso, quando a pessoa clica no link, então a mensagem é marcada como lida', async () => {
    // Dado
    montar([avisoDeInclusao(inclusao())]);
    const marcar = vi.spyOn(SD, 'mensagemMarcarLida').mockResolvedValue();
    // Quando
    await userEvent.click(within(await screen.findByRole('listitem', { name: /incluiu você na demanda/ })).getByRole('link'));
    // Então
    expect(marcar).toHaveBeenCalledWith('m-inclusao');
  });
});
