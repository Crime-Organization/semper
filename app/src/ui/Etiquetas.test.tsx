// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// O banco fictício sempre entra como administrador; aqui a seção é aberta também como quem não é.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SD, type Etiqueta } from '../dados';
import { BotaoDasEtiquetas, EtiquetasDaSecao, EtiquetasDoItem, filtroDeEtiqueta, lojaDeEtiquetas, SecaoEtiquetas, SeloEtiqueta, SelosDasEtiquetas } from './Etiquetas';

const sessao = vi.hoisted(() => ({ ehAdmin: false }));
vi.mock('./sessao', () => ({ useCtx: () => ({ perfil: { id: 'u-bruno' }, ehAdmin: sessao.ehAdmin }) }));

const MINHA: Etiqueta = { id: 'e-minha', cor: 'azul', texto: 'Minha', criado_por: 'u-bruno' };
const DA_ANA: Etiqueta = { id: 'e-ana', cor: 'vermelho', texto: 'Da Ana', criado_por: 'u-ana' };

describe('Peças das etiquetas', () => {
  beforeEach(() => {
    sessao.ehAdmin = false;
    lojaDeEtiquetas.mudar([DA_ANA, MINHA]);
    vi.spyOn(SD, 'etiquetasListar').mockResolvedValue([DA_ANA, MINHA]);
  });

  it('quando a etiqueta é só de cor, então aparece uma faixa com o nome para leitores de tela', () => {
    // Quando
    render(<SeloEtiqueta e={{ cor: 'verde', texto: null }} />);
    // Então
    expect(screen.getByRole('img', { name: 'Só cor: Verde' })).toBeTruthy();
  });

  it('quando o item não tem etiquetas, então não aparece nada; quando tem, só as dele', () => {
    // Quando
    const { container, rerender } = render(<EtiquetasDoItem etq={[]} modulo="pessoas" id="p-qualquer" />);
    // Então
    expect(container.textContent).toBe('');
    // Quando
    rerender(<EtiquetasDoItem etq={[{ etiqueta_id: MINHA.id }]} modulo="pessoas" id="p-qualquer" />);
    // Então
    expect(container.textContent).toBe('Minha');
  });

  it('quando o escritório não tem etiquetas, então o filtro não aparece; quando tem, lista todas', () => {
    // Então
    expect(filtroDeEtiqueta([], '', () => undefined)).toEqual([]);
    const [filtro] = filtroDeEtiqueta([MINHA, { id: 'e-cor', cor: 'verde', texto: null, criado_por: null }], 'e-cor', () => undefined);
    expect(filtro.valor).toBe('e-cor');
    expect(filtro.opcoes).toEqual([['', 'Todas'], ['e-minha', 'Minha'], ['e-cor', 'Só cor: Verde']]);
  });

  it('quando quem abre não é administrador, então aplica qualquer etiqueta, mas só muda as que criou', async () => {
    // Dado
    render(<SecaoEtiquetas modulo="pessoas" id="p-qualquer" aoMudar={() => undefined} />);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Escolher etiquetas' }));
    // Então
    const painel = within(screen.getByRole('dialog', { name: 'Escolher etiquetas' }));
    expect(painel.getByRole('checkbox', { name: 'Da Ana' })).toBeTruthy();
    expect(painel.getByRole('checkbox', { name: 'Minha' })).toBeTruthy();
    expect(painel.getByRole('button', { name: 'Mudar a etiqueta Minha' })).toBeTruthy();
    expect(painel.queryByRole('button', { name: 'Mudar a etiqueta Da Ana' })).toBeNull();
    expect(painel.getByRole('form', { name: 'Nova etiqueta' })).toBeTruthy();
  });

  it('quando quem abre é administrador, então muda qualquer etiqueta', async () => {
    // Dado
    sessao.ehAdmin = true;
    render(<SecaoEtiquetas modulo="pessoas" id="p-qualquer" aoMudar={() => undefined} />);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Escolher etiquetas' }));
    // Então
    expect(within(screen.getByRole('dialog', { name: 'Escolher etiquetas' })).getByRole('button', { name: 'Mudar a etiqueta Da Ana' })).toBeTruthy();
  });

  it('quando a etiqueta é do sistema, então o administrador a muda, mas não a exclui; quem não é administrador nem muda', async () => {
    // Dado
    const incompleta: Etiqueta = { id: 'e-inc', cor: 'laranja', texto: 'Incompleta', criado_por: null, sistema: 'incompleta' };
    vi.spyOn(SD, 'etiquetasListar').mockResolvedValue([incompleta]);
    lojaDeEtiquetas.mudar([incompleta]);
    const { unmount } = render(<SecaoEtiquetas modulo="pessoas" id="p-qualquer" aoMudar={() => undefined} />);
    await userEvent.click(screen.getByRole('button', { name: 'Escolher etiquetas' }));
    // Então
    expect(screen.queryByRole('button', { name: 'Mudar a etiqueta Incompleta' })).toBeNull();
    unmount();
    // Quando
    sessao.ehAdmin = true;
    render(<SecaoEtiquetas modulo="pessoas" id="p-qualquer" aoMudar={() => undefined} />);
    await userEvent.click(screen.getByRole('button', { name: 'Escolher etiquetas' }));
    await userEvent.click(screen.getByRole('button', { name: 'Mudar a etiqueta Incompleta' }));
    // Então
    const form = within(screen.getByRole('form', { name: 'Mudar a etiqueta Incompleta' }));
    expect(form.getByRole('button', { name: 'Salvar etiqueta' })).toBeTruthy();
    expect(form.queryByRole('button', { name: /Excluir/ })).toBeNull();
  });

  it('quando o cartão está arquivado, então as etiquetas só aparecem, sem escolher', () => {
    // Quando
    render(<SecaoEtiquetas modulo="pessoas" id="p-qualquer" somenteLer aoMudar={() => undefined} />);
    // Então
    expect(screen.queryByRole('button', { name: 'Escolher etiquetas' })).toBeNull();
  });

  it('quando o item está arquivado, então a etiqueta aparece sem o x; ativo, com o x', () => {
    // Quando
    const { rerender } = render(<EtiquetasDoItem etq={[{ etiqueta_id: MINHA.id }]} modulo="pessoas" id="p-qualquer" somenteLer />);
    // Então
    expect(screen.queryByRole('button', { name: 'Tirar a etiqueta Minha' })).toBeNull();
    // Quando
    rerender(<EtiquetasDoItem etq={[{ etiqueta_id: MINHA.id }]} modulo="pessoas" id="p-qualquer" />);
    // Então
    expect(screen.getByRole('button', { name: 'Tirar a etiqueta Minha' })).toBeTruthy();
  });
});

