// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import type { Demanda, Membro } from '../dados/tipos';
import {
  camposDaDemanda, dadosDaDemanda, DEMANDA_VAZIA, errosDaEtapaDemanda, motivoSemMencaoNaDemanda, papeisNaDemanda,
  primeiraEtapaComErroDemanda, situacaoDoPrazo, validarDemanda, valorLegivelDemanda
} from './demanda';

const completa = { ...DEMANDA_VAZIA, titulo: 'Pedido de registro de marca', responsavelId: 'u-ana' };

describe('Cadastro de demanda', () => {
  it('quando faltam o título e o responsável, então o cadastro avisa os dois', () => {
    // Quando
    const erros = validarDemanda(DEMANDA_VAZIA);
    // Então
    expect(erros).toEqual({ titulo: 'Dê um título à demanda.', responsavelId: 'Escolha o responsável.' });
  });

  it.each([
    ['um prazo inválido', { prazo: '31/02/2026' }, 'prazo'],
    ['um colaborador repetido', { colaboradores: ['u-bruno', 'u-bruno'] }, 'colaboradores'],
    ['um cliente repetido', { clientes: ['p1', 'p1'] }, 'clientes']
  ])('quando há %s, então o campo tem erro', (_caso, mudanca, campo) => {
    // Quando
    const erros = validarDemanda({ ...completa, ...mudanca });
    // Então
    expect(Object.keys(erros)).toEqual([campo]);
  });

  it('quando a demanda é salva, então o responsável sai dos colaboradores, as linhas vazias somem e o prazo vai como data', () => {
    // Quando
    const dados = dadosDaDemanda({ ...completa, descricao: '  ', prazo: '10/11/2026', colaboradores: ['u-bruno', 'u-ana', 'u-bruno'], clientes: ['p1', '', 'p1'] });
    // Então
    expect(dados).toEqual({ titulo: 'Pedido de registro de marca', descricao: null, prazo: '2026-11-10', responsavel_id: 'u-ana',
      colaboradores: ['u-bruno'], clientes: ['p1'], contrato_id: null });
  });

  it('quando a demanda salva volta ao formulário, então os campos voltam como foram digitados', () => {
    // Dado
    const d = { titulo: 'X', descricao: null, prazo: '2026-11-10', responsavel_id: 'u-ana', colaboradores: ['u-bruno'],
      clientes: [{ id: 'p1' }], contrato_id: 'k1' } as unknown as Demanda;
    // Quando
    const campos = camposDaDemanda(d);
    // Então
    expect(campos).toEqual({ titulo: 'X', descricao: '', prazo: '10/11/2026', responsavelId: 'u-ana', colaboradores: ['u-bruno'], clientes: ['p1'], contratoId: 'k1' });
  });

  it('quando o título falta, então a primeira etapa é a que tem erro, e a etapa das pessoas não acusa o título', () => {
    // Quando
    const primeira = primeiraEtapaComErroDemanda({ ...completa, titulo: '' });
    const daEtapaPessoas = errosDaEtapaDemanda('pessoas', { ...completa, titulo: '' });
    // Então
    expect(primeira).toBe(0);
    expect(daEtapaPessoas).toEqual({});
  });

  it('quando o prazo aparece no histórico, então vem como dia/mês/ano; vazio vira um traço', () => {
    // Então
    expect(valorLegivelDemanda('prazo', '2026-11-10')).toBe('10/11/2026');
    expect(valorLegivelDemanda('descricao', null)).toBe('—');
  });
});

describe('Prazo da demanda', () => {
  it.each([
    ['antes de hoje', '2026-10-28', 'vencido'],
    ['hoje', '2026-10-29', 'hoje'],
    ['depois de hoje', '2026-11-05', 'em_dia'],
    ['sem prazo', null, null]
  ])('quando o prazo é %s, então a situação é %s', (_caso, prazo, esperada) => {
    // Quando
    const s = situacaoDoPrazo(prazo, '2026-10-29');
    // Então
    expect(s).toBe(esperada);
  });
});

describe('Pessoas da demanda', () => {
  const demanda = { clientes: ['p-cliente'], responsavel_id: 'u-ana', colaboradores: ['u-bruno'], criado_por: 'u-carla' };

  it.each([
    ['o cliente', 'p-cliente', null, ['cliente']],
    ['a responsável', 'p-ana', 'u-ana', ['responsavel']],
    ['o colaborador', 'p-bruno', 'u-bruno', ['colaborador']],
    ['quem não está nela', 'p-outra', 'u-outra', []]
  ])('quando se pergunta o papel de %s, então a resposta é %j', (_quem, pessoa, perfil, papeis) => {
    // Quando
    const r = papeisNaDemanda(demanda, pessoa, perfil);
    // Então
    expect(r).toEqual(papeis);
  });

  it.each([
    ['um administrador de fora da demanda', { id: 'u-adm', nome: 'Adm', papel: 'admin' }, null],
    ['o colaborador', { id: 'u-bruno', nome: 'Bruno', papel: 'usuario' }, null],
    ['quem criou', { id: 'u-carla', nome: 'Carla', papel: 'usuario' }, null],
    ['alguém da equipe de fora da demanda', { id: 'u-davi', nome: 'Davi', papel: 'usuario' }, 'não participa; inclua como colaborador']
  ] as [string, Membro, string | null][])('quando %s é mencionado num comentário da demanda, então o motivo para não poder é %s', (_quem, m, motivo) => {
    // Quando
    const r = motivoSemMencaoNaDemanda(demanda)(m);
    // Então
    expect(r).toBe(motivo);
  });
});
