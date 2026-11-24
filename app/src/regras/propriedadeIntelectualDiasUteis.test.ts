// Propriedade intelectual (#418): os prazos em dias contam só os dias úteis do INPI, o prazo após a publicação do deferimento da marca
// (60 + 30 dias úteis, sem taxa, até a concessão), os papéis só nos processos da área e os compromissos que acompanham as datas.
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import type { DiaLancado, Orgao } from '../dados/tipos';
import {
  ACOMPANHAR_DEFERIMENTO, anosDosPrazosEmDiasUteis, AREA_DA_PI, calendarioDoInpi, camposParaAcompanhar, compromissoAConcluir, contagemDoProcesso, dataParaAtualizar,
  descreverDataParaAtualizar, descreverPrazoAposODeferimento, PAPEL_SO_DA_PI, papelCabeNoProcesso, PRAZO_APOS_O_DEFERIMENTO, prazoAposODeferimentoNaAgenda,
  prazoPorExtenso, prazosDaProtecao, siglaDoCalendario, situacaoDoPrazo, somarDiasUteisNoInpi, SO_FERIADOS_NACIONAIS, tituloDoDeferimentoAConcluir,
  type DatasDaProtecao, type OndeHaProtecao
} from './propriedadeIntelectual';

const NUMERO = '912345678';
/** Uma marca de PI com as datas dadas. */
const marca = (d: Partial<DatasDaProtecao> = {}): DatasDaProtecao & OndeHaProtecao & { numero: string } =>
  ({ protecao: 'marca', deposito: '2025-03-10', concessao: null, publicacao: null, criacao: null, area: AREA_DA_PI, tipo: 'administrativo', numero: NUMERO, ...d });
/** A terça-feira em que a RPI publicou o deferimento. */
const DEFERIMENTO = '2026-10-06';
const HOJE = '2026-11-04';
/** O órgão INPI cadastrado em Feriados e prazos, que segue Carnaval, Sexta-feira Santa e Corpus Christi. */
const INPI: Orgao = { id: 'o-inpi', sigla: 'INPI', nome: null, contagem_padrao: 'uteis', recesso: false, praxe: true, justica_federal: false };
const OUTRO: Orgao = { id: 'o-tj', sigla: 'TJMG', nome: null, contagem_padrao: 'corridos', recesso: true, praxe: false, justica_federal: false };
/** Dois dias sem expediente lançados para o INPI. */
const LANCADOS: DiaLancado[] = [
  { id: 'd1', data: '2026-10-07', motivo: 'Ponto facultativo', tipo: 'feriado', orgao_id: 'o-inpi' },
  { id: 'd2', data: '2026-10-08', motivo: 'Ponto facultativo', tipo: 'feriado', orgao_id: 'o-inpi' },
  { id: 'd3', data: '2026-10-09', motivo: 'Só do TJMG', tipo: 'feriado', orgao_id: 'o-tj' }
];

describe('Dias úteis no INPI', () => {
  it('dada a publicação numa terça, quando conta 60 dias úteis, então pula os fins de semana e os feriados nacionais (12/10, 02/11, 20/11, 25/12 e 01/01)', () => {
    // Quando
    const fim = somarDiasUteisNoInpi(DEFERIMENTO, 60, SO_FERIADOS_NACIONAIS);
    // Então
    expect(fim).toBe('2027-01-05');
  });

  it('dado o órgão INPI em Feriados e prazos, quando conta, então pula também os dias lançados para ele e os que ele segue, e não os de outro órgão', () => {
    // Dado
    const calendario = calendarioDoInpi([OUTRO, INPI], LANCADOS);
    // Quando
    const fim = somarDiasUteisNoInpi(DEFERIMENTO, 60, calendario);
    // Então: 07/10 e 08/10 não contam (lançados para o INPI); 09/10, só do TJMG, conta. No extra, o Carnaval (08 e 09/02/2027) não conta.
    expect(fim).toBe('2027-01-07');
    expect(somarDiasUteisNoInpi(fim, 30, calendario)).toBe('2027-02-22');
  });

  it('dado um escritório sem o órgão INPI, quando conta, então valem os feriados nacionais e os dias lançados para todos os órgãos', () => {
    // Dado
    const paraTodos: DiaLancado[] = [{ id: 'd4', data: '2026-10-07', motivo: 'Feriado municipal', tipo: 'feriado', orgao_id: null }, ...LANCADOS];
    // Quando
    const fim = somarDiasUteisNoInpi(DEFERIMENTO, 60, calendarioDoInpi([OUTRO], paraTodos));
    // Então: só 07/10 sai da conta (os de 08/10 e 09/10 são de órgãos)
    expect(fim).toBe('2027-01-06');
  });

  it.each([
    [AREA_DA_PI, OUTRO, 'uteis'],
    ['propriedade INTELECTUAL', null, 'uteis'],
    ['Cível', OUTRO, 'corridos'],
    ['Cível', null, undefined]
  ] as const)('dado um processo da área "%s", quando lança um prazo, então a contagem começa em %s', (area, orgao, contagem) => {
    // Então
    expect(contagemDoProcesso({ area }, orgao)).toBe(contagem);
  });

  it('dado um processo administrativo de PI sem órgão, quando conta os prazos dele, então usa o calendário do INPI; com órgão, o dele', () => {
    // Então
    expect(siglaDoCalendario({ tipo: 'administrativo', area: AREA_DA_PI, orgao: null })).toBe('INPI');
    expect(siglaDoCalendario({ tipo: 'administrativo', area: AREA_DA_PI, orgao: 'TRF2' })).toBe('TRF2');
    expect(siglaDoCalendario({ tipo: 'judicial', area: AREA_DA_PI, orgao: null })).toBeNull();
    expect(siglaDoCalendario({ tipo: 'administrativo', area: 'Cível', orgao: null })).toBeNull();
  });
});

