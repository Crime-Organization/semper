// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import { TAMANHO_ANDAMENTO, TAMANHO_PRAZO, TAMANHO_TAREFA } from '../dados/limites';
import {
  alertaDosPrazos, andamentoNovo, aTratar, comoFoiContado, dadosDoAndamento, dadosDoPrazo, errosDoAndamento, errosDoPrazo, formDoAndamento, formDoPrazo, linhaDoAndamento, linhaDoPrazo,
  mudancaDoAndamento, naOrdemDosPrazos, porDataDoAndamento, prazoNovo, quandoDoAndamento, rotuloDoPrazo, situacaoDoPrazoNoProcesso, tarefaDaIntimacao, tarefaDoPrazo
} from './andamentos';

const HOJE = '2026-11-10';
const andamento = (extra = {}) => ({
  id: 'a1', processo_id: 'p1', tipo: 'intimacao' as const, data: '2026-11-09', hora: null, local: null, texto: 'Intimação para contestar', tratada_em: null,
  tarefa_id: null, tarefa: null, criado_por: 'u1', criado_em: '2026-11-09T10:00:00Z', atualizado_em: '2026-11-09T10:00:00Z', ...extra
});
const prazo = (extra = {}) => ({
  id: 'z1', processo_id: 'p1', descricao: 'Contestação', final: '2026-12-01', intimacao: '2026-11-09', dias: 15, contagem: 'uteis' as const, disponibilizacao: false, sem_recesso: false,
  andamento_id: null, tarefa_id: null, tarefa: null, concluido_em: null, criado_por: 'u1', criado_em: '2026-11-09T10:00:00Z', atualizado_em: '2026-11-09T10:00:00Z', ...extra
});
const PROCESSO = { id: 'p1', numero: '0001234-97.2026.8.13.0024', titulo: null, cliente_nome: 'JOSÉ DA SILVA', responsavel_id: 'u1', colaboradores: ['u2', 'saiu'], clientes: [{ id: 'c1' }] };

describe('Formulário do andamento', () => {
  it('quando está em branco, então pede o texto e aceita a data de hoje', () => {
    // Então
    expect(errosDoAndamento(andamentoNovo(HOJE))).toEqual({ texto: 'Escreva o que aconteceu.' });
  });

  it.each([['data que não existe', { data: '2026-02-31' }, 'data'], ['data vazia', { data: '' }, 'data'], ['ano fora do calendário', { data: '1999-01-01' }, 'data'],
    ['texto longo', { texto: 'x'.repeat(TAMANHO_ANDAMENTO.texto + 1) }, 'texto'], ['local longo', { tipo: 'audiencia' as const, local: 'x'.repeat(TAMANHO_ANDAMENTO.local + 1) }, 'local']
  ])('quando tem %s, então avisa no campo', (_caso, mudanca, campo) => {
    // Então
    expect(Object.keys(errosDoAndamento({ ...andamentoNovo(HOJE), texto: 'ok', ...mudanca }))).toEqual([campo]);
  });

  it('quando o tipo não é audiência nem perícia, então hora e local não vão para o banco, nem travam', () => {
    // Dado
    const f = { ...andamentoNovo(HOJE), tipo: 'andamento' as const, hora: '10:00', local: 'x'.repeat(TAMANHO_ANDAMENTO.local + 1), texto: ' ok ' };
    // Então
    expect(errosDoAndamento(f)).toEqual({});
    expect(dadosDoAndamento(f)).toEqual({ tipo: 'andamento', data: HOJE, hora: null, local: null, texto: 'ok' });
  });

  it('quando é audiência, então hora e local vão limpos, e voltam ao abrir de novo', () => {
    // Quando
    const d = dadosDoAndamento({ tipo: 'audiencia', data: HOJE, hora: '14:30', local: ' Fórum ', texto: 'Conciliação' });
    // Então
    expect(d).toEqual({ tipo: 'audiencia', data: HOJE, hora: '14:30', local: 'Fórum', texto: 'Conciliação' });
    expect(formDoAndamento(andamento(d))).toEqual({ tipo: 'audiencia', data: HOJE, hora: '14:30', local: 'Fórum', texto: 'Conciliação' });
  });

  it('quando deixa de ser intimação, então deixa de estar tratada; continuando intimação, nada muda nisso', () => {
    // Então
    expect(mudancaDoAndamento({ ...andamentoNovo(HOJE), tipo: 'andamento', texto: 'x' }).tratada_em).toBeNull();
    expect(mudancaDoAndamento({ ...andamentoNovo(HOJE), tipo: 'intimacao', texto: 'x' })).not.toHaveProperty('tratada_em');
  });
});

