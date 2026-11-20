// @vitest-environment jsdom
// Os atalhos de teclado da página de módulo (#86). Padrão Dado / Quando / Então: veja app/TESTES.md.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { Janelas } from './janela';
import { PaginaModulo } from './PaginaModulo';

/** Mostra o endereço atual, para conferir aonde o "N" levou. */
function Endereco() {
  const l = useLocation();
  return <output aria-label="Endereço">{l.pathname + l.search}</output>;
}

function montar({ comNovo = true, comBusca = true, porCima = false } = {}) {
  render(<MemoryRouter initialEntries={['/pessoas/']}>
    <PaginaModulo titulo="Pessoas" acao={comNovo ? { rotulo: 'Nova pessoa', para: '/pessoas/nova/' } : undefined}
      busca={comBusca ? { placeholder: 'Buscar nome', aoBuscar: vi.fn() } : undefined}>
      <input type="checkbox" aria-label="Marcar a linha" />
      <textarea aria-label="Comentário" />
    </PaginaModulo>
    {/* O cartão aberto por cima da página. */}
    {porCima && <aside role="dialog" aria-label="Cartão"><button type="button">Fechar</button></aside>}
    <Endereco />
    <Janelas />
  </MemoryRouter>);
}
/** As janelas ficam numa lista do sistema todo: a do teste fecha no fim dele, para não passar ao seguinte. */
const fecharALista = (lista: HTMLElement) => userEvent.click(within(lista).getByRole('button', { name: 'Fechar' }));
const endereco = () => screen.getByRole('status', { name: 'Endereço' });

describe('Página de módulo: os atalhos do teclado', () => {
  it('dada a página, quando a pessoa aperta "/", então o cursor vai para a busca, sem a barra entrar nela', async () => {
    // Dado
    montar();
    // Quando
    await userEvent.keyboard('/');
    // Então
    expect(screen.getByRole('searchbox')).toHaveFocus();
    expect(screen.getByRole('searchbox')).toHaveValue('');
  });

  it('dada a página, quando a pessoa aperta "N", então abre o "Novo" do módulo', async () => {
    // Dado
    montar();
    // Quando
    await userEvent.keyboard('n');
    // Então
    expect(endereco()).toHaveTextContent('/pessoas/nova/');
  });

  it('dada a linha da tabela marcada (o foco na caixa de marcar), quando a pessoa aperta "N", então o atalho vale', async () => {
    // Dado
    montar();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Marcar a linha' }));
    // Quando
    await userEvent.keyboard('n');
    // Então
    expect(endereco()).toHaveTextContent('/pessoas/nova/');
  });

  it('dado o foco na busca ou numa área de texto, quando a pessoa digita "/" e "N", então as letras entram e nenhum atalho dispara', async () => {
    // Dado
    montar();
    // Quando
    await userEvent.type(screen.getByRole('searchbox'), 'n/');
    await userEvent.type(screen.getByRole('textbox', { name: 'Comentário' }), 'N?');
    // Então
    expect(screen.getByRole('searchbox')).toHaveValue('n/');
    expect(screen.getByRole('textbox', { name: 'Comentário' })).toHaveValue('N?');
    expect(endereco()).toHaveTextContent(/^\/pessoas\/$/);
    expect(screen.queryByRole('dialog', { name: 'Atalhos do teclado' })).not.toBeInTheDocument();
  });

  it('dado o cartão aberto por cima da página, quando a pessoa aperta "N", então nenhum item novo abre por trás dele', async () => {
    // Dado
    montar({ porCima: true });
    // Quando
    await userEvent.keyboard('n/');
    // Então
    expect(endereco()).toHaveTextContent(/^\/pessoas\/$/);
    expect(screen.getByRole('searchbox')).not.toHaveFocus();
  });

  it('dado Ctrl apertado, quando a pessoa aperta "N", então o atalho não dispara (fica para o navegador)', async () => {
    // Dado
    montar();
    // Quando
    await userEvent.keyboard('{Control>}n{/Control}');
    // Então
    expect(endereco()).toHaveTextContent(/^\/pessoas\/$/);
  });

  it('dada a página, quando a pessoa aperta "?", então a janela lista os atalhos, com o nome do "Novo" do módulo', async () => {
    // Dado
    montar();
    // Quando
    await userEvent.keyboard('?');
    // Então
    const lista = await screen.findByRole('dialog', { name: 'Atalhos do teclado' });
    expect(lista).toHaveTextContent('Ir para a busca desta página');
    expect(lista).toHaveTextContent('Nova pessoa');
    expect(lista).toHaveTextContent('Buscar em todo o SEMPER');
    await fecharALista(lista);
  });

  it('dada a página sem "Novo" nem busca, quando a pessoa aperta "N" e "?", então nada abre além da lista, que não promete "N" nem "/"', async () => {
    // Dado
    montar({ comNovo: false, comBusca: false });
    // Quando
    await userEvent.keyboard('n?');
    // Então
    expect(endereco()).toHaveTextContent(/^\/pessoas\/$/);
    const lista = await screen.findByRole('dialog', { name: 'Atalhos do teclado' });
    expect(lista).not.toHaveTextContent('Ir para a busca desta página');
    expect(lista).toHaveTextContent('Mostrar esta lista de atalhos');
    await fecharALista(lista);
  });

  it('dado o botão "Nova pessoa" e a busca, quando a pessoa para o mouse neles, então a dica mostra o atalho', () => {
    // Quando
    montar();
    // Então
    const novo = screen.getByRole('link', { name: 'Nova pessoa' });
    expect(novo).toHaveAttribute('title', 'Nova pessoa (N)');
    expect(novo).toHaveAttribute('aria-keyshortcuts', 'N');
    expect(screen.getByRole('searchbox')).toHaveAttribute('title', 'Buscar (/)');
  });
});
