// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DadosAnotacoes, ItemDaAnotacao } from '../dados';
import { LigarItem } from './LigarItem';

// A busca usa só uma operação da camada de dados; o mock declara exatamente essa.
const { itensParaLigar } = vi.hoisted(() => ({ itensParaLigar: vi.fn<DadosAnotacoes['itensParaLigar']>() }));
vi.mock('../dados', () => ({ SD: { itensParaLigar } satisfies Pick<DadosAnotacoes, 'itensParaLigar'> }));

const jose: ItemDaAnotacao = { modulo: 'pessoas', id: 'p1', codigo: 'P-001', nome: 'JOSÉ DA SILVA TESTE', arquivado_em: null };
const maria: ItemDaAnotacao = { modulo: 'pessoas', id: 'p2', codigo: 'P-002', nome: 'MARIA APARECIDA EXEMPLO', arquivado_em: null };
const marca: ItemDaAnotacao = { modulo: 'demandas', id: 'd1', codigo: 'D-010', nome: 'Registro de marca', arquivado_em: null };
const ACHADOS: Record<string, ItemDaAnotacao[]> = { pessoas: [jose, maria], demandas: [marca] };

function montar(ligados: Pick<ItemDaAnotacao, 'modulo' | 'id'>[] = []) {
  const aoEscolher = vi.fn();
  render(<LigarItem modulos={['pessoas', 'demandas', 'tarefas']} ligados={ligados} aoEscolher={aoEscolher} />);
  return aoEscolher;
}
const abrir = () => userEvent.click(screen.getByRole('button', { name: 'Ligar a outro item' }));
const busca = () => screen.getByRole('textbox', { name: 'Buscar item para ligar' });

describe('Ligar a anotação a outro item: a busca', () => {
  beforeEach(() => {
    itensParaLigar.mockReset();
    itensParaLigar.mockImplementation(async modulo => ACHADOS[modulo] ?? []);
  });

  it('quando a pessoa abre a busca, então o campo recebe o foco e aparecem as pessoas mais recentes, com o tipo e o código', async () => {
    // Dado
    montar();
    // Quando
    await abrir();
    // Então
    expect(busca()).toHaveFocus();
    expect(screen.getByRole('combobox', { name: 'Tipo de item' })).toHaveValue('pessoas');
    expect(await screen.findByRole('button', { name: /JOSÉ DA SILVA TESTE/ })).toHaveTextContent('Pessoa · P-001');
    expect(itensParaLigar).toHaveBeenCalledWith('pessoas', '');
  });

  it('quando a pessoa troca o tipo de item, então a busca passa a ser nesse módulo e o foco volta ao campo', async () => {
    // Dado
    montar();
    await abrir();
    await screen.findByRole('button', { name: /JOSÉ DA SILVA TESTE/ });
    // Quando
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Tipo de item' }), 'demandas');
    // Então
    expect(await screen.findByRole('button', { name: /Registro de marca/ })).toHaveTextContent('Demanda · D-010');
    expect(screen.queryByRole('button', { name: /JOSÉ DA SILVA TESTE/ })).not.toBeInTheDocument();
    expect(itensParaLigar).toHaveBeenLastCalledWith('demandas', '');
    expect(busca()).toHaveFocus();
  });

  it('dado um item já ligado, quando a busca abre, então ele não aparece de novo', async () => {
    // Dado
    montar([{ modulo: 'pessoas', id: 'p1' }]);
    // Quando
    await abrir();
    // Então
    expect(await screen.findByRole('button', { name: /MARIA APARECIDA EXEMPLO/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /JOSÉ DA SILVA TESTE/ })).not.toBeInTheDocument();
  });

  it('quando a pessoa digita e clica num achado, então ele é escolhido, a busca fecha e o foco volta ao botão', async () => {
    // Dado
    const aoEscolher = montar();
    await abrir();
    // Quando
    await userEvent.type(busca(), 'maria');
    // A busca vai ao banco um instante depois de a pessoa parar de digitar.
    await waitFor(() => expect(itensParaLigar).toHaveBeenLastCalledWith('pessoas', 'maria'));
    await userEvent.click(await screen.findByRole('button', { name: /MARIA APARECIDA EXEMPLO/ }));
    // Então
    expect(aoEscolher).toHaveBeenCalledWith(maria);
    expect(screen.queryByRole('textbox', { name: 'Buscar item para ligar' })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Ligar a outro item' })).toHaveFocus());
  });

  it('quando a pessoa tecla Enter, então o primeiro achado é escolhido; com Esc, a busca fecha sem escolher', async () => {
    // Dado
    const aoEscolher = montar();
    await abrir();
    await screen.findByRole('button', { name: /JOSÉ DA SILVA TESTE/ });
    // Quando
    await userEvent.keyboard('{Enter}');
    // Então
    expect(aoEscolher).toHaveBeenCalledWith(jose);
    // Quando
    await abrir();
    await userEvent.keyboard('{Escape}');
    // Então
    expect(aoEscolher).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Ligar a outro item' })).toBeInTheDocument();
  });

  it('dado que a pessoa acabou de digitar, quando tecla Enter antes de a busca do texto voltar, então nada é escolhido; com a busca de volta, o Enter escolhe o achado dela', async () => {
    // Dado: a lista ainda mostra os mais recentes, da busca sem texto, e a busca por "maria" acha só ela
    itensParaLigar.mockImplementation(async (modulo, termo) => termo === 'maria' ? [maria] : ACHADOS[modulo] ?? []);
    const aoEscolher = montar();
    await abrir();
    await screen.findByRole('button', { name: /JOSÉ DA SILVA TESTE/ });
    // Quando
    await userEvent.type(busca(), 'maria{Enter}');
    // Então
    expect(aoEscolher).not.toHaveBeenCalled();
    // Quando
    await waitFor(() => expect(itensParaLigar).toHaveBeenLastCalledWith('pessoas', 'maria'));
    await screen.findByRole('button', { name: /MARIA APARECIDA EXEMPLO/ });
    await userEvent.keyboard('{Enter}');
    // Então
    expect(aoEscolher).toHaveBeenCalledWith(maria);
  });

  it('quando nada do módulo combina com o texto, então a lista diz que não há item que a pessoa possa ligar', async () => {
    // Dado
    montar();
    await abrir();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Tipo de item' }), 'tarefas');
    // Quando
    await userEvent.type(busca(), 'xyz');
    // Então
    expect(await screen.findByText('Nenhum item ativo com esse texto que você possa ligar.')).toBeInTheDocument();
  });
});

describe('Ligar a anotação nova a um item (#339)', () => {
  beforeEach(() => {
    itensParaLigar.mockReset();
    itensParaLigar.mockImplementation(async modulo => ACHADOS[modulo] ?? []);
  });

  it('dado um texto próprio para o botão, quando a pessoa o usa, então a busca abre do mesmo jeito', async () => {
    // Dado
    render(<LigarItem modulos={['pessoas']} ligados={[]} aoEscolher={vi.fn()} rotulo="Ligar a um item" />);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Ligar a um item' }));
    // Então
    expect(busca()).toHaveFocus();
  });
});
