// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import type { Processo } from '../dados/tipos';
import {
  aoMudarNumero, cabeOutroProcesso, detalheDoProcesso, ehOpcaoPronta, mudancasNosProcessos, processosParaOferecer, camposDoProcesso, dadosDoProcesso, errosDaEtapaProcesso, linhasDoProcesso, nomeDoProcesso, opcaoNaLista, opcoesDoCampo, OPCOES_PRONTAS, numeroParaComparar, orgaoDoNumero, orgaoIndicadoNoProcesso, papeisNoProcesso, primeiraEtapaComErroProcesso, processoVazio,
  semSairDoProcesso, validarProcesso, valorLegivelProcesso, mencaoNegadaNoProcesso, motivoSemMencaoNoProcesso, type CamposProcesso,
  clienteNoCartao, comPapelDoCliente, PAPEIS_DA_PARTE, PAPEIS_DO_CLIENTE, PAPEL_DO_CLIENTE_OBRIGATORIO, papeisAoGravar, papelSugeridoDoCliente, papeisAoTrocarCliente, papeisDosClientesPorExtenso,
  selosDoProcesso
} from './processo';

const NUMERO_VALIDO = '0001234-97.2026.8.13.0024';
const valido = (extra: Partial<CamposProcesso> = {}): CamposProcesso => ({ ...processoVazio('judicial'), numero: NUMERO_VALIDO, clientes: ['p1'], papeisClientes: { p1: 'autor' }, responsavelId: 'u1', ...extra });

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
    expect(d).toMatchObject({ numero: NUMERO_VALIDO, titulo: null, colaboradores: ['u2'], clientes: ['p1'], papeis_clientes: { p1: 'autor' }, valor_causa: 1500.5, distribuicao: '2026-03-02', segredo: false });
    // O antigo polo do processo não é mais gravado pela tela (#426): fica como estava, para a versão anterior do site.
    expect(d).not.toHaveProperty('polo');
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

  it('dado um escritório qualquer, quando monta a lista de sistemas, então SEEU, JPe e CPE (STJ) já estão nela (#288)', () => {
    // Quando
    const lista = opcoesDoCampo('sistema', []);
    // Então
    expect(lista).toEqual(expect.arrayContaining(['SEEU', 'JPe', 'CPE (STJ)', 'PJe', 'Físico (sem sistema)']));
  });

  it('dado um escritório que acrescentou "Seeu" e "PJE", quando monta a lista, então cada nome aparece uma vez, na grafia da lista pronta (#288)', () => {
    // Quando
    const lista = opcoesDoCampo('sistema', ['Seeu', 'seeu', 'PJE', 'Tucujuris', 'tucujurís']);
    // Então
    expect(lista).toEqual([...OPCOES_PRONTAS.sistema, 'Tucujuris']);
  });

  it('dado um processo salvo com "Seeu", quando a lista é montada para editar, então aparece só "Seeu", no lugar de SEEU, e o processo continua com ele (#288)', () => {
    // Quando
    const lista = opcoesDoCampo('sistema', ['SEEU'], 'Seeu');
    // Então
    expect(lista).toContain('Seeu');
    expect(lista).not.toContain('SEEU');
    expect(lista).toHaveLength(OPCOES_PRONTAS.sistema.length);
    expect(lista.indexOf('Seeu')).toBe(OPCOES_PRONTAS.sistema.indexOf('SEEU'));
  });

  it('dado um administrador que digita "seeu" em "Acrescentar opção", quando confere a lista, então vale a opção pronta SEEU (#288)', () => {
    // Então
    expect(opcaoNaLista(opcoesDoCampo('sistema', []), 'seeu')).toBe('SEEU');
    expect(opcaoNaLista(opcoesDoCampo('sistema', []), 'cpe (stj)')).toBe('CPE (STJ)');
  });

  it('quando confere se um valor é de uma lista pronta, então não conta maiúsculas nem acentos (#288)', () => {
    // Então
    expect(ehOpcaoPronta('sistema', 'seeu')).toBe(true);
    expect(ehOpcaoPronta('area', 'civel')).toBe(true);
    expect(ehOpcaoPronta('sistema', 'Tucujuris')).toBe(false);
    expect(ehOpcaoPronta('sistema', '')).toBe(false);
  });

  it.each(['vitima', 'investigado', 'apenado'] as const)('dado o papel %s de um cliente, judicial ou administrativo, quando salva e abre para editar, então o papel volta igual (#289, #426)', papel => {
    for (const tipo of ['judicial', 'administrativo'] as const) {
      // Quando
      const d = dadosDoProcesso(valido({ tipo, papeisClientes: { p1: papel } }));
      // Então
      expect(d.papeis_clientes).toEqual({ p1: papel });
      expect(camposDoProcesso({ ...d, id: 'x', clientes: [{ id: 'p1' }] } as unknown as Processo).papeisClientes).toEqual({ p1: papel });
    }
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
    ['polo', 'reu', 'Réu'], ['polo', 'vitima', 'Vítima'], ['polo', 'investigado', 'Investigado'], ['polo', 'apenado', 'Apenado'], ['gratuidade', 'nao_pedida', 'Não pedida'], ['meio', 'fisico', 'Físico'], ['segredo', true, 'Sim'], ['segredo', false, 'Não'],
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

describe('Ligar um processo que já existe a outro cartão (#294)', () => {
  it('quando a busca mostra um processo, então embaixo do nome vêm o tipo, o número e o código; sem número, só o tipo e o código', () => {
    // Então
    expect(detalheDoProcesso({ tipo: 'judicial', numero: NUMERO_VALIDO, codigo: 'AB12CD34' })).toBe('Judicial · ' + NUMERO_VALIDO + ' · AB12CD34');
    expect(detalheDoProcesso({ tipo: 'administrativo', numero: '', codigo: 'AB12CD34' })).toBe('Administrativo · AB12CD34');
  });

  it('dado processos já ligados ao cartão, quando a busca oferece os achados, então eles ficam de fora e a ordem se mantém', () => {
    // Dado
    const achados = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    // Quando
    const oferecidos = processosParaOferecer(achados, ['b']);
    // Então
    expect(oferecidos.map(p => p.id)).toEqual(['a', 'c']);
  });

  it('dado os processos de antes e os de depois, quando o cadastro é salvo, então só liga os que entraram e desliga os que saíram', () => {
    // Quando
    const m = mudancasNosProcessos(['a', 'b'], ['b', 'c']);
    // Então
    expect(m).toEqual({ ligar: ['c'], desligar: ['a'] });
    expect(mudancasNosProcessos(['a'], ['a'])).toEqual({ ligar: [], desligar: [] });
  });

  it('quando o cartão tem um processo só (tarefa, compromisso), então não cabe outro; sem máximo (demanda, contrato), sempre cabe', () => {
    // Então
    expect(cabeOutroProcesso(0, 1)).toBe(true);
    expect(cabeOutroProcesso(1, 1)).toBe(false);
    expect(cabeOutroProcesso(5)).toBe(true);
  });
});

describe('Menções nos comentários do processo (#362)', () => {
  const PROCESSO = { criado_por: 'u-criou', responsavel_id: 'u-resp', colaboradores: ['u-colab'] };

  it.each([
    ['quem criou', { id: 'u-criou', nome: 'A' }], ['o responsável', { id: 'u-resp', nome: 'B' }], ['um colaborador', { id: 'u-colab', nome: 'C' }],
    ['um administrador de fora', { id: 'u-adm', nome: 'D', papel: 'admin' as const }]
  ])('quando menciona %s, então pode', (_caso, membro) => {
    // Então
    expect(motivoSemMencaoNoProcesso(PROCESSO)(membro)).toBeNull();
  });

  it('quando menciona quem não está no processo, então não pode, e a lista do @ diz por quê; a recusa é a mesma do banco', () => {
    // Então
    expect(motivoSemMencaoNoProcesso(PROCESSO)({ id: 'u-fora', nome: 'Eli' })).toBe('não participa; inclua como colaborador');
    expect(mencaoNegadaNoProcesso('Eli')).toBe('Não é possível mencionar Eli neste processo: inclua essa pessoa como colaboradora antes.');
  });
});

describe('Papel de cada cliente no processo (#426)', () => {
  it('dado o cadastro de um processo novo, quando algum cliente está sem papel, então não salva e diz que o papel é obrigatório', () => {
    // Dado
    const c = valido({ clientes: ['p1', 'p2'], papeisClientes: { p1: 'autor' } });
    // Então
    expect(validarProcesso(c).papeisClientes).toBe(PAPEL_DO_CLIENTE_OBRIGATORIO);
    expect(primeiraEtapaComErroProcesso(c)).toBe(1);
    expect(Object.keys(errosDaEtapaProcesso('pessoas', c))).toEqual(['papeisClientes']);
  });

  it('dado um processo com dois clientes, quando cada um tem o seu papel, então salva e cada cliente guarda o seu', () => {
    // Dado
    const c = valido({ clientes: ['p1', 'p2'], papeisClientes: { p1: 'autor', p2: 'reu' } });
    // Então
    expect(validarProcesso(c)).toEqual({});
    expect(dadosDoProcesso(c).papeis_clientes).toEqual({ p1: 'autor', p2: 'reu' });
  });

  it('dado um cliente que saiu da lista, quando grava, então o papel dele não vai junto', () => {
    // Quando
    const d = dadosDoProcesso(valido({ clientes: ['p1', ''], papeisClientes: { p1: 'autor', saiu: 'reu' } }));
    // Então
    expect(d.papeis_clientes).toEqual({ p1: 'autor' });
  });

  it('dado um processo antigo sem papel, quando abre para editar, então precisa informar o papel para salvar', () => {
    // Dado
    const antigo = { ...dadosDoProcesso(valido()), id: 'x', tipo: 'judicial', clientes: [{ id: 'p1' }], papeis_clientes: {} } as unknown as Processo;
    // Quando
    const c = camposDoProcesso(antigo);
    // Então
    expect(validarProcesso(c).papeisClientes).toBe(PAPEL_DO_CLIENTE_OBRIGATORIO);
    expect(validarProcesso({ ...c, papeisClientes: comPapelDoCliente(c.papeisClientes, 'p1', 'terceiro') })).toEqual({});
  });

  it('quando escolhe a opção vazia, então o cliente fica sem papel; um valor fora da lista também não vale', () => {
    // Então
    expect(comPapelDoCliente({ p1: 'autor' }, 'p1', '').p1).toBeUndefined();
    expect(comPapelDoCliente({}, 'p1', 'Autor').p1).toBeUndefined();
    expect(comPapelDoCliente({}, 'p1', 'reu').p1).toBe('reu');
  });

  it('quando troca a pessoa de uma linha, então o papel escolhido na linha passa para a nova', () => {
    // Então
    expect(papeisAoTrocarCliente({ p1: 'autor' }, 'p1', 'p2')).toEqual({ p1: 'autor', p2: 'autor' });
    expect(papeisAoTrocarCliente({ p1: 'autor', p2: 'reu' }, 'p1', 'p2')).toEqual({ p1: 'autor', p2: 'reu' });
    expect(papeisAoTrocarCliente({ p1: 'autor' }, 'p1', '')).toEqual({ p1: 'autor' });
  });

  it('dado um processo, quando alguém é ligado como cliente pelo cartão, então a pergunta do papel já vem com o papel dos outros clientes; sem nenhum, Autor', () => {
    // Então
    expect(papelSugeridoDoCliente({ p1: 'reu', p2: 'autor' })).toBe('reu');
    expect(papelSugeridoDoCliente({})).toBe('autor');
    expect(papelSugeridoDoCliente(undefined)).toBe('autor');
  });

  it('quando oferece os papéis do cliente, então é a mesma lista das pessoas com papel, com o "Outro papel" por último', () => {
    // Então
    expect([...PAPEIS_DO_CLIENTE].sort()).toEqual(Object.keys(PAPEIS_DA_PARTE).sort());
    expect(PAPEIS_DO_CLIENTE.at(-1)).toBe('outro');
    expect(PAPEIS_DO_CLIENTE.slice(0, 2)).toEqual(['autor', 'reu']);
  });

  it('dado um processo antigo com polo, quando a mudança chega, então o polo vira o papel de cada cliente; sem polo, nenhum papel', () => {
    // Então
    expect(papeisAoGravar({}, ['p1', 'p2'], 'apenado')).toEqual({ p1: 'apenado', p2: 'apenado' });
    expect(papeisAoGravar({}, ['p1'], null)).toEqual({});
  });

  it('dado um cliente com papel, quando grava, então o papel dele fica e o de quem não é cliente sai', () => {
    // Então
    expect(papeisAoGravar({ p1: 'reu', fora: 'autor' }, ['p1', 'p2'], 'autor')).toEqual({ p1: 'reu', p2: 'autor' });
  });

  it('quando mostra os papéis dos clientes, então cada papel aparece uma vez, na ordem da lista', () => {
    // Então
    expect(papeisDosClientesPorExtenso({ p2: 'reu', p1: 'autor', p3: 'autor' })).toBe('Autor, Réu');
    expect(papeisDosClientesPorExtenso({})).toBe('');
    expect(valorLegivelProcesso('papeis_clientes', { p1: 'vitima' })).toBe('Vítima');
  });

  it('dado um processo com papel do cliente, quando aparece a miniatura, então mostra o órgão, o sistema e o papel; os vazios saem', () => {
    // Então
    expect(selosDoProcesso({ orgao: 'TJMG', sistema: 'PJe', papeis_clientes: { p1: 'autor' } })).toEqual(['TJMG', 'PJe', 'Autor']);
    expect(selosDoProcesso({ orgao: null, sistema: null, papeis_clientes: {} })).toEqual([]);
  });

  it('quando o cartão mostra o cliente, então diz o papel dele, ou que ainda falta informá-lo', () => {
    // Então
    expect(clienteNoCartao('reu')).toBe('Cliente · Réu');
    expect(clienteNoCartao(undefined)).toBe('Cliente · papel a informar');
  });
});
