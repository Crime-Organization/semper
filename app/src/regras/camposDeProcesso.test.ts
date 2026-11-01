// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import type { CampoDeProcesso } from '../dados/tipos';
import {
  CAMPO_NOVO, camposDoTipo, dadosDoCampo, errosDoFormDoCampo, errosDosCampos, formDoCampo, linhasDosCampos, nomesNoHistorico, opcoesDigitadas, valoresNoFormulario, valoresParaGravar, valorNoHistorico
} from './camposDeProcesso';

const campo = (id: string, tipo: CampoDeProcesso['tipo'], extra: Partial<CampoDeProcesso> = {}): CampoDeProcesso =>
  ({ id, nome: id.toUpperCase(), tipo, aparece_em: 'ambos', opcoes: tipo === 'lista' ? ['Site', 'Parceiro'] : [], apagado_em: null, ...extra });
const TEXTO = campo('perito', 'texto', { aparece_em: 'judicial' }), DATA = campo('pericia', 'data'), NUMERO = campo('autores', 'numero'), LISTA = campo('origem', 'lista');
const APAGADO = campo('velho', 'texto', { apagado_em: '2026-11-01T12:00:00Z' }), SO_ADM = campo('inpi', 'texto', { aparece_em: 'administrativo' });
const TODOS = [TEXTO, DATA, NUMERO, LISTA, APAGADO, SO_ADM];

describe('Campos que aparecem em cada processo', () => {
  it('quando o processo é judicial, então vêm os do judicial e os dos dois, sem os apagados', () => {
    // Então
    expect(camposDoTipo(TODOS, 'judicial')).toEqual([TEXTO, DATA, NUMERO, LISTA]);
    expect(camposDoTipo(TODOS, 'administrativo')).toEqual([DATA, NUMERO, LISTA, SO_ADM]);
  });
});

describe('Preenchimento', () => {
  it.each([
    ['data', { pericia: '10/12/2026' }, { pericia: '2026-12-10' }],
    ['número com milhar e decimais', { autores: '1.234,50' }, { autores: '1234.50' }],
    ['número simples', { autores: '3' }, { autores: '3' }],
    ['número negativo', { autores: '-3,5' }, { autores: '-3.5' }],
    ['texto com espaços', { perito: '  Dra. Exemplo ' }, { perito: 'Dra. Exemplo' }],
    ['lista', { origem: 'Site' }, { origem: 'Site' }],
    ['campo vazio', { perito: '   ' }, {}]
  ])('quando grava %s, então fica no formato guardado', (_caso, digitados, guardados) => {
    // Então
    expect(errosDosCampos(TODOS, 'judicial', digitados)).toEqual({});
    expect(valoresParaGravar(TODOS, 'judicial', digitados)).toEqual(guardados);
  });

  it('quando abre um processo salvo, então os valores voltam como se digita', () => {
    // Quando
    const f = valoresNoFormulario(TODOS, { pericia: '2026-12-10', autores: '1234.50', perito: 'Dra.', origem: 'Site' });
    // Então
    expect(f).toEqual({ pericia: '10/12/2026', autores: '1.234,50', perito: 'Dra.', origem: 'Site' });
    expect(valoresParaGravar(TODOS, 'judicial', f)).toEqual({ pericia: '2026-12-10', autores: '1234.50', perito: 'Dra.', origem: 'Site' });
  });

  it.each([
    ['pericia', '31/02/2026'], ['pericia', '10-12'], ['autores', 'muitos'], ['autores', '1,2,3'], ['perito', 'x'.repeat(1001)]
  ])('quando o campo %s recebe um valor inválido, então avisa só nele', (id, digitado) => {
    // Então
    expect(Object.keys(errosDosCampos(TODOS, 'judicial', { [id]: digitado }))).toEqual([id]);
  });

  it('quando o campo não vale para o tipo do processo, então um valor errado nele não trava: está fora da tela', () => {
    // Então
    expect(errosDosCampos([TEXTO, campo('so', 'numero', { aparece_em: 'judicial' })], 'administrativo', { so: 'abc' })).toEqual({});
  });

  it('quando grava, então o que está guardado em campo apagado continua guardado, e o que foi limpo sai', () => {
    // Quando
    const v = valoresParaGravar(TODOS, 'judicial', { perito: '' }, { velho: 'antigo', perito: 'Dra.', pericia: '2026-12-10' });
    // Então
    expect(v).toEqual({ velho: 'antigo' });
  });
});

