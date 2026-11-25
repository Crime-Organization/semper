// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// As despesas do escritório a pagar (#439), em regras/despesas.ts.
import { describe, expect, it } from 'vitest';
import {
  avisoDaDespesaCriada, avisoDaDespesaExcluida, avisoDaDespesaMudada, dadosDaDespesa, despesaNoLimite, despesaNoPeriodo, despesaNova, errosDaDespesa, FIM_ANTES_DO_VENCIMENTO,
  formDaDespesa, repeticaoDaDespesa, rotuloDaDespesa, totalAPagar, valorNaDespesa, type FormDaDespesa
} from './despesas';
import { REPETICAO, TAMANHO_FINANCEIRO } from '../dados/limites';

const HOJE = '2026-11-25';
const form = (campos: Partial<FormDaDespesa> = {}): FormDaDespesa => ({ ...despesaNova(HOJE), descricao: 'Conta de luz', valor: '250,00', ...campos });

describe('Formulário da despesa', () => {
  it('dada uma despesa nova, quando abre, então o vencimento é hoje e ela não se repete', () => {
    // Quando
    const f = despesaNova(HOJE);
    // Então
    expect(f).toMatchObject({ vencimento: HOJE, repetir: '', aCada: '1', termina: 'nunca' });
  });

  it('dados os campos certos, quando confere, então não há erro e o que vai ao banco está em centavos e sem espaços', () => {
    // Dado
    const f = form({ descricao: '  Conta de luz ' });
    // Quando
    const erros = errosDaDespesa(f);
    // Então
    expect(erros).toEqual({});
    expect(dadosDaDespesa(f)).toEqual({ descricao: 'Conta de luz', valor: 25000, vencimento: HOJE });
    expect(repeticaoDaDespesa(f)).toBeNull();
  });

  it.each([
    ['sem descrição', { descricao: '  ' }, 'descricao', 'Diga do que se trata.'],
    ['com a descrição longa demais', { descricao: 'x'.repeat(TAMANHO_FINANCEIRO.descricao + 1) }, 'descricao', `Use até ${TAMANHO_FINANCEIRO.descricao} caracteres.`],
    ['sem valor', { valor: '' }, 'valor', 'Informe o valor.'],
    ['com a data inválida', { vencimento: '2026-02-30' }, 'vencimento', 'Informe uma data válida.'],
    ['repetindo a cada 0', { repetir: 'mes' as const, aCada: '0' }, 'aCada', `Informe de 1 a ${REPETICAO.intervaloMaximo}.`],
    ['repetindo até uma data sem a data', { repetir: 'mes' as const, termina: 'data' as const }, 'repetirAte', 'Informe até quando a despesa se repete.'],
    ['repetindo até antes do vencimento', { repetir: 'mes' as const, termina: 'data' as const, repetirAte: '2026-11-20' }, 'repetirAte', FIM_ANTES_DO_VENCIMENTO],
    ['repetindo uma vez só', { repetir: 'ano' as const, termina: 'vezes' as const, repetirVezes: '1' }, 'repetirVezes', `Informe de 2 a ${REPETICAO.vezesMaximas} vezes, contando a primeira.`]
  ])('dado o formulário %s, quando confere, então o campo mostra o erro', (_caso, campos, campo, mensagem) => {
    // Quando
    const erros = errosDaDespesa(form(campos));
    // Então
    expect(erros).toEqual({ [campo]: mensagem });
  });

  it('dada a repetição sem escolher, quando confere, então os campos dela não contam', () => {
    // Quando / Então
    expect(errosDaDespesa(form({ aCada: '0', termina: 'vezes', repetirVezes: '' }))).toEqual({});
  });

  it.each([
    ['sem fim', { termina: 'nunca' as const }, { ate: null, vezes: null }],
    ['até uma data', { termina: 'data' as const, repetirAte: '2027-12-31' }, { ate: '2027-12-31', vezes: null }],
    ['por um número de vezes', { termina: 'vezes' as const, repetirVezes: '12' }, { ate: null, vezes: 12 }]
  ])('dada a despesa de todo mês %s, quando grava, então vai a regra da repetição', (_caso, campos, fim) => {
    // Quando
    const regra = repeticaoDaDespesa(form({ repetir: 'mes', aCada: '2', ...campos }));
    // Então
    expect(regra).toEqual({ frequencia: 'mes', intervalo: 2, ...fim });
  });

  it('dada uma despesa que já existe, quando abre para mudar, então vem com o valor no formato do campo', () => {
    // Quando
    const f = formDaDespesa({ descricao: 'DAS', valor: 123456, vencimento: '2026-12-20' });
    // Então
    expect(f).toMatchObject({ descricao: 'DAS', valor: '1.234,56', vencimento: '2026-12-20', repetir: '' });
  });

  it.each([
    ['certa', { descricao: 'DAS', valor: 100, vencimento: HOJE }, true],
    ['com valor zerado', { descricao: 'DAS', valor: 0, vencimento: HOJE }, false],
    ['com fração de centavo', { descricao: 'DAS', valor: 10.5, vencimento: HOJE }, false],
    ['sem descrição', { descricao: ' ', valor: 100, vencimento: HOJE }, false],
    ['com data que não existe', { descricao: 'DAS', valor: 100, vencimento: '2026-02-30' }, false]
  ])('dada uma despesa %s, quando o banco confere, então aceita ou recusa', (_caso, d, aceita) => {
    // Quando / Então
    expect(despesaNoLimite(d)).toBe(aceita);
  });
});