describe('Prazo após o deferimento da marca', () => {
  it('dada a marca com a publicação do deferimento e sem concessão, quando abre o cartão, então vê o prazo de 60 dias úteis e mais 30 extras', () => {
    // Quando
    const prazos = prazosDaProtecao(marca({ deferimento: DEFERIMENTO }), HOJE)!;
    // Então
    expect(prazos.validade).toBeNull();
    expect(prazos.falta).toMatch(/informe a data da concessão/);
    expect(prazos.datas).toEqual([{ tipo: 'deferimento', nome: PRAZO_APOS_O_DEFERIMENTO, inicio: DEFERIMENTO, fim: '2027-01-05', fimExtra: '2027-02-16' }]);
    expect(situacaoDoPrazo(prazos.datas[0], HOJE)).toBe('aberto');
  });

  it('dado o prazo após o deferimento, quando aparece por extenso, então não fala em taxa', () => {
    // Quando
    const texto = prazoPorExtenso(prazosDaProtecao(marca({ deferimento: DEFERIMENTO }), HOJE)!.datas[0]);
    // Então
    expect(texto).toBe('de 06/10/2026 a 05/01/2027 (prazo extra até 16/02/2027)');
    expect(texto).not.toMatch(/taxa/i);
  });

  it('dada a concessão informada, quando abre o cartão, então o prazo após o deferimento some e ficam as prorrogações', () => {
    // Quando
    const prazos = prazosDaProtecao(marca({ deferimento: DEFERIMENTO, concessao: '2027-01-12' }), HOJE)!;
    // Então
    expect(prazos.datas.map(x => x.tipo)).not.toContain('deferimento');
    expect(prazos.validade?.data).toBe('2037-01-12');
  });

  it('dada uma marca sem a publicação do deferimento, ou uma patente, quando abre o cartão, então não há prazo após o deferimento', () => {
    // Então
    expect(prazosDaProtecao(marca(), HOJE)!.datas).toEqual([]);
    expect(prazosDaProtecao(marca({ protecao: 'patente_invencao', deferimento: DEFERIMENTO }), HOJE)!.datas.map(x => x.tipo)).not.toContain('deferimento');
  });

  it('dada a marca com o deferimento, quando a tela busca os dias lançados, então pede os anos que o prazo atravessa; sem ele, nenhum', () => {
    // Então
    expect(anosDosPrazosEmDiasUteis(marca({ deferimento: DEFERIMENTO }))).toEqual([2026, 2027]);
    expect(anosDosPrazosEmDiasUteis(marca({ deferimento: DEFERIMENTO, concessao: '2027-01-12' }))).toEqual([]);
    expect(anosDosPrazosEmDiasUteis(marca())).toEqual([]);
  });
});

