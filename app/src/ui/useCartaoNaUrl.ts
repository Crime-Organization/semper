// Cartão aberto na URL (?id=...): o link leva direto ao item, e fechar tira o id do endereço.
// Peça comum dos módulos (Pessoas, Contratos...): não sabe o que o cartão mostra.
import { useSearchParams } from 'react-router';

export function useCartaoNaUrl() {
  const [params, setParams] = useSearchParams();
  return {
    /** id do item aberto, ou null. */
    aberto: params.get('id'),
    abrir: (id: string) => setParams({ id }, { replace: true }),
    fechar: () => setParams({}, { replace: true })
  };
}