describe('Lista das despesas', () => {
  it.each([
    ['vence no mês, a pagar', { vencimento: '2026-12-10', paga_em: null }, true],
    ['vence no mês, paga', { vencimento: '2026-12-10', paga_em: '2026-12-09' }, true],
    ['venceu antes, a pagar', { vencimento: '2026-11-10', paga_em: null }, true],
    ['venceu antes, paga', { vencimento: '2026-11-10', paga_em: '2026-11-10' }, false],
    ['vence depois', { vencimento: '2027-01-10', paga_em: null }, false]
  ])('dada uma despesa que %s, quando lê dezembro, então entra ou não', (_caso, d, entra) => {
    // Quando / Então
    expect(despesaNoPeriodo(d, '2026-12-01', '2026-12-31')).toBe(entra);
  });

  it('dadas despesas pagas e a pagar, quando soma, então o total é só do que falta pagar', () => {
    // Quando / Então
    expect(totalAPagar([{ valor: 100, paga_em: null }, { valor: 250, paga_em: '2026-11-01' }, { valor: 50, paga_em: null }])).toBe(150);
  });

  it('dada uma despesa, quando aparece num botão, então leva a descrição e o vencimento', () => {
    // Quando / Então
    expect(rotuloDaDespesa({ descricao: 'Conta de luz', vencimento: '2026-12-10' })).toBe('Conta de luz, vence em 10/12/2026');
  });
});

describe('Avisos e histórico da despesa', () => {
  it.each([
    [() => avisoDaDespesaCriada(0), 'Despesa cadastrada.'],
    [() => avisoDaDespesaCriada(1), 'Despesa cadastrada, com mais 1 data da repetição.'],
    [() => avisoDaDespesaCriada(11), 'Despesa cadastrada, com mais 11 datas da repetição.'],
    [() => avisoDaDespesaMudada(1), 'Despesa atualizada.'],
    [() => avisoDaDespesaMudada(3), '3 despesas mudadas na repetição.'],
    [() => avisoDaDespesaExcluida(1, false), 'Despesa excluída.'],
    [() => avisoDaDespesaExcluida(4, true), '4 despesas excluídas. A repetição parou.']
  ])('dado o que foi feito, quando avisa, então diz "%s"', (aviso, texto) => {
    // Quando / Então
    expect(aviso()).toBe(texto);
  });

  it.each([
    ['valor', 25000, 'R$ 250,00'],
    ['vencimento', '2026-12-10', '10/12/2026'],
    ['paga_em', null, '—'],
    ['excluida_em', '2026-11-25T10:00:00Z', 'Excluída'],
    ['descricao', 'DAS', 'DAS']
  ])('dado o campo %s no histórico, quando mostra, então aparece formatado', (campo, valor, texto) => {
    // Quando / Então
    expect(valorNaDespesa(campo, valor).replace(/\s/g, ' ')).toBe(texto);
  });
});
