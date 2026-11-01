// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import type { DiaLancado, Orgao } from '../dados/tipos';
import { anosDoPrazo, diaDaSemana, diasDoOrgao, erroDoLancamento, fmtPeriodo, pulosEmPeriodos, linhasDoLancamento, NENHUM_ORGAO, padraoDoOrgao, periodosDoAno, SIGLAS_SUGERIDAS, TODOS_OS_ORGAOS, type PedidoDeLancamento } from './calendario';
import { contarPrazo } from './prazos';

const orgao = (sigla: string, extra: Partial<Orgao> = {}): Orgao => ({ id: 'o-' + sigla, ...padraoDoOrgao(sigla), ...extra });
const TJMG = orgao('TJMG'), TRF6 = orgao('TRF6'), INPI = orgao('INPI');
const dia = (data: string, motivo: string, orgao_id: string | null, tipo: DiaLancado['tipo'] = 'feriado'): DiaLancado =>
  ({ id: `d-${data}-${orgao_id}`, data, motivo, tipo, orgao_id });
const prazo = (o: Orgao | null, lancados: DiaLancado[], intimacao: string, dias: number, contagem: 'corridos' | 'uteis' = 'uteis') =>
  contarPrazo({ intimacao, dias, contagem, semExpediente: diasDoOrgao(o, lancados, anosDoPrazo(intimacao, dias)) });

describe('Órgãos do escritório', () => {
  it.each([
    ['TJMG', { recesso: true, justica_federal: false }],
    ['trf6', { recesso: true, justica_federal: true }],
    ['TRT3', { recesso: true, justica_federal: false }],
    ['STJ', { recesso: true, justica_federal: true }],
    ['TST', { recesso: true, justica_federal: true }],
    ['INPI', { recesso: false, justica_federal: false }],
    ['INSS', { recesso: false, justica_federal: false }]
  ])('quando o órgão novo é %s, então já vem com o que ele costuma seguir', (sigla, segue) => {
    // Quando
    const o = padraoDoOrgao(sigla);
    // Então (os de praxe sempre desligados, e a contagem em dias corridos)
    expect(o).toEqual({ sigla: sigla.toUpperCase(), nome: null, contagem_padrao: 'corridos', praxe: false, ...segue });
  });

  it('quando a pessoa cadastra um órgão, então as sugestões trazem os tribunais e os órgãos administrativos', () => {
    // Então
    expect(SIGLAS_SUGERIDAS).toEqual(expect.arrayContaining(['TJMG', 'TJDFT', 'TRF6', 'TRT24', 'TRE-MG', 'STJ', 'INPI', 'INSS']));
    expect(SIGLAS_SUGERIDAS).not.toContain('TJDF');
    expect(new Set(SIGLAS_SUGERIDAS).size).toBe(SIGLAS_SUGERIDAS.length);
  });
});