describe('Lista de andamentos', () => {
  it('quando é intimação sem tratar, então está a tratar; tratada ou de outro tipo, não', () => {
    // Então
    expect(aTratar(andamento())).toBe(true);
    expect(aTratar(andamento({ tratada_em: 'x' }))).toBe(false);
    expect(aTratar(andamento({ tipo: 'andamento' }))).toBe(false);
    expect(aTratar(andamento({ tarefa_id: 't1' }))).toBe(false);
  });

  it('quando ordena, então vêm os de data mais nova e, no mesmo dia, os lançados por último', () => {
    // Dado
    const lista = [andamento({ id: '1', data: '2026-01-01' }), andamento({ id: '2', data: '2026-02-01', criado_em: '2026-02-01T08:00:00Z' }), andamento({ id: '3', data: '2026-02-01', criado_em: '2026-02-01T09:00:00Z' })];
    // Então
    expect(lista.toSorted(porDataDoAndamento).map(a => a.id)).toEqual(['3', '2', '1']);
  });

  it('quando mostra e grava no histórico, então a linha é igual à do banco', () => {
    // Dado
    const a = andamento({ tipo: 'audiencia', data: '2026-11-10', hora: '14:30', local: 'Fórum', texto: 'Texto' });
    // Então
    expect(quandoDoAndamento(a)).toBe('10/11/2026 às 14:30 em Fórum');
    expect(linhaDoAndamento(a)).toBe('Audiência de 10/11/2026 às 14:30 em Fórum: Texto');
    expect(linhaDoAndamento(andamento({ tipo: 'andamento', data: '2026-11-10', texto: 'y'.repeat(200) }))).toBe('Andamento de 10/11/2026: ' + 'y'.repeat(200));
    expect(linhaDoAndamento(andamento({ data: '2026-11-10', texto: 'T', tratada_em: 'x' }))).toBe('Intimação de 10/11/2026: T (tratada)');
  });
});

