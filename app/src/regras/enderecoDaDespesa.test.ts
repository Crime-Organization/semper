// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// O endereço que abre uma despesa do escritório (#439), em supabase/functions/_compartilhado/enderecoDaDespesa.ts: o site o lê e a
// agenda Administrativo do Google (#166) o leva na descrição do evento.
import { describe, expect, it } from 'vitest';
import { CAMINHO_DAS_DESPESAS, enderecoDaDespesa, PARAMETROS_DA_DESPESA } from '../../../supabase/functions/_compartilhado/enderecoDaDespesa';
import { mesPedido, PARAMETROS_DO_LANCAMENTO } from './caixa';

describe('Endereço da despesa', () => {
  it('dada uma despesa, quando monta o endereço, então ele abre a aba Obrigações no mês do vencimento, com a despesa', () => {
    // Quando
    const endereco = enderecoDaDespesa({ id: 'd-1', vencimento: '2026-12-10' });
    // Então
    expect(endereco).toBe('/financeiro/obrigacoes/?mes=2026-12&despesa=d-1');
    const url = new URL(endereco, 'https://exemplo.test');
    expect(url.pathname).toBe(CAMINHO_DAS_DESPESAS);
    expect(mesPedido(url.searchParams.get(PARAMETROS_DO_LANCAMENTO.mes))).toBe('2026-12');
    expect(url.searchParams.get(PARAMETROS_DA_DESPESA.despesa)).toBe('d-1');
  });

  it('dado o mês do endereço, quando a página do Financeiro o lê, então é o mesmo parâmetro do lançamento pedido', () => {
    // Quando / Então
    expect(PARAMETROS_DA_DESPESA.mes).toBe(PARAMETROS_DO_LANCAMENTO.mes);
    expect(CAMINHO_DAS_DESPESAS).toBe('/financeiro/obrigacoes/');
  });

  it('dado um id com caracteres especiais, quando monta o endereço, então ele vai codificado', () => {
    // Quando
    const url = new URL(enderecoDaDespesa({ id: 'a&b=c', vencimento: '2027-01-31' }), 'https://exemplo.test');
    // Então
    expect(url.searchParams.get(PARAMETROS_DA_DESPESA.despesa)).toBe('a&b=c');
    expect(url.searchParams.get(PARAMETROS_DA_DESPESA.mes)).toBe('2027-01');
  });
});
