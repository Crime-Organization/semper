// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import type { Processo } from '../dados/tipos';
import {
  aoMudarNumero, camposDoProcesso, dadosDoProcesso, errosDaEtapaProcesso, linhasDoProcesso, nomeDoProcesso, opcaoNaLista, opcoesDoCampo, OPCOES_PRONTAS, numeroParaComparar, orgaoDoNumero, orgaoIndicadoNoProcesso, papeisNoProcesso, primeiraEtapaComErroProcesso, processoVazio,
  semSairDoProcesso, validarProcesso, valorLegivelProcesso, type CamposProcesso
} from './processo';

const NUMERO_VALIDO = '0001234-97.2026.8.13.0024';
const valido = (extra: Partial<CamposProcesso> = {}): CamposProcesso => ({ ...processoVazio('judicial'), numero: NUMERO_VALIDO, clientes: ['p1'], responsavelId: 'u1', ...extra });

describe('Cadastro de processo', () => {
  it('quando tem tipo, número, cliente e responsável, então pode salvar: nada mais é obrigatório', () => {
    // Então
    expect(validarProcesso(valido())).toEqual({});
    expect(primeiraEtapaComErroProcesso(valido())).toBe(-1);
  });

  it.each([
    ['sem número', { numero: '  ' }, 'numero', 'Informe o número do processo.'],
    ['sem cliente', { clientes: [''] }, 'clientes', 'Escolha pelo menos um cliente.'],
    ['o mesmo cliente duas vezes', { clientes: ['p1', 'p1'] }, 'clientes', 'O mesmo cliente aparece duas vezes.'],
    ['sem responsável', { responsavelId: '' }, 'responsavelId', 'Escolha o responsável.'],
    ['data de distribuição inválida', { distribuicao: '31/02/2026' }, 'distribuicao', expect.any(String)],
    ['valor da causa ilegível', { valorCausa: 'muito' }, 'valorCausa', 'Use um valor como 1.500,00.'],
    ['valor da causa maior que o banco guarda', { valorCausa: '100.000.000.000.000,00' }, 'valorCausa', 'Esse valor é grande demais: confira o valor da causa.'],
    ['número grande demais', { tipo: 'administrativo' as const, numero: 'x'.repeat(61) }, 'numero', 'O número pode ter até 60 caracteres.']
  ])('quando está %s, então avisa o que corrigir', (_caso, extra, campo, erro) => {
    // Então
    expect(validarProcesso(valido(extra))[campo as keyof CamposProcesso]).toEqual(erro);
  });

  it('quando o judicial tem número fora do padrão do CNJ, então avisa; marcado como antigo, passa', () => {
    // Então
    expect(validarProcesso(valido({ numero: '1234' })).numero).toBe('O número do processo tem 20 algarismos (NNNNNNN-DD.AAAA.J.TR.OOOO).');
    expect(validarProcesso(valido({ numero: '0001235-97.2026.8.13.0024' })).numero).toBe('O dígito verificador não confere: confira o número do processo.');
    expect(validarProcesso(valido({ numero: '1234/98', numeroAntigo: true })).numero).toBeUndefined();
  });

  it('quando é administrativo, então o número é livre', () => {
    // Então
    expect(validarProcesso(valido({ tipo: 'administrativo', numero: 'INPI 912345678' }))).toEqual({});
  });

  it('quando troca para administrativo com um campo judicial inválido, então ele não trava o salvar: está fora da tela e não é gravado', () => {
    // Dado
    const c = valido({ tipo: 'administrativo', numero: 'INPI 1', valorCausa: 'abc', distribuicao: '99', comarca: 'x'.repeat(121) });
    // Então
    expect(validarProcesso(c)).toEqual({});
    expect(primeiraEtapaComErroProcesso(c)).toBe(-1);
    expect(dadosDoProcesso(c)).toMatchObject({ valor_causa: null, distribuicao: null, comarca: null });
  });

  it('quando falta o cliente, então a etapa com erro é a de pessoas; e só ela reclama', () => {
    // Dado
    const c = valido({ clientes: [''] });
    // Então
    expect(primeiraEtapaComErroProcesso(c)).toBe(1);
    expect(errosDaEtapaProcesso('processo', c)).toEqual({});
    expect(Object.keys(errosDaEtapaProcesso('pessoas', c))).toEqual(['clientes']);
  });

  it('quando grava, então o número vai pontuado, os vazios vão como nulos, e o responsável não entra nos colaboradores', () => {
    // Quando
    const d = dadosDoProcesso(valido({ numero: '00012349720268130024', titulo: '  ', colaboradores: ['u1', 'u2', 'u2'], clientes: ['p1', '', 'p1'], valorCausa: '1.500,50', distribuicao: '02/03/2026' }));
    // Então
    expect(d).toMatchObject({ numero: NUMERO_VALIDO, titulo: null, colaboradores: ['u2'], clientes: ['p1'], valor_causa: 1500.5, distribuicao: '2026-03-02', polo: null, segredo: false });
  });

  it('quando é administrativo, então os campos só do judicial não vão para o banco', () => {
    // Quando
    const d = dadosDoProcesso(valido({ tipo: 'administrativo', numero: 'INPI 1', comarca: 'Montes Claros', vara: '2ª', segredo: true, gratuidade: 'pedida', sistema: 'e-Marcas' }));
    // Então
    expect(d).toMatchObject({ comarca: null, vara: null, segredo: false, gratuidade: null, sistema: 'e-Marcas' });
  });

  it('quando abre um processo salvo, então os campos voltam como digitados; número fora do padrão vem marcado como antigo', () => {
    // Dado
    const salvo = { ...dadosDoProcesso(valido({ valorCausa: '1.500,50', distribuicao: '02/03/2026' })), tipo: 'judicial', clientes: [{ id: 'p1' }] } as unknown as Processo;
    // Então
    expect(camposDoProcesso(salvo)).toMatchObject({ numero: NUMERO_VALIDO, numeroAntigo: false, valorCausa: '1.500,50', distribuicao: '02/03/2026', clientes: ['p1'] });
    expect(camposDoProcesso({ ...salvo, numero: '1234/98' }).numeroAntigo).toBe(true);
    expect(camposDoProcesso({ ...salvo, tipo: 'administrativo', numero: 'INPI 1' }).numeroAntigo).toBe(false);
  });

  it('quando o número é judicial e completo, então sugere o órgão; antigo ou administrativo, não', () => {
    // Então
    expect(orgaoDoNumero({ tipo: 'judicial', numero: NUMERO_VALIDO, numeroAntigo: false })).toBe('TJMG');
    expect(orgaoDoNumero({ tipo: 'judicial', numero: NUMERO_VALIDO, numeroAntigo: true })).toBeNull();
    expect(orgaoDoNumero({ tipo: 'administrativo', numero: NUMERO_VALIDO, numeroAntigo: false })).toBeNull();
  });
});

