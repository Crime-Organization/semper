// Processo: pessoas com papel, recursos e incidentais (#316) e os tipos que ficaram, judicial e administrativo (#406).
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import { PARTES_MAXIMAS } from '../dados/limites';
import {
  CAMPOS_PROCESSO, cabeOutraParte, cadastroDoDerivado, dadosDoProcesso, errosDaEtapaProcesso, ligacaoDoEndereco, origemAoCriar, PAPEIS, PAPEIS_DA_PARTE, papeisPorExtenso, papeisQueFaltam,
  processoDoProcesso, processosComPartes, processoVazio, relacaoEntreProcessos, relacionadosDoProcesso, tipoDoEndereco, TIPOS, TIPOS_PROCESSO, validarProcesso, valorLegivelProcesso
} from './processo';

describe('Tipos de processo', () => {
  it('quando a pessoa escolhe o tipo, então só judicial e administrativo estão entre as opções, cada um com o seu quadro e a sua página (#406)', () => {
    // Então
    expect(TIPOS.map(t => TIPOS_PROCESSO[t].nome)).toEqual(['Judicial', 'Administrativo']);
    expect(TIPOS_PROCESSO.administrativo).toMatchObject({ quadro: 'processos_administrativos', caminho: '/processos/administrativo/' });
    expect(new Set(TIPOS.map(t => TIPOS_PROCESSO[t].quadro)).size).toBe(TIPOS.length);
  });

  it.each([['administrativo', 'administrativo'], ['extrajudicial', 'administrativo'], ['investigacao', 'administrativo'], ['outro', 'judicial'], [null, 'judicial']] as const)(
    'quando o endereço traz o tipo %s, então o cadastro abre como %s', (valor, tipo) => {
      // Então
      expect(tipoDoEndereco(valor)).toBe(tipo);
    });

  it('quando o processo é administrativo, então o número não segue o CNJ e os campos só do judicial não são gravados', () => {
    // Dado
    const c = { ...processoVazio('administrativo'), numero: 'Notificação 12/2026', clientes: ['p1'], papeisClientes: { p1: 'autor' as const }, responsavelId: 'u1', comarca: 'Montes Claros', advogadoContrario: 'Fulano' };
    // Quando
    const erros = validarProcesso(c), dados = dadosDoProcesso(c);
    // Então
    expect(erros).toEqual({});
    expect(dados).toMatchObject({ numero: 'Notificação 12/2026', comarca: null, advogado_contrario: null });
  });
});

describe('Pessoas com papel no processo', () => {
  const parte = (pessoa: string, papel: (typeof PAPEIS)[number]) => ({ papel, pessoa: { id: pessoa } });

  it('quando a lista de papéis é mostrada, então tem autor, réu, terceiro, testemunha, perito e assistente técnico, cada um com nome', () => {
    // Então
    expect(PAPEIS).toEqual(expect.arrayContaining(['autor', 'reu', 'terceiro', 'testemunha', 'perito', 'assistente_tecnico']));
    expect(PAPEIS.every(p => PAPEIS_DA_PARTE[p].length > 0)).toBe(true);
  });

  it('quando a pessoa já tem um papel, então só ele sai das opções dela; as outras pessoas continuam com todos', () => {
    // Dado
    const partes = [parte('p1', 'testemunha')];
    // Então
    expect(papeisQueFaltam(partes, 'p1')).not.toContain('testemunha');
    expect(papeisQueFaltam(partes, 'p1')).toHaveLength(PAPEIS.length - 1);
    expect(papeisQueFaltam(partes, 'p2')).toEqual(PAPEIS);
  });

  it('quando o processo chega ao máximo de pessoas com papel, então não cabe outra', () => {
    // Então
    expect(cabeOutraParte(PARTES_MAXIMAS - 1)).toBe(true);
    expect(cabeOutraParte(PARTES_MAXIMAS)).toBe(false);
  });

  it('quando a pessoa é cliente e testemunha, então o cartão dela diz os dois', () => {
    // Então
    expect(papeisPorExtenso({ papeis: ['cliente'], partes: ['testemunha'] })).toBe('Cliente, Testemunha');
    expect(papeisPorExtenso({ papeis: [] })).toBe('');
  });

  it('quando o histórico mostra a pessoa que entrou, então aparece o nome e o papel; a pessoa excluída aparece assim', () => {
    // Então
    expect(valorLegivelProcesso('partes', { pessoa_id: 'p1', nome: 'PESSOA TESTE', papel: 'perito' })).toBe('PESSOA TESTE (Perito)');
    expect(valorLegivelProcesso('partes', { nome: 'pessoa excluída', papel: 'reu' })).toBe('pessoa excluída (Réu)');
    expect(valorLegivelProcesso('partes', null)).toBe('—');
  });

  it('quando a pessoa é cliente de um processo e tem papel em outro, então os dois aparecem no cartão dela, uma vez cada, dos mais novos aos mais antigos', () => {
    // Dado
    const base = { codigo: 'X', tipo: 'judicial' as const, numero: '1', titulo: null, cliente_nome: '', etapa_id: null, arquivado_em: null, responsavel_id: 'u1', colaboradores: [] };
    const comoCliente = { ...base, id: 'a', clientes: ['p1'], criado_em: '2026-01-01' };
    const comPapel = { ...base, id: 'b', clientes: ['p9'], criado_em: '2026-02-01' };
    // Quando
    const lista = processosComPartes([comoCliente], [{ papel: 'perito', processo: comPapel }, { papel: 'testemunha', processo: comPapel }], 'p1', null);
    // Então
    expect(lista.map(p => [p.id, p.papeis, p.partes])).toEqual([['b', [], ['testemunha', 'perito']], ['a', ['cliente'], []]]);
  });
});

