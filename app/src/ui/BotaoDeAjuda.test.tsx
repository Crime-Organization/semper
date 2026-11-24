// @vitest-environment jsdom
// O "?" da ajuda nas telas que não são de módulo (#411). Padrão Dado / Quando / Então: veja app/TESTES.md.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AJUDA_DAS_TELAS } from '../regras/ajuda';
import { ligarAtalhos } from './atalhos';
import { BotaoDeAjuda, TituloComAjuda, useAjudaDaTela } from './BotaoDeAjuda';
import { Janelas } from './janela';

/** As janelas ficam numa lista do sistema todo: a do teste fecha no fim dele, para não passar ao seguinte. */
const fechar = (janela: HTMLElement) => userEvent.click(within(janela).getByRole('button', { name: 'Fechar' }));

/** Uma tela com o "N" dela, como o Financeiro. */
function TelaComNovo({ aoNovo }: { aoNovo: () => void }) {
  const abrir = useAjudaDaTela('financeiroDireitos', { rotulo: 'Nova entrada', abrir: aoNovo });
  return <BotaoDeAjuda aoAbrir={abrir} />;
}

describe('A ajuda das telas que não são de módulo (#411)', () => {
  // A preferência é da pessoa e vale para o sistema todo: cada teste começa com os atalhos ligados, como vêm.
  afterEach(() => { ligarAtalhos(true); });

  it('dado o título de Minha conta, quando a pessoa clica no "?", então abre a ajuda da tela com a explicação e os atalhos', async () => {
    // Dado
    render(<><TituloComAjuda tela="minhaConta" /><Janelas /></>);
    expect(screen.getByRole('heading', { level: 1, name: 'Minha conta.' })).toBeInTheDocument();
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Ajuda desta tela' }));
    // Então
    const ajuda = await screen.findByRole('dialog', { name: 'Ajuda: Minha conta' });
    for (const paragrafo of AJUDA_DAS_TELAS.minhaConta.textos) expect(ajuda).toHaveTextContent(paragrafo);
    const atalhos = within(ajuda).getByRole('region', { name: 'Atalhos do teclado' });
    expect(within(atalhos).getByRole('region', { name: 'Nesta página' })).toHaveTextContent('Mostrar esta ajuda');
    expect(within(atalhos).getByRole('region', { name: 'Nesta página' })).not.toHaveTextContent('Ir para a busca desta página');
    await fechar(ajuda);
  });

  it('dado o título de Configurações, quando a pessoa aperta "?", então abre a mesma janela do botão', async () => {
    // Dado
    render(<><TituloComAjuda tela="configuracoes" /><Janelas /></>);
    // Quando
    await userEvent.keyboard('?');
    // Então
    const ajuda = await screen.findByRole('dialog', { name: 'Ajuda: Configurações' });
    expect(ajuda).toHaveTextContent(AJUDA_DAS_TELAS.configuracoes.textos[0]);
    await fechar(ajuda);
  });

  it('dado o título com outro texto (o nome da pessoa no perfil), quando a ajuda abre, então a janela tem o título da tela', async () => {
    // Dado
    render(<><TituloComAjuda tela="perfilDaEquipe">Fulana de Teste</TituloComAjuda><Janelas /></>);
    expect(screen.getByRole('heading', { level: 1, name: 'Fulana de Teste.' })).toBeInTheDocument();
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Ajuda desta tela' }));
    // Então
    const ajuda = await screen.findByRole('dialog', { name: 'Ajuda: Perfil profissional' });
    expect(ajuda).toHaveTextContent(AJUDA_DAS_TELAS.perfilDaEquipe.textos[0]);
    await fechar(ajuda);
  });

  it('dada a tela com o "N" dela, quando a pessoa aperta "?" e depois "N", então a ajuda lista o "N" e ele faz o "Novo" da tela', async () => {
    // Dado
    const aoNovo = vi.fn();
    render(<><TelaComNovo aoNovo={aoNovo} /><Janelas /></>);
    // Quando
    await userEvent.keyboard('?');
    // Então
    const ajuda = await screen.findByRole('dialog', { name: 'Ajuda: Financeiro (Direitos)' });
    expect(within(ajuda).getByRole('region', { name: 'Nesta página' })).toHaveTextContent('Nova entrada');
    // Quando
    await fechar(ajuda);
    await userEvent.keyboard('n');
    // Então
    expect(aoNovo).toHaveBeenCalledTimes(1);
  });

  it('dados os atalhos desligados, quando a pessoa aperta "?", então nada abre, e o botão continua abrindo a ajuda, sem prometer a tecla', async () => {
    // Dado
    ligarAtalhos(false);
    render(<><TituloComAjuda tela="equipe" /><Janelas /></>);
    const botao = screen.getByRole('button', { name: 'Ajuda desta tela' });
    expect(botao).not.toHaveAttribute('aria-keyshortcuts');
    expect(botao).toHaveAttribute('title', 'Ajuda desta tela');
    // Quando
    await userEvent.keyboard('?');
    // Então
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    // Quando
    await userEvent.click(botao);
    // Então
    const ajuda = await screen.findByRole('dialog', { name: 'Ajuda: Equipe e acessos' });
    await fechar(ajuda);
  });

  it('dados os atalhos ligados, quando a pessoa para o mouse no "?", então a dica mostra a tecla', () => {
    // Quando
    render(<TituloComAjuda tela="mensagens" />);
    // Então
    const botao = screen.getByRole('button', { name: 'Ajuda desta tela' });
    expect(botao).toHaveAttribute('title', 'Ajuda desta tela (?)');
    expect(botao).toHaveAttribute('aria-keyshortcuts', '?');
  });
});
