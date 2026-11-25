// Processos relacionados de qualquer tipo (#440). Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Os nomes são inventados.
import { describe, expect, it } from 'vitest';
import type { ProcessoRelacionado } from '../dados/tipos';
import { comOsRelacionados, foraDaBuscaDeProcessos, judicialParaDesligar, RELACOES } from './processo';

const base = { numero: '1', titulo: null, cliente_nome: '', etapa_id: null, arquivado_em: null };
const ORIGEM: ProcessoRelacionado = { ...base, id: 'o', codigo: 'O1', tipo: 'administrativo', criado_em: '2026-01-01', relacao: 'administrativo' };
const RECURSO: ProcessoRelacionado = { ...base, id: 'r', codigo: 'R1', tipo: 'judicial', criado_em: '2026-02-01', relacao: 'recurso' };
const { relacao: _o, ...origemSemRelacao } = ORIGEM;
const LIGADO_ANTIGO = { ...base, id: 'a', codigo: 'A1', tipo: 'judicial' as const, criado_em: '2026-03-01' };
const LIGADO_NOVO = { ...base, id: 'b', codigo: 'B1', tipo: 'administrativo' as const, criado_em: '2026-04-01' };

describe('Processos relacionados de qualquer tipo (#440)', () => {
  it('dado processos ligados depois, quando o cartão junta com os de origem, então eles aparecem como "Relacionado", depois da origem, dos mais novos aos mais antigos', () => {
    // Quando
    const lista = comOsRelacionados([RECURSO, ORIGEM], [LIGADO_ANTIGO, LIGADO_NOVO]);
    // Então
    expect(lista.map(p => [p.id, p.relacao])).toEqual([['o', 'administrativo'], ['b', 'relacionado'], ['a', 'relacionado'], ['r', 'recurso']]);
    expect(RELACOES.relacionado).toBe('Relacionado');
  });

  it('dado um processo que é origem e também foi ligado depois, quando o cartão junta as listas, então ele aparece uma vez só, pela origem', () => {
    // Quando
    const lista = comOsRelacionados([ORIGEM], [origemSemRelacao]);
    // Então
    expect(lista).toEqual([ORIGEM]);
  });

  it('quando a busca de "Ligar processo existente" abre, então ficam de fora o próprio processo e todos os que já estão na seção', () => {
    // Então
    expect(foraDaBuscaDeProcessos('aberto', [ORIGEM, RECURSO])).toEqual(['aberto', 'o', 'r']);
    expect(foraDaBuscaDeProcessos('aberto', [])).toEqual(['aberto']);
  });

  it('dado um relacionado, quando se pergunta qual judicial guarda a ligação, então nenhum: ele se desfaz pela própria ligação', () => {
    // Então
    expect(judicialParaDesligar({ id: 'b', relacao: 'relacionado' }, 'aberto')).toBeNull();
  });
});
