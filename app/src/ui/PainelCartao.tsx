// Painel do cartão: desliza da direita, sobre um véu. Esc ou clique fora fecham (se não houver janela aberta).
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icone } from './Icone';

export function PainelCartao({ aoFechar, children }: { aoFechar: () => void; children: ReactNode }) {
  const [on, setOn] = useState(false);
  const painel = useRef<HTMLElement>(null);
  const fechar = useRef(aoFechar);
  fechar.current = aoFechar;
  useEffect(() => {
    document.body.classList.add('sem-rolagem');
    const r = requestAnimationFrame(() => { setOn(true); painel.current?.focus(); });
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.querySelector('.veu-janela')) fechar.current(); };
    document.addEventListener('keydown', tecla);
    return () => { cancelAnimationFrame(r); document.removeEventListener('keydown', tecla); document.body.classList.remove('sem-rolagem'); };
  }, []);
  return createPortal(<>
    <div className={'veu' + (on ? ' on' : '')} onClick={() => fechar.current()} />
    <aside className={'cartao-painel' + (on ? ' on' : '')} role="dialog" aria-modal="true" tabIndex={-1} ref={painel}>
      <button type="button" className="cartao-fechar" aria-label="Fechar" onClick={() => fechar.current()}><Icone nome="fechar" tam={18} /></button>
      <div className="cartao-corpo">{children}</div>
    </aside>
  </>, document.body);
}
