// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LigarExistente } from './LigarExistente';

/** Um item qualquer que a seção oferece (a peça não sabe o que é: quem usa diz como buscar e como mostrar). */
interface Item { id: string; codigo: string; titulo: string; cheio?: boolean }
const estrategia: Item = { id: 'a1', codigo: 'K7Q2', titulo: 'Estratégia da defesa' };
const ata: Item = { id: 'a2', codigo: 'P9X4', titulo: 'Ata da reunião' };
const cheia: Item = { id: 'a3', codigo: 'Z1Z1', titulo: 'Resumo do caso', cheio: true };
/** Como a camada de dados busca: pelo título ou pelo código, e só o que se pode ligar (sem o já ligado, o arquivado e o alheio). */
const TODOS = [estrategia, ata, cheia];

const buscar = vi.fn(async (termo: string) => TODOS.filter(x => !termo || `${x.codigo} ${x.titulo}`.toLowerCase().includes(termo.toLowerCase())));

function montar(extra: Partial<Parameters<typeof LigarExistente<Item>>[0]> = {}) {
  const aoEscolher = vi.fn();
  render(<LigarExistente<Item> rotulo="Ligar anotação existente" buscar={buscar} aoEscolher={aoEscolher}
    mostrar={x => ({ id: x.id, titulo: x.titulo, detalhe: x.codigo, motivo: x.cheio ? 'Já está ligada a 50 itens, o máximo.' : '' })}
    rotuloDaBusca="Buscar anotação para ligar" dicaDaBusca="Título ou código" nomeDaLista="Anotações para ligar"
    semAchados={{ comTexto: 'Nada com esse texto.', semTexto: 'Nada para ligar.' }} {...extra} />);
  return aoEscolher;
}
const abrir = () => userEvent.click(screen.getByRole('button', { name: 'Ligar anotação existente' }));
const campo = () => screen.getByRole('textbox', { name: 'Buscar anotação para ligar' });

describe('Ligar um item que já existe: a busca', () => {
  beforeEach(() => buscar.mockClear());

  it('quando a pessoa abre a busca, então o campo recebe o foco e aparecem os mais recentes, com o título e o detalhe', async () => {
    // Dado
    montar();
    // Quando
    await abrir();
    // Então
    expect(campo()).toHaveFocus();
    expect(await screen.findByRole('button', { name: /Estratégia da defesa/ })).toHaveTextContent('K7Q2');
    expect(buscar).toHaveBeenCalledWith('');
  });

  it.each([['pelo título', 'reunião', ata], ['pelo código', 'k7q2', estrategia]])('quando a pessoa busca %s e clica no achado, então ele é escolhido, a busca fecha e o foco volta ao botão',
    async (_caso, texto, esperado) => {
      // Dado
      const aoEscolher = montar();
      await abrir();
      // Quando
      await userEvent.type(campo(), texto);
      // A busca vai à camada de dados um instante depois de a pessoa parar de digitar.
      await waitFor(() => expect(buscar).toHaveBeenLastCalledWith(texto));
      await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(1));
      await userEvent.click(screen.getByRole('button', { name: new RegExp(esperado.titulo) }));
      // Então
      expect(aoEscolher).toHaveBeenCalledWith(esperado);
      expect(screen.queryByRole('textbox', { name: 'Buscar anotação para ligar' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Ligar anotação existente' })).toHaveFocus();
    });

  it('dado um achado que não pode ser escolhido, então ele aparece desabilitado com o motivo, e o Enter escolhe o primeiro que pode', async () => {
    // Dado
    buscar.mockResolvedValueOnce([cheia, ata]);
    const aoEscolher = montar();
    await abrir();
    // Quando
    const desabilitado = await screen.findByRole('button', { name: /Resumo do caso/ });
    // Então
    expect(desabilitado).toBeDisabled();
    expect(desabilitado).toHaveTextContent('Já está ligada a 50 itens, o máximo.');
    // Quando
    await userEvent.keyboard('{Enter}');
    // Então
    expect(aoEscolher).toHaveBeenCalledWith(ata);
  });

  it('dado que a camada de dados não acha nada, então a lista diz isso, com o texto digitado e sem; o Esc fecha sem escolher', async () => {
    // Dado
    buscar.mockResolvedValueOnce([]);
    const aoEscolher = montar();
    await abrir();
    // Então
    expect(await screen.findByText('Nada para ligar.')).toBeInTheDocument();
    // Quando
    await userEvent.type(campo(), 'xyz');
    // Então
    expect(await screen.findByText('Nada com esse texto.')).toBeInTheDocument();
    // Quando
    await userEvent.keyboard('{Escape}');
    // Então
    expect(aoEscolher).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox', { name: 'Buscar anotação para ligar' })).not.toBeInTheDocument();
  });

  it('dado um aviso, quando a busca abre, então ele aparece embaixo do campo', async () => {
    // Dado
    montar({ aviso: 'Quem vê este processo passa a ler a anotação que você ligar.' });
    // Quando
    await abrir();
    // Então
    expect(screen.getByText('Quem vê este processo passa a ler a anotação que você ligar.')).toBeInTheDocument();
  });

  it('dado o cartão só para ler, então o botão de ligar não aparece e nada é buscado', () => {
    // Dado / Quando
    montar({ somenteLer: true });
    // Então
    expect(screen.queryByRole('button', { name: 'Ligar anotação existente' })).not.toBeInTheDocument();
    expect(buscar).not.toHaveBeenCalled();
  });

  it('dada a lista do cartão cheia, então o botão aparece desabilitado, com o motivo ao lado, e nada é buscado', async () => {
    // Dado / Quando
    montar({ indisponivel: 'Este processo já tem 10 clientes, o máximo.' });
    // Então
    const botao = screen.getByRole('button', { name: 'Ligar anotação existente' });
    expect(botao).toBeDisabled();
    expect(botao).toHaveAccessibleDescription('Este processo já tem 10 clientes, o máximo.');
    await userEvent.click(botao);
    expect(screen.queryByRole('textbox', { name: 'Buscar anotação para ligar' })).not.toBeInTheDocument();
    expect(buscar).not.toHaveBeenCalled();
  });
});

describe('Ligar um item que já existe: a busca dentro de uma janela (#312)', () => {
  beforeEach(() => buscar.mockClear());

  it('dada a busca numa janela, quando aparece, então já vem aberta, sem o botão, com o campo em foco e os mais recentes', async () => {
    // Quando
    montar({ naJanela: true });
    // Então
    expect(screen.queryByRole('button', { name: 'Ligar anotação existente' })).toBeNull();
    expect(campo()).toHaveFocus();
    expect(await screen.findByRole('button', { name: /Estratégia da defesa/ })).toBeInTheDocument();
  });

  it('dada a busca numa janela, quando a pessoa escolhe e quando clica fora, então escolher só responde e a busca não fecha sozinha', async () => {
    // Dado
    const aoEscolher = montar({ naJanela: true });
    // Quando
    await userEvent.click(document.body);
    // Então: clicar fora é da janela (a busca continua)
    expect(campo()).toBeInTheDocument();
    // Quando
    await userEvent.click(await screen.findByRole('button', { name: /Ata da reunião/ }));
    // Então
    expect(aoEscolher).toHaveBeenCalledWith(ata);
    expect(screen.queryByRole('button', { name: 'Ligar anotação existente' })).toBeNull();
  });
});