// A seção "Etiquetas" dos cartões: o título com o "+" na frente e os selos embaixo. A anotação (pedido do dono, 18/11) não tem a
// seção: usa as mesmas peças por partes, o botão que abre a escolha e os selos (veja o grupo seguinte).
describe('A seção "Etiquetas" dos cartões', () => {
  beforeEach(() => {
    sessao.ehAdmin = false;
    lojaDeEtiquetas.mudar([DA_ANA, MINHA]);
    vi.spyOn(SD, 'etiquetasListar').mockResolvedValue([DA_ANA, MINHA]);
  });

  it('dado um cartão cuja lista fica com quem chama, quando a pessoa clica no "+" ao lado do título da seção e marca uma, então quem chama recebe a etiqueta marcada', async () => {
    // Dado
    const aoMarcar = vi.fn();
    render(<EtiquetasDaSecao ids={[]} aoMarcar={aoMarcar} />);
    expect(screen.getByRole('region', { name: 'Etiquetas' })).toHaveTextContent('Nenhuma etiqueta.');
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Escolher etiquetas' }));
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Escolher etiquetas' })).getByRole('checkbox', { name: 'Minha' }));
    // Então
    expect(aoMarcar).toHaveBeenCalledWith(MINHA, true);
  });

  it('dadas as etiquetas, quando aparecem embaixo do título da seção, então cada uma é um selo, e só quem pode mudar vê o x para tirar', async () => {
    // Dado
    const aoMarcar = vi.fn();
    const { rerender } = render(<EtiquetasDaSecao ids={[MINHA.id]} aoMarcar={aoMarcar} somenteLer />);
    // Então
    expect(screen.getByText('Minha')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Tirar a etiqueta Minha' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Escolher etiquetas' })).toBeNull();
    // Quando
    rerender(<EtiquetasDaSecao ids={[MINHA.id]} aoMarcar={aoMarcar} />);
    await userEvent.click(screen.getByRole('button', { name: 'Tirar a etiqueta Minha' }));
    // Então
    expect(aoMarcar).toHaveBeenCalledWith(MINHA, false);
  });
});

