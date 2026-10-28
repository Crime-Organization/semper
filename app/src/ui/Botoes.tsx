// Botões com comportamento comum: o que fica ocupado enquanto a ação roda e o de exclusão em dois cliques.
import { useEffect, useRef, useState, type ComponentPropsWithRef, type MouseEvent, type ReactNode } from 'react';
import { estiloBotao, type EstiloBotao } from './base/botao';
import { PRAZO_PARA_CONFIRMAR } from './tempos';

// forma, variante e pequeno montam a classe do botão (veja base/botao.ts); className continua valendo para o resto.
type Base = Omit<ComponentPropsWithRef<'button'>, 'onClick'> & EstiloBotao;
// Sem nenhuma opção de estilo, vale só o className (como as telas que ainda escrevem as classes à mão).
const classeDe = ({ forma, variante, pequeno }: EstiloBotao, className?: string) =>
  forma || variante || pequeno ? estiloBotao({ forma, variante, pequeno }, className) : className;

/** Fica desativado enquanto a ação (async) roda; ocupadoTexto troca o rótulo nesse tempo (ex.: "Buscando…"). */
export function Botao({ onClick, ocupadoTexto, children, disabled, type = 'button', forma, variante, pequeno, className, ...resto }:
  Base & { onClick?: (e: MouseEvent<HTMLButtonElement>) => unknown; ocupadoTexto?: ReactNode }) {
  const [ocupado, setOcupado] = useState(false);
  const clicar = async (e: MouseEvent<HTMLButtonElement>) => {
    if (!onClick) return;
    setOcupado(true);
    try { await onClick(e); } finally { setOcupado(false); }
  };
  return <button type={type} className={classeDe({ forma, variante, pequeno }, className)} disabled={disabled || ocupado} onClick={onClick ? clicar : undefined} {...resto}>
    {ocupado && ocupadoTexto ? ocupadoTexto : children}
  </button>;
}

/** Exclusão em dois cliques: o primeiro pede confirmação (some em 4 s), o segundo executa. */
export function BotaoDuplo({ className, forma, variante, pequeno, confirmar, aoConfirmar, children, ...resto }:
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
  return <button type="button" ref={ref} className={[classeDe({ forma, variante, pequeno }, className), armado ? 'confirmar' : ''].filter(Boolean).join(' ') || undefined} onClick={clicar} onBlur={sair} {...resto}>
    {armado ? confirmar : children}
  </button>;
}
