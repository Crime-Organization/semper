// Os atalhos de teclado da página de módulo (#86): "/" vai à busca, "N" abre o "Novo" do módulo e "?" mostra a lista.
// Uma peça só, usada pelo <PaginaModulo>: o módulo não declara nada (os atalhos vêm da busca e da ação principal dele).
// O que dispara e quando está em regras/atalhos.ts; aqui só se lê a tecla, onde está o foco e se há algo aberto por cima.
// A pessoa pode desligar os atalhos de uma tecla só (WCAG 2.1.4: quem dita por voz dispararia o N sem querer): a escolha
// fica nas preferências dela, com a caixa de marcar na própria lista do "?" e em Minha conta (para religar).
import { useEffect, useRef } from 'react';
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

/** A caixa de marcar que liga e desliga os atalhos de uma tecla só (na lista do "?" e em Minha conta, com a classe dos cartões de lá). */
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

/** A lista de atalhos, agrupada, como a janela do "?" mostra. */
export function ListaDeAtalhos({ grupos }: { grupos: GrupoDeAtalhos[] }) {
  return <div className="lista-de-atalhos">
    {grupos.map(g => <section key={g.titulo} aria-label={g.titulo}>
      <h3>{g.titulo}</h3>
      <dl>
        {g.linhas.map(l => <div key={l.oQueFaz}>
          <dt>{l.teclas.map(t => <Tecla key={t}>{t}</Tecla>)}</dt>
          <dd>{l.oQueFaz}</dd>
        </div>)}
      </dl>
    </section>)}
  </div>;
}

/** Abre a janela com a lista dos atalhos da página e a caixa de marcar que os desliga. */
export function mostrarAtalhos(pagina: { temBusca: boolean; novo: string | null }) {
  return janela({ titulo: 'Atalhos do teclado', corpo: <>
    <ListaDeAtalhos grupos={listaDeAtalhos({ ...pagina, mac: ehMac() })} />
    <div className="atalhos-desligar">
      <InterruptorDosAtalhos />
      <Nota>Desligue se você dita por voz ou se as letras disparam algo sem querer. Desligados, o ? também não abre esta lista: para religar, vá a Minha conta.</Nota>
    </div>
  </> });
}

/**
 * Liga os atalhos enquanto a página está na tela. "buscar" e "novo" são o que a página faz em cada um (sem busca ou sem
 * "Novo", a tecla não faz nada e fica livre); "novo" traz também o nome do botão, para a lista.
 */
export function useAtalhosDaPagina({ buscar, novo }: { buscar?: () => void; novo?: { rotulo: string; abrir: () => void } }) {
  const atual = useRef({ buscar, novo });
  atual.current = { buscar, novo };
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const atalho = atalhoDaTecla(teclaDoEvento(e), { escrevendo: estaEscrevendo(e.target), algoPorCima: !!document.querySelector(POR_CIMA), desligados: !atalhosLigados() });
      const { buscar: irParaBusca, novo: oNovo } = atual.current;
      const acoes: Record<Atalho, (() => void) | undefined> = {
        buscar: irParaBusca,
        novo: oNovo?.abrir,
        atalhos: () => { void mostrarAtalhos({ temBusca: !!irParaBusca, novo: oNovo?.rotulo ?? null }); }
      };
      const fazer = atalho && acoes[atalho];
      if (!fazer) return;
      e.preventDefault();
      fazer();
    };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, []);
}
