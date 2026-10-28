// Botões com comportamento comum: o que fica ocupado enquanto a ação roda e o de exclusão em dois cliques.
import { useEffect, useRef, useState, type ComponentPropsWithRef, type MouseEvent, type ReactNode } from 'react';
import { PRAZO_PARA_CONFIRMAR } from './tempos';

type Base = Omit<ComponentPropsWithRef<'button'>, 'onClick'>;

/** Fica desativado enquanto a ação (async) roda; ocupadoTexto troca o rótulo nesse tempo (ex.: "Buscando…"). */
export function Botao({ onClick, ocupadoTexto, children, disabled, type = 'button', ...resto }:
  Base & { onClick?: (e: MouseEvent<HTMLButtonElement>) => unknown; ocupadoTexto?: ReactNode }) {
  const [ocupado, setOcupado] = useState(false);
  const clicar = async (e: MouseEvent<HTMLButtonElement>) => {
    if (!onClick) return;
    setOcupado(true);
    try { await onClick(e); } finally { setOcupado(false); }
  };
  return <button type={type} disabled={disabled || ocupado} onClick={onClick ? clicar : undefined} {...resto}>
    {ocupado && ocupadoTexto ? ocupadoTexto : children}
  </button>;
}

/** Exclusão em dois cliques: o primeiro pede confirmação (some em 4 s), o segundo executa. */
export function BotaoDuplo({ className = '', confirmar, aoConfirmar, children, ...resto }:
  Base & { confirmar: ReactNode; aoConfirmar: () => unknown }) {
  const [armado, setArmado] = useState(false);
  const tempo = useRef<number | undefined>(undefined);
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => () => clearTimeout(tempo.current), []);
  const clicar = async () => {
    clearTimeout(tempo.current);
    if (!armado) { setArmado(true); tempo.current = window.setTimeout(() => setArmado(false), PRAZO_PARA_CONFIRMAR); return; }
    setArmado(false);
    await aoConfirmar();
  };
  const sair = () => setTimeout(() => { if (document.activeElement !== ref.current) setArmado(false); }, 150);
  return <button type="button" ref={ref} className={className + (armado ? ' confirmar' : '')} onClick={clicar} onBlur={sair} {...resto}>
    {armado ? confirmar : children}
  </button>;
}
