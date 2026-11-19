// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// O "+ Novo…" da seção "Ligada a" da anotação (#376): o menu com um item por módulo ligado no escritório (as pessoas sempre, o
// processo nunca), cada um abrindo o cadastro com a anotação de origem; e, na anotação nova, o botão que espera ela ir ao banco.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { ItemDaAnotacao, ModuloDaAnotacao } from '../dados';
import { NOVO_ESPERA_A_ANOTACAO } from '../regras/novoNaAnotacao';
import { NovoNaAnotacao } from './NovoNaAnotacao';

/** Onde a tela foi parar, para conferir o endereço do cadastro aberto. */
function Destino() {
  const l = useLocation();
  return <p>Foi para {l.pathname}{l.search}</p>;
}

type Itens = Pick<ItemDaAnotacao, 'modulo' | 'id' | 'arquivado_em'>[];
function abrir(modulos: ModuloDaAnotacao[], anotacaoId: string | null, itens: Itens = []) {
  const roteador = createMemoryRouter([
    { path: '/', element: <NovoNaAnotacao modulos={modulos} anotacaoId={anotacaoId} itens={itens} /> },
    { path: '*', element: <Destino /> }
  ]);
  render(<RouterProvider router={roteador} />);
}
const TODOS: ModuloDaAnotacao[] = ['pessoas', 'processos', 'contratos', 'demandas', 'tarefas', 'compromissos'];

describe('O "+ Novo…" da anotação gravada', () => {
  it('dado o escritório com todos os módulos, quando a pessoa abre o menu, então há Tarefa, Demanda, Compromisso, Pessoa e Contrato, sem Processo', async () => {
    // Dado
    abrir(TODOS, 'an1');
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Novo…' }));
    // Então
    const menu = screen.getByRole('menu', { name: 'Novo item ligado a esta anotação' });
    expect(menu).toBeInTheDocument();
    expect(screen.getAllByRole('menuitem').map(b => b.textContent?.trim())).toEqual(['Tarefa', 'Demanda', 'Compromisso', 'Pessoa', 'Contrato']);
  });

  it('dado o escritório sem Demandas, quando a pessoa abre o menu, então Demanda não aparece, e Pessoa sim', async () => {
    // Dado
    abrir(['pessoas', 'tarefas'], 'an1');
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Novo…' }));
    // Então
    expect(screen.getAllByRole('menuitem').map(b => b.textContent?.trim())).toEqual(['Tarefa', 'Pessoa']);
  });

  it('dada a anotação com uma pessoa só, quando a pessoa escolhe Demanda, então abre o cadastro de demanda com a anotação e a pessoa como cliente', async () => {
    // Dado
    abrir(TODOS, 'an1', [{ modulo: 'pessoas', id: 'p1', arquivado_em: null }]);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Novo…' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Demanda' }));
    // Então
    expect(await screen.findByText('Foi para /demandas/nova/?anotacao=an1&cliente=p1')).toBeInTheDocument();
  });

  it('quando a pessoa escolhe Pessoa, então abre o cadastro de pessoa com a anotação de origem', async () => {
    // Dado
    abrir(TODOS, 'an1');
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Novo…' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Pessoa' }));
    // Então
    expect(await screen.findByText('Foi para /pessoas/nova/?anotacao=an1')).toBeInTheDocument();
  });

  it('dado o menu aberto, quando a pessoa aperta Esc, então ele fecha e o foco volta ao botão', async () => {
    // Dado
    abrir(TODOS, 'an1');
    const botao = screen.getByRole('button', { name: 'Novo…' });
    await userEvent.click(botao);
    // Quando
    await userEvent.keyboard('{Escape}');
    // Então
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(botao).toHaveFocus();
    expect(botao).toHaveAttribute('aria-expanded', 'false');
  });

  it('dado só o processo para ligar, quando o botão seria mostrado, então ele não aparece (não há o que criar)', () => {
    // Dado / Quando
    abrir(['processos'], 'an1');
    // Então
    expect(screen.queryByRole('button', { name: 'Novo…' })).not.toBeInTheDocument();
  });
});

describe('O "+ Novo…" da anotação nova, ainda sem ir ao banco', () => {
  it('quando a pessoa clica nele, então nada abre: ele está desligado, no Tab, com o motivo para o leitor de tela', async () => {
    // Dado
    abrir(TODOS, null);
    const botao = screen.getByRole('button', { name: 'Novo…' });
    // Quando
    await userEvent.click(botao);
    // Então
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(botao).toHaveAttribute('aria-disabled', 'true');
    expect(botao).toHaveAccessibleDescription(NOVO_ESPERA_A_ANOTACAO);
    expect(botao).not.toBeDisabled();
  });
});
