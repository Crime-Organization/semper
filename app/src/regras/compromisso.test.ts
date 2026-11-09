// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import type { Compromisso, Membro } from '../dados/tipos';
import {
  camposDoCompromisso, compromissoVazio, continuaPeloProcesso, dadosDoCompromisso, detalheDoLigado, errosDaEtapaCompromisso, ETAPAS_COMPROMISSO, fmtHora, horarioDoCompromisso, linhasDoCompromisso, mencaoNegadaNoCompromisso,
  motivoSemMencaoNoCompromisso, nomeDoCompromisso, papeisNoCompromisso, participaDoCompromisso, podeMudarCompromisso, primeiraEtapaComErroCompromisso, quandoDoCompromisso, semSairDoCompromisso, soLeNaLista, TIPOS,
  TIPOS_COMPROMISSO, validarCompromisso, valorLegivelCompromisso, veOCompromisso, type CamposCompromisso
} from './compromisso';

const preenchido = (campos: Partial<CamposCompromisso> = {}): CamposCompromisso => ({
  ...compromissoVazio(), titulo: 'Reunião com o cliente', data: '10/11/2026', hora: '14:30', responsavelId: 'u-ana', ...campos
});
const salvo = (campos: Partial<Compromisso> = {}): Compromisso => ({
  id: 'c1', codigo: 'ABC', tipo: 'audiencia', titulo: null, data: '2026-11-10', hora: '14:30:00', hora_fim: null, modalidade: 'presencial', local: 'Fórum', resultado: null, observacoes: null, geral: false,
  responsavel_id: 'u-ana', participantes: ['u-bruno'], pessoa_nome: 'JOSÉ; MARIA', processo_id: 'p1', processo_codigo: 'P1', processo_numero: '123', etapa_id: null, etapa_ordem: null, arquivado_em: null, arquivado_por: null,
  criado_por: 'u-ana', criado_em: '', atualizado_por: null, atualizado_em: '', pessoas: [], processo: null, ...campos
});
const membro = (id: string, papel: Membro['papel'] = 'usuario'): Membro => ({ id, nome: id, papel });

