// Menu que abre por cima da página, preso a um botão (menu "⋯" da barra do módulo, menu da coluna do quadro).
// Fecha ao clicar fora ou com Esc (o foco volta ao botão); o primeiro item (botão ou link) já vem com o foco.
// Com "painel" (ex.: os filtros), clicar dentro não fecha: dá para mexer em vários campos seguidos.
// Com "setas" (#399, o menu "Acrescentar ao cartão"), as setas andam pelos itens (para baixo e para a direita, o seguinte; para
// cima e para a esquerda, o anterior, dando a volta nas pontas), e Home e End vão ao primeiro e ao último.
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as TeclaNoReact, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { proximaOpcao } from '../regras/buscaGeral';

interface Props {
  botao: HTMLElement; aoFechar: () => void; painel?: boolean; rotulo?: string; setas?: boolean;
  /** Enquanto vale (ex.: a janela das datas gravando, #422), o Esc e o clique fora não fecham o painel. O Esc fica preso aqui: não
   *  passa ao cartão nem à janela onde o painel está, que fechariam com a gravação em andamento. */
  travado?: boolean;
  children: ReactNode;
}

/** Para onde cada seta leva, no menu com "setas": o item seguinte (1) ou o anterior (-1). */
const PASSO_DA_SETA: Partial<Record<string, 1 | -1>> = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
/** Home e End: o primeiro e o último item (a posição de partida antes do passo que dá a volta). */
const PONTA: Partial<Record<string, { de: 'fim' | 'comeco'; passo: 1 | -1 }>> = { Home: { de: 'fim', passo: 1 }, End: { de: 'comeco', passo: -1 } };

/** Anda pelos itens do menu com as setas, Home e End (veja o comentário do arquivo). */
function andarComAsSetas(e: TeclaNoReact<HTMLDivElement>) {
  const itens = [...e.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]')];
  const atual = itens.indexOf(document.activeElement as HTMLElement);
  const ponta = PONTA[e.key], passo = PASSO_DA_SETA[e.key] ?? ponta?.passo;
  if (!passo || !itens.length) return;
  e.preventDefault();
  const de = ponta ? (ponta.de === 'fim' ? itens.length - 1 : 0) : atual;
  itens[proximaOpcao(de, itens.length, passo)]?.focus();
}

/** Quanto o menu fica longe das bordas da tela e do botão que o abriu, em pixels. */
export const MARGEM_DA_TELA = 12, DISTANCIA_DO_BOTAO = 6;

/**
 * A faixa de botões parada no alto do cartão (o lápis, o ⋯, o X: .cartao-botoes, em PainelCartao), ou null fora de um cartão.
 * Um menu aberto por um botão do corpo do cartão (a janela das datas, #422) nunca sobe por cima dela: abre logo abaixo, mesmo que
 * o botão tenha rolado até o alto do cartão (embaixo da faixa) ou que o menu, alto, subisse para caber na tela. Assim a pessoa
 * continua clicando no lápis ou no X com o menu aberto. Os menus dos botões da própria faixa abrem abaixo dela, como sempre.
 */
export const FaixaDoCartao = createContext<HTMLElement | null>(null);

/** Os menus abertos agora: cada um sabe se fechar. */
const abertos = new Set<() => void>();
/**
 * Fecha os menus abertos, para outra janela abrir por cima (a busca geral, pelo Ctrl+K): escondido atrás dela, o menu
 * continuaria pegando o Esc. O foco que estava dentro do menu volta ao botão dele, como no Esc.
 */
export const fecharMenusAbertos = () => [...abertos].forEach(fechar => fechar());

