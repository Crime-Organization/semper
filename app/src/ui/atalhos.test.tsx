// @vitest-environment jsdom
// Os atalhos de teclado da página de módulo (#86) e a ajuda da tela (#85). Padrão Dado / Quando / Então: veja app/TESTES.md.
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ligarAtalhos } from './atalhos';
import { Janelas } from './janela';
import { PaginaModulo, type AcaoPrincipal } from './PaginaModulo';

/** Mostra o endereço atual, para conferir aonde o "N" levou. */
function Endereco() {
  const l = useLocation();
  return <output aria-label="Endereço">{l.pathname + l.search}</output>;
}

const NOVA_PESSOA: AcaoPrincipal = { rotulo: 'Nova pessoa', para: '/pessoas/nova/' };

/** A explicação da tela, como as de regras/ajuda.ts. */
const AJUDA_DE_TESTE = ['Aqui ficam as pessoas.', 'Clique no nome para abrir o cartão.', 'Arraste no Kanban.'];

function montar({ comNovo = true, comBusca = true, porCima = false, acao = NOVA_PESSOA, ajuda }: { comNovo?: boolean; comBusca?: boolean; porCima?: boolean; acao?: AcaoPrincipal; ajuda?: readonly string[] } = {}) {
  render(<MemoryRouter initialEntries={['/pessoas/']}>
    <PaginaModulo titulo="Pessoas" ajuda={ajuda} acao={comNovo ? acao : undefined}
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
  // A preferência é da pessoa e vale para o sistema todo: cada teste começa com os atalhos ligados, como vêm.
  afterEach(() => { ligarAtalhos(true); });

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
    expect(lista).toHaveTextContent('Mostrar esta ajuda');
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

  it('dada a ação principal que abre algo na própria página (a Nova entrada do Financeiro), quando a pessoa aperta "N", então faz o mesmo que o botão', async () => {
    // Dado
    const aoClicar = vi.fn();
    montar({ acao: { rotulo: 'Nova entrada', aoClicar } });
    const botao = screen.getByRole('button', { name: 'Nova entrada' });
    expect(botao).toHaveAttribute('title', 'Nova entrada (N)');
    expect(botao).toHaveAttribute('aria-keyshortcuts', 'N');
    // Quando
    await userEvent.keyboard('n');
    // Então
    expect(aoClicar).toHaveBeenCalledTimes(1);
    expect(endereco()).toHaveTextContent(/^\/pessoas\/$/);
    // Quando
    await userEvent.click(botao);
    // Então
    expect(aoClicar).toHaveBeenCalledTimes(2);
  });

  it('dada a ação principal por clique, quando a pessoa aperta "?", então a lista mostra o "N" com o nome dela', async () => {
    // Dado
    montar({ acao: { rotulo: 'Nova entrada', aoClicar: vi.fn() } });
    // Quando
    await userEvent.keyboard('?');
    // Então
    const lista = await screen.findByRole('dialog', { name: 'Atalhos do teclado' });
    expect(within(lista).getByRole('region', { name: 'Nesta página' })).toHaveTextContent('Nova entrada');
    await fecharALista(lista);
  });

  it('dado o teclado ABNT2 sem a tecla "/ ?", quando a pessoa aperta AltGr+Q (a barra, que chega como Ctrl+Alt), então o cursor vai para a busca', () => {
    // Dado
    montar();
    // Quando
    fireEvent.keyDown(document.body, { key: '/', ctrlKey: true, altKey: true, modifierAltGraph: true });
    // Então
    expect(screen.getByRole('searchbox')).toHaveFocus();
  });

  it('dados os atalhos de uma tecla desligados pela pessoa, quando ela aperta "/", "N" e "?", então nada acontece e a dica não os promete', async () => {
    // Dado
    ligarAtalhos(false);
    montar();
    // Quando
    await userEvent.keyboard('/n?');
    // Então
    expect(endereco()).toHaveTextContent(/^\/pessoas\/$/);
    expect(screen.getByRole('searchbox')).not.toHaveFocus();
    expect(screen.queryByRole('dialog', { name: 'Atalhos do teclado' })).not.toBeInTheDocument();
    const novo = screen.getByRole('link', { name: 'Nova pessoa' });
    expect(novo).toHaveAttribute('title', 'Nova pessoa');
    expect(novo).not.toHaveAttribute('aria-keyshortcuts');
    expect(screen.getByRole('searchbox')).not.toHaveAttribute('aria-keyshortcuts');
  });

  it('dada a lista do "?", quando a pessoa desmarca "Atalhos de uma tecla só", então o "N" deixa de abrir o cadastro', async () => {
    // Dado
    montar();
    await userEvent.keyboard('?');
    const lista = await screen.findByRole('dialog', { name: 'Atalhos do teclado' });
    // Quando
    await userEvent.click(within(lista).getByRole('checkbox', { name: /Atalhos de uma tecla só/ }));
    await fecharALista(lista);
    await userEvent.keyboard('n');
    // Então
    expect(endereco()).toHaveTextContent(/^\/pessoas\/$/);
    expect(screen.getByRole('link', { name: 'Nova pessoa' })).toHaveAttribute('title', 'Nova pessoa');
  });
});

