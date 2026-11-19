// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import { DEMANDA_VAZIA, ETAPAS_DEMANDA, validarDemanda } from './demanda';
import {
  camposDoPrazo, camposDoQuando, camposForaDoLapis, DATAS_NO_LUGAR, datasForaDoLapisDoCompromisso, errosDoQuando, errosDosCampos, etapasDoLapis,
  horaNoLapis, lembreteDoPrazo, prazoAoGravar, prazoComoEsta, quandoAoGravar, quandoComoEsta, resumoDoPrazo, semOsCampos, SEM_PRAZO, temErro, textoDoPrazo
} from './datasNoCartao';
import { ETAPAS_COMPROMISSO } from './compromisso';
import { ETAPAS_TAREFA, TAREFA_VAZIA, validarTarefa } from './tarefa';

const CAMPOS = ['prazo', 'hora', 'lembrete'] as const;

describe('O prazo no cartão (#361)', () => {
  it.each([
    ['com hora e lembrete', { prazo: '2030-11-15', prazo_hora: '14:00:00', lembrete: 60 as const }, '15/11/2030 às 14:00', '1 hora antes'],
    ['sem hora nem lembrete', { prazo: '2030-11-15', prazo_hora: null, lembrete: null }, '15/11/2030', 'Sem lembrete'],
    ['sem prazo (o lembrete que sobrou no banco não vale)', { prazo: null, prazo_hora: null, lembrete: 30 as const }, SEM_PRAZO, null]
  ])('dado um prazo %s, quando o cartão o mostra, então diz o prazo e o lembrete', (_caso, gravado, prazo, lembrete) => {
    // Quando / Então
    expect(textoDoPrazo(gravado)).toBe(prazo);
    expect(lembreteDoPrazo(gravado)).toBe(lembrete);
  });

  it('dado um prazo com lembrete, quando o leitor de tela o lê, então ouve o prazo e o lembrete juntos', () => {
    // Quando / Então
    expect(resumoDoPrazo({ prazo: '2030-11-15', prazo_hora: '14:00:00', lembrete: 1440 })).toBe('15/11/2030 às 14:00, lembrete: 1 dia antes');
    expect(resumoDoPrazo({ prazo: '2030-11-15', prazo_hora: null, lembrete: null })).toBe('15/11/2030');
  });

  it('dado o prazo gravado, quando o formulário pequeno abre, então começa com ele (sem prazo, sem hora e sem lembrete)', () => {
    // Quando / Então
    expect(camposDoPrazo({ prazo: '2030-11-15', prazo_hora: '14:00:00', lembrete: 30 })).toEqual({ prazo: '15/11/2030', hora: '14:00', lembrete: 30 });
    expect(camposDoPrazo({ prazo: null, prazo_hora: '14:00:00', lembrete: 30 })).toEqual({ prazo: '', hora: '', lembrete: null });
  });

  it.each([
    ['a hora sem o prazo', { prazo: '', hora: '14:00', lembrete: null }, { hora: 'Informe o prazo para pôr a hora' }],
    ['o lembrete sem o prazo', { prazo: '', hora: '', lembrete: 60 as const }, { lembrete: 'Informe o prazo para marcar o lembrete' }],
    ['um dia que não existe', { prazo: '31/02/2030', hora: '', lembrete: null }, { prazo: expect.any(String) }],
    ['tudo certo', { prazo: '15/11/2030', hora: '14:00', lembrete: 60 as const }, {}],
    ['sem prazo nenhum', { prazo: '', hora: '', lembrete: null }, {}]
  ])('dado %s, quando o cartão confere, então dá os mesmos erros do cadastro da tarefa e da demanda', (_caso, campos, erros) => {
    // Quando / Então
    expect(errosDosCampos(validarTarefa, TAREFA_VAZIA, campos, CAMPOS)).toEqual(erros);
    expect(errosDosCampos(validarDemanda, DEMANDA_VAZIA, campos, CAMPOS)).toEqual(erros);
  });

  it('dado o cadastro vazio, quando o cartão confere só o prazo, então os erros dos outros campos (o título em branco) não contam', () => {
    // Quando
    const erros = errosDosCampos(validarTarefa, TAREFA_VAZIA, { prazo: '15/11/2030', hora: '', lembrete: null }, CAMPOS);
    // Então
    expect(temErro(erros)).toBe(false);
    expect(temErro({ prazo: 'Use o formato DD/MM/AAAA.' })).toBe(true);
  });

  it('dado o prazo conferido, quando o cartão grava, então vai como o banco guarda; sem prazo, a hora e o lembrete ficam vazios', () => {
    // Quando / Então
    expect(prazoAoGravar({ prazo: '15/11/2030', hora: '14:00', lembrete: 60 })).toEqual({ prazo: '2030-11-15', prazo_hora: '14:00', lembrete: 60 });
    expect(prazoAoGravar({ prazo: '15/11/2030', hora: '', lembrete: null })).toEqual({ prazo: '2030-11-15', prazo_hora: null, lembrete: null });
    expect(prazoAoGravar({ prazo: '', hora: '14:00', lembrete: 60 })).toEqual({ prazo: null, prazo_hora: null, lembrete: null });
  });

  it('dado um prazo gravado sem as colunas novas, quando o Desfazer o guarda, então a hora e o lembrete vão vazios', () => {
    // Quando / Então
    expect(prazoComoEsta({ prazo: '2030-11-15' })).toEqual({ prazo: '2030-11-15', prazo_hora: null, lembrete: null });
  });
});

