// @vitest-environment jsdom
// Os pedidos para participar na caixa de Mensagens (#363). Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SD, type Mensagem, type PedidoDaMensagem } from '../dados';
import { avisar, falha } from '../ui/avisos';
import Mensagens from './Mensagens';

const EQUIPE = [{ id: 'u-ana', nome: 'Ana Teste Lima' }, { id: 'u-bruno', nome: 'Bruno Exemplo Souza' }];
vi.mock('../ui/sessao', () => ({ useCtx: () => ({ perfil: { id: 'u-ana' }, equipe: EQUIPE, ehAdmin: true, escritorio: { modulos: {} } }) }));
vi.mock('../ui/avisos', () => ({ avisar: vi.fn(), falha: vi.fn() }));

const pedido = (extra: Partial<PedidoDaMensagem> = {}): PedidoDaMensagem => ({
  id: 'p1', modulo: 'tarefas', item_id: 't1', item_codigo: 'F00D1234', pedido_por: 'u-bruno', situacao: 'pendente', respondido_por: null, tipo_do_processo: null, ...extra
});
const mensagem = (tipo: 'pedido' | 'resposta', p: PedidoDaMensagem): Mensagem =>
  ({ id: 'm-' + tipo, tipo, criado_em: '2026-11-18T12:00:00Z', lido_em: null, comentario: null, prazo: null, pedido: p });

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
