// O registro das coisas do cartão (#351; desde a #399, para o menu "Acrescentar ao cartão", em AcrescentarAoCartao.tsx). Quem já
// sabe mostrar e abrir uma coisa do cartão (a seção com o "+" no título, o dado que se muda no lugar) a oferece com
// useAtalhoDoCartao: como chegar até ela (ver), quantas há e, para quem pode, como acrescentar uma nova; o menu lê as oferecidas. O
// painel do cartão (PainelCartao) põe o registro em volta de tudo, a coluna da direita também (ela vai por um portal, mas fica na
// mesma árvore).
import { createContext, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { TipoDeAtalho } from '../regras/atalhosDoCartao';

/** Como acrescentar uma nova: levar a um endereço (a anotação nova, que abre na janela da anotação) ou abrir ali mesmo. */
export interface Atalho {
  /** O que faz, por inteiro (ex.: "Adicionar checklist", "Mudar o prazo"): o nome do "+" da linha no menu. */
  nome: string;
  /** Leva a este endereço. */
  para?: string;
  /** Abre a coisa ali mesmo; recebe o botão onde o menu do item novo se prende (a bolinha do menu). */
  abrir?: (botao: HTMLElement) => void;
  /** Abre um menu (ex.: "Adicionar checklist"), e não um formulário: o leitor de tela fica sabendo. */
  menu?: boolean;
}

/** Uma coisa do cartão, como o menu a mostra (#399). */
export interface CoisaDoCartao {
  /** Quantas já existem (o número da seção). Sem ele (o prazo), o menu não mostra número. */
  quantidade?: number;
  /** Leva até a coisa no cartão e a abre, com o foco nela. */
  ver: () => void;
  /** Como acrescentar uma nova; no cartão arquivado ou só para ler, nenhum. */
  acrescentar?: Atalho | null;
}

/**
 * Uma coisa oferecida: o tipo e como ler a de agora (o que ela faz muda a cada desenho de quem a oferece). Quem deixou de
 * oferecer só sai do registro depois do desenho: até lá, a coisa lida é vazia.
 */
export interface AtalhoOferecido { id: string; tipo: TipoDeAtalho; ler: () => CoisaDoCartao | null | undefined }
interface Registro {
  inscrever: (oferecido: AtalhoOferecido) => () => void;
  /** A coisa mudou (a contagem, o acrescentar): o menu redesenha, com as coisas na mesma ordem. */
  mudou: () => void;
}
const RegistroDosAtalhos = createContext<Registro | null>(null);
const Oferecidos = createContext<AtalhoOferecido[]>([]);

/** O registro das coisas de um cartão: em volta do cartão inteiro. */
export function ComAtalhosDoCartao({ children }: { children: ReactNode }) {
  const [oferecidos, setOferecidos] = useState<AtalhoOferecido[]>([]);
  const registro = useMemo<Registro>(() => ({
    inscrever: oferecido => {
      setOferecidos(lista => [...lista.filter(o => o.id !== oferecido.id), oferecido]);
      return () => setOferecidos(lista => lista.filter(o => o.id !== oferecido.id));
    },
    mudou: () => setOferecidos(lista => [...lista])
  }), []);
  return <RegistroDosAtalhos.Provider value={registro}>
    <Oferecidos.Provider value={oferecidos}>{children}</Oferecidos.Provider>
  </RegistroDosAtalhos.Provider>;
}

/** As coisas oferecidas ao cartão em que está (fora do registro, nenhuma). */
export function useAtalhosOferecidos() {
  return useContext(Oferecidos);
}

/**
 * Oferece uma coisa ao menu do cartão em que está, enquanto `coisa` existir (sem `tipo` ou sem `coisa`, nada; fora do registro,
 * também nada). O menu sempre faz o que a coisa do último desenho manda; a contagem e o acrescentar (o nome, o endereço, o menu)
 * redesenham o menu.
 */
export function useAtalhoDoCartao(tipo: TipoDeAtalho | undefined, coisa: CoisaDoCartao | null | undefined) {
  const registro = useContext(RegistroDosAtalhos);
  const id = useId();
  const atual = useRef(coisa);
  atual.current = coisa;
  const ativo = !!tipo && !!coisa;
  const novo = coisa?.acrescentar;
  const chave = coisa ? [coisa.quantidade ?? '', novo?.nome ?? '', novo?.para ?? '', novo?.menu ? 'menu' : ''].join('|') : '';
  // Antes de a tela ser desenhada (layout effect): a bolinha do menu aparece junto com o cartão, e não um quadro depois, empurrando a
  // equipe do topo para baixo (e tudo o que vem embaixo dela) quando chega (#422).
  useLayoutEffect(() => {
    if (!registro || !tipo || !ativo) return;
    return registro.inscrever({ id, tipo, ler: () => atual.current });
  }, [registro, tipo, ativo, id]);
  // A coisa mudou sem deixar de existir: o menu relê, sem tirar e pôr de novo (a ordem das oferecidas fica a mesma).
  const vista = useRef(chave);
  useEffect(() => {
    if (vista.current === chave) return;
    vista.current = chave;
    if (registro && ativo) registro.mudou();
  }, [registro, ativo, chave]);
}
