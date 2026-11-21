// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import { PERGUNTA_DO_PRAZO, perguntaDoPrazo, prazosQueMudam } from './prazoDaTarefa';

const COLUNAS = [{ id: 'fazer', marco: 'inicio' as const }, { id: 'fazendo', marco: null }, { id: 'feita', marco: 'concluido' as const }];
const PRAZOS = [{ descricao: 'Contestação', concluido_em: null }, { descricao: 'Réplica', concluido_em: '2026-11-20T10:00:00Z' }];

describe('A pergunta do prazo do processo ao mudar a tarefa de coluna (#355)', () => {
  it.each([
    ['fazendo', 'feita', 'cumprir'],
    [null, 'feita', 'cumprir'],
    ['feita', 'fazer', 'reabrir'],
    ['feita', null, 'reabrir'],
    ['fazer', 'fazendo', null],
    ['feita', 'feita', null]
  ] as const)('dada a tarefa que sai de %s, quando vai para %s, então a pergunta é %s', (de, para, esperada) => {
    // Dado / Quando
    const pergunta = perguntaDoPrazo(COLUNAS, de, para);
    // Então
    expect(pergunta).toBe(esperada);
  });

  it('dados um prazo aberto e um cumprido, quando a pergunta é cumprir, então só o aberto muda; quando é reabrir, só o cumprido', () => {
    // Dado / Quando / Então
    expect(prazosQueMudam('cumprir', PRAZOS).map(z => z.descricao)).toEqual(['Contestação']);
    expect(prazosQueMudam('reabrir', PRAZOS).map(z => z.descricao)).toEqual(['Réplica']);
  });

  it('dada a resposta sim, quando grava, então cumprir marca o instante da resposta e reabrir apaga a marca', () => {
    // Dado
    const agora = '2026-11-21T12:00:00.000Z';
    // Quando / Então
    expect(PERGUNTA_DO_PRAZO.cumprir.concluidoEm(agora)).toBe(agora);
    expect(PERGUNTA_DO_PRAZO.reabrir.concluidoEm(agora)).toBeNull();
  });

  it('dados um ou dois prazos, quando monta o texto, então diz o nome de cada um, no singular ou no plural', () => {
    // Dado / Quando / Então
    expect(PERGUNTA_DO_PRAZO.cumprir.texto(['Contestação'])).toContain('cumpre o prazo "Contestação" do processo. Ele foi cumprido?');
    expect(PERGUNTA_DO_PRAZO.cumprir.texto(['Contestação', 'Réplica'])).toContain('os prazos "Contestação" e "Réplica" do processo. Eles foram cumpridos?');
    expect(PERGUNTA_DO_PRAZO.reabrir.texto(['Réplica'])).toBe('O prazo "Réplica" do processo está marcado como cumprido. Com a tarefa reaberta, ele volta a ficar aberto?');
    expect(PERGUNTA_DO_PRAZO.reabrir.aviso(2)).toBe('Prazos do processo reabertos.');
  });
});
