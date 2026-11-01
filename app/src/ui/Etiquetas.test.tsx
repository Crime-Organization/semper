// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// O banco fictício sempre entra como administrador; aqui a seção é aberta também como quem não é.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Etiqueta } from '../dados';
import { EtiquetasDoItem, filtroDeEtiqueta, lojaDeEtiquetas, SecaoEtiquetas, SeloEtiqueta } from './Etiquetas';

const sessao = vi.hoisted(() => ({ ehAdmin: false }));
vi.mock('./sessao', () => ({ useCtx: () => ({ perfil: { id: 'u-bruno' }, ehAdmin: sessao.ehAdmin }) }));

const MINHA: Etiqueta = { id: 'e-minha', cor: 'azul', texto: 'Minha', criado_por: 'u-bruno' };
const DA_ANA: Etiqueta = { id: 'e-ana', cor: 'vermelho', texto: 'Da Ana', criado_por: 'u-ana' };

describe('Peças das etiquetas', () => {
  beforeEach(() => {
    sessao.ehAdmin = false;
    lojaDeEtiquetas.mudar([DA_ANA, MINHA]);
  });

  it('quando a etiqueta é só de cor, então aparece uma faixa com o nome para leitores de tela', () => {
    // Quando
    render(<SeloEtiqueta e={{ cor: 'verde', texto: null }} />);
    // Então
    expect(screen.getByRole('img', { name: 'Só cor: Verde' })).toBeTruthy();
  });

  it('quando o item não tem etiquetas, então não aparece nada; quando tem, só as dele', () => {
    // Quando
    const { container, rerender } = render(<EtiquetasDoItem etq={[]} />);
    // Então
    expect(container.textContent).toBe('');
    // Quando
    rerender(<EtiquetasDoItem etq={[{ etiqueta_id: MINHA.id }]} />);
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

  it('quando o cartão está arquivado, então as etiquetas só aparecem, sem escolher', () => {
    // Quando
    render(<SecaoEtiquetas modulo="pessoas" id="p-qualquer" somenteLer aoMudar={() => undefined} />);
    // Então
    expect(screen.queryByRole('button', { name: 'Escolher etiquetas' })).toBeNull();
  });
});
