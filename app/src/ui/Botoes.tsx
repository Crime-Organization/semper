// Botões com comportamento comum: o que fica ocupado enquanto a ação roda e o de exclusão em dois cliques. Os dois podem ser só
// de ícone (#423), com `icone` e `rotulo` (veja base/BotaoDeIcone): o rótulo é o nome do botão e a dica ao passar o mouse.
import { useEffect, useRef, useState, type ComponentPropsWithRef, type MouseEvent, type ReactNode } from 'react';
import { estiloBotao, type EstiloBotao } from './base/botao';
import { IconeDoBotao, propsDoBotaoDeIcone, type SoIcone } from './base/BotaoDeIcone';
import { PRAZO_PARA_CONFIRMAR } from './tempos';

/**
 * Excluir em dois cliques: ao perder o foco (Tab, clique fora), o botão espera este tanto e só desarma se o foco não voltou a ele.
 */
const ESPERA_AO_SAIR = 150;

// forma, variante e pequeno montam a classe do botão (veja base/botao.ts); className continua valendo para o resto.
type Base = Omit<ComponentPropsWithRef<'button'>, 'onClick'> & EstiloBotao;
/** Com o ícone, o botão é só de ícone (forma "icone", a não ser que se peça outra); sem ele, o texto vem nos filhos. */
type TalvezIcone = SoIcone | { icone?: undefined; rotulo?: undefined; dica?: undefined };
// Sem nenhuma opção de estilo, vale só o className (como as telas que ainda escrevem as classes à mão).
const classeDe = ({ forma, variante, pequeno }: EstiloBotao, className?: string) =>
  forma || variante || pequeno ? estiloBotao({ forma, variante, pequeno }, className) : className;

/**
 * Fica desativado enquanto a ação (async) roda; ocupadoTexto troca o rótulo nesse tempo (ex.: "Buscando…"). Só de ícone, o ícone
 * fica e o nome e a dica passam a ser o ocupadoTexto (se for um texto).
 */
export function Botao({ onClick, ocupadoTexto, children, disabled, type = 'button', forma, variante, pequeno, className, icone, rotulo, dica, ...resto }:
  Base & TalvezIcone & { onClick?: (e: MouseEvent<HTMLButtonElement>) => unknown; ocupadoTexto?: ReactNode }) {
  const [ocupado, setOcupado] = useState(false);
  const clicar = async (e: MouseEvent<HTMLButtonElement>) => {
    if (!onClick) return;
    setOcupado(true);
    try { await onClick(e); } finally { setOcupado(false); }
  };
  const textoOcupado = ocupado && typeof ocupadoTexto === 'string' ? ocupadoTexto : undefined;
  const doIcone = icone ? { ...propsDoBotaoDeIcone(textoOcupado ?? rotulo, textoOcupado ?? dica), 'aria-busy': ocupado || undefined } : {};
  return <button type={type} className={classeDe({ forma: forma ?? (icone && 'icone'), variante, pequeno }, className)} disabled={disabled || ocupado}
    onClick={onClick ? clicar : undefined} {...doIcone} {...resto}>
    {icone ? <IconeDoBotao icone={icone} /> : ocupado && ocupadoTexto ? ocupadoTexto : children}
  </button>;
}

/**
 * Exclusão em dois cliques: o primeiro pede confirmação (some em 4 s), o segundo executa. Só de ícone, o pedido de confirmação
 * aparece escrito (o botão cresce), e o nome do botão passa a ser ele.
 */
export function BotaoDuplo({ className, forma, variante, pequeno, confirmar, aoConfirmar, children, icone, rotulo, dica, ...resto }:
  Base & TalvezIcone & { confirmar: ReactNode; aoConfirmar: () => unknown }) {
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
  const sair = () => setTimeout(() => { if (document.activeElement !== ref.current) setArmado(false); }, ESPERA_AO_SAIR);
  const doIcone = icone && !armado ? propsDoBotaoDeIcone(rotulo, dica) : {};
  return <button type="button" ref={ref} className={[classeDe({ forma: forma ?? (icone && 'icone'), variante, pequeno }, className), armado ? 'confirmar' : ''].filter(Boolean).join(' ') || undefined}
    onClick={clicar} onBlur={sair} {...doIcone} {...resto}>
    {armado ? confirmar : icone ? <IconeDoBotao icone={icone} /> : children}
  </button>;
}
