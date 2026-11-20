// Os atalhos de teclado da página de módulo (#86): "/" vai à busca, "N" abre o "Novo" do módulo e "?" mostra a lista.
// Uma peça só, usada pelo <PaginaModulo>: o módulo não declara nada (os atalhos vêm da busca e da ação principal dele).
// O que dispara e quando está em regras/atalhos.ts; aqui só se lê a tecla, onde está o foco e se há algo aberto por cima.
import { useEffect, useRef } from 'react';
import { atalhoDaTecla, ehLugarDeEscrever, listaDeAtalhos, type Atalho, type GrupoDeAtalhos } from '../regras/atalhos';
import { janela } from './janela';
import { ehMac } from './util';

/**
 * O que fica aberto por cima da página: as janelas, o cartão e a busca geral (dialog) e os menus. Com qualquer um deles
 * aberto, os atalhos da página esperam: o cartão e as janelas têm os seus (como o T do cronômetro da tarefa), e o N não
 * cria um item novo por trás do que a pessoa está vendo.
 */
const POR_CIMA = '[role="dialog"], [role="menu"]';

/** O foco está num lugar de escrever (campo, área de texto, lista de escolha ou editor). */
function escrevendo(alvo: EventTarget | null) {
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
          <dt>{l.teclas.map(t => <kbd key={t}>{t}</kbd>)}</dt>
          <dd>{l.oQueFaz}</dd>
        </div>)}
      </dl>
    </section>)}
  </div>;
}

/** Abre a janela com a lista dos atalhos da página. */
export function mostrarAtalhos(pagina: { temBusca: boolean; novo: string | null }) {
  return janela({ titulo: 'Atalhos do teclado', corpo: <ListaDeAtalhos grupos={listaDeAtalhos({ ...pagina, mac: ehMac() })} /> });
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
      const atalho = atalhoDaTecla(e, { escrevendo: escrevendo(e.target), algoPorCima: !!document.querySelector(POR_CIMA) });
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