describe('Dias para contar o prazo de um órgão', () => {
  const municipal = dia('2026-07-03', 'Feriado municipal', TJMG.id);

  it('quando o escritório lança um feriado municipal para o TJMG, então o prazo do TJMG pula esse dia, e o do TRF6 não', () => {
    // Dado: intimação na terça, 30/06/2026; 5 dias úteis
    // Então
    expect(prazo(TJMG, [municipal], '2026-06-30', 5).final).toBe('2026-07-08');
    expect(prazo(TJMG, [municipal], '2026-06-30', 5).pulados).toContainEqual({ data: '2026-07-03', motivo: 'Feriado municipal' });
    expect(prazo(TRF6, [municipal], '2026-06-30', 5).final).toBe('2026-07-07');
  });

  it('quando o dia é lançado para todos os órgãos, então vale para qualquer um, e também sem órgão', () => {
    // Dado
    const todos = dia('2026-07-03', 'Portaria conjunta', null, 'suspensao');
    // Então
    expect(prazo(TRF6, [todos], '2026-06-30', 5).final).toBe('2026-07-08');
    expect(prazo(null, [todos], '2026-06-30', 5).final).toBe('2026-07-08');
  });

  it('quando um dia lançado é suspensão, então ele para o prazo em dias corridos; se é feriado, conta', () => {
    // Dado: intimação na segunda, 06/07/2026; 5 dias corridos (início 07/07, fim 11/07, sábado → 13/07)
    const suspensao = dia('2026-07-08', 'Portaria 1/2026', TJMG.id, 'suspensao');
    const feriado = dia('2026-07-08', 'Feriado municipal', TJMG.id, 'feriado');
    // Então
    expect(prazo(TJMG, [suspensao], '2026-07-06', 5, 'corridos').final).toBe('2026-07-13');
    expect(prazo(TJMG, [suspensao], '2026-07-06', 4, 'corridos').final).toBe('2026-07-13');
    expect(prazo(TJMG, [feriado], '2026-07-06', 4, 'corridos').final).toBe('2026-07-10');
  });

  it('quando o órgão segue o recesso, então o prazo para de 20/12 a 20/01; o INPI, que não segue, conta direto', () => {
    // Dado: intimação em 17/12/2026; 10 dias corridos
    // Então
    expect(prazo(TJMG, [], '2026-12-17', 10, 'corridos').final).toBe('2027-01-28');
    expect(prazo(INPI, [], '2026-12-17', 10, 'corridos').final).toBe('2026-12-28');
  });

  it('quando a intimação é em janeiro, então o recesso que começou no ano anterior também vale', () => {
    // Dado: intimação em 05/01/2027 (fórum fechado), 5 dias úteis: publicação em 07/01, contagem a partir de 21/01
    // Então
    expect(prazo(TJMG, [], '2027-01-05', 5).inicio).toBe('2027-01-21');
  });

  it('quando o órgão adota os de praxe, então o Corpus Christi passa o fim do prazo para o dia seguinte; sem adotar, não', () => {
    // Dado: Corpus Christi de 2026 é 04/06 (quinta); intimação em 28/05, 5 dias úteis
    const adota = orgao('TJMG', { praxe: true });
    // Então
    expect(prazo(adota, [], '2026-05-28', 5).final).toBe('2026-06-05');
    expect(prazo(TJMG, [], '2026-05-28', 5).final).toBe('2026-06-04');
  });

  it('quando o órgão segue a Justiça Federal, então 11/08 não conta', () => {
    // Dado: 11/08/2026 é terça; intimação em 07/08 (sexta), 2 dias úteis
    // Então
    expect(prazo(TRF6, [], '2026-08-07', 2).final).toBe('2026-08-12');
    expect(prazo(TJMG, [], '2026-08-07', 2).final).toBe('2026-08-11');
  });

  it('quando não há órgão, então só valem os nacionais e os lançados para todos (sem recesso)', () => {
    // Então
    expect(prazo(null, [dia('2026-07-03', 'Feriado municipal', TJMG.id)], '2026-06-30', 5).final).toBe('2026-07-07');
    expect(prazo(null, [], '2026-12-17', 10, 'corridos').final).toBe('2026-12-28');
  });

  it.each([
    ['2026-03-10', 5, [2026, 2027]],
    ['2026-03-10', 200, [2026, 2027]],
    ['2026-03-10', 201, [2026, 2027, 2028]],
    ['2026-12-30', 1, [2026, 2027]]
  ])('quando a intimação é %s e o prazo tem %i dias, então os anos considerados são %j', (intimacao, dias, anos) => {
    // Então
    expect(anosDoPrazo(intimacao, dias)).toEqual(anos);
  });
});