describe('Cadastro de compromisso', () => {
  it.each(TIPOS.map(t => [t, TIPOS_COMPROMISSO[t].doProcesso] as const))('quando o tipo é %s, então exigir o processo é %s', (tipo, doProcesso) => {
    // Quando
    const erros = validarCompromisso(preenchido({ tipo, modalidade: '' }));
    // Então
    expect(!!erros.processoId).toBe(doProcesso);
    expect(!!erros.modalidade).toBe(doProcesso);
  });

  it.each([
    ['audiência sem processo', { tipo: 'audiencia', modalidade: 'presencial' }, 'processoId', 'Audiência precisa de um processo.'],
    ['perícia sem processo', { tipo: 'pericia', modalidade: 'virtual' }, 'processoId', 'Perícia precisa de um processo.'],
    ['audiência sem modalidade', { tipo: 'audiencia', processoId: 'p1' }, 'modalidade', 'Escolha a modalidade.'],
    ['reunião sem título', { titulo: '  ' }, 'titulo', 'Dê um título ao compromisso.'],
    ['título longo demais', { titulo: 'x'.repeat(301) }, 'titulo', 'O título pode ter até 300 caracteres.'],
    ['sem data', { data: '' }, 'data', 'Informe a data.'],
    ['data que não existe', { data: '31/02/2026' }, 'data', 'Data inexistente.'],
    ['reunião sem hora', { hora: '' }, 'hora', 'Informe a hora.'],
    ['fim sem início', { tipo: 'outro', hora: '', horaFim: '10:00' }, 'horaFim', 'O fim só vale com a hora do início.'],
    ['fim antes do início', { hora: '14:00', horaFim: '13:00' }, 'horaFim', 'O fim precisa ser depois do início.'],
    ['fim igual ao início', { hora: '14:00', horaFim: '14:00' }, 'horaFim', 'O fim precisa ser depois do início.'],
    ['sem responsável', { responsavelId: '' }, 'responsavelId', 'Escolha o responsável.'],
    ['participante repetido', { participantes: ['u-a', 'u-a'] }, 'participantes', 'A mesma pessoa aparece duas vezes nos participantes.'],
    ['pessoa repetida', { pessoas: ['p1', 'p1'] }, 'pessoas', 'A mesma pessoa aparece duas vezes.']
  ] as const)('quando há %s, então o campo avisa', (_caso, campos, campo, mensagem) => {
    // Quando
    const erros = validarCompromisso(preenchido(campos as Partial<CamposCompromisso>));
    // Então
    expect(erros[campo]).toBe(mensagem);
  });

  it.each([
    ['reunião completa', {}],
    ['audiência sem título', { tipo: 'audiencia', titulo: '', processoId: 'p1', modalidade: 'presencial' }],
    ['outro sem hora', { tipo: 'outro', hora: '' }],
    ['com hora do fim', { horaFim: '15:00' }]
  ] as const)('quando é %s, então pode salvar', (_caso, campos) => {
    // Quando
    const erros = validarCompromisso(preenchido(campos as Partial<CamposCompromisso>));
    // Então
    expect(erros).toEqual({});
  });

  it('quando vai para o banco, então os textos ficam limpos, a data no formato dele e o responsável fora dos participantes', () => {
    // Quando
    const d = dadosDoCompromisso(preenchido({ titulo: ' Reunião ', local: ' ', participantes: ['u-ana', 'u-b', 'u-b', ''], pessoas: ['p1', 'p1', ''], geral: true }));
    // Então
    expect(d).toMatchObject({ tipo: 'reuniao', titulo: 'Reunião', data: '2026-11-10', hora: '14:30', hora_fim: null, local: null, modalidade: null, responsavel_id: 'u-ana', participantes: ['u-b'], pessoas: ['p1'], processo_id: null, geral: true });
  });

  it('quando o tipo não é do processo, então o resultado digitado antes de trocar de tipo não vai para o banco', () => {
    // Quando
    const d = dadosDoCompromisso(preenchido({ tipo: 'reuniao', resultado: 'Acordo' }));
    // Então
    expect(d.resultado).toBeNull();
  });

  it('quando abre um compromisso salvo, então os campos voltam como a pessoa digita', () => {
    // Quando
    const c = camposDoCompromisso(salvo({ hora_fim: '16:00:00', resultado: 'Acordo' }));
    // Então
    expect(c).toMatchObject({ tipo: 'audiencia', titulo: '', data: '10/11/2026', hora: '14:30', horaFim: '16:00', modalidade: 'presencial', local: 'Fórum', processoId: 'p1', responsavelId: 'u-ana', participantes: ['u-bruno'], pessoas: [''], resultado: 'Acordo' });
  });

  it('quando os erros são por etapa, então cada etapa vê só os campos dela', () => {
    // Dado
    const c = preenchido({ tipo: 'audiencia', data: '' });
    // Quando / Então
    expect(Object.keys(errosDaEtapaCompromisso('compromisso', c))).toEqual(['data']);
    expect(Object.keys(errosDaEtapaCompromisso('onde', c))).toEqual(['processoId', 'modalidade']);
    expect(errosDaEtapaCompromisso('detalhes', c)).toEqual({});
  });

  it('quando há erro numa etapa anterior, então ao salvar volta para ela', () => {
    // Quando / Então
    expect(primeiraEtapaComErroCompromisso(preenchido({ tipo: 'audiencia' }))).toBe(ETAPAS_COMPROMISSO.findIndex(e => e.id === 'onde'));
    expect(primeiraEtapaComErroCompromisso(preenchido())).toBe(-1);
  });
});

