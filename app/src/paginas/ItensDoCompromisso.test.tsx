// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// As seções das ligações do compromisso (#306): "Ligado a", no cartão do compromisso, e "Compromissos", no cartão da tarefa, da
// demanda e do contrato.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SD, type CompromissoLigado, type ItemDoCompromisso } from '../dados';
import { CompromissosDoItem } from './CompromissosDoItem';
import { ItensDoCompromisso } from './ItensDoCompromisso';
import { iniciarPreferencias } from '../ui/preferencias';

vi.mock('../ui/sessao', () => ({
  useCtx: () => ({ perfil: { id: 'u-mauro' }, equipe: [], ehAdmin: true, escritorio: { modulos: { compromissos: true, tarefas: true, demandas: true, contratos: true } } })
}));

const item = (modulo: ItemDoCompromisso['modulo'], id: string, nome: string): ItemDoCompromisso => ({ modulo, id, codigo: id.toUpperCase(), nome, arquivado_em: null });
const ligado = (id: string, titulo: string): CompromissoLigado => ({
  id, codigo: 'C-' + id, tipo: 'atendimento', titulo, data: '2026-12-01', hora: '14:00:00', hora_fim: null, pessoa_nome: '', processo_numero: null, etapa_id: null, arquivado_em: null, papeis: []
});

beforeEach(() => {
  vi.restoreAllMocks();
  // Cada caso começa com as seções fechadas: a escolha de abrir fica guardada nas preferências.
  iniciarPreferencias({});
  vi.spyOn(SD, 'colunasListar').mockResolvedValue([]);
});

describe('A seção "Ligado a" do cartão do compromisso', () => {
  const montar = (somenteLer = false) => render(<MemoryRouter><ItensDoCompromisso id="c1" somenteLer={somenteLer} versao={0} aoMudar={() => undefined} /></MemoryRouter>);

  it('dado um compromisso ligado a uma tarefa e a uma demanda, quando o cartão abre, então o número aparece com a seção fechada e, aberta, os itens, com a corrente no título', async () => {
    // Dado
    vi.spyOn(SD, 'compromissoItens').mockResolvedValue({ visiveis: [item('demandas', 'd1', 'Inventário'), item('tarefas', 't1', 'Ligar para o cliente')], ocultos: 1 });
    // Quando
    montar();
    const titulo = await screen.findByRole('button', { name: /Ligado a/ });
    // Então
    await within(titulo).findByText('3');
    await userEvent.click(titulo);
    expect(screen.getByRole('link', { name: /Ligar para o cliente/ })).toHaveAttribute('href', '/tarefas/?id=t1');
    expect(screen.getByRole('link', { name: /Inventário/ })).toHaveAttribute('href', '/demandas/?id=d1');
    expect(screen.getByText(/1 item ligado aqui que você não tem acesso/)).toBeInTheDocument();
    // A corrente do título (#427) abre um menu com a busca de cada módulo; embaixo, nenhum botão de ligar.
    expect(screen.queryByRole('button', { name: /Ligar contrato existente/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Ligar a um item existente' }));
    expect(within(screen.getByRole('menu', { name: 'Ligar a um item existente' })).getByRole('menuitem', { name: 'Ligar contrato existente' })).toBeInTheDocument();
  });

  it('dado quem muda o compromisso, quando desliga um item, então a ligação sai', async () => {
    // Dado
    vi.spyOn(SD, 'compromissoItens').mockResolvedValue({ visiveis: [item('contratos', 'k1', 'Registro de marca')], ocultos: 0 });
    const desligar = vi.spyOn(SD, 'compromissoDesligar').mockResolvedValue();
    montar();
    await userEvent.click(await screen.findByRole('button', { name: /Ligado a/ }));
    // Quando
    await userEvent.click(await screen.findByRole('button', { name: 'Desligar Registro de marca' }));
    // Então
    expect(desligar).toHaveBeenCalledWith('c1', 'contratos', 'k1');
  });

  it('dado quem só lê o compromisso, quando a seção abre, então não há como ligar nem desligar', async () => {
    // Dado
    vi.spyOn(SD, 'compromissoItens').mockResolvedValue({ visiveis: [item('tarefas', 't1', 'Ligar para o cliente')], ocultos: 0 });
    // Quando
    montar(true);
    await userEvent.click(await screen.findByRole('button', { name: /Ligado a/ }));
    // Então
    expect(screen.queryByRole('button', { name: /Desligar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Ligar tarefa existente/ })).not.toBeInTheDocument();
  });
});

describe('A seção "Compromissos" do cartão da demanda', () => {
  it('dada uma demanda com um compromisso, quando o cartão abre, então o número aparece, e o "+ Novo compromisso" leva ao cadastro já ligado a ela', async () => {
    // Dado
    vi.spyOn(SD, 'compromissosDoItem').mockResolvedValue([ligado('c1', 'Primeiro atendimento')]);
    // Quando
    render(<MemoryRouter><CompromissosDoItem modulo="demandas" id="d1" podeLigar /></MemoryRouter>);
    const titulo = await screen.findByRole('button', { name: /Compromissos/ });
    // Então
    await within(titulo).findByText('1');
    expect(screen.getByRole('link', { name: 'Novo compromisso desta demanda' })).toHaveAttribute('href', '/agenda/novo/?demanda=d1');
    await userEvent.click(titulo);
    expect(await screen.findByRole('link', { name: /Primeiro atendimento/ })).toHaveAttribute('href', '/agenda/?id=c1');
  });

  it('dado quem só lê a demanda, quando a seção abre, então não há "+ Novo compromisso" nem "Ligar compromisso existente"', async () => {
    // Dado
    vi.spyOn(SD, 'compromissosDoItem').mockResolvedValue([]);
    // Quando
    render(<MemoryRouter><CompromissosDoItem modulo="demandas" id="d1" podeLigar={false} /></MemoryRouter>);
    await userEvent.click(await screen.findByRole('button', { name: /Compromissos/ }));
    // Então
    expect(await screen.findByText('Nenhum compromisso ligado a esta demanda.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Novo compromisso/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Ligar compromisso existente/ })).not.toBeInTheDocument();
  });
});
