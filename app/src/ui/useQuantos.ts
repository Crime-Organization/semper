// A lista de uma seção do cartão, lida pelo cartão ao abrir, para o número ao lado do título (o <Recolhivel> só monta o
// conteúdo quando abre). Enquanto lê, ou se a leitura falhar, vem undefined e não há número.
// "chave" diz quando ler de novo (ex.: o id do cartão e a versão do histórico); com "ligada" false, não lê nada (ex.: o
// módulo está desligado no escritório).
import { useEffect, useRef, useState } from 'react';

export function useLista<T>(carregar: () => Promise<T[]>, chave: string, ligada = true): T[] | undefined {
  const [lista, setLista] = useState<T[] | undefined>(undefined);
  const leitura = useRef(carregar);
  leitura.current = carregar;
  useEffect(() => {
    if (!ligada) { setLista(undefined); return; }
    let vivo = true;
    leitura.current().then(l => { if (vivo) setLista(l); }).catch(() => { if (vivo) setLista(undefined); });
    return () => { vivo = false; };
  }, [chave, ligada]);
  return lista;
}

/** Só quantos itens a seção tem. */
export const useQuantos = <T,>(carregar: () => Promise<T[]>, chave: string, ligada = true) => useLista(carregar, chave, ligada)?.length;
