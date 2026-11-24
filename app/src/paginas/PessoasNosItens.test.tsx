// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// O "+ Nova pessoa" das seções Clientes e Pessoas do cartão (#376): os dois atalhos, com as mesmas condições do "Ligar … existente".
// E a pergunta do papel de quem entra como cliente do processo (#426).
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { CLIENTES_MAXIMOS } from '../dados/limites';
import { Janelas } from '../ui/janela';
import { LigarPessoaNoItem, novaPessoaNoItem, pedirPapelDoCliente } from './PessoasNosItens';

vi.mock('../dados', () => ({ SD: {} }));

const pessoas = (n: number) => Array.from({ length: n }, (_, i) => ({ id: 'p' + i }));

describe('O "+ Nova pessoa" no cartão do item', () => {
  it('dado o cartão de uma demanda que se pode alterar, quando monta os atalhos, então o "+" do título e o botão levam ao cadastro já com a demanda', () => {
    // Dado / Quando
    const novo = novaPessoaNoItem('demandas', 'd1', pessoas(1), true);
    // Então
    expect(novo.titulo).toEqual({ para: '/pessoas/nova/?demanda=d1', rotulo: 'Nova pessoa como cliente desta demanda' });
    expect(novo.embaixo).toEqual({ para: '/pessoas/nova/?demanda=d1', rotulo: 'Nova pessoa' });
  });

  it('dado o cartão só para ler (ou arquivado), quando monta os atalhos, então não há nenhum', () => {
    // Dado / Quando / Então
    expect(novaPessoaNoItem('tarefas', 't1', [], false)).toEqual({});
  });

  it('dada a lista do item cheia, quando monta os atalhos, então não há nenhum, como o "Ligar existente"', () => {
    // Dado / Quando / Então
    expect(novaPessoaNoItem('processos', 'k1', pessoas(CLIENTES_MAXIMOS), true)).toEqual({});
  });

  it('dado o atalho, quando a seção mostra o "Ligar pessoa existente", então o "+ Nova pessoa" aparece ao lado, com o endereço do cadastro', () => {
    // Dado
    const { embaixo } = novaPessoaNoItem('compromissos', 'c1', [], true);
    // Quando
    render(<MemoryRouter><LigarPessoaNoItem modulo="compromissos" itemId="c1" ligadas={[]} depois={() => undefined} novo={embaixo} /></MemoryRouter>);
    // Então
    expect(screen.getByRole('button', { name: 'Ligar pessoa existente' })).toBeEnabled();
    expect(screen.getByRole('link', { name: 'Nova pessoa' })).toHaveAttribute('href', '/pessoas/nova/?compromisso=c1');
  });
});

describe('O papel de quem entra como cliente do processo pelo cartão (#426)', () => {
  it('dado um processo com clientes réus, quando a pergunta abre, então ela já traz Réu, e a pessoa troca e liga', async () => {
    // Dado
    render(<Janelas />);
    let resposta!: Promise<string | null>;
    // Quando
    act(() => { resposta = pedirPapelDoCliente({ c1: 'reu' }); });
    const janela = screen.getByRole('dialog', { name: 'Papel do cliente no processo' });
    const papel = within(janela).getByLabelText('Papel do cliente') as HTMLSelectElement;
    // Então
    expect(papel.value).toBe('reu');
    expect([...papel.options].map(o => o.text)).toContain('Testemunha');
    // Quando
    await userEvent.selectOptions(papel, 'testemunha');
    await userEvent.click(within(janela).getByRole('button', { name: 'Ligar' }));
    // Então
    await expect(resposta).resolves.toBe('testemunha');
  });

  it('dada a pergunta aberta, quando a pessoa cancela, então não há papel (e ninguém é ligado)', async () => {
    // Dado
    render(<Janelas />);
    let resposta!: Promise<string | null>;
    act(() => { resposta = pedirPapelDoCliente(undefined); });
    expect((screen.getByLabelText('Papel do cliente') as HTMLSelectElement).value).toBe('autor');
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    // Então
    await expect(resposta).resolves.toBeNull();
  });
});