describe('O ano, período a período', () => {
  it('quando o escritório é novo, então o ano já mostra os feriados nacionais e o recesso, mesmo sem órgãos', () => {
    // Quando
    const p = periodosDoAno(2026, [], [], null);
    // Então
    expect(p.filter(x => x.origem === 'lei').map(x => x.de)).toEqual(
      ['2026-01-01', '2026-04-21', '2026-05-01', '2026-09-07', '2026-10-12', '2026-11-02', '2026-11-15', '2026-11-20', '2026-12-25']);
    expect(p.filter(x => x.origem === 'recesso').map(x => [x.de, x.ate, x.tipo, x.valePara])).toEqual([
      ['2026-01-01', '2026-01-06', 'suspensao', NENHUM_ORGAO],
      ['2026-01-07', '2026-01-20', 'suspensao_com_expediente', NENHUM_ORGAO],
      ['2026-12-20', '2026-12-31', 'suspensao', NENHUM_ORGAO]
    ]);
  });

  it('quando há órgãos, então cada período pronto diz para que órgãos vale', () => {
    // Dado
    const orgaos = [TJMG, TRF6, INPI];
    // Quando
    const p = periodosDoAno(2026, orgaos, [], null);
    // Então
    expect(p.find(x => x.origem === 'lei')?.valePara).toBe(TODOS_OS_ORGAOS);
    expect(p.find(x => x.origem === 'recesso')?.valePara).toBe('TJMG, TRF6');
    expect(p.find(x => x.origem === 'justica_federal')?.valePara).toBe('TRF6');
    expect(p.find(x => x.origem === 'praxe')?.valePara).toBe(NENHUM_ORGAO);
  });

  it('quando um lançamento cobre dias seguidos, então vira um período só, com os ids para excluir', () => {
    // Dado
    const lancados = ['2026-03-23', '2026-03-24', '2026-03-25'].map(d => dia(d, 'Portaria 3/2026', TJMG.id, 'suspensao'));
    // Quando
    const p = periodosDoAno(2026, [TJMG], [...lancados, dia('2026-03-27', 'Portaria 3/2026', TJMG.id, 'suspensao')], null)
      .filter(x => x.origem === 'escritorio');
    // Então
    expect(p).toEqual([
      { de: '2026-03-23', ate: '2026-03-25', motivo: 'Portaria 3/2026', tipo: 'suspensao', origem: 'escritorio', valePara: 'TJMG', ids: lancados.map(l => l.id) },
      { de: '2026-03-27', ate: '2026-03-27', motivo: 'Portaria 3/2026', tipo: 'suspensao', origem: 'escritorio', valePara: 'TJMG', ids: ['d-2026-03-27-o-TJMG'] }
    ]);
  });

  it('quando a pessoa escolhe um órgão, então só vê o que vale para ele', () => {
    // Dado
    const lancados = [dia('2026-07-03', 'Feriado municipal', TJMG.id), dia('2026-07-16', 'Feriado em Belo Horizonte', TRF6.id), dia('2026-03-25', 'Portaria', null)];
    // Quando
    const doInpi = periodosDoAno(2026, [TJMG, TRF6, INPI], lancados, INPI.id);
    const doTj = periodosDoAno(2026, [TJMG, TRF6, INPI], lancados, TJMG.id);
    // Então
    expect(doInpi.map(x => x.origem)).not.toContain('recesso');
    expect(doInpi.filter(x => x.origem === 'escritorio').map(x => x.motivo)).toEqual(['Portaria']);
    expect(doTj.filter(x => x.origem === 'escritorio').map(x => x.motivo)).toEqual(['Portaria', 'Feriado municipal']);
    expect(doTj.some(x => x.origem === 'recesso')).toBe(true);
  });

  it('quando dois períodos começam no mesmo dia, então a suspensão vem antes do feriado', () => {
    // Dado
    const p = periodosDoAno(2026, [TRF6], [], null).filter(x => x.de === '2026-12-20');
    // Então
    expect(p.map(x => x.origem)).toEqual(['recesso', 'justica_federal']);
  });

  it('quando os dias lançados são de outro ano, então não entram', () => {
    // Então
    expect(periodosDoAno(2026, [TJMG], [dia('2027-07-03', 'Feriado municipal', TJMG.id)], null).some(x => x.origem === 'escritorio')).toBe(false);
  });
});

describe('Lançar dias', () => {
  const pedido = (extra: Partial<PedidoDeLancamento> = {}): PedidoDeLancamento =>
    ({ motivo: ' Portaria 12/2026 ', tipo: 'suspensao', de: '2026-03-23', ate: '2026-03-25', orgaos: [TJMG.id, TRF6.id], ...extra });

  it('quando o lançamento vai de um dia a outro para dois órgãos, então grava cada dia para cada órgão, com o motivo limpo', () => {
    // Quando
    const linhas = linhasDoLancamento(pedido());
    // Então
    expect(erroDoLancamento(pedido())).toBeNull();
    expect(linhas).toHaveLength(6);
    expect(linhas[0]).toEqual({ data: '2026-03-23', motivo: 'Portaria 12/2026', tipo: 'suspensao', orgao_id: TJMG.id });
    expect(linhas.at(-1)).toEqual({ data: '2026-03-25', motivo: 'Portaria 12/2026', tipo: 'suspensao', orgao_id: TRF6.id });
  });

  it('quando não há "até", então é um dia só; e "todos os órgãos" vale sozinho', () => {
    // Quando
    const linhas = linhasDoLancamento(pedido({ ate: '', orgaos: [TJMG.id, null] }));
    // Então
    expect(linhas).toEqual([{ data: '2026-03-23', motivo: 'Portaria 12/2026', tipo: 'suspensao', orgao_id: null }]);
  });

  it.each([
    ['sem motivo', { motivo: '  ' }, 'Diga o motivo (ex.: feriado municipal, Portaria 12/2026).'],
    ['motivo longo demais', { motivo: 'x'.repeat(121) }, 'O motivo pode ter até 120 caracteres.'],
    ['sem o primeiro dia', { de: '' }, 'Informe o primeiro dia.'],
    ['um dia que não existe', { de: '2026-02-30', ate: '' }, 'Informe o primeiro dia.'],
    ['o último dia inexistente', { ate: '2026-02-30' }, 'O último dia não existe.'],
    ['o último antes do primeiro', { ate: '2026-03-20' }, 'O último dia precisa ser depois do primeiro.'],
    ['fora dos anos do calendário', { de: '1999-12-31', ate: '' }, 'O calendário vai de 2000 a 2100.'],
    ['mais de um ano seguido', { de: '2026-01-01', ate: '2027-01-02' }, 'Um lançamento pode ter até 366 dias seguidos.'],
    ['sem órgão', { orgaos: [] }, 'Escolha para que órgãos o dia vale.']
  ])('quando o lançamento está %s, então avisa o que corrigir', (_caso, extra, erro) => {
    // Então
    expect(erroDoLancamento(pedido(extra))).toBe(erro);
  });

  it('quando o lançamento tem exatamente 366 dias, então é aceito', () => {
    // Então
    expect(erroDoLancamento(pedido({ de: '2026-01-01', ate: '2027-01-01' }))).toBeNull();
  });
});