// Pedido do dono (18/11): na anotação, a escolha das etiquetas abre pelo ícone de etiqueta, no topo, e os selos ficam numa linha
// entre o topo e o título; sem etiquetas, a linha não aparece.
describe('As peças das etiquetas da anotação: o botão que abre a escolha e os selos', () => {
  beforeEach(() => {
    sessao.ehAdmin = false;
    lojaDeEtiquetas.mudar([DA_ANA, MINHA]);
    vi.spyOn(SD, 'etiquetasListar').mockResolvedValue([DA_ANA, MINHA]);
  });

  it('quando a pessoa clica no botão, então abre a mesma escolha da seção, com as etiquetas marcadas e o formulário de nova; marcar avisa quem chama, e clicar de novo fecha', async () => {
    // Dado
    const aoMarcar = vi.fn();
    render(<BotaoDasEtiquetas ids={[MINHA.id]} aoMarcar={aoMarcar} rotulo="Etiquetas" className="cartao-botao" comDica>ícone</BotaoDasEtiquetas>);
    const botao = screen.getByRole('button', { name: 'Etiquetas' });
    expect(botao).toHaveAttribute('aria-expanded', 'false');
    // Quando
    await userEvent.click(botao);
    // Então
    const escolha = within(screen.getByRole('dialog', { name: 'Escolher etiquetas' }));
    expect(botao).toHaveAttribute('aria-expanded', 'true');
    expect(escolha.getByRole('checkbox', { name: 'Minha' })).toBeChecked();
    expect(escolha.getByRole('checkbox', { name: 'Da Ana' })).not.toBeChecked();
    expect(escolha.getByRole('form', { name: 'Nova etiqueta' })).toBeTruthy();
    // Quando
    await userEvent.click(escolha.getByRole('checkbox', { name: 'Da Ana' }));
    // Então
    expect(aoMarcar).toHaveBeenCalledWith(DA_ANA, true);
    // Quando
    await userEvent.click(botao);
    // Então
    expect(screen.queryByRole('dialog', { name: 'Escolher etiquetas' })).toBeNull();
  });

  it('dado o botão com a dica do sistema, então o nome aparece na dica, e não na do navegador', () => {
    // Quando
    render(<BotaoDasEtiquetas ids={[]} aoMarcar={vi.fn()} rotulo="Etiquetas" className="cartao-botao" comDica>ícone</BotaoDasEtiquetas>);
    // Então
    const botao = screen.getByRole('button', { name: 'Etiquetas' });
    expect(botao).toHaveAttribute('data-dica', 'Etiquetas');
    expect(botao).not.toHaveAttribute('title');
  });

  it('dadas duas etiquetas, quando os selos aparecem, então ficam numa linha com o nome dado, e o x tira a etiqueta', async () => {
    // Dado
    const aoTirar = vi.fn();
    render(<SelosDasEtiquetas ids={[MINHA.id, DA_ANA.id]} rotulo="Etiquetas" aoTirar={aoTirar} />);
    // Então
    const linha = within(screen.getByRole('group', { name: 'Etiquetas' }));
    expect(linha.getByText('Minha')).toBeTruthy();
    expect(linha.getByText('Da Ana')).toBeTruthy();
    // Quando
    await userEvent.click(linha.getByRole('button', { name: 'Tirar a etiqueta Minha' }));
    // Então
    expect(aoTirar).toHaveBeenCalledWith(MINHA);
  });

  it('dado quem só lê, então os selos aparecem sem o x; sem etiquetas, a linha não aparece', () => {
    // Quando
    const { container, rerender } = render(<SelosDasEtiquetas ids={[MINHA.id]} rotulo="Etiquetas" />);
    // Então
    expect(screen.getByRole('group', { name: 'Etiquetas' })).toHaveTextContent('Minha');
    expect(screen.queryByRole('button', { name: 'Tirar a etiqueta Minha' })).toBeNull();
    // Quando
    rerender(<SelosDasEtiquetas ids={[]} rotulo="Etiquetas" />);
    // Então
    expect(screen.queryByRole('group', { name: 'Etiquetas' })).toBeNull();
    expect(container.textContent).toBe('');
  });
});
