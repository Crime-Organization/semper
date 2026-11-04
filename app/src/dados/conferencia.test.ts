// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. O banco fictício precisa se comportar como o de verdade; as regras de quem vê o
// quê estão em supabase/tests/conferencia_de_lancamentos.test.sql, porque o banco fictício sempre entra como administrador.
import { describe, expect, it } from 'vitest';
import { SD } from './falso';

const ANO = 2026;
const linha = async (cliente: string) => (await SD.conferenciaListar(ANO, null)).find(l => l.cliente === cliente)!;

describe('Conferência no banco fictício', () => {
  it('quando lista um ano e um responsável, então traz só essas linhas, com a mais nova primeiro', async () => {
    // Quando
    const minhas = await SD.conferenciaListar(ANO, 'u-master');
    // Então
    expect(minhas.map(l => l.cliente)).toEqual(['CLIENTE SÓ NO CAIXA', 'CLIENTE SEM ENTRADA', 'CLIENTE QUE CONFERE']);
    expect((await SD.conferenciaListar(ANO, 'u-ana')).map(l => l.cliente)).toEqual(['CLIENTE DA ANA']);
    expect((await SD.conferenciaListar(2025, null)).map(l => l.cliente)).toEqual(['CLIENTE DE 2025']);
  });

  it('quando marca e apaga a marcação, então guarda e limpa quem marcou, e registra no histórico', async () => {
    // Dado
    const { id } = await linha('CLIENTE DA ANA');
    // Quando
    await SD.conferenciaMarcar(id, 'nao_confere', '  Falta o comprovante  ');
    // Então
    expect(await linha('CLIENTE DA ANA')).toMatchObject({ situacao: 'nao_confere', observacao: 'Falta o comprovante', marcado_por: 'u-master' });
    // Quando
    await SD.conferenciaMarcar(id, null, null);
    // Então
    expect(await linha('CLIENTE DA ANA')).toMatchObject({ situacao: null, observacao: null, marcado_por: null, marcado_em: null });
    expect(Object.keys((await SD.conferenciaHistorico(id))[0].alteracoes)).toEqual(['Situação', 'Observação']);
  });

  it('quando corrige, então guarda, registra no histórico e recusa a data futura e o valor zero', async () => {
    // Dado
    const { id, valor_caixa } = await linha('CLIENTE SÓ NO CAIXA');
    // Quando
    await SD.conferenciaCorrigir(id, '2026-05-20', 50000);
    // Então
    expect(await linha('CLIENTE SÓ NO CAIXA')).toMatchObject({ data_pago: '2026-05-20', valor_pago: 50000, valor_caixa });
    expect(Object.keys((await SD.conferenciaHistorico(id))[0].alteracoes)).toEqual(['Pago em', 'Valor pago']);
    await expect(SD.conferenciaCorrigir(id, '2999-01-01', 100)).rejects.toThrow('A data do pagamento não pode estar no futuro.');
    await expect(SD.conferenciaCorrigir(id, '2026-05-20', 0)).rejects.toThrow('Confira o valor pago.');
  });

  it('quando pede o resumo, então vem por responsável e ano, com o que confere e o que falta', async () => {
    // Dado
    const { id } = await linha('CLIENTE QUE CONFERE');
    await SD.conferenciaMarcar(id, 'confere', null);
    // Quando
    const resumo = await SD.conferenciaResumo();
    // Então
    const meu = resumo.find(r => r.responsavel_id === 'u-master' && r.ano === ANO)!;
    expect(meu.total).toBe(3);
    expect(meu.confere).toBe(1);
    expect(meu.valor_confere).toBe(100000);
    expect(resumo.map(r => r.ano)).toEqual(resumo.map(r => r.ano).toSorted((a, b) => b - a));
  });
});
