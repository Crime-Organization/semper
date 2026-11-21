// Uma edição aberta de cada vez (#395), na tela: a faixa das datas do cartão (ui/base/GrupoDeDatas.tsx) e os prazos do processo
// guardam aqui qual formulário está aberto e se ele tem algo por salvar. A regra de quando trocar fica em regras/edicaoUnica.ts.
import { useCallback, useState } from 'react';
import { pedirEdicao, type EdicaoAberta } from '../regras/edicaoUnica';

export interface EdicaoUnica {
  /** O formulário aberto, ou null. */
  aberta: string | null;
  /** Quantas vezes a pessoa pediu outro formulário com o aberto por salvar: o aberto, ao ver o número mudar, lembra dela. */
  barrados: number;
  /** Pede para abrir o formulário: true quando abriu (trocando o aberto, se ele não tinha nada por salvar), false quando o aberto ficou. */
  pedir: (id: string) => boolean;
  /** O formulário fechou (salvo, cancelado, ou saiu da tela). */
  fechar: (id: string) => void;
  /** O formulário aberto passou a ter (ou deixou de ter) algo por salvar. */
  marcarSujo: (id: string, sujo: boolean) => void;
}

export function useEdicaoUnica(): EdicaoUnica {
  const [aberta, setAberta] = useState<EdicaoAberta | null>(null);
  const [barrados, setBarrados] = useState(0);
  const pedir = (id: string) => {
    if (pedirEdicao(aberta, id) === 'manter') { setBarrados(n => n + 1); return false; }
    if (aberta?.id !== id) setAberta({ id, sujo: false });
    return true;
  };
  const fechar = useCallback((id: string) => setAberta(a => a?.id === id ? null : a), []);
  const marcarSujo = useCallback((id: string, sujo: boolean) => setAberta(a => a?.id === id && a.sujo !== sujo ? { id, sujo } : a), []);
  return { aberta: aberta?.id ?? null, barrados, pedir, fechar, marcarSujo };
}