describe('Número e órgão enquanto se preenche', () => {
  const NUMERO_SP = '0005678-13.2026.8.26.0433';
  const vazio = processoVazio('judicial');

  it('quando digita o número completo, então ele fica pontuado e indica o órgão; incompleto, fica como foi digitado', () => {
    // Então
    expect(aoMudarNumero(vazio, { numero: '00012349720268130024' }, '')).toEqual({ campos: { numero: NUMERO_VALIDO, orgao: 'TJMG' }, orgaoIndicado: 'TJMG' });
    expect(aoMudarNumero(vazio, { numero: '2004.38.00' }, '').campos.numero).toBe('2004.38.00');
  });

  it('quando marca que o número é antigo, então o que foi digitado não muda', () => {
    // Dado
    const c = { ...vazio, numero: '2004.38.00.012345-6' };
    // Então
    expect(aoMudarNumero(c, { numeroAntigo: true }, '').campos.numero).toBe('2004.38.00.012345-6');
  });

  it('quando desmarca o número antigo ou volta para judicial com o número completo, então ele é pontuado e indica o órgão', () => {
    // Dado
    const c = { ...vazio, numero: '00012349720268130024' };
    // Então
    expect(aoMudarNumero({ ...c, numeroAntigo: true }, { numeroAntigo: false }, '').campos).toMatchObject({ numero: NUMERO_VALIDO, orgao: 'TJMG' });
    expect(aoMudarNumero({ ...c, tipo: 'administrativo' }, { tipo: 'judicial' }, '').campos).toMatchObject({ numero: NUMERO_VALIDO, orgao: 'TJMG' });
  });

  it('quando o número deixa de indicar o órgão, então o que foi indicado sai; o digitado à mão fica', () => {
    // Dado
    const indicado = { ...vazio, numero: NUMERO_VALIDO, orgao: 'TJMG' };
    // Então
    expect(aoMudarNumero(indicado, { tipo: 'administrativo' }, 'TJMG').campos.orgao).toBe('');
    expect(aoMudarNumero(indicado, { numeroAntigo: true }, 'TJMG').campos.orgao).toBe('');
    expect(aoMudarNumero({ ...indicado, orgao: 'INPI' }, { tipo: 'administrativo' }, 'TJMG').campos.orgao).toBeUndefined();
  });

  it('quando o número muda para outro tribunal, então o órgão indicado acompanha; o digitado à mão, não', () => {
    // Dado
    const c = { ...vazio, numero: NUMERO_VALIDO, orgao: 'TJMG' };
    // Então
    expect(aoMudarNumero(c, { numero: NUMERO_SP }, 'TJMG').campos.orgao).toBe('TJSP');
    expect(aoMudarNumero({ ...c, orgao: 'STJ' }, { numero: NUMERO_SP }, 'TJSP').campos.orgao).toBeUndefined();
  });

  it('quando abre um processo salvo, então só conta como indicado o órgão que o número indica', () => {
    // Então
    expect(orgaoIndicadoNoProcesso({ tipo: 'judicial', numero: NUMERO_VALIDO, numeroAntigo: false, orgao: 'TJMG' })).toBe('TJMG');
    expect(orgaoIndicadoNoProcesso({ tipo: 'judicial', numero: NUMERO_VALIDO, numeroAntigo: false, orgao: 'STJ' })).toBe('');
  });

  it('quando compara números, então pontuação, espaços e maiúsculas não fazem diferença', () => {
    // Então
    expect(numeroParaComparar('912 345-678')).toBe(numeroParaComparar('912345678'));
    expect(numeroParaComparar('br512024')).toBe(numeroParaComparar('BR512024'));
    expect(numeroParaComparar(NUMERO_VALIDO)).toBe('00012349720268130024');
  });
});

