// Cartão aberto na URL (?id=...): o link leva direto ao item, e fechar tira o id do endereço.
// Peça comum dos módulos (Pessoas, Contratos...): não sabe o que o cartão mostra.
import { useLocation, useSearchParams } from 'react-router';

export function useCartaoNaUrl() {
  const [params, setParams] = useSearchParams();
  const { pathname } = useLocation();
  return {
    /** id do item aberto, ou null. */
    aberto: params.get('id'),
    abrir: (id: string) => setParams({ id }, { replace: true }),
    fechar: () => setParams({}, { replace: true }),
    /** Endereço que abre o cartão do item (o que vai para a aba nova no Ctrl+clique). */
    endereco: (id: string) => `${pathname}?${new URLSearchParams({ id })}`
  };
}
