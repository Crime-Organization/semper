// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { problemasDasNovidades, type VersaoComNovidades } from '../regras/novidades';

// As janelas abertas e as preferências são do sistema todo: cada caso recarrega os módulos para começar do zero.
let Janelas: typeof import('./janela').Janelas;
let novidades: typeof import('./Novidades');
let preferencias: typeof import('./preferencias');
beforeEach(async () => {
  vi.resetModules();
  ({ Janelas } = await import('./janela'));
  novidades = await import('./Novidades');
  preferencias = await import('./preferencias');
});

const VERSOES_DE_EXEMPLO: VersaoComNovidades[] = [
  { versao: 'v1.31.0', data: '2026-12-01', novidades: [
    { arquivo: 'v1.31.0/342-pastas.json', titulo: 'Pastas', texto: 'Anotações em pastas.', ondeAchar: 'Em Documentos, na árvore de pastas.' },
    { arquivo: 'v1.31.0/343-etiquetas.json', titulo: 'Etiquetas', texto: 'Etiquetas nas anotações.', ondeAchar: 'No círculo à esquerda do título.', link: { rotulo: 'Como usar', endereco: 'https://semper.app.br/ajuda' } }
  ] },
  { versao: 'v1.30.0', data: '2026-11-18', novidades: [{ arquivo: 'v1.30.0/353-novidades.json', titulo: 'Novidades', texto: 'Esta lista.', ondeAchar: 'No menu lateral.' }] }
];
const botao = () => screen.getByRole('button', { name: /^Novidades/ });

describe('Arquivos de novidades do repositório', () => {
  it('dados os arquivos de app/novidades, quando confere, então todos estão certos (título, texto e onde achar em cada novidade, e a data em cada versão)', () => {
    // Quando / Então
    expect(problemasDasNovidades(novidades.ARQUIVOS_DE_NOVIDADES)).toEqual([]);
  });

  it('dada a lista montada, quando olha as versões, então há no máximo uma próxima versão e ela vem primeiro', () => {
    // Quando
    const { VERSOES } = novidades;
    const semNumero = VERSOES.filter(v => v.versao === null);
    // Então
    expect(VERSOES.length).toBeGreaterThan(0);
    expect(semNumero.length).toBeLessThanOrEqual(1);
    expect(VERSOES.findIndex(v => v.versao === null)).toBeLessThanOrEqual(0);
  });
});

describe('Botão Novidades', () => {
  it('dado alguém que nunca abriu as novidades, quando vê o botão, então ele avisa que há novidade não vista', () => {
    // Quando
    render(<novidades.BotaoNovidades versoes={VERSOES_DE_EXEMPLO} />);
    // Então
    expect(botao()).toHaveAccessibleName('Novidades: há novidades que você ainda não viu');
  });

  it('dado o botão com o ponto, quando a pessoa abre, então vê as versões da mais nova para a mais antiga, com data, título, texto e onde achar', async () => {
    // Dado
    render(<><novidades.BotaoNovidades versoes={VERSOES_DE_EXEMPLO} /><Janelas /></>);
    // Quando
    await userEvent.click(botao());
    // Então
    const lista = screen.getByRole('dialog', { name: 'Novidades' });
    const versoes = within(lista).getAllByRole('heading', { level: 3 }).map(h => h.textContent);
    expect(versoes).toEqual(['v1.31.0 1º de dezembro de 2026', 'v1.30.0 18 de novembro de 2026']);
    const primeira = within(lista).getByRole('listitem', { name: /v1\.31\.0/ });
    expect(within(primeira).getAllByRole('heading', { level: 4 }).map(h => h.textContent)).toEqual(['Pastas', 'Etiquetas']);
    expect(primeira).toHaveTextContent('Anotações em pastas.');
    expect(primeira).toHaveTextContent('Em Documentos, na árvore de pastas.');
    expect(within(primeira).getByRole('link', { name: 'Como usar' })).toHaveAttribute('href', 'https://semper.app.br/ajuda');
  });

  it('dado o botão com o ponto, quando a pessoa abre e fecha com Esc, então o ponto some, a versão vista fica guardada e o foco volta ao botão', async () => {
    // Dado
    render(<><novidades.BotaoNovidades versoes={VERSOES_DE_EXEMPLO} /><Janelas /></>);
    await userEvent.click(botao());
    // Quando
    await userEvent.keyboard('{Escape}');
    // Então
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(botao()).toHaveAccessibleName('Novidades');
    expect(botao()).toHaveFocus();
    expect(preferencias.lerPreferencia(novidades.PREFERENCIA_NOVIDADES, null)).toBe('v1.31.0');
  });

  it('dado alguém que já viu a versão mais nova, quando vê o botão, então não há ponto', () => {
    // Dado
    preferencias.iniciarPreferencias({ [novidades.PREFERENCIA_NOVIDADES]: 'v1.31.0' });
    // Quando
    render(<novidades.BotaoNovidades versoes={VERSOES_DE_EXEMPLO} />);
    // Então
    expect(botao()).toHaveAccessibleName('Novidades');
  });

  it('dado o botão só com o ícone (a barra do topo do celular), quando a pessoa o vê, então ele tem nome mesmo sem texto e avisa do ponto', () => {
    // Quando
    render(<novidades.BotaoNovidades versoes={VERSOES_DE_EXEMPLO} soIcone />);
    // Então
    expect(botao()).toHaveAccessibleName('Novidades: há novidades que você ainda não viu');
    expect(botao()).not.toHaveTextContent('Novidades');
  });

  it('dados os dois botões (menu lateral e topo do celular), quando a pessoa abre por um, então o ponto some dos dois', async () => {
    // Dado
    render(<><nav aria-label="Conta"><novidades.BotaoNovidades versoes={VERSOES_DE_EXEMPLO} /></nav>
      <header><novidades.BotaoNovidades versoes={VERSOES_DE_EXEMPLO} soIcone /></header><Janelas /></>);
    const doTopo = within(screen.getByRole('banner')).getByRole('button');
    const doMenu = within(screen.getByRole('navigation', { name: 'Conta' })).getByRole('button');
    // Quando
    await userEvent.click(doTopo);
    await userEvent.keyboard('{Escape}');
    // Então
    expect(doTopo).toHaveAccessibleName('Novidades');
    expect(doMenu).toHaveAccessibleName('Novidades');
  });

  it('dada uma lista sem nenhuma versão, quando a pessoa abre, então vê que ainda não há novidades', async () => {
    // Dado
    render(<><novidades.BotaoNovidades versoes={[]} /><Janelas /></>);
    // Quando
    await userEvent.click(botao());
    // Então
    expect(screen.getByRole('dialog', { name: 'Novidades' })).toHaveTextContent('Ainda não há novidades.');
  });
});