describe('Formulário do prazo', () => {
  it('quando o prazo nasce de uma intimação, então já vem com a data e a ligação dela, e a contagem do órgão', () => {
    // Quando
    const f = prazoNovo(HOJE, 'uteis', andamento());
    // Então
    expect(f).toMatchObject({ intimacao: '2026-11-09', andamentoId: 'a1', contagem: 'uteis', modo: 'calcular', dias: '15' });
    expect(prazoNovo(HOJE)).toMatchObject({ intimacao: HOJE, andamentoId: null, contagem: 'corridos' });
  });

  it('quando abre um prazo calculado ou digitado, então volta no mesmo modo', () => {
    // Então
    expect(formDoPrazo(prazo(), HOJE)).toMatchObject({ modo: 'calcular', intimacao: '2026-11-09', dias: '15', contagem: 'uteis', final: '2026-12-01' });
    expect(formDoPrazo(prazo({ intimacao: null, dias: null, contagem: null }), HOJE)).toMatchObject({ modo: 'digitar', intimacao: HOJE, final: '2026-12-01', contagem: 'corridos' });
    expect(formDoPrazo(prazo({ intimacao: null, dias: null, contagem: null }), HOJE, 'uteis').contagem).toBe('uteis');
    expect(formDoPrazo(prazo({ contagem: 'corridos' }), HOJE, 'uteis').contagem).toBe('corridos');
  });

  it('quando falta a descrição, ou ela é longa demais, então avisa', () => {
    // Então
    expect(errosDoPrazo(prazoNovo(HOJE), '2026-12-01').descricao).toBe('Diga que prazo é este (ex.: Contestação).');
    expect(errosDoPrazo({ ...prazoNovo(HOJE), descricao: 'x'.repeat(TAMANHO_PRAZO.descricao + 1) }, '2026-12-01').descricao).toBe(`Use até ${TAMANHO_PRAZO.descricao} caracteres.`);
  });

  it.each([['0'], [''], ['1,5'], ['1831'], ['muitos']])('quando os dias são "%s", então avisa no cálculo', dias => {
    // Então
    expect(errosDoPrazo({ ...prazoNovo(HOJE), descricao: 'x', dias }, null).calculo).toBeTruthy();
  });

  it('quando a conta ainda não terminou, então não salva', () => {
    // Então
    expect(errosDoPrazo({ ...prazoNovo(HOJE), descricao: 'x' }, null).calculo).toBe('Espere o cálculo terminar ou digite a data.');
    expect(errosDoPrazo({ ...prazoNovo(HOJE), descricao: 'x' }, '2026-12-01')).toEqual({});
  });

  it.each([['1999-12-31'], ['2101-01-01']])('quando a intimação é de %s, fora do calendário do banco, então avisa', intimacao => {
    // Então
    expect(errosDoPrazo({ ...prazoNovo(HOJE), descricao: 'x', intimacao }, '2026-12-01').calculo).toBe('Informe uma data válida.');
  });

  it('quando a conta passa de 2100, então avisa em vez de o banco recusar', () => {
    // Então
    expect(errosDoPrazo({ ...prazoNovo(HOJE), descricao: 'x', intimacao: '2100-12-20' }, '2101-01-10').calculo).toBe('O último dia precisa ser até 2100.');
  });

  it('quando digita a data, então só ela é conferida, e nenhum cálculo vai para o banco', () => {
    // Dado
    const f = { ...prazoNovo(HOJE), descricao: ' Recurso ', modo: 'digitar' as const, dias: '0', final: '' };
    // Então
    expect(errosDoPrazo(f, null)).toEqual({ final: 'Informe uma data válida.' });
    expect(dadosDoPrazo({ ...f, final: '2026-12-20' }, '2026-12-01')).toEqual({ descricao: 'Recurso', final: '2026-12-20', intimacao: null, dias: null, contagem: null, disponibilizacao: false, sem_recesso: false, andamento_id: null });
  });

  it('quando calcula, então guarda o último dia calculado e como foi contado', () => {
    // Quando
    const d = dadosDoPrazo({ ...prazoNovo(HOJE, 'uteis', andamento()), descricao: 'Contestação', disponibilizacao: true, semRecesso: true }, '2026-12-01');
    // Então
    expect(d).toEqual({ descricao: 'Contestação', final: '2026-12-01', intimacao: '2026-11-09', dias: 15, contagem: 'uteis', disponibilizacao: true, sem_recesso: true, andamento_id: 'a1' });
  });
});