describe('O prazo após o deferimento na agenda', () => {
  it('dado o prazo aberto, quando a pessoa põe na agenda, então o compromisso é um só, no último dia dos 60 dias úteis, sem falar em taxa', () => {
    // Quando
    const x = prazoAposODeferimentoNaAgenda(marca({ deferimento: DEFERIMENTO }), HOJE)!;
    // Então
    expect(x.titulo).toBe(`Prazo após o deferimento ${NUMERO}`);
    expect(x.data).toBe('2027-01-05');
    expect(x.observacoes).toContain('60 dias úteis, até 05/01/2027, e mais 30 dias úteis de prazo extra, até 16/02/2027');
    expect(x.observacoes).not.toMatch(/taxa|pagamento/i);
    expect(descreverPrazoAposODeferimento(x)).toBe(`Cria na agenda "Prazo após o deferimento ${NUMERO}" em 05/01/2027.`);
  });

  it('dado o prazo de 60 dias já acabado, quando a pessoa põe na agenda, então o compromisso fica no último dia do prazo extra; passado o extra, nada', () => {
    // Então
    expect(prazoAposODeferimentoNaAgenda(marca({ deferimento: DEFERIMENTO }), '2027-01-20')?.data).toBe('2027-02-16');
    expect(prazoAposODeferimentoNaAgenda(marca({ deferimento: DEFERIMENTO }), '2027-02-17')).toBeNull();
  });

  it('dado o endereço ?acompanhar=deferimento, quando o cadastro do compromisso abre, então vem preenchido com o prazo, sem repetir', () => {
    // Quando
    const campos = camposParaAcompanhar(ACOMPANHAR_DEFERIMENTO, marca({ deferimento: DEFERIMENTO }), HOJE, calendarioDoInpi([INPI], LANCADOS));
    // Então: conta no calendário do INPI
    expect(campos).toMatchObject({ tipo: 'outro', titulo: `Prazo após o deferimento ${NUMERO}`, data: '07/01/2027', repetir: '' });
  });

  it('dada a concessão informada, quando o cartão procura o compromisso do prazo, então oferece concluir só o que está em aberto', () => {
    // Dado
    const titulo = tituloDoDeferimentoAConcluir(marca({ deferimento: DEFERIMENTO, concessao: '2027-01-12' }))!;
    const aberto = { id: 'c1', titulo, etapa_id: 'agendado', arquivado_em: null };
    // Então
    expect(titulo).toBe(`Prazo após o deferimento ${NUMERO}`);
    expect(compromissoAConcluir([aberto], titulo, 'realizado')).toBe(aberto);
    expect(compromissoAConcluir([{ ...aberto, etapa_id: 'realizado' }], titulo, 'realizado')).toBeNull();
    expect(compromissoAConcluir([{ ...aberto, arquivado_em: '2026-11-01' }], titulo, 'realizado')).toBeNull();
    // E sem a concessão, nada a concluir
    expect(tituloDoDeferimentoAConcluir(marca({ deferimento: DEFERIMENTO }))).toBeNull();
  });
});

describe('Os compromissos dos prazos acompanham as datas', () => {
  const ligado = (id: string, data: string, arquivado_em: string | null = null) => ({ id, titulo: 'Prorrogação da marca', data, arquivado_em });

  it('dado o compromisso na data da conta, quando o cartão confere, então não oferece nada', () => {
    // Então
    expect(dataParaAtualizar([ligado('c1', '2035-05-10'), ligado('c2', '2045-05-10')], { titulo: 'Prorrogação da marca', data: '2035-05-10' }, HOJE)).toBeNull();
  });

  it('dada a concessão mudada, quando a conta dá outra data, então o cartão oferece levar a próxima data do compromisso para a da conta', () => {
    // Quando
    const x = dataParaAtualizar([ligado('c2', '2045-05-10'), ligado('c1', '2035-05-10'), ligado('c0', '2025-05-10')],
      { titulo: 'Prorrogação da marca', data: '2035-06-20' }, HOJE)!;
    // Então: a próxima data é a de 2035 (a de 2025 já passou)
    expect(x).toEqual({ id: 'c1', titulo: 'Prorrogação da marca', de: '2035-05-10', para: '2035-06-20' });
    expect(descreverDataParaAtualizar(x)).toBe('As datas do processo mudaram: "Prorrogação da marca" está na agenda em 10/05/2035, e a conta de agora dá 20/06/2035.');
  });

  it('dado o compromisso arquivado, de outro título ou só no passado, quando o cartão confere, então não oferece nada', () => {
    // Então
    const conta = { titulo: 'Prorrogação da marca', data: '2035-06-20' };
    expect(dataParaAtualizar([ligado('c1', '2035-05-10', '2026-01-01')], conta, HOJE)).toBeNull();
    expect(dataParaAtualizar([{ ...ligado('c1', '2035-05-10'), titulo: 'Outro' }], conta, HOJE)).toBeNull();
    expect(dataParaAtualizar([ligado('c0', '2025-05-10')], conta, HOJE)).toBeNull();
  });
});

describe('Papéis de PI só nos processos da área', () => {
  it.each([
    ['titular', AREA_DA_PI, true],
    ['inventor', 'propriedade intelectual', true],
    ['autor_da_criacao', 'Cível', false],
    ['titular', null, false],
    ['testemunha', 'Cível', true]
  ] as const)('dado o papel %s num processo da área "%s", quando a pessoa entra, então cabe: %s', (papel, area, cabe) => {
    // Então
    expect(papelCabeNoProcesso(papel, { area })).toBe(cabe);
  });

  it('quando o papel de PI é recusado, então a frase é a mesma do banco', () => {
    // Então
    expect(PAPEL_SO_DA_PI).toBe('Titular, inventor e autor da criação só existem nos processos de propriedade intelectual.');
  });
});