describe('Cartão e histórico', () => {
  it('quando mostra o cartão, então aparecem só os preenchidos, sem os apagados nem os de outro tipo', () => {
    // Então
    expect(linhasDosCampos(TODOS, 'judicial', { perito: 'Dra.', pericia: '2026-12-10', velho: 'x', inpi: 'y' })).toEqual([['PERITO', 'Dra.'], ['PERICIA', '10/12/2026']]);
  });

  it('quando mostra o histórico, então o campo aparece pelo nome e no formato dele, inclusive o apagado', () => {
    // Dado
    const valor = valorNoHistorico(TODOS, (_c, v) => 'fixo:' + String(v));
    // Então
    expect(nomesNoHistorico(TODOS)['campo:velho']).toBe('VELHO');
    expect(valor('campo:pericia', '2026-12-10')).toBe('10/12/2026');
    expect(valor('campo:pericia', null)).toBe('—');
    expect(valor('campo:desconhecido', 'cru')).toBe('cru');
    expect(valor('comarca', 'Cidade')).toBe('fixo:Cidade');
  });
});

describe('Configuração do campo', () => {
  it('quando tem nome, então pode salvar; a lista precisa de opção', () => {
    // Então
    expect(errosDoFormDoCampo({ ...CAMPO_NOVO, nome: 'Perito' }, [])).toEqual({});
    expect(errosDoFormDoCampo(CAMPO_NOVO, []).nome).toBe('Dê um nome ao campo.');
    expect(errosDoFormDoCampo({ ...CAMPO_NOVO, nome: 'x', tipo: 'lista', opcoes: ' \n ' }, []).opcoes).toBe('Escreva pelo menos uma opção.');
  });

  it('quando o nome já existe, sem contar maiúsculas nem acentos, então avisa; se está apagado, sugere reativar', () => {
    // Dado
    const existentes = [campo('a', 'texto', { nome: 'Perícia' }), campo('b', 'texto', { nome: 'Velho', apagado_em: 'x' })];
    // Então
    expect(errosDoFormDoCampo({ ...CAMPO_NOVO, nome: 'pericia' }, existentes).nome).toBe('Já existe um campo com esse nome.');
    expect(errosDoFormDoCampo({ ...CAMPO_NOVO, nome: 'VELHO' }, existentes).nome).toBe('Já existe um campo apagado com esse nome. Reative esse campo.');
    expect(errosDoFormDoCampo({ ...CAMPO_NOVO, nome: 'Perícia' }, existentes, 'a')).toEqual({});
  });

  it('quando escreve as opções, então ficam uma por linha, limpas e sem repetir', () => {
    // Então
    expect(opcoesDigitadas(' Site \n\nsite\nParceiro\nCível\ncivel')).toEqual(['Site', 'Parceiro', 'Cível']);
  });

  it('quando o tipo não é lista, então as opções não vão para o banco', () => {
    // Então
    expect(dadosDoCampo({ nome: ' Perito ', tipo: 'texto', aparece_em: 'judicial', opcoes: 'sobrou' })).toEqual({ nome: 'Perito', tipo: 'texto', aparece_em: 'judicial', opcoes: [] });
    expect(dadosDoCampo(formDoCampo(LISTA)).opcoes).toEqual(['Site', 'Parceiro']);
  });
});
