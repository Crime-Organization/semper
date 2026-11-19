// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { iniciarPreferencias, lerPreferencia } from './preferencias';
import { GrupoDeSecoes, Recolhivel } from './Recolhivel';

describe('Seção recolhível', () => {
  it('quando começa fechada, então só o título aparece', () => {
    // Quando
    render(<Recolhivel titulo="Vínculos" icone="vinculo" contador={2}><p>João é cônjuge</p></Recolhivel>);
    // Então
    expect(screen.getByRole('button', { name: /Vínculos/ })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: /Vínculos/ })).toHaveTextContent('2');
    expect(screen.queryByText('João é cônjuge')).not.toBeInTheDocument();
  });

  it('quando a pessoa clica no título, então o conteúdo aparece', async () => {
    // Dado
    render(<Recolhivel titulo="Vínculos" icone="vinculo"><p>João é cônjuge</p></Recolhivel>);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Vínculos' }));
    // Então
    expect(screen.getByRole('button', { name: 'Vínculos' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('João é cônjuge')).toBeInTheDocument();
  });

  it('quando a pessoa usa o teclado (Tab e Enter), então abre e fecha do mesmo jeito', async () => {
    // Dado
    render(<Recolhivel titulo="Vínculos" icone="vinculo"><p>João é cônjuge</p></Recolhivel>);
    await userEvent.tab();
    // Quando
    await userEvent.keyboard('{Enter}');
    const depoisDeAbrir = screen.getByRole('button', { name: 'Vínculos' }).getAttribute('aria-expanded');
    await userEvent.keyboard('{Enter}');
    // Então
    expect(depoisDeAbrir).toBe('true');
    expect(screen.getByRole('button', { name: 'Vínculos' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('João é cônjuge')).not.toBeInTheDocument();
  });

  it('quando o usuário nunca mexeu na seção, então ela começa recolhida; se já a abriu, começa aberta', () => {
    // Dado
    iniciarPreferencias({ 'teste.aberta': true });
    // Quando
    render(<>
      <Recolhivel titulo="Nunca mexida" icone="vinculo" preferencia="teste.nunca"><p>a</p></Recolhivel>
      <Recolhivel titulo="Já aberta" icone="vinculo" preferencia="teste.aberta"><p>b</p></Recolhivel>
    </>);
    // Então
    expect(screen.getByRole('button', { name: 'Nunca mexida' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: 'Já aberta' })).toHaveAttribute('aria-expanded', 'true');
  });
});

describe('Seção aberta por quem chegou com um destino', () => {
  it('dado a seção recolhida na preferência, quando pede para abrir ao iniciar, então aparece aberta e a preferência continua como estava', () => {
    // Dado
    iniciarPreferencias({ 'teste.fechada': false });
    // Quando
    render(<Recolhivel titulo="Comentários" icone="comentario" preferencia="teste.fechada" abertaAoIniciar><p>texto</p></Recolhivel>);
    // Então
    expect(screen.getByRole('button', { name: 'Comentários' })).toHaveAttribute('aria-expanded', 'true');
    expect(lerPreferencia('teste.fechada', false)).toBe(false);
  });
});

describe('O número ao lado do título', () => {
  it('dado uma seção conferida e vazia, quando aparece, então mostra 0 (para não confundir com "ainda não contou")', () => {
    // Quando
    render(<Recolhivel titulo="Tarefas" icone="tarefas" contador={0}><p>nada</p></Recolhivel>);
    // Então
    expect(screen.getByRole('button', { name: /^Tarefas\s?0$/ })).toBeInTheDocument();
  });

  it('dado uma seção que ainda não contou, quando aparece, então não mostra número', () => {
    // Quando
    render(<Recolhivel titulo="Tarefas" icone="tarefas"><p>nada</p></Recolhivel>);
    // Então
    expect(screen.getByRole('button', { name: 'Tarefas' })).toBeInTheDocument();
  });
});

describe('Um grupo dentro de outro (#360)', () => {
  it('dado um grupo que não é próprio, dentro do grupo do cartão, quando abre, então as seções dele entram no de fora: um botão só, que abre todas', async () => {
    // Dado
    render(<GrupoDeSecoes>
      <Recolhivel titulo="Dados" icone="lista"><p>Os dados</p></Recolhivel>
      <GrupoDeSecoes proprio={false}><Recolhivel titulo="Histórico" icone="relogio"><p>As mudanças</p></Recolhivel></GrupoDeSecoes>
    </GrupoDeSecoes>);
    // Então
    expect(screen.getAllByRole('button', { name: /^(Expandir|Recolher) tudo$/ })).toHaveLength(1);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Expandir tudo' }));
    // Então
    expect(screen.getByText('Os dados')).toBeInTheDocument();
    expect(screen.getByText('As mudanças')).toBeInTheDocument();
  });

  it('dado um grupo próprio dentro do do cartão, quando abre, então cada um tem o seu botão, que abre só as dele', async () => {
    // Dado
    render(<GrupoDeSecoes>
      <Recolhivel titulo="Dados" icone="lista"><p>Os dados</p></Recolhivel>
      <GrupoDeSecoes><Recolhivel titulo="Histórico" icone="relogio"><p>As mudanças</p></Recolhivel></GrupoDeSecoes>
    </GrupoDeSecoes>);
    const botoes = screen.getAllByRole('button', { name: 'Expandir tudo' });
    expect(botoes).toHaveLength(2);
    // Quando
    await userEvent.click(botoes[1]);
    // Então
    expect(screen.getByText('As mudanças')).toBeInTheDocument();
    expect(screen.queryByText('Os dados')).not.toBeInTheDocument();
  });
});