describe('A data e o horário do compromisso no cartão (#361)', () => {
  it('dado o compromisso gravado, quando o formulário pequeno abre e grava, então vai e volta no formato de cada lado', () => {
    // Dado
    const gravado = { data: '2026-11-10', hora: '14:30:00', hora_fim: null };
    // Quando
    const campos = camposDoQuando(gravado);
    // Então
    expect(campos).toEqual({ data: '10/11/2026', hora: '14:30', horaFim: '' });
    expect(quandoAoGravar(campos)).toEqual({ data: '2026-11-10', hora: '14:30', hora_fim: null });
    expect(quandoComoEsta(gravado)).toEqual(gravado);
  });

  it.each([
    ['reunião sem hora', 'reuniao' as const, { data: '10/11/2026', hora: '', horaFim: '' }, { hora: 'Informe a hora.' }],
    ['"Outro" sem hora (vale o dia inteiro)', 'outro' as const, { data: '10/11/2026', hora: '', horaFim: '' }, {}],
    ['o fim antes do início', 'reuniao' as const, { data: '10/11/2026', hora: '14:00', horaFim: '13:00' }, { horaFim: 'O fim precisa ser depois do início.' }],
    ['sem a data', 'audiencia' as const, { data: '', hora: '14:00', horaFim: '' }, { data: 'Informe a data.' }]
  ])('dado %s, quando o cartão confere, então dá os erros do cadastro do compromisso (e só os da data e do horário)', (_caso, tipo, campos, erros) => {
    // Quando / Então
    expect(errosDoQuando(tipo, campos)).toEqual(erros);
  });
});

describe('O lápis de um item já existente sem as datas (#361)', () => {
  it('dados os dados do lápis da tarefa, quando ele grava, então as datas mudadas no cartão ficam de fora', () => {
    // Dado
    const dados = { prazo: '2030-11-15', prazo_hora: '14:00', lembrete: 60, data_inicio: '2030-11-01', responsavel_id: 'u1', participantes: [] };
    // Quando / Então
    expect(semOsCampos(dados, DATAS_NO_LUGAR.tarefas.dados)).toEqual({ responsavel_id: 'u1', participantes: [] });
  });

  it('dadas as etapas da tarefa e da demanda, quando o lápis as mostra, então a primeira da demanda (só título, descrição e datas) some, a da tarefa fica pelas ligações e a do compromisso, pelo tipo', () => {
    // Quando
    const daTarefa = etapasDoLapis(ETAPAS_TAREFA, camposForaDoLapis(DATAS_NO_LUGAR.tarefas)).map(e => e.id);
    const daDemanda = etapasDoLapis(ETAPAS_DEMANDA, camposForaDoLapis(DATAS_NO_LUGAR.demandas)).map(e => e.id);
    const doCompromisso = etapasDoLapis(ETAPAS_COMPROMISSO, camposForaDoLapis(DATAS_NO_LUGAR.compromissos)).map(e => e.id);
    // Então
    // A primeira etapa da tarefa também tem as ligações (#299): no lápis, ela fica só com elas.
    expect(daTarefa).toEqual(['tarefa', 'pessoas']);
    expect(daDemanda).not.toContain('demanda');
    expect(doCompromisso).toEqual(ETAPAS_COMPROMISSO.map(e => e.id));
  });

  it.each([
    ['um "Outro" sem hora que vira reunião', 'reuniao' as const, null, true],
    ['uma reunião com hora', 'reuniao' as const, '14:00:00', false],
    ['um "Outro" sem hora que continua "Outro"', 'outro' as const, null, false]
  ])('dado %s, quando o lápis abre, então só pede a hora se o tipo a exige e não há', (_caso, tipo, hora, pede) => {
    // Quando / Então
    expect(horaNoLapis(tipo, hora)).toBe(pede);
    expect(datasForaDoLapisDoCompromisso(tipo, hora).dados).toEqual(pede ? ['data'] : ['data', 'hora', 'hora_fim']);
  });
});
