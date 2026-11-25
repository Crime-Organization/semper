// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// O prazo na folhinha do cartão da tarefa (#442).
import { describe, expect, it } from 'vitest';
import { antesOuDepoisDoPrazo, detalheDoPrazo, folhaDoDia, prazoNaFolhinha, quantosDias } from './prazoNaFolhinha';

/** Hoje, nos testes: quarta-feira, 25/11/2026. */
const HOJE = '2026-11-25';

describe('A folhinha de um dia', () => {
  it('dado uma sexta-feira de novembro, quando vira folhinha, então mostra "nov", o dia e "sexta", e o dia por extenso para o leitor de tela', () => {
    // Quando
    const folha = folhaDoDia('2026-11-27');
    // Então
    expect(folha).toEqual({ mes: 'nov', dia: '27', semana: 'sexta', porExtenso: 'sexta-feira, 27/11/2026' });
  });

  it.each([
    ['2026-11-28', 'sábado'],
    ['2026-11-29', 'domingo'],
    ['2026-11-23', 'segunda']
  ])('dado %s, quando vira folhinha, então o dia da semana é "%s"', (iso, semana) => {
    // Quando / Então
    expect(folhaDoDia(iso).semana).toBe(semana);
  });

  it('dado um dia de janeiro e um de março, quando viram folhinha, então o mês tem três letras e o dia não tem zero na frente', () => {
    // Quando / Então
    expect(folhaDoDia('2027-01-05')).toMatchObject({ mes: 'jan', dia: '5' });
    expect(folhaDoDia('2027-03-10').mes).toBe('mar');
  });
});

describe('Quanto falta para o prazo', () => {
  it.each([
    ['2026-11-27', 'Faltam 2 dias'],
    ['2026-11-26', 'Falta 1 dia'],
    ['2026-11-25', 'Vence hoje']
  ])('dado o prazo em %s, quando o cartão abre, então diz "%s", no tom de sempre, e a folhinha abre as datas', (prazo, principal) => {
    // Quando
    const p = prazoNaFolhinha({ prazo }, HOJE);
    // Então
    expect(p).toMatchObject({ dia: prazo, principal, tom: 'normal', folhinhaAbre: true });
  });

  it.each([
    ['2026-11-24', 'Venceu há 1 dia'],
    ['2026-11-20', 'Venceu há 5 dias']
  ])('dado o prazo vencido em %s, quando o cartão abre, então diz "%s", em vermelho', (prazo, principal) => {
    // Quando
    const p = prazoNaFolhinha({ prazo }, HOJE);
    // Então
    expect(p).toMatchObject({ principal, tom: 'vencido' });
  });

  it('dado a tarefa sem prazo, quando o cartão abre, então diz "Sem prazo", calmo, sem folhinha', () => {
    // Quando
    const p = prazoNaFolhinha({ prazo: null }, HOJE);
    // Então
    expect(p).toEqual({ dia: null, principal: 'Sem prazo', tom: 'calmo', detalhe: null, folhinhaAbre: false });
  });

  it('dado o plural, quando conta os dias, então "1 dia" e "N dias"', () => {
    // Quando / Então
    expect([quantosDias(1), quantosDias(2), quantosDias(0)]).toEqual(['1 dia', '2 dias', '0 dias']);
  });
});

describe('A hora e o lembrete, embaixo da frase do prazo', () => {
  it('dado a hora e o lembrete, quando o cartão escreve a linha, então "Às 18:00 · lembrete 1 h antes"', () => {
    // Quando / Então
    expect(detalheDoPrazo('18:00:00', 60)).toBe('Às 18:00 · lembrete 1 h antes');
  });

  it('dado só o lembrete, quando o cartão escreve a linha, então "Lembrete 1 dia antes"', () => {
    // Quando / Então
    expect(detalheDoPrazo(null, 1440)).toBe('Lembrete 1 dia antes');
  });

  it('dado só a hora, quando o cartão escreve a linha, então "Às 09:30"', () => {
    // Quando / Então
    expect(detalheDoPrazo('09:30', null)).toBe('Às 09:30');
  });

  it('dado nem hora nem lembrete, quando o cartão escreve a linha, então não há linha', () => {
    // Quando / Então
    expect(detalheDoPrazo(null, null)).toBeNull();
    expect(prazoNaFolhinha({ prazo: '2026-11-27' }, HOJE).detalhe).toBeNull();
  });

  it('dado o prazo com hora e lembrete, quando o cartão abre, então o detalhe vem com o prazo', () => {
    // Quando
    const p = prazoNaFolhinha({ prazo: '2026-11-27', prazo_hora: '18:00', lembrete: 30 }, HOJE);
    // Então
    expect(p.detalhe).toBe('Às 18:00 · lembrete 30 min antes');
  });
});

describe('A tarefa concluída', () => {
  // 26/11/2026 às 15:00 em Brasília.
  const CONCLUIDA_EM = '2026-11-26T18:00:00Z';

  it.each([
    ['2026-11-27', '1 dia antes do prazo'],
    ['2026-11-26', 'No dia do prazo'],
    ['2026-11-24', '2 dias depois do prazo']
  ])('dado o prazo em %s, quando a tarefa foi concluída em 26/11, então a folhinha é o dia da conclusão e diz "%s"', (prazo, detalhe) => {
    // Quando
    const p = prazoNaFolhinha({ prazo, concluida_em: CONCLUIDA_EM }, HOJE);
    // Então
    expect(p).toEqual({ dia: '2026-11-26', principal: 'Concluída', tom: 'normal', detalhe, folhinhaAbre: false });
  });

  it('dado a concluída sem prazo, quando o cartão abre, então a folhinha é o dia da conclusão e diz "Sem prazo"', () => {
    // Quando
    const p = prazoNaFolhinha({ prazo: null, concluida_em: CONCLUIDA_EM }, HOJE);
    // Então
    expect(p).toMatchObject({ dia: '2026-11-26', principal: 'Concluída', detalhe: 'Sem prazo' });
  });

  it('dado a conclusão às 22:00 de Brasília (01:00 do dia seguinte em UTC), quando vira o dia da folhinha, então é o dia de Brasília', () => {
    // Quando
    const p = prazoNaFolhinha({ prazo: null, concluida_em: '2026-11-27T01:00:00Z' }, HOJE);
    // Então
    expect(p.dia).toBe('2026-11-26');
  });

  it('dado o dia da conclusão, quando compara com o prazo, então conta os dias corridos', () => {
    // Quando / Então
    expect(antesOuDepoisDoPrazo('2026-11-20', '2026-11-30')).toBe('10 dias antes do prazo');
  });
});