describe('Quem passa o processo adiante', () => {
  const dados = { responsavel_id: 'u2', colaboradores: ['u3'] };
  const ANTES = { responsavel_id: 'u2', lista: ['u3', 'u1'] };

  it('quando não pode sair, então continua como colaborador', () => {
    // Então
    expect(semSairDoProcesso(dados, 'u1', false, ANTES)).toEqual({ dados: { responsavel_id: 'u2', colaboradores: ['u3', 'u1'] }, ficou: true });
  });

  it('quando é administrador ou criou o processo, ou continua nele, então nada muda', () => {
    // Então
    expect(semSairDoProcesso(dados, 'u1', true, ANTES)).toEqual({ dados, ficou: false });
    expect(semSairDoProcesso(dados, 'u2', false, ANTES)).toEqual({ dados, ficou: false });
    expect(semSairDoProcesso(dados, 'u3', false, ANTES)).toEqual({ dados, ficou: false });
  });
});

describe('Listas e cartão', () => {
  it('quando monta a lista, então vêm as prontas, as do escritório e o valor atual, se tiver saído da lista', () => {
    // Então
    expect(opcoesDoCampo('sistema', ['Tucujuris'])).toEqual([...OPCOES_PRONTAS.sistema, 'Tucujuris']);
    expect(opcoesDoCampo('area', [], 'Marítimo').at(-1)).toBe('Marítimo');
    expect(opcoesDoCampo('area', [], 'Cível')).toEqual(OPCOES_PRONTAS.area);
  });

  it('quando o escritório acrescenta o que já está na lista, então vale a que já existe, sem contar maiúsculas nem acentos', () => {
    // Então
    expect(opcaoNaLista(opcoesDoCampo('sistema', []), ' PJE ')).toBe('PJe');
    expect(opcaoNaLista(opcoesDoCampo('area', []), 'civel')).toBe('Cível');
    expect(opcaoNaLista(opcoesDoCampo('sistema', []), 'Tucujuris')).toBeNull();
    expect(new Set(opcoesDoCampo('sistema', ['PJe'])).size).toBe(opcoesDoCampo('sistema', ['PJe']).length);
  });

  it('quando mostra os dados no cartão, então só aparecem os preenchidos, e o segredo de justiça só quando há', () => {
    // Dado
    const p = { numero: '123', orgao: 'INPI', comarca: null, vara: '', segredo: false, valor_causa: 10 } as unknown as Processo;
    // Então
    expect(linhasDoProcesso(p)).toEqual([['Número', '123'], ['Órgão', 'INPI'], ['Valor da causa', 'R$\u00a010,00']]);
    expect(linhasDoProcesso({ ...p, segredo: true })).toContainEqual(['Segredo de justiça', 'Sim']);
  });

  it('quando o cartão não tem nome, então aparecem os clientes', () => {
    // Então
    expect(nomeDoProcesso({ titulo: 'Ação de cobrança', cliente_nome: 'JOSÉ', numero: '1' })).toBe('Ação de cobrança');
    expect(nomeDoProcesso({ titulo: null, cliente_nome: 'JOSÉ; MARIA', numero: '1' })).toBe('JOSÉ e MARIA');
  });

  it.each([
    ['polo', 'reu', 'Réu'], ['gratuidade', 'nao_pedida', 'Não pedida'], ['meio', 'fisico', 'Físico'], ['segredo', true, 'Sim'], ['segredo', false, 'Não'],
    ['distribuicao', '2026-03-02', '02/03/2026'], ['valor_causa', 1500.5, 'R$ 1.500,50'], ['comarca', null, '—'], ['comarca', 'Montes Claros', 'Montes Claros']
  ])('quando o campo %s vale %j, então aparece como "%s"', (campo, valor, texto) => {
    // Então
    expect(valorLegivelProcesso(campo, valor)).toBe(texto);
  });

  it('quando a pessoa está no processo, então os papéis dela aparecem', () => {
    // Dado
    const p = { clientes: ['p1'], responsavel_id: 'u1', colaboradores: ['u2'] };
    // Então
    expect(papeisNoProcesso(p, 'p1')).toEqual(['cliente']);
    expect(papeisNoProcesso(p, 'px', 'u1')).toEqual(['responsavel']);
    expect(papeisNoProcesso(p, 'px', 'u2')).toEqual(['colaborador']);
    expect(papeisNoProcesso(p, 'px', 'u9')).toEqual([]);
  });
});
