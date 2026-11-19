// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Arrastar um item até um alvo, com o mouse e com o dedo (ui/arrastar.tsx, #370), numa lista mínima: um link que se arrasta e
// dois alvos, um que aceita o item e outro que não.
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ATRIBUTO_DO_ALVO, FantasmaDoArrasto, useArrastar } from './arrastar';
import { SEGURAR_PARA_ARRASTAR } from './tempos';

/** A lista: o link "Item" (que se arrasta), o alvo "Aceita" e o alvo "Recusa", dentro de uma caixa que rola. */
function Lista({ aoSoltar, aoAbrir }: { aoSoltar: (id: string, alvo: string) => void; aoAbrir: () => void }) {
  const { arrasto, alca } = useArrastar({ aceita: (_id, alvo) => alvo === 'aceita', aoSoltar });
  return <div role="list" aria-label="Lista que rola" style={{ overflowY: 'auto' }}>
    <a href="#item" onClick={e => { e.preventDefault(); aoAbrir(); }} {...alca('i1')}>Item</a>
    <div role="listitem" aria-label="Aceita" aria-current={arrasto?.alvo === 'aceita' ? 'true' : undefined} {...{ [ATRIBUTO_DO_ALVO]: 'aceita' }}>Aceita</div>
    <div role="listitem" aria-label="Recusa" aria-current={arrasto?.alvo === 'recusa' ? 'true' : undefined} {...{ [ATRIBUTO_DO_ALVO]: 'recusa' }}>Recusa</div>
    <FantasmaDoArrasto arrasto={arrasto}>Item arrastado</FantasmaDoArrasto>
  </div>;
}