describe('Quem não pode sair do compromisso', () => {
  const dados = { responsavel_id: 'u-outro', participantes: [] as string[] };
  const ANTES = { responsavel_id: 'u-eu', lista: [] };
  it('quando a pessoa passaria a não ver, então continua como participante', () => {
    // Quando
    const r = semSairDoCompromisso(dados, 'u-eu', false, ANTES);
    // Então
    expect(r).toEqual({ dados: { ...dados, participantes: ['u-eu'] }, ficou: true });
  });
  it('quando passa adiante um compromisso da Agenda geral, então continua como participante, para não perder a edição', () => {
    // Quando
    const r = semSairDoCompromisso({ ...dados, geral: true }, 'u-eu', false, ANTES);
    // Então
    expect(r).toEqual({ dados: { ...dados, geral: true, participantes: ['u-eu'] }, ficou: true });
  });
  it.each([
    ['é administradora ou criou', dados, true],
    ['continua responsável', { ...dados, responsavel_id: 'u-eu' }, false],
    ['continua participante', { ...dados, participantes: ['u-eu'] }, false]
  ])('quando %s, então nada muda', (_caso, d, podeSair) => {
    // Quando
    const r = semSairDoCompromisso(d, 'u-eu', podeSair, ANTES);
    // Então
    expect(r).toEqual({ dados: d, ficou: false });
  });
  it.each([
    ['escolheu outro processo agora', { processo_id: 'a', processo: null }, 'b', true],
    ['o processo já ligado é um que vê', { processo_id: 'a', processo: { id: 'a' } }, 'a', true],
    ['o processo já ligado não é um que vê', { processo_id: 'a', processo: null }, 'a', false],
    ['tirou o processo', { processo_id: 'a', processo: { id: 'a' } }, null, false]
  ])('quando %s, então continuar vendo pelo processo é %s', (_caso, alvo, depois, esperado) => {
    // Quando
    const r = continuaPeloProcesso(alvo as never, depois);
    // Então
    expect(r).toBe(esperado);
  });
});

describe('Cartão do compromisso', () => {
  it.each([
    ['tem título', { titulo: 'Instrução' }, 'Instrução'],
    ['não tem título, mas tem pessoas', {}, 'Audiência · JOSÉ e MARIA'],
    ['só tem o processo', { pessoa_nome: '' }, 'Audiência · 123']
  ])('quando %s, então o nome do cartão é %s', (_caso, campos, nome) => {
    // Quando
    const r = nomeDoCompromisso(salvo(campos));
    // Então
    expect(r).toBe(nome);
  });

  it.each([
    [{ hora: '14:30:00', hora_fim: null }, '14:30'],
    [{ hora: '14:30:00', hora_fim: '16:00:00' }, '14:30 às 16:00'],
    [{ hora: null, hora_fim: null }, 'Dia inteiro']
  ])('quando o horário é %j, então aparece como %s', (horas, texto) => {
    // Quando / Então
    expect(horarioDoCompromisso(horas)).toBe(texto);
  });

  it('quando mostra a data, então vem no formato brasileiro, com o horário', () => {
    // Quando / Então
    expect(quandoDoCompromisso({ data: '2026-11-10', hora: '09:05:00', hora_fim: null })).toBe('10/11/2026 · 09:05');
    expect(fmtHora(null)).toBe('');
  });

  it('quando mostra os dados, então só os preenchidos aparecem', () => {
    // Quando
    const rotulos = linhasDoCompromisso(salvo({ local: null, geral: true })).map(([r]) => r);
    // Então
    expect(rotulos).toEqual(['Data', 'Horário', 'Tipo', 'Modalidade', 'Agenda geral']);
  });

  it.each([
    ['tipo', 'pericia', 'Perícia'],
    ['modalidade', 'virtual', 'Virtual'],
    ['data', '2026-11-10', '10/11/2026'],
    ['hora', '14:30:00', '14:30'],
    ['geral', true, 'Sim'],
    ['local', 'Fórum', 'Fórum'],
    ['local', null, '—'],
    ['arquivado_em', '2026-11-03T01:00:00Z', '02/11/2026']
  ])('quando o histórico mostra %s = %s, então aparece %s', (campo, valor, texto) => {
    // Quando / Então
    expect(valorLegivelCompromisso(campo, valor)).toBe(texto);
  });

  it('quando aparece em outro cartão, então mostra a data, o papel e a situação', () => {
    // Quando
    const r = detalheDoLigado({ data: '2026-11-10', hora: '14:30:00', hora_fim: null, papeis: ['pessoa', 'responsavel'] }, 'Agendado');
    // Então
    expect(r).toBe('10/11/2026 · 14:30 · Ligada, Responsável · Agendado');
  });
});

