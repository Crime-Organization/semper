// Os atalhos de teclado da página de módulo (#86): "/" vai à busca, "N" abre o "Novo" do módulo e "?" mostra a ajuda da tela.
// Uma peça só, usada pelo <PaginaModulo>: o módulo não declara nada (os atalhos vêm da busca e da ação principal dele). As telas
// que não são de módulo (Início, Financeiro, Minha conta…, #411) a usam pelo useAjudaDaTela de ui/BotaoDeAjuda.tsx.
// A ajuda (#85) é uma janela só: a explicação da tela em cima (os textos de regras/ajuda.ts, que o módulo passa) e a lista dos
// atalhos embaixo. A tecla "?" e o botão "?" do cabeçalho abrem a mesma janela (useAtalhosDaPagina devolve como abri-la).
// O que dispara e quando está em regras/atalhos.ts; aqui só se lê a tecla, onde está o foco e se há algo aberto por cima.
// A pessoa pode desligar os atalhos de uma tecla só (WCAG 2.1.4: quem dita por voz dispararia o N sem querer): a escolha
// fica nas preferências dela, com a caixa de marcar na própria janela do "?" e em Minha conta (para religar).
import { useCallback, useLayoutEffect, useRef } from 'react';
import { atalhoDaTecla, ehLugarDeEscrever, listaDeAtalhos, type Atalho, type GrupoDeAtalhos, type TeclaApertada } from '../regras/atalhos';
import { Nota, Tecla } from './base';
import { janela } from './janela';
import { criarLoja } from './loja';
import { lerPreferencia, salvarPreferencia } from './preferencias';
import { ehMac } from './util';

/** A preferência da pessoa: os atalhos de uma tecla só ("/", "N", "?") ligados. Começam ligados. */
export const PREFERENCIA_DOS_ATALHOS = 'atalhos.deUmaTecla';
/** Avisa as telas quando a pessoa liga ou desliga os atalhos (a preferência em si fica em ui/preferencias.ts). */
const mudouOsAtalhos = criarLoja(0);
/** Os atalhos de uma tecla estão ligados (lido na hora da tecla). */
export const atalhosLigados = () => lerPreferencia(PREFERENCIA_DOS_ATALHOS, true);
/** Hook: os atalhos estão ligados, e a tela se desenha de novo quando a pessoa muda. */
export function useAtalhosLigados() {
  mudouOsAtalhos.usar();
  return atalhosLigados();
}
/** Liga ou desliga os atalhos de uma tecla só, para esta pessoa, em qualquer aparelho. */
export function ligarAtalhos(ligados: boolean) {
  salvarPreferencia(PREFERENCIA_DOS_ATALHOS, ligados);
  mudouOsAtalhos.mudar(n => n + 1);
}

/** A caixa de marcar que liga e desliga os atalhos de uma tecla só (na janela do "?" e em Minha conta, com a classe dos cartões de lá). */
export function InterruptorDosAtalhos({ className = 'marcar' }: { className?: string }) {
  const ligados = useAtalhosLigados();
  return <label className={className}>
    <input type="checkbox" checked={ligados} onChange={e => ligarAtalhos(e.target.checked)} />
    Atalhos de uma tecla só (/, N, ? e o T do cronômetro)
  </label>;
}

/** A tecla como as regras a leem, com o AltGr (que o Windows informa como Ctrl+Alt). */
export const teclaDoEvento = (e: KeyboardEvent): TeclaApertada => ({
  key: e.key, ctrlKey: e.ctrlKey, altKey: e.altKey, metaKey: e.metaKey, repeat: e.repeat, isComposing: e.isComposing, altGr: e.getModifierState('AltGraph')
});

/**
 * O que fica aberto por cima da página: as janelas, o cartão e a busca geral (dialog) e os menus. Com qualquer um deles
 * aberto, os atalhos da página esperam: o cartão e as janelas têm os seus (como o T do cronômetro da tarefa), e o N não
 * cria um item novo por trás do que a pessoa está vendo.
 */
const POR_CIMA = '[role="dialog"], [role="menu"]';

/** O foco está num lugar de escrever (campo, área de texto, lista de escolha ou editor). Vale também para o T do cronômetro. */
export function estaEscrevendo(alvo: EventTarget | null) {
  if (!(alvo instanceof HTMLElement)) return false;
  return ehLugarDeEscrever({ etiqueta: alvo.tagName, tipo: alvo.getAttribute('type') ?? undefined, editavel: alvo.isContentEditable });
}

/** O título de cada grupo da lista: h3 na janela só de atalhos; h4 na ajuda da tela, onde os atalhos já têm o seu h3. */
const TITULO_DO_GRUPO = { 3: 'h3', 4: 'h4' } as const;

/** A lista de atalhos, agrupada, como a janela do "?" mostra. */
export function ListaDeAtalhos({ grupos, nivel = 3 }: { grupos: GrupoDeAtalhos[]; nivel?: keyof typeof TITULO_DO_GRUPO }) {
  const Titulo = TITULO_DO_GRUPO[nivel];
  return <div className="lista-de-atalhos">
    {grupos.map(g => <section key={g.titulo} aria-label={g.titulo}>
      <Titulo>{g.titulo}</Titulo>
      <dl>
        {g.linhas.map(l => <div key={l.oQueFaz}>
          <dt>{l.teclas.map(t => <Tecla key={t}>{t}</Tecla>)}</dt>
          <dd>{l.oQueFaz}</dd>
        </div>)}
      </dl>
    </section>)}
  </div>;
}