export function MenuFlutuante({ botao, aoFechar, painel = false, rotulo, setas = false, travado = false, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const faixa = useContext(FaixaDoCartao);
  const [pos, setPos] = useState<{ top: number; left: number; maxHeight?: number }>({ top: -9999, left: 0 });
  const fechar = useRef(aoFechar);
  fechar.current = aoFechar;
  const preso = useRef(travado);
  preso.current = travado;
  useLayoutEffect(() => {
    const m = ref.current!;
    const posicionar = () => {
      const r = botao.getBoundingClientRect();
      // Abre abaixo do botão; se não couber, sobe até caber na tela (o menu mais alto que a tela rola por dentro: .kmenu).
      const noFimDaTela = window.scrollY + window.innerHeight - m.offsetHeight - MARGEM_DA_TELA;
      const naTela = Math.max(window.scrollY + MARGEM_DA_TELA, Math.min(r.bottom + window.scrollY + DISTANCIA_DO_BOTAO, noFimDaTela));
      // Num botão do corpo do cartão, o menu fica abaixo da faixa de botões do alto (FaixaDoCartao); se assim não couber até o pé
      // da tela, ele encurta e rola por dentro (.kmenu), em vez de subir por cima do lápis.
      const abaixoDaFaixa = faixa && !faixa.contains(botao) ? faixa.getBoundingClientRect().bottom + window.scrollY + DISTANCIA_DO_BOTAO : null;
      const topo = abaixoDaFaixa === null ? naTela : Math.max(naTela, abaixoDaFaixa);
      setPos({
        top: topo,
        left: Math.max(MARGEM_DA_TELA, Math.min(r.left + window.scrollX, window.innerWidth - m.offsetWidth - MARGEM_DA_TELA)),
        maxHeight: abaixoDaFaixa === null ? undefined : window.scrollY + window.innerHeight - topo - MARGEM_DA_TELA
      });
    };
    posicionar();
    // No menu, o primeiro item pode ser um link (o "Ver perfil" da bolinha da equipe, #388, quando as outras ações não valem).
    // Sem rolar: o menu ainda não está no lugar (o top novo vem no próximo desenho), e o foco num menu fora da tela rolaria o cartão.
    m.querySelector<HTMLElement>(painel ? 'select, input, button' : 'button, a[href]')?.focus({ preventScroll: true });
    // O painel que cresce (ex.: uma etiqueta nova na lista) sobe para continuar dentro da tela.
    const observador = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(posicionar);
    observador?.observe(m);
    // A página atrás de um cartão pode rolar com o painel aberto (o clique num campo dele leva a tela ao fim da página): o painel
    // acompanha o botão, e não sobe por cima do topo do cartão, que fica parado.
    window.addEventListener('scroll', posicionar, { passive: true });
    return () => { observador?.disconnect(); window.removeEventListener('scroll', posicionar); };
  }, [botao, painel, faixa]);
  useEffect(() => {
    // composedPath: vale mesmo se o clique tirou da tela o elemento clicado (ex.: o formulário de um painel).
    const fora = (e: MouseEvent) => { if (preso.current || (painel && e.composedPath().includes(ref.current!))) return; fechar.current(); };
    // Antes dos outros (captura): o Esc fecha só o menu, e não também a janela ou o cartão onde ele está.
    // Travado, o Esc não fecha nada: nem o painel, nem o que está atrás dele.
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      if (preso.current) { e.preventDefault(); return; }
      fechar.current(); botao.focus();
    };
    const fecharDeFora = () => {
      const focoDentro = !!ref.current?.contains(document.activeElement);
      fechar.current();
      if (focoDentro) botao.focus();
    };
    abertos.add(fecharDeFora);
    const t = setTimeout(() => document.addEventListener('click', fora), 0);
    document.addEventListener('keydown', tecla, true);
    return () => { abertos.delete(fecharDeFora); clearTimeout(t); document.removeEventListener('click', fora); document.removeEventListener('keydown', tecla, true); };
  }, [botao, painel]);
  return createPortal(<div className={painel ? 'kmenu painel' : 'kmenu'} role={painel ? 'dialog' : 'menu'} aria-label={rotulo} ref={ref} style={pos}
    onKeyDown={setas ? andarComAsSetas : undefined}>
    {children}
  </div>, document.body);
}
