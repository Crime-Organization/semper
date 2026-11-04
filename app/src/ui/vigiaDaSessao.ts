// Vigia da sessão: quando a sessão acaba em outro lugar (troca de e-mail pelo administrador, "Sair" em outro aparelho), o banco deixa
// de devolver dados, mas não dá erro, e as listas ficariam vazias como se tudo tivesse sumido. De tempos em tempos (e quando a aba
// volta a ficar visível), a aba confere a sessão e leva a pessoa à entrada.
import { useEffect } from 'react';
import { CONFERIR_SESSAO_A_CADA } from './tempos';

export function useVigiaDaSessao(sessaoEncerrada: () => Promise<boolean>, aoEncerrar: () => void) {
  useEffect(() => {
    let ativo = true;
    const conferir = async () => {
      if (document.visibilityState === 'hidden') return;
      // Sem resposta (sem internet, login fora do ar), a pessoa continua onde está.
      const encerrada = await sessaoEncerrada().catch(() => false);
      if (ativo && encerrada) aoEncerrar();
    };
    const relogio = setInterval(conferir, CONFERIR_SESSAO_A_CADA);
    const aoVoltar = () => { if (document.visibilityState === 'visible') void conferir(); };
    document.addEventListener('visibilitychange', aoVoltar);
    return () => { ativo = false; clearInterval(relogio); document.removeEventListener('visibilitychange', aoVoltar); };
  }, [sessaoEncerrada, aoEncerrar]);
}
