// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BuscaDoGrupo, GrupoDaBusca, ItemAchado, ItemSemAcesso } from '../regras/buscaGeral';
import { BotaoBuscaGeral, BuscaGeral } from './BuscaGeral';
import { buscaGeralAberta, type BuscarEmTudo } from './fontesDaBuscaGeral';
import { MenuFlutuante } from './Menu';
import { travarRolagem } from './rolagem';

// A janela recebe a busca de quem a monta: aqui, uma resposta fixa (a camada de dados nem é carregada).
vi.mock('../dados', () => ({ SD: {} }));

const AGORA = new Date('2026-11-18T12:00:00-03:00');
const achado = (grupo: GrupoDaBusca, id: string, titulo: string, contexto = '', codigo = id.toUpperCase()): ItemAchado =>
  ({ tipo: 'achado', grupo, id, codigo, titulo, contexto, criadoEm: '2026-11-17T10:00:00-03:00', exatos: [codigo.toLowerCase()] });
const jose = achado('pessoas', 'p1', 'JOSÉ DA SILVA TESTE', 'Pessoa física · 529.982.247-25');
const processo = achado('judiciais', 'pr1', '0001234-97.2026.8.13.0024', 'JOSÉ DA SILVA TESTE · TJMG');
const gru = achado('tarefas', 't1', 'Emitir a GRU', 'JOSÉ DA SILVA TESTE', 'C0FFEE12');

/** A busca de mentira: devolve os grupos indicados para qualquer termo. */
function buscaQueDevolve(buscas: BuscaDoGrupo[], semAcesso: ItemSemAcesso[] = []) {
  return vi.fn<BuscarEmTudo>(async () => ({ buscas, semAcesso, falhas: [] }));
}
const TUDO: BuscaDoGrupo[] = [
  { grupo: 'pessoas', itens: [jose], total: 1 }, { grupo: 'judiciais', itens: [processo], total: 1 }, { grupo: 'tarefas', itens: [gru], total: 1 }
];

/** Mostra o endereço atual, para conferir para onde a janela levou. */
function Endereco() {
  const l = useLocation();
  return <output aria-label="Endereço">{l.pathname + l.search}</output>;
}
/** O botão "Filtros" de uma página de módulo, com o painel dele (um MenuFlutuante), como na PaginaModulo. */
function BotaoFiltros() {
  const [botao, setBotao] = useState<HTMLElement | null>(null);
  return <>
    <button type="button" onClick={e => setBotao(e.currentTarget)}>Filtros</button>
    {botao && <MenuFlutuante botao={botao} painel rotulo="Filtros da página" aoFechar={() => setBotao(null)}>
      <select aria-label="Tipo"><option>Todos</option></select>
    </MenuFlutuante>}
  </>;
}
function montar(buscar = buscaQueDevolve(TUDO)) {
  render(<MemoryRouter initialEntries={['/inicio/']}>
    <BotaoBuscaGeral />
    <BotaoFiltros />
    <BuscaGeral modulos={['pessoas', 'processos', 'tarefas']} buscar={buscar} agora={() => AGORA} />
    <Endereco />
  </MemoryRouter>);
  return buscar;
}
const campo = () => screen.getByRole('combobox', { name: 'Buscar em todo o SEMPER' });
async function buscar(texto: string) {
  await userEvent.type(campo(), texto);
  // A busca sai um instante depois de a pessoa parar de digitar.
  await waitFor(() => expect(screen.getByRole('listbox', { name: 'Resultados' })).toBeVisible());
}