describe('Arrastar um item até um alvo (#370)', () => {
  /** O elemento debaixo do ponteiro (o jsdom não desenha a página: o teste diz por cima de quem o ponteiro está). */
  let debaixo: Element | null = null;
  beforeEach(() => { debaixo = null; document.elementFromPoint = () => debaixo; });
  afterEach(() => { vi.useRealTimers(); });

  function montar() {
    const aoSoltar = vi.fn(), aoAbrir = vi.fn();
    const tela = render(<Lista aoSoltar={aoSoltar} aoAbrir={aoAbrir} />);
    return { aoSoltar, aoAbrir, tela, item: screen.getByRole('link', { name: 'Item' }) };
  }
  const ponteiro = { pointerId: 1, isPrimary: true };
  const apertar = (item: Element, pointerType = 'mouse', button = 0) => fireEvent.pointerDown(item, { ...ponteiro, pointerType, button, clientX: 10, clientY: 10 });
  /** Leva o ponteiro até a altura `y`, por cima do elemento. */
  function passarPor(alvo: Element | null, y = 80) {
    debaixo = alvo;
    fireEvent.pointerMove(window, { ...ponteiro, clientX: 60, clientY: y });
  }
  const soltar = () => fireEvent.pointerUp(window, { ...ponteiro, clientX: 60, clientY: 80 });
  const fantasma = () => screen.queryByText('Item arrastado');

  it('dado o item, quando a pessoa clica nele sem arrastar, então o clique abre o item, como sempre', () => {
    // Dado
    const { aoSoltar, aoAbrir, item } = montar();
    // Quando
    apertar(item);
    soltar();
    fireEvent.click(item);
    // Então
    expect(aoAbrir).toHaveBeenCalledOnce();
    expect(aoSoltar).not.toHaveBeenCalled();
  });

  it('dado o item arrastado com o mouse, quando ele é solto num alvo que aceita, então quem usa o recebe, e o clique que vem ao soltar não abre o item', () => {
    // Dado
    const { aoSoltar, aoAbrir, item } = montar();
    apertar(item);
    passarPor(screen.getByRole('listitem', { name: 'Aceita' }));
    expect(screen.getByRole('listitem', { name: 'Aceita' })).toHaveAttribute('aria-current', 'true');
    expect(fantasma()).toBeTruthy();
    // Quando
    soltar();
    fireEvent.click(item);
    // Então
    expect(aoSoltar).toHaveBeenCalledWith('i1', 'aceita');
    expect(aoAbrir).not.toHaveBeenCalled();
    expect(fantasma()).toBeNull();
  });

  it('dado o item arrastado, quando passa por um alvo que não o aceita e é solto ali, então o alvo não se destaca e nada acontece', () => {
    // Dado
    const { aoSoltar, item } = montar();
    apertar(item);
    // Quando
    passarPor(screen.getByRole('listitem', { name: 'Recusa' }));
    // Então
    expect(screen.getByRole('listitem', { name: 'Recusa' })).not.toHaveAttribute('aria-current');
    expect(fantasma()).toBeTruthy();
    soltar();
    expect(aoSoltar).not.toHaveBeenCalled();
  });

  it('dado o item arrastado, quando o navegador cancela o ponteiro (pointercancel), então o arrasto acaba sem soltar nada', () => {
    // Dado
    const { aoSoltar, item } = montar();
    apertar(item);
    passarPor(screen.getByRole('listitem', { name: 'Aceita' }));
    // Quando
    fireEvent.pointerCancel(window, ponteiro);
    soltar();
    // Então
    expect(fantasma()).toBeNull();
    expect(aoSoltar).not.toHaveBeenCalled();
  });

  it('dado o botão direito do mouse, quando a pessoa o aperta e anda, então não há arrasto', () => {
    // Dado
    const { aoSoltar, item } = montar();
    // Quando
    apertar(item, 'mouse', 2);
    passarPor(screen.getByRole('listitem', { name: 'Aceita' }));
    soltar();
    // Então
    expect(fantasma()).toBeNull();
    expect(aoSoltar).not.toHaveBeenCalled();
  });

  it('dada a lista que rola, quando o item arrastado chega perto da borda de baixo, então a lista rola para baixo', () => {
    // Dado: a lista tem 100px de altura e 500px de conteúdo
    const { item } = montar();
    const lista = screen.getByRole('list', { name: 'Lista que rola' });
    Object.defineProperty(lista, 'scrollHeight', { value: 500 });
    Object.defineProperty(lista, 'clientHeight', { value: 100 });
    lista.getBoundingClientRect = () => ({ top: 0, bottom: 100, left: 0, right: 200, width: 200, height: 100, x: 0, y: 0, toJSON: () => ({}) });
    apertar(item);
    passarPor(null, 50);
    expect(lista.scrollTop).toBe(0);
    // Quando
    passarPor(null, 95);
    // Então
    expect(lista.scrollTop).toBeGreaterThan(0);
  });

  it('dado o dedo no item, quando ele segura parado, então o arrasto começa e mexer o dedo deixa de rolar a lista; antes disso, a lista rola', () => {
    vi.useFakeTimers();
    // Dado
    const { aoSoltar, item } = montar();
    apertar(item, 'touch');
    // Antes de segurar, o toque que anda rola a lista (o navegador não é impedido)
    expect(fireEvent.touchMove(item, { cancelable: true })).toBe(true);
    // Quando
    act(() => { vi.advanceTimersByTime(SEGURAR_PARA_ARRASTAR); });
    // Então: o toque que anda leva o item, e não rola a lista
    expect(fantasma()).toBeTruthy();
    expect(fireEvent.touchMove(item, { cancelable: true })).toBe(false);
    passarPor(screen.getByRole('listitem', { name: 'Aceita' }));
    soltar();
    expect(aoSoltar).toHaveBeenCalledWith('i1', 'aceita');
    // E, acabado o arrasto, o toque volta a rolar a lista
    expect(fireEvent.touchMove(item, { cancelable: true })).toBe(true);
  });

  it('dado o item arrastado, quando a lista sai da tela no meio do arrasto, então o arrasto acaba sem erro e sem soltar nada', () => {
    // Dado
    const { aoSoltar, item, tela } = montar();
    apertar(item);
    passarPor(screen.getByRole('listitem', { name: 'Aceita' }));
    // Quando
    tela.unmount();
    soltar();
    // Então
    expect(fantasma()).toBeNull();
    expect(aoSoltar).not.toHaveBeenCalled();
  });
});