/** O que a janela de ajuda mostra: os atalhos que a página tem e, quando a tela tem texto em regras/ajuda.ts, o título e a explicação dela. */
export interface AjudaDaPagina {
  temBusca: boolean;
  novo: string | null;
  /** O título da tela e os parágrafos da explicação (regras/ajuda.ts). Sem eles (página de módulo sem texto de ajuda), a janela mostra só os atalhos. */
  tela?: ExplicacaoDaTela;
}
/** O título da tela e os parágrafos que a explicam, na ajuda (#85). */
export interface ExplicacaoDaTela { titulo: string; textos: readonly string[] }

/** A lista dos atalhos e a caixa de marcar que os desliga: embaixo, na ajuda da tela, ou sozinha, na janela só de atalhos. */
function AtalhosDaJanela({ temBusca, novo, nivel }: { temBusca: boolean; novo: string | null; nivel: keyof typeof TITULO_DO_GRUPO }) {
  return <>
    <ListaDeAtalhos nivel={nivel} grupos={listaDeAtalhos({ temBusca, novo, mac: ehMac() })} />
    <div className="atalhos-desligar">
      <InterruptorDosAtalhos />
      <Nota>Desligue se você dita por voz ou se as letras disparam algo sem querer. Desligados, a tecla ? não abre esta janela: use o botão ? no alto das páginas, ou religue em Minha conta.</Nota>
    </div>
  </>;
}

/** O id do título "Atalhos do teclado" dentro da ajuda (só uma ajuda fica aberta por vez: com ela aberta, o "?" espera). */
const TITULO_DOS_ATALHOS = 'ajuda-atalhos-titulo';

/**
 * Abre a ajuda da página. Com a explicação da tela (nas páginas de módulo e nas outras telas, como o Financeiro, #411), é a janela
 * "Ajuda: <tela>", com o texto em cima e os atalhos embaixo; sem ela (página de módulo sem texto em regras/ajuda.ts), é a janela
 * "Atalhos do teclado". A ajuda é a janela larga, em que só o corpo
 * rola: a explicação aparece primeiro, mesmo com o foco no Fechar, e o título e o Fechar ficam à vista.
 */
export function mostrarAjuda({ temBusca, novo, tela }: AjudaDaPagina) {
  if (!tela) return janela({ titulo: 'Atalhos do teclado', corpo: <AtalhosDaJanela temBusca={temBusca} novo={novo} nivel={3} /> });
  return janela({ titulo: `Ajuda: ${tela.titulo}`, larga: true, corpo: <>
    <div className="ajuda-da-tela">{tela.textos.map(t => <p key={t}>{t}</p>)}</div>
    <section className="ajuda-atalhos" aria-labelledby={TITULO_DOS_ATALHOS}>
      <h3 id={TITULO_DOS_ATALHOS}>Atalhos do teclado</h3>
      <AtalhosDaJanela temBusca={temBusca} novo={novo} nivel={4} />
    </section>
  </> });
}

/**
 * Liga os atalhos enquanto a página está na tela. "buscar" e "novo" são o que a página faz em cada um (sem busca ou sem
 * "Novo", a tecla não faz nada e fica livre); "novo" traz também o nome do botão, para a lista. "tela" é o título e a
 * explicação da tela, para a ajuda (#85). Devolve como abrir a ajuda: o botão "?" do cabeçalho abre a mesma janela da tecla.
 */
export function useAtalhosDaPagina({ buscar, novo, tela }: { buscar?: () => void; novo?: { rotulo: string; abrir: () => void }; tela?: ExplicacaoDaTela }) {
  const atual = useRef({ buscar, novo, tela });
  atual.current = { buscar, novo, tela };
  const abrirAjuda = useCallback(() => {
    const { buscar: irParaBusca, novo: oNovo, tela: aTela } = atual.current;
    void mostrarAjuda({ temBusca: !!irParaBusca, novo: oNovo?.rotulo ?? null, tela: aTela });
  }, []);
  // Os atalhos valem desde que a página aparece (#420). Com o useEffect, eles se ligavam um instante depois de a página estar na
  // tela (o React roda esses efeitos depois de desenhar): com o computador carregado, o "/" apertado logo ao ver a página se
  // perdia, e as letras seguintes iam para a página (o "n" abria a Nova tarefa). O useLayoutEffect liga antes de desenhar.
  useLayoutEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const atalho = atalhoDaTecla(teclaDoEvento(e), { escrevendo: estaEscrevendo(e.target), algoPorCima: !!document.querySelector(POR_CIMA), desligados: !atalhosLigados() });
      const { buscar: irParaBusca, novo: oNovo } = atual.current;
      const acoes: Record<Atalho, (() => void) | undefined> = {
        buscar: irParaBusca,
        novo: oNovo?.abrir,
        atalhos: abrirAjuda
      };
      const fazer = atalho && acoes[atalho];
      if (!fazer) return;
      e.preventDefault();
      fazer();
    };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, [abrirAjuda]);
  return abrirAjuda;
}
