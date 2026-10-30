// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DadosSessao } from '../dados';
import { PainelCartao, PREFERENCIA_FORMATO } from './PainelCartao';
import { iniciarPreferencias } from './preferencias';

// O painel só grava a preferência do formato; o mock declara exatamente essa operação.
const { salvarPreferencia } = vi.hoisted(() => ({ salvarPreferencia: vi.fn<DadosSessao['salvarPreferencia']>() }));
vi.mock('../dados', () => ({ SD: { salvarPreferencia } satisfies Pick<DadosSessao, 'salvarPreferencia'> }));

function abrir() {
  const aoFechar = vi.fn();
  render(<PainelCartao aoFechar={aoFechar}><h2>JOSÉ DA SILVA TESTE</h2></PainelCartao>);
  return aoFechar;
}

describe('Formato do cartão', () => {
  beforeEach(() => { iniciarPreferencias({}); salvarPreferencia.mockReset(); salvarPreferencia.mockResolvedValue(); });

  it('quando a pessoa nunca escolheu, então o cartão abre ao lado, com o botão para abrir no centro', () => {
    // Quando
    abrir();
    // Então
    expect(screen.getByRole('dialog')).toHaveTextContent('JOSÉ DA SILVA TESTE');
    expect(screen.getByRole('button', { name: 'Abrir no centro da tela' })).toBeInTheDocument();
  });

  it('quando a pessoa clica em "Abrir no centro da tela", então o cartão muda e a escolha fica guardada', async () => {
    // Dado
    abrir();
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Abrir no centro da tela' }));
    // Então
    expect(screen.getByRole('button', { name: 'Abrir ao lado' })).toBeInTheDocument();
    expect(salvarPreferencia).toHaveBeenCalledWith(PREFERENCIA_FORMATO, 'centro');
  });

  it('dado que a pessoa escolheu o centro, quando abre o próximo cartão, então ele já abre no centro', () => {
    // Dado
    iniciarPreferencias({ [PREFERENCIA_FORMATO]: 'centro' });
    // Quando
    abrir();
    // Então
    expect(screen.getByRole('button', { name: 'Abrir ao lado' })).toBeInTheDocument();
  });

  it('quando a preferência guardada não é um formato conhecido, então o cartão abre ao lado', () => {
    // Dado
    iniciarPreferencias({ [PREFERENCIA_FORMATO]: 'flutuante' });
    // Quando
    abrir();
    // Então
    expect(screen.getByRole('button', { name: 'Abrir no centro da tela' })).toBeInTheDocument();
  });

  it.each([['lado'], ['centro']])('dado o cartão %s, quando a pessoa aperta Esc, então ele fecha', async formato => {
    // Dado
    iniciarPreferencias({ [PREFERENCIA_FORMATO]: formato });
    const aoFechar = abrir();
    // Quando
    await userEvent.keyboard('{Escape}');
    // Então
    expect(aoFechar).toHaveBeenCalledOnce();
  });
});

describe('Janela do cadastro novo', () => {
  beforeEach(() => { iniciarPreferencias({ [PREFERENCIA_FORMATO]: 'lado' }); });

  it('quando abre, então fica no centro mesmo para quem prefere o cartão ao lado, sem o botão de trocar', () => {
    // Quando
    render(<PainelCartao soNoCentro aoFechar={() => {}}><h1>Nova pessoa</h1></PainelCartao>);
    // Então
    expect(screen.getByRole('dialog')).toHaveClass('centro');
    expect(screen.queryByRole('button', { name: /Abrir/ })).not.toBeInTheDocument();
  });

  it('quando a pessoa clica fora, então não fecha (perderia o que digitou); o X fecha', async () => {
    // Dado
    const aoFechar = vi.fn();
    render(<PainelCartao soNoCentro aoFechar={aoFechar}><h1>Nova pessoa</h1></PainelCartao>);
    // Quando: o clique cai no véu, o fundo escurecido logo antes da janela
    await userEvent.click(screen.getByRole('dialog').previousElementSibling!);
    const depoisDoClique = aoFechar.mock.calls.length;
    await userEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    // Então
    expect(depoisDoClique).toBe(0);
    expect(aoFechar).toHaveBeenCalledOnce();
  });
});
