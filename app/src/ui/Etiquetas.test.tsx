// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// O banco fictício sempre entra como administrador; aqui a seção é aberta também como quem não é.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SD, type Etiqueta } from '../dados';
import { anelDasEtiquetas, CirculoDeEtiquetas, EtiquetasDoItem, filtroDeEtiqueta, lojaDeEtiquetas, SecaoEtiquetas, SeloEtiqueta, SelosDasEtiquetas } from './Etiquetas';

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

describe('O círculo das etiquetas da anotação (#342)', () => {
  beforeEach(() => {
    sessao.ehAdmin = false;
    lojaDeEtiquetas.mudar([DA_ANA, MINHA]);
    vi.spyOn(SD, 'etiquetasListar').mockResolvedValue([DA_ANA, MINHA]);
  });

  it('dadas as cores das etiquetas, quando monta o anel, então cada uma ganha uma fatia igual, na ordem; sem etiqueta, não há anel', () => {
    // Então
    expect(anelDasEtiquetas([])).toBeUndefined();
    expect(anelDasEtiquetas(['azul', 'verde'])).toEqual({ '--anel': 'conic-gradient(var(--etq-azul) 0% 50%, var(--etq-verde) 50% 100%)' });
  });

  it('dada uma anotação sem etiquetas, quando a pessoa clica no círculo e marca uma, então quem chama recebe a etiqueta marcada', async () => {
    // Dado
    const aoMarcar = vi.fn();
    render(<CirculoDeEtiquetas ids={[]} aoMarcar={aoMarcar} />);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Escolher etiquetas' }));
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Escolher etiquetas' })).getByRole('checkbox', { name: 'Minha' }));
    // Então
    expect(aoMarcar).toHaveBeenCalledWith(MINHA, true);
  });

  it('dada uma anotação com etiquetas, quando quem só lê a vê, então o círculo mostra as cores mas não é um botão', () => {
    // Quando
    const { container } = render(<CirculoDeEtiquetas ids={[MINHA.id]} aoMarcar={() => undefined} somenteLer />);
    // Então
    expect(screen.queryByRole('button', { name: 'Escolher etiquetas' })).toBeNull();
    expect((container.firstElementChild as HTMLElement).style.getPropertyValue('--anel')).toContain('var(--etq-azul)');
  });

  it('dadas as etiquetas da anotação, quando aparecem abaixo do título, então só quem pode mudar vê o x para tirar', async () => {
    // Dado
    const aoTirar = vi.fn();
    const { rerender } = render(<SelosDasEtiquetas ids={[MINHA.id]} />);
    // Então
    expect(screen.getByText('Minha')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Tirar a etiqueta Minha' })).toBeNull();
    // Quando
    rerender(<SelosDasEtiquetas ids={[MINHA.id]} aoTirar={aoTirar} />);
    await userEvent.click(screen.getByRole('button', { name: 'Tirar a etiqueta Minha' }));
    // Então
    expect(aoTirar).toHaveBeenCalledWith(MINHA);
  });
});
