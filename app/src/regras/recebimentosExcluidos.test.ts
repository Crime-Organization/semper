// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import type { RecebimentoExcluido } from '../dados/tipos';
import { fmtCentavos } from './caixa';
import { CONTA_REMOVIDA, linhaDoExcluido, QUEM_SAIU, SEM_CONTA } from './recebimentosExcluidos';

const EQUIPE = [{ id: 'u-1', nome: 'Pessoa Administradora' }];
const recebimento = (extra: Partial<RecebimentoExcluido> = {}): RecebimentoExcluido => ({
  id: 1, contrato_codigo: 'AA11-0004-2030', tipo: 'recebimento', parcela_numero: 2, data: '2030-03-10', valor: 123456, conta_nome: 'PJ', estornado: false,
  excluido_por: 'u-1', excluido_em: '2030-05-20T15:00:00Z', ...extra
});

describe('Recebimentos excluídos (#413)', () => {
  it('dado um recebimento excluído, quando vira linha, então mostra o contrato, a parcela, a data, o valor, a conta e quem excluiu', () => {
    // Quando
    const l = linhaDoExcluido(recebimento(), EQUIPE);
    // Então
    expect(l).toEqual({ id: 1, contrato: 'Contrato AA11-0004-2030', parcela: 'Parcela 2', data: '10/03/2030', valor: fmtCentavos(123456), conta: 'PJ',
      quem: 'Pessoa Administradora', excluidoEm: '20/05/2030', selos: [] });
  });

  it('dado um recebimento estornado, quando vira linha, então ganha o selo "Estornado"', () => {
    // Quando
    const l = linhaDoExcluido(recebimento({ estornado: true }), EQUIPE);
    // Então
    expect(l.selos).toEqual(['Estornado']);
  });

  it('dada uma parcela importada como paga, quando vira linha, então diz que não passou pelo Caixa', () => {
    // Quando
    const l = linhaDoExcluido(recebimento({ tipo: 'parcela_importada', conta_nome: null }), EQUIPE);
    // Então
    expect(l).toMatchObject({ conta: SEM_CONTA, selos: ['Importada como paga'] });
  });

  it.each([
    ['saiu da equipe', 'u-que-saiu'],
    ['não ficou gravado', null]
  ])('dado quem excluiu %s, quando vira linha, então aparece como usuário removido', (_caso, quem) => {
    // Quando
    const l = linhaDoExcluido(recebimento({ excluido_por: quem }), EQUIPE);
    // Então
    expect(l.quem).toBe(QUEM_SAIU);
  });

  it('dado um recebimento sem o nome da conta e sem data, quando vira linha, então diz isso em vez de ficar em branco', () => {
    // Quando
    const l = linhaDoExcluido(recebimento({ conta_nome: null, data: null, parcela_numero: null }), EQUIPE);
    // Então
    expect(l).toMatchObject({ conta: CONTA_REMOVIDA, data: 'Sem data', parcela: '' });
  });
});