describe('Para mostrar', () => {
  it('quando a data é mostrada, então sai com o dia da semana e no formato dd/mm', () => {
    // Então
    expect(diaDaSemana('2026-11-01')).toBe('domingo');
    expect(diaDaSemana('2027-01-27')).toBe('quarta-feira');
    expect(fmtPeriodo('2026-12-25', '2026-12-25')).toBe('25/12');
    expect(fmtPeriodo('2026-12-20', '2026-12-31')).toBe('20/12 a 31/12');
  });

  it('quando o prazo atravessa o recesso e fins de semana, então os dias pulados seguidos viram uma linha só', () => {
    // Dado: intimação em 17/12/2026 (quinta), 5 dias úteis no TJMG
    const pulos = pulosEmPeriodos(prazo(TJMG, [], '2026-12-17', 5).pulados);
    // Então
    expect(pulos).toEqual([
      { de: '2026-12-19', ate: '2026-12-19', motivo: 'fim de semana' },
      { de: '2026-12-20', ate: '2027-01-06', motivo: 'Recesso forense' },
      { de: '2027-01-07', ate: '2027-01-20', motivo: 'Recesso forense (prazos suspensos)' },
      { de: '2027-01-23', ate: '2027-01-24', motivo: 'fim de semana' }
    ]);
  });
});

describe('Prazo que não se suspende no recesso', () => {
  const contar = (o: Orgao, intimacao: string, dias: number, opcoes: { semRecesso: boolean }, contagem: 'corridos' | 'uteis' = 'corridos') =>
    contarPrazo({ intimacao, dias, contagem, semExpediente: diasDoOrgao(o, [], anosDoPrazo(intimacao, dias), opcoes) });

  it('quando o processo tem réu preso (CPP, art. 798-A), então o prazo corre durante o recesso e vence nele', () => {
    // Dado: intimação em 17/12/2026, 5 dias corridos, TJMG
    // Então
    expect(contar(TJMG, '2026-12-17', 5, { semRecesso: false }).final).toBe('2027-01-25');
    expect(contar(TJMG, '2026-12-17', 5, { semRecesso: true }).final).toBe('2026-12-22');
  });

  it('quando o prazo é de direito material, então o recesso não o estica', () => {
    // Dado: mandado de segurança, 120 dias da ciência em 03/11/2026, TJMG
    // Então
    expect(contar(TJMG, '2026-11-03', 120, { semRecesso: true }).final).toBe('2027-03-03');
  });

  it('quando o órgão também segue a Justiça Federal, então os feriados dela continuam valendo', () => {
    // Dado: intimação em 17/12/2026, 5 dias úteis, TRF6: os feriados de 20/12 a 06/01 não contam, sem o recesso
    const prazoFederal = contar(TRF6, '2026-12-17', 5, { semRecesso: true }, 'uteis');
    // Então: 18/12, depois 07/01, 08/01, 11/01 e 12/01
    expect(prazoFederal.final).toBe('2027-01-12');
    expect(prazoFederal.pulados).toContainEqual({ data: '2026-12-21', motivo: 'Feriado da Justiça Federal (20/12 a 06/01)' });
  });
});