describe('Recursos e incidentais', () => {
  it('quando o cadastro nasce de um processo, então traz o tipo, os clientes com o papel de cada um (#426) e a equipe ativa dele, e não o número', () => {
    // Dado
    const origem = { id: 'o1', tipo: 'judicial' as const, responsavel_id: 'u-saiu', colaboradores: ['u1', 'u-saiu', 'u2'], papeis_clientes: { p1: 'autor' as const, p2: 'reu' as const },
      area: 'Cível', sistema: 'PJe', meio: 'eletronico' as const, clientes: [{ id: 'p1' }, { id: 'p2' }] };
    // Quando
    const campos = processoDoProcesso(origem, ['u1', 'u2', 'eu'], 'eu');
    // Então
    expect(campos).toEqual({ origemId: 'o1', tipo: 'judicial', responsavelId: 'eu', colaboradores: ['u1', 'u2'], clientes: ['p1', 'p2'], papeisClientes: { p1: 'autor', p2: 'reu' }, area: 'Cível', sistema: 'PJe', meio: 'eletronico' });
    expect(campos).not.toHaveProperty('numero');
  });

  it('quando nasce de um processo e não diz se é recurso ou incidental, então a primeira etapa pede isso', () => {
    // Dado
    const c = { ...processoVazio('judicial'), origemId: 'o1' };
    // Então
    expect(errosDaEtapaProcesso('processo', c).ligacao).toBe('Escolha se é um recurso ou um incidental.');
    expect(errosDaEtapaProcesso('processo', { ...c, ligacao: 'recurso' }).ligacao).toBeUndefined();
    expect(validarProcesso(processoVazio('judicial')).ligacao).toBeUndefined();
  });

  it('quando o processo novo é gravado, então a origem vai junto só se houver; ela não entra na atualização', () => {
    // Então
    expect(origemAoCriar({ origemId: 'o1', ligacao: 'incidental' })).toEqual({ origem_id: 'o1', ligacao: 'incidental' });
    expect(origemAoCriar({ origemId: '', ligacao: '' })).toEqual({});
    expect(dadosDoProcesso({ ...processoVazio('judicial'), origemId: 'o1', ligacao: 'recurso' })).not.toHaveProperty('origem_id');
  });

  it('quando o botão do cartão abre o cadastro, então o endereço traz a origem e a ligação, que o cadastro lê de volta', () => {
    // Então
    expect(cadastroDoDerivado('o1', 'recurso')).toBe('/processos/novo/?processo=o1&ligacao=recurso');
    expect(cadastroDoDerivado('o1')).toBe('/processos/novo/?processo=o1');
    expect(ligacaoDoEndereco('incidental')).toBe('incidental');
    expect(ligacaoDoEndereco('qualquer')).toBe('');
  });

  it('quando um processo mostra os ligados, então a origem vem primeiro, depois os recursos e incidentais dele; o que não se liga sai', () => {
    // Dado
    const aberto = { id: 'a', origem_id: 'o', ligacao: 'recurso' as const };
    const base = { codigo: 'X', tipo: 'judicial' as const, numero: '1', titulo: null, cliente_nome: '', etapa_id: null, arquivado_em: null };
    const achados = [
      { ...base, id: 'r1', origem_id: 'a', ligacao: 'recurso' as const, criado_em: '2026-01-01' },
      { ...base, id: 'o', origem_id: null, ligacao: null, criado_em: '2025-01-01' },
      { ...base, id: 'i1', origem_id: 'a', ligacao: 'incidental' as const, criado_em: '2026-03-01' },
      { ...base, id: 'irmao', origem_id: 'o', ligacao: 'recurso' as const, criado_em: '2026-04-01' }
    ];
    // Quando
    const lista = relacionadosDoProcesso(achados, aberto);
    // Então
    expect(lista.map(p => [p.id, p.relacao])).toEqual([['o', 'origem'], ['i1', 'incidental'], ['r1', 'recurso']]);
    expect(relacaoEntreProcessos({ id: 'irmao', origem_id: 'o', ligacao: 'recurso' }, aberto)).toBeNull();
  });

  it('quando o processo de origem é excluído ou desligado (#425), então o histórico diz que a ligação acabou, sem o id da origem', () => {
    // Então
    expect(CAMPOS_PROCESSO.origem_id).toBe('Processo de origem');
    expect(valorLegivelProcesso('origem_id', '73160000-0000-0000-0000-000000000002')).toBe('ligado');
    expect(valorLegivelProcesso('origem_id', null)).toBe('sem ligação');
    expect(valorLegivelProcesso('numero', null)).toBe('—');
  });
});
