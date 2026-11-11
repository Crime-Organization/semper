// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DadosCompromissos, ProcessoParaLigar } from '../dados';
import { LigarProcesso } from './LigarProcesso';

// A busca usa só uma operação da camada de dados; o mock declara exatamente essa.
const { processosParaLigar } = vi.hoisted(() => ({ processosParaLigar: vi.fn<DadosCompromissos['processosParaLigar']>() }));
vi.mock('../dados', () => ({ SD: { processosParaLigar } satisfies Pick<DadosCompromissos, 'processosParaLigar'> }));

const marca: ProcessoParaLigar = { id: 'pr-marca', codigo: 'E901D209', tipo: 'administrativo', numero: '912345678', titulo: 'Registro da marca Exemplo', cliente_nome: 'JOSÉ DA SILVA TESTE' };
const acao: ProcessoParaLigar = { id: 'pr-acao', codigo: '2FF7C598', tipo: 'judicial', numero: '0001234-97.2026.8.13.0024', titulo: null, cliente_nome: 'MARIA APARECIDA EXEMPLO' };

function montar(ligados: string[] = []) {
  const aoEscolher = vi.fn();
  render(<LigarProcesso ligados={ligados} aoEscolher={aoEscolher} />);
  return aoEscolher;
}

describe('Ligar processo: a busca', () => {
  beforeEach(() => { processosParaLigar.mockReset(); processosParaLigar.mockResolvedValue([marca, acao]); });

  it('quando a pessoa abre a busca, então o campo recebe o foco e aparecem os mais recentes, com o nome e, embaixo, o tipo, o número e o código', async () => {
    // Dado
    montar();
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Ligar processo' }));
    // Então
    expect(screen.getByRole('textbox', { name: 'Buscar processo para ligar' })).toHaveFocus();
    expect(await screen.findByRole('button', { name: /Registro da marca Exemplo/ })).toHaveTextContent('Administrativo · 912345678 · E901D209');
    // Sem nome dado, o processo aparece pelo cliente.
    expect(screen.getByRole('button', { name: /MARIA APARECIDA EXEMPLO/ })).toBeInTheDocument();
    expect(processosParaLigar).toHaveBeenCalledWith('');
  });

  it('dado um processo já ligado ao cartão, quando a busca abre, então ele não aparece de novo', async () => {
    // Dado
    montar(['pr-marca']);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Ligar processo' }));
    // Então
    expect(await screen.findByRole('button', { name: /MARIA APARECIDA EXEMPLO/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Registro da marca Exemplo/ })).not.toBeInTheDocument();
  });

  it('quando a pessoa digita e clica num achado, então ele é escolhido, a busca fecha e o foco volta ao botão', async () => {
    // Dado
    const aoEscolher = montar();
    await userEvent.click(screen.getByRole('button', { name: 'Ligar processo' }));
    // Quando
    await userEvent.type(screen.getByRole('textbox', { name: 'Buscar processo para ligar' }), 'marca');
    // A busca vai ao banco um instante depois de a pessoa parar de digitar.
    await waitFor(() => expect(processosParaLigar).toHaveBeenLastCalledWith('marca'));
    await userEvent.click(await screen.findByRole('button', { name: /Registro da marca Exemplo/ }));
    // Então
    expect(aoEscolher).toHaveBeenCalledWith(marca);
    expect(screen.queryByRole('textbox', { name: 'Buscar processo para ligar' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ligar processo' })).toHaveFocus();
  });

  it('quando a pessoa tecla Enter, então o primeiro achado é escolhido; com Esc, a busca fecha sem escolher', async () => {
    // Dado
    const aoEscolher = montar();
    await userEvent.click(screen.getByRole('button', { name: 'Ligar processo' }));
    await screen.findByRole('button', { name: /Registro da marca Exemplo/ });
    // Quando
    await userEvent.keyboard('{Enter}');
    // Então
    expect(aoEscolher).toHaveBeenCalledWith(marca);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Ligar processo' }));
    await userEvent.keyboard('{Escape}');
    // Então
    expect(aoEscolher).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Ligar processo' })).toBeInTheDocument();
  });

  it('quando nada combina com o texto, então a lista diz que não há processo que a pessoa possa ligar', async () => {
    // Dado
    processosParaLigar.mockResolvedValue([]);
    montar();
    await userEvent.click(screen.getByRole('button', { name: 'Ligar processo' }));
    // Quando
    await userEvent.type(screen.getByRole('textbox', { name: 'Buscar processo para ligar' }), 'xyz');
    // Então
    expect(await screen.findByText('Nenhum processo ativo com esse texto que você possa ligar.')).toBeInTheDocument();
  });
});