describe('Pessoas do compromisso', () => {
  const c = { pessoas: ['p1'], responsavel_id: 'u-r', participantes: ['u-p'] };
  it.each([
    ['ligada', 'p1', null, ['pessoa']],
    ['responsável', 'p2', 'u-r', ['responsavel']],
    ['participante', 'p2', 'u-p', ['participante']],
    ['fora', 'p2', 'u-x', []]
  ])('quando a pessoa está %s, então os papéis são os dela', (_caso, pessoa, perfil, papeis) => {
    // Quando / Então
    expect(papeisNoCompromisso(c, pessoa, perfil)).toEqual(papeis);
  });
});

describe('Quem vê e quem muda o compromisso', () => {
  const c = salvo({ criado_por: 'u-criou', responsavel_id: 'u-resp', participantes: ['u-part'] });
  const processo = { criado_por: 'u-pc', responsavel_id: 'u-pr', colaboradores: ['u-pcol'] };
  it.each([
    ['um administrador', membro('u-x', 'admin'), null, true],
    ['um master', membro('u-x', 'master'), null, true],
    ['quem criou', membro('u-criou'), null, true],
    ['o responsável', membro('u-resp'), null, true],
    ['um participante', membro('u-part'), null, true],
    ['um colaborador do processo', membro('u-pcol'), processo, true],
    ['o responsável do processo', membro('u-pr'), processo, true],
    ['alguém de fora', membro('u-x'), processo, false]
  ])('quando é %s, então participar é %s', (_caso, m, p, esperado) => {
    // Quando / Então
    expect(participaDoCompromisso(c, m, p)).toBe(esperado);
    expect(veOCompromisso(c, m, p)).toBe(esperado);
  });

  it('quando está na Agenda geral, então todos veem, mas quem está de fora não muda', () => {
    // Dado
    const geral = { ...c, geral: true };
    // Quando / Então
    expect(veOCompromisso(geral, membro('u-x'))).toBe(true);
    expect(participaDoCompromisso(geral, membro('u-x'))).toBe(false);
    expect(motivoSemMencaoNoCompromisso(geral)(membro('u-x'))).toBeNull();
  });

  it('quando não está na Agenda geral, então quem não vê não pode ser mencionado', () => {
    // Quando / Então
    expect(motivoSemMencaoNoCompromisso(c)(membro('u-x'))).toBe('não participa; inclua como participante');
    expect(motivoSemMencaoNoCompromisso(c)(membro('u-part'))).toBeNull();
    expect(mencaoNegadaNoCompromisso('Ana')).toBe('Não é possível mencionar Ana neste compromisso: inclua essa pessoa como participante antes.');
  });

  it.each([
    ['alguém de fora, na Agenda geral', 'u-x', false, true, true],
    ['alguém de fora, sem Agenda geral', 'u-x', false, false, false],
    ['um administrador, na Agenda geral', 'u-x', true, true, false],
    ['quem participa, na Agenda geral', 'u-part', false, true, false]
  ])('quando na lista é %s, então só ler é %s', (_caso, eu, ehAdmin, geral, esperado) => {
    // Quando / Então
    expect(soLeNaLista({ ...c, geral }, eu, ehAdmin)).toBe(esperado);
  });

  it.each([
    ['administrador', 'u-x', true, {}, true],
    ['quem criou', 'u-criou', false, {}, true],
    ['responsável', 'u-resp', false, {}, true],
    ['participante', 'u-part', false, {}, true],
    ['quem está no processo ligado', 'u-x', false, { processo: { id: 'p', criado_por: 'u-y', responsavel_id: 'u-x', colaboradores: [] } }, true],
    ['colaborador do processo ligado', 'u-x', false, { processo: { id: 'p', criado_por: 'u-y', responsavel_id: 'u-y', colaboradores: ['u-x'] } }, true],
    ['quem vê o processo só porque toda a equipe vê', 'u-x', false, { processo: { id: 'p', criado_por: 'u-y', responsavel_id: 'u-y', colaboradores: [] } }, false],
    ['quem só vê a Agenda geral', 'u-x', false, { geral: true }, false]
  ])('quando na tela é %s, então poder mudar é %s', (_caso, eu, ehAdmin, campos, esperado) => {
    // Quando / Então
    expect(podeMudarCompromisso({ ...c, ...(campos as Partial<Compromisso>) }, eu, ehAdmin)).toBe(esperado);
  });
});
