// O número de mensagens não lidas, do sistema todo (mostrado no menu). Confere ao mudar de tela e de tempos em tempos.
import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { SD } from '../dados';
import { criarLoja } from './loja';
import { CONFERIR_MENSAGENS_A_CADA } from './tempos';

export const naoLidas = criarLoja(0);

export async function atualizarNaoLidas() {
  // O contador não vale um erro na tela: se a conferência falhar, ele fica como estava até a próxima.
  try { naoLidas.mudar(await SD.mensagensNaoLidas()); } catch { return; }
}

/** Mantém o número em dia enquanto a casca do app está na tela. */
export function useConferirNaoLidas() {
  const { pathname, search } = useLocation();
  useEffect(() => { void atualizarNaoLidas(); }, [pathname, search]);
  useEffect(() => {
    const relogio = setInterval(() => void atualizarNaoLidas(), CONFERIR_MENSAGENS_A_CADA);
    return () => clearInterval(relogio);
  }, []);
}