describe('Página de módulo: a ajuda da tela (#85)', () => {
  afterEach(() => { ligarAtalhos(true); });

  it('dada a página sem texto de ajuda, quando ela abre, então não há botão "?" no cabeçalho', () => {
    // Quando
    montar();
    // Então
    expect(screen.queryByRole('button', { name: 'Ajuda desta tela' })).not.toBeInTheDocument();
  });

  it('dada a página com o texto de ajuda, quando a pessoa clica no "?", então abre a explicação da tela em cima e os atalhos embaixo', async () => {
    // Dado
    montar({ ajuda: AJUDA_DE_TESTE });
    const botao = screen.getByRole('button', { name: 'Ajuda desta tela' });
    expect(botao).toHaveAttribute('title', 'Ajuda desta tela (?)');
    expect(botao).toHaveAttribute('aria-keyshortcuts', '?');
    // Quando
    await userEvent.click(botao);
    // Então
    const ajuda = await screen.findByRole('dialog', { name: 'Ajuda: Pessoas' });
    AJUDA_DE_TESTE.forEach(t => expect(within(ajuda).getByText(t)).toBeVisible());
    const atalhos = within(ajuda).getByRole('region', { name: 'Atalhos do teclado' });
    expect(within(atalhos).getByRole('region', { name: 'Nesta página' })).toHaveTextContent('Nova pessoa');
    expect(within(atalhos).getByRole('heading', { level: 4, name: 'Em todo o SEMPER' })).toBeVisible();
    // A explicação vem antes dos atalhos.
    expect(within(ajuda).getByText(AJUDA_DE_TESTE[0]).compareDocumentPosition(atalhos) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await fecharALista(ajuda);
  });

  it('dada a página com o texto de ajuda, quando a pessoa aperta "?", então abre a mesma janela do botão', async () => {
    // Dado
    montar({ ajuda: AJUDA_DE_TESTE });
    // Quando
    await userEvent.keyboard('?');
    // Então
    const ajuda = await screen.findByRole('dialog', { name: 'Ajuda: Pessoas' });
    expect(ajuda).toHaveTextContent(AJUDA_DE_TESTE[1]);
    expect(ajuda).toHaveTextContent('Mostrar esta ajuda');
    await fecharALista(ajuda);
  });

  it('dada a ajuda aberta, quando a pessoa aperta Esc, então ela fecha', async () => {
    // Dado
    montar({ ajuda: AJUDA_DE_TESTE });
    await userEvent.click(screen.getByRole('button', { name: 'Ajuda desta tela' }));
    const ajuda = await screen.findByRole('dialog', { name: 'Ajuda: Pessoas' });
    // Quando
    await userEvent.keyboard('{Escape}');
    // Então
    expect(ajuda).not.toBeInTheDocument();
  });

  it('dada a ajuda aberta, quando a pessoa clica fora dela, então ela fecha', async () => {
    // Dado
    montar({ ajuda: AJUDA_DE_TESTE });
    await userEvent.click(screen.getByRole('button', { name: 'Ajuda desta tela' }));
    const ajuda = await screen.findByRole('dialog', { name: 'Ajuda: Pessoas' });
    // Quando: o clique cai no véu escuro em volta da janela
    await userEvent.click(ajuda.parentElement!);
    // Então
    expect(ajuda).not.toBeInTheDocument();
  });

  it('dados os atalhos de uma tecla desligados, quando a pessoa clica no "?", então a ajuda abre mesmo assim (e o "?" do teclado não)', async () => {
    // Dado
    ligarAtalhos(false);
    montar({ ajuda: AJUDA_DE_TESTE });
    await userEvent.keyboard('?');
    expect(screen.queryByRole('dialog', { name: 'Ajuda: Pessoas' })).not.toBeInTheDocument();
    const botao = screen.getByRole('button', { name: 'Ajuda desta tela' });
    expect(botao).not.toHaveAttribute('aria-keyshortcuts');
    // Quando
    await userEvent.click(botao);
    // Então
    const ajuda = await screen.findByRole('dialog', { name: 'Ajuda: Pessoas' });
    expect(within(ajuda).getByRole('checkbox', { name: /Atalhos de uma tecla só/ })).not.toBeChecked();
    await fecharALista(ajuda);
  });
});
