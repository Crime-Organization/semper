// Um parâmetro do endereço que a página lê uma vez, ao abrir, e logo tira do endereço (como o ?responsavel=eu de Pessoas): assim,
// recarregar a página ou copiar o endereço do cartão aberto não o aplica de novo por cima do que a pessoa escolheu depois. O resto
// do endereço (o cartão aberto, ?id=…) continua.
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';

/** O valor que o parâmetro tinha quando a página abriu (null se não veio). */
export function useParametroLido(nome: string): string | null {
  const [params, setParams] = useSearchParams();
  const [lido] = useState(() => params.get(nome));
  const noEndereco = params.has(nome);
  useEffect(() => {
    if (noEndereco) setParams(p => { p.delete(nome); return p; }, { replace: true });
  }, [noEndereco, nome, setParams]);
  return lido;
}
