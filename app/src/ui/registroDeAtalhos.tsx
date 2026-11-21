// O registro dos botões rápidos do cartão (#351; a linha fica em AtalhosDoCartao.tsx). Quem já sabe abrir uma coisa do cartão
// (a seção com o "+" no título, o dado que se muda no lugar) oferece o botão com useAtalhoDoCartao, enquanto pode; a linha lê os
// oferecidos. O painel do cartão (PainelCartao) põe o registro em volta de tudo, a coluna da direita também (ela vai por um portal,
// mas fica na mesma árvore).
import { createContext, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import type { TipoDeAtalho } from '../regras/atalhosDoCartao';

/** O que um botão faz: leva a um endereço (a anotação nova, que abre na janela da anotação) ou abre a coisa ali mesmo. */
export interface Atalho {
  /** O que o botão faz, por inteiro (ex.: "Adicionar checklist", "Mudar o prazo"): a dica dele. */
  nome: string;
  /** Leva a este endereço. */
  para?: string;
  /** Abre a coisa ali mesmo; recebe o botão clicado, onde o menu do item novo se prende. */
  abrir?: (botao: HTMLElement) => void;
  /** O botão abre um menu (ex.: "Adicionar checklist"), e não um formulário: o leitor de tela fica sabendo. */
  menu?: boolean;
}

/**
 * Um botão oferecido: o tipo e como ler o atalho de agora (o que ele faz muda a cada desenho de quem o oferece). Quem deixou de
 * oferecer (o item acabou de ser arquivado) só sai do registro depois do desenho: até lá, o atalho lido é vazio.
 */
export interface AtalhoOferecido { id: string; tipo: TipoDeAtalho; ler: () => Atalho | null | undefined }
interface Registro { inscrever: (oferecido: AtalhoOferecido) => () => void }
const RegistroDosAtalhos = createContext<Registro | null>(null);
const Oferecidos = createContext<AtalhoOferecido[]>([]);

/** O registro dos botões rápidos de um cartão: em volta do cartão inteiro. */
export function ComAtalhosDoCartao({ children }: { children: ReactNode }) {
  const [oferecidos, setOferecidos] = useState<AtalhoOferecido[]>([]);
  const registro = useMemo<Registro>(() => ({
    inscrever: oferecido => {
      setOferecidos(lista => [...lista.filter(o => o.id !== oferecido.id), oferecido]);
      return () => setOferecidos(lista => lista.filter(o => o.id !== oferecido.id));
    }
  }), []);
  return <RegistroDosAtalhos.Provider value={registro}>
    <Oferecidos.Provider value={oferecidos}>{children}</Oferecidos.Provider>
  </RegistroDosAtalhos.Provider>;
}

/** Os botões oferecidos ao cartão em que está (fora do registro, nenhum). */
export function useAtalhosOferecidos() {
  return useContext(Oferecidos);
}

/**
 * Oferece um botão rápido ao cartão em que está, enquanto `atalho` existir (sem `tipo` ou sem `atalho`, nada; fora do registro,
 * também nada). O botão sempre faz o que o atalho do último desenho manda; só o nome, o endereço e o menu redesenham a linha.
 */
export function useAtalhoDoCartao(tipo: TipoDeAtalho | undefined, atalho: Atalho | null | undefined) {
  const registro = useContext(RegistroDosAtalhos);
  const id = useId();
  const atual = useRef(atalho);
  atual.current = atalho;
  const ativo = !!tipo && !!atalho;
  const chave = atalho ? [atalho.nome, atalho.para ?? '', atalho.menu ? 'menu' : ''].join('|') : '';
  useEffect(() => {
    if (!registro || !tipo || !ativo) return;
    return registro.inscrever({ id, tipo, ler: () => atual.current });
  }, [registro, tipo, ativo, chave, id]);
}