describe('Busca geral: a janela', () => {
  beforeEach(() => buscaGeralAberta.reiniciar());
  afterEach(() => vi.restoreAllMocks());

  it('quando a pessoa clica em "Buscar" no menu, então a janela abre com o foco no campo e a explicação do que dá para buscar', async () => {
    // Dado
    montar();
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Buscar em todo o SEMPER' }));
    // Então
    expect(screen.getByRole('dialog', { name: 'Buscar em todo o SEMPER' })).toBeInTheDocument();
    expect(campo()).toHaveFocus();
    expect(screen.getByText(/CPF, CNPJ e número de processo podem ir com ou sem pontuação/)).toBeInTheDocument();
  });

  it.each([['Ctrl+K', { ctrlKey: true }], ['Cmd+K', { metaKey: true }]])('quando a pessoa aperta %s em qualquer lugar, então a janela abre', async (_atalho, tecla) => {
    // Dado
    montar();
    // Quando
    fireEvent.keyDown(document.body, { key: 'k', ...tecla });
    // Então
    expect(await screen.findByRole('dialog', { name: 'Buscar em todo o SEMPER' })).toBeInTheDocument();
  });

  it('quando a pessoa digita, então os resultados aparecem agrupados por módulo, com o tipo, o código, o título e o contexto', async () => {
    // Dado
    const busca = montar();
    await userEvent.click(screen.getByRole('button', { name: 'Buscar em todo o SEMPER' }));
    // Quando
    await buscar('jose');
    // Então
    expect(busca).toHaveBeenLastCalledWith('jose', ['pessoas', 'judiciais', 'administrativos', 'tarefas']);
    const grupos = within(screen.getByRole('listbox', { name: 'Resultados' })).getAllByRole('group');
    expect(grupos.map(g => g.getAttribute('aria-labelledby') && document.getElementById(g.getAttribute('aria-labelledby')!)!.textContent))
      .toEqual(['Pessoas', 'Processos judiciais', 'Tarefas']);
    expect(screen.getByRole('option', { name: /Emitir a GRU/ })).toHaveTextContent('TarefaC0FFEE12JOSÉ DA SILVA TESTE');
    expect(within(screen.getByRole('dialog')).getByRole('status')).toHaveTextContent('3 resultados em 3 módulos.');
  });

  it('quando a pessoa filtra por um módulo, então só os resultados dele ficam', async () => {
    // Dado
    montar();
    await userEvent.click(screen.getByRole('button', { name: 'Buscar em todo o SEMPER' }));
    await buscar('jose');
    // Quando
    await userEvent.click(within(screen.getByRole('group', { name: 'Módulo' })).getByRole('button', { name: 'Tarefas' }));
    // Então
    expect(within(screen.getByRole('listbox', { name: 'Resultados' })).getAllByRole('option')).toHaveLength(1);
    expect(screen.getByRole('option', { name: /Emitir a GRU/ })).toBeInTheDocument();
  });

  it('quando a pessoa filtra pela data e nada foi criado no período, então a janela diz e oferece limpar os filtros', async () => {
    // Dado
    montar(buscaQueDevolve([{ grupo: 'tarefas', itens: [{ ...gru, criadoEm: '2024-01-10T10:00:00-03:00' }], total: 1 }]));
    await userEvent.click(screen.getByRole('button', { name: 'Buscar em todo o SEMPER' }));
    await buscar('gru');
    // Quando
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Criado' }), 'nos últimos 30 dias');
    // Então
    expect(screen.getByText(/com estes filtros/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Limpar os filtros' }));
    expect(screen.getByRole('option', { name: /Emitir a GRU/ })).toBeInTheDocument();
  });

  it('dados resultados de datas diferentes, quando a pessoa escolhe "nos últimos 7 dias", então o recente fica, o antigo some e o "Ver todos" avisa que a página mostra todas as datas', async () => {
    // Dado
    const recente = { ...gru, id: 't1', titulo: 'Emitir a GRU recente', criadoEm: '2026-11-16T10:00:00-03:00' };
    const antiga = { ...gru, id: 't2', codigo: 'C0FFEE13', titulo: 'Emitir a GRU antiga', criadoEm: '2026-08-10T10:00:00-03:00' };
    montar(buscaQueDevolve([{ grupo: 'tarefas', itens: [recente, antiga], total: 9 }]));
    await userEvent.click(screen.getByRole('button', { name: 'Buscar em todo o SEMPER' }));
    await buscar('gru');
    expect(screen.getByRole('option', { name: /Ver todos em Tarefas/ })).toHaveTextContent('9 no total');
    // Quando
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Criado' }), 'nos últimos 7 dias');
    // Então
    expect(screen.getByRole('option', { name: /Emitir a GRU recente/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Emitir a GRU antiga/ })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Ver todos em Tarefas/ })).toHaveTextContent('Em todas as datas');
  });

  it('dado um cartão aberto (a página por trás travada), quando a busca abre e fecha, então a página continua travada', async () => {
    // Dado
    const soltarCartao = travarRolagem();
    montar();
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Buscar em todo o SEMPER' }));
    await userEvent.keyboard('{Escape}');
    // Então
    expect(screen.queryByRole('dialog', { name: 'Buscar em todo o SEMPER' })).not.toBeInTheDocument();
    expect(document.body).toHaveClass('sem-rolagem');
    soltarCartao();
    expect(document.body).not.toHaveClass('sem-rolagem');
  });

  it('dado o painel de filtros da página aberto, quando a pessoa aperta Ctrl+K e depois Esc, então o painel fecha, a busca fecha e o foco volta ao botão dos filtros', async () => {
    // Dado
    montar();
    await userEvent.click(screen.getByRole('button', { name: 'Filtros' }));
    expect(screen.getByRole('combobox', { name: 'Tipo' })).toHaveFocus();
    // Quando
    await userEvent.keyboard('{Control>}k{/Control}');
    // Então
    expect(await screen.findByRole('dialog', { name: 'Buscar em todo o SEMPER' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Filtros da página' })).not.toBeInTheDocument();
    expect(campo()).toHaveFocus();
    // Quando
    await userEvent.keyboard('{Escape}');
    // Então
    expect(screen.queryByRole('dialog', { name: 'Buscar em todo o SEMPER' })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Filtros' })).toHaveFocus());
  });

  it('quando a pessoa anda com as setas e aperta Enter, então abre o cartão do resultado escolhido e a janela fecha', async () => {
    // Dado
    montar();
    await userEvent.click(screen.getByRole('button', { name: 'Buscar em todo o SEMPER' }));
    await buscar('jose');
    expect(screen.getByRole('option', { name: /JOSÉ DA SILVA TESTE/, selected: true })).toHaveTextContent('Pessoa');
    // Quando
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    // Então
    const escolhida = screen.getByRole('option', { name: /Emitir a GRU/ });
    expect(escolhida).toHaveAttribute('aria-selected', 'true');
    expect(campo()).toHaveAttribute('aria-activedescendant', escolhida.id);
    // Quando
    await userEvent.keyboard('{Enter}');
    // Então
    expect(screen.getByRole('status', { name: 'Endereço' })).toHaveTextContent('/tarefas/?id=t1');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('quando a pessoa clica num resultado, então abre o cartão dele', async () => {
    // Dado
    montar();
    await userEvent.click(screen.getByRole('button', { name: 'Buscar em todo o SEMPER' }));
    await buscar('jose');
    // Quando
    await userEvent.click(screen.getByRole('option', { name: /0001234-97/ }));
    // Então
    expect(screen.getByRole('status', { name: 'Endereço' })).toHaveTextContent('/processos/judicial/?id=pr1');
  });

  it('dado um módulo com mais resultados do que a janela mostra, quando a pessoa escolhe "Ver todos", então vai à página dele com a busca preenchida', async () => {
    // Dado
    montar(buscaQueDevolve([{ grupo: 'pessoas', itens: [jose], total: 12 }]));
    await userEvent.click(screen.getByRole('button', { name: 'Buscar em todo o SEMPER' }));
    await buscar('silva');
    // Quando
    await userEvent.click(screen.getByRole('option', { name: /Ver todos em Pessoas/ }));
    // Então
    expect(screen.getByRole('status', { name: 'Endereço' })).toHaveTextContent('/pessoas/?busca=silva');
  });

  it('quando a pessoa aperta Esc, então a janela fecha e o foco volta ao botão que a abriu', async () => {
    // Dado
    montar();
    await userEvent.click(screen.getByRole('button', { name: 'Buscar em todo o SEMPER' }));
    // Quando
    await userEvent.keyboard('{Escape}');
    // Então
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Buscar em todo o SEMPER' })).toHaveFocus());
  });

  it('quando nada é achado, então a janela diz o que foi buscado e dá uma dica', async () => {
    // Dado
    montar(buscaQueDevolve([]));
    await userEvent.click(screen.getByRole('button', { name: 'Buscar em todo o SEMPER' }));
    // Quando
    await userEvent.type(campo(), 'zzzz');
    // Então
    expect(await screen.findByText(/Nada encontrado para/)).toHaveTextContent('Nada encontrado para “zzzz”.');
    expect(screen.getByText(/Só aparecem os itens ativos a que você tem acesso/)).toBeInTheDocument();
    expect(within(screen.getByRole('dialog')).getByRole('status')).toHaveTextContent('Nada encontrado.');
  });

  it('quando a pessoa digita um CPF com pontuação, então a janela confirma que entendeu um CPF', async () => {
    // Dado
    montar();
    await userEvent.click(screen.getByRole('button', { name: 'Buscar em todo o SEMPER' }));
    // Quando
    await userEvent.type(campo(), '529.982.247-25');
    // Então
    expect(campo()).toHaveAccessibleDescription('CPF 529.982.247-25');
  });

  it('dado um item de que a pessoa não faz parte (#363), quando ela busca o código exato, então ele aparece só com o tipo e o código, e não abre', async () => {
    // Dado
    const alheio: ItemSemAcesso = { tipo: 'semAcesso', grupo: 'tarefas', id: 'x', codigo: 'BEEF0001' };
    montar(buscaQueDevolve([{ grupo: 'tarefas', itens: [], total: 0 }], [alheio]));
    await userEvent.click(screen.getByRole('button', { name: 'Buscar em todo o SEMPER' }));
    await buscar('BEEF0001');
    // Quando
    const linha = screen.getByRole('option', { name: /BEEF0001/ });
    await userEvent.click(linha);
    // Então
    expect(linha).toHaveTextContent('Tarefa BEEF0001Você não faz parte deste item.');
    expect(linha).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('status', { name: 'Endereço' })).toHaveTextContent('/inicio/');
  });
});