describe('Situação do prazo', () => {
  it.each([
    ['2026-11-09', null, 'vencido', 'Vencido há 1 dia'], ['2026-11-01', null, 'vencido', 'Vencido há 9 dias'], ['2026-11-10', null, 'hoje', 'Vence hoje'],
    ['2026-11-11', null, 'proximo', 'Falta 1 dia'], ['2026-11-17', null, 'proximo', 'Faltam 7 dias'], ['2026-11-18', null, 'em_dia', 'Faltam 8 dias'],
    ['2026-11-01', 'x', 'cumprido', 'Cumprido']
  ])('quando o último dia é %s (cumprido: %s), então a situação é %s', (final, concluido_em, situacao, rotulo) => {
    // Então
    expect(situacaoDoPrazoNoProcesso({ final, concluido_em }, HOJE)).toBe(situacao);
    expect(rotuloDoPrazo({ final, concluido_em }, HOJE)).toBe(rotulo);
  });

  it('quando atravessa a troca do horário de verão ou de ano, então a conta de dias não escorrega', () => {
    // Então
    expect(rotuloDoPrazo({ final: '2027-01-02', concluido_em: null }, '2026-12-31')).toBe('Faltam 2 dias');
  });

  it('quando diz como foi contado, então usa os dias e a contagem, ou diz que foi digitada', () => {
    // Então
    expect(comoFoiContado(prazo())).toBe('15 dias úteis desde 09/11/2026');
    expect(comoFoiContado(prazo({ dias: 1, contagem: 'corridos' }))).toBe('1 dia corrido desde 09/11/2026');
    expect(comoFoiContado(prazo({ intimacao: null, dias: null, contagem: null }))).toBe('Data digitada');
  });

  it('quando ordena, então vêm os abertos do que vence antes, e depois os cumpridos', () => {
    // Dado
    const lista = [prazo({ id: 'tarde', final: '2026-12-20' }), prazo({ id: 'feito-velho', final: '2026-01-01', concluido_em: 'x' }), prazo({ id: 'cedo', final: '2026-11-20' }), prazo({ id: 'feito-novo', final: '2026-06-01', concluido_em: 'x' })];
    // Então
    expect(naOrdemDosPrazos(lista).map(z => z.id)).toEqual(['cedo', 'tarde', 'feito-novo', 'feito-velho']);
  });

  it.each([
    [[prazo({ final: '2026-11-01' })], 'Este processo tem 1 prazo vencido.'],
    [[prazo({ final: HOJE })], 'Este processo tem 1 prazo que vence hoje.'],
    [[prazo({ final: '2026-11-01' }), prazo({ final: '2026-11-02' }), prazo({ final: HOJE }), prazo({ final: HOJE })], 'Este processo tem 2 prazos vencidos e 2 prazos que vencem hoje.'],
    [[prazo({ final: '2026-11-01', concluido_em: 'x' }), prazo({ final: '2026-11-11' })], null], [[], null]
  ])('quando há esses prazos, então o alerta é o certo (%#)', (prazos, alerta) => {
    // Então
    expect(alertaDosPrazos(prazos, HOJE)).toBe(alerta);
  });

  it('quando grava no histórico, então a linha é igual à do banco', () => {
    // Então
    expect(linhaDoPrazo(prazo())).toBe('Contestação: 01/12/2026 (15 dias úteis desde 09/11/2026)');
    expect(linhaDoPrazo(prazo({ dias: 1, contagem: 'uteis' }))).toBe('Contestação: 01/12/2026 (1 dia útil desde 09/11/2026)');
    expect(linhaDoPrazo(prazo({ intimacao: null, dias: null, contagem: null, concluido_em: 'x' }))).toBe('Contestação: 01/12/2026 (cumprido)');
  });
});

describe('A tarefa que nasce', () => {
  it('quando nasce de uma intimação, então fica ligada ao processo, com o responsável, os clientes e os colaboradores que ainda estão na equipe', () => {
    // Quando
    const t = tarefaDaIntimacao(PROCESSO, andamento(), { eu: 'u9', ativos: ['u1', 'u2'] });
    // Então
    expect(t).toMatchObject({ titulo: 'Intimação: Intimação para contestar', prazo: null, responsavel_id: 'u1', participantes: ['u2'], pessoas: ['c1'], processo_id: 'p1' });
    expect(t.descricao).toContain('0001234-97.2026.8.13.0024');
    expect(t.descricao).toContain('Intimação de 09/11/2026');
  });

  it('quando nasce de um prazo, então o prazo da tarefa é o último dia', () => {
    // Quando
    const t = tarefaDoPrazo(PROCESSO, prazo(), { eu: 'u9', ativos: ['u1'] });
    // Então
    expect(t).toMatchObject({ titulo: 'Prazo: Contestação', prazo: '2026-12-01', participantes: [], processo_id: 'p1' });
    expect(t.descricao).not.toContain('01/12/2026');
  });

  it('quando o responsável do processo não está mais ativo, então a tarefa fica com quem está criando', () => {
    // Quando
    const t = tarefaDoPrazo(PROCESSO, prazo(), { eu: 'u9', ativos: ['u2', 'u9'] });
    // Então
    expect(t).toMatchObject({ responsavel_id: 'u9', participantes: ['u2'] });
  });

  it('quando o texto é longo, então título e descrição cabem no que o banco aceita', () => {
    // Quando
    const t = tarefaDaIntimacao(PROCESSO, andamento({ texto: 'x'.repeat(TAMANHO_ANDAMENTO.texto) }), { eu: 'u1', ativos: [] });
    const z = tarefaDoPrazo(PROCESSO, prazo({ descricao: 'y'.repeat(TAMANHO_PRAZO.descricao) }), { eu: 'u1', ativos: [] });
    // Então
    expect(t.titulo!.length).toBeLessThanOrEqual(TAMANHO_TAREFA.titulo);
    expect(t.descricao!.length).toBeLessThanOrEqual(TAMANHO_TAREFA.descricao);
    expect(z.titulo!.length).toBeLessThanOrEqual(TAMANHO_TAREFA.titulo);
  });
});
