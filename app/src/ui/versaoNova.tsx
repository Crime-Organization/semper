// Aviso de versão nova: uma aba aberta antes de uma publicação continua rodando o código antigo até recarregar.
// De tempos em tempos (e quando a aba volta a ficar visível), ela lê o /versao.txt e, se a versão no ar for outra,
// mostra um aviso com o botão "Recarregar". Nada recarrega sozinho: quem está no meio de um cadastro escolhe a hora.
import { useEffect, useState } from 'react';
import { haVersaoNova, versaoDoArquivo, versaoValida } from '../regras/versao';
import { CONFERIR_VERSAO_A_CADA } from './tempos';

/** A versão no ar, sem passar pelo cache do navegador. Sem resposta (fora do ar, sem internet) → null. */
async function lerVersaoNoAr() {
  try {
    const resposta = await fetch(import.meta.env.BASE_URL + 'versao.txt', { cache: 'no-store' });
    return resposta.ok ? versaoDoArquivo(await resposta.text()) : null;
  } catch {
    return null;
  }
}

export function AvisoDeVersaoNova({ versao = __VERSAO__, recarregar = () => location.reload() }: { versao?: string; recarregar?: () => void }) {
  const [noAr, setNoAr] = useState<string | null>(null);
  const [dispensada, setDispensada] = useState<string | null>(null);

  useEffect(() => {
    // Sem versão embutida (npm run dev, banco fictício, testes), não há o que comparar.
    if (!versaoValida(versao)) return;
    let ativo = true;
    const conferir = async () => {
      if (document.visibilityState === 'hidden') return;
      const lida = await lerVersaoNoAr();
      if (ativo && haVersaoNova(versao, lida)) setNoAr(lida);
    };
    const relogio = setInterval(conferir, CONFERIR_VERSAO_A_CADA);
    const aoVoltar = () => { if (document.visibilityState === 'visible') void conferir(); };
    document.addEventListener('visibilitychange', aoVoltar);
    return () => { ativo = false; clearInterval(relogio); document.removeEventListener('visibilitychange', aoVoltar); };
  }, [versao]);

  if (!noAr || noAr === dispensada) return null;
  return <div className="toast">
    Há uma versão nova do SEMPER.
    <button type="button" className="toast-acao" onClick={recarregar}>Recarregar</button>
    <button type="button" className="toast-acao" onClick={() => setDispensada(noAr)}>Agora não</button>
  </div>;
}
