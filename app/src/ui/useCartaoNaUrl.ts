// Cartão aberto na URL (?id=...): o link leva direto ao item, e fechar tira o id do endereço.
// Peça comum dos módulos (Pessoas, Contratos...): não sabe o que o cartão mostra.
import { useLocation, useSearchParams } from 'react-router';

export function useCartaoNaUrl() {
  const [params, setParams] = useSearchParams();
  const { pathname } = useLocation();
  return {
    /** id do item aberto, ou null. */
    aberto: params.get('id'),
    // O resto do endereço (ex.: o filtro que veio do painel de Processos) continua.
    abrir: (id: string) => setParams(p => { p.set('id', id); return p; }, { replace: true }),
    fechar: () => setParams(p => { p.delete('id'); return p; }, { replace: true }),
    /** Endereço que abre o cartão do item (o que vai para a aba nova no Ctrl+clique). */
    endereco: (id: string) => `${pathname}?${new URLSearchParams({ id })}`
  };
}
