// Testes da linha de comando do conversor. Padrão Dado / Quando / Então: veja app/TESTES.md. Só dados fictícios.
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { escreverCSV, lerCSV } from '../../src/regras/csv';
import { ARQUIVOS, AVISO_DAS_DATAS, converter, lerArgumentos } from './converter';
import { COLUNAS_PARA_DECIDIR } from './decisoes';
import { CABECALHO_GOOGLE, CPF } from './ficticios';
import { COLUNAS_DO_SITE } from './planilhas';

describe('Argumentos do conversor', () => {
  it('quando não há --site, então mostra a ajuda', () => {
    // Quando / Então
    expect(lerArgumentos([])).toBeNull();
    expect(lerArgumentos(['--google', 'contatos.csv'])).toBeNull();
  });

  it.each([['--ajuda'], ['-h'], ['--help']])('quando pede %s, então mostra a ajuda', opcao => {
    // Quando / Então
    expect(lerArgumentos(['--site', 'site.csv', opcao])).toBeNull();
  });

  it('quando recebe todas as opções, então cada uma vai para o seu lugar e --google repete', () => {
    // Quando
    const args = lerArgumentos(['--site', 'site.csv', '--google', 'atual.csv', '--google', 'antigo.csv', '--saida', 'saida',
      '--decisoes', 'para-decidir.csv', '--lgpd', 'processo', '--hoje', '2026-10-31']);
    // Então
    expect(args).toEqual({
      site: 'site.csv', google: ['atual.csv', 'antigo.csv'], saida: 'saida', decisoes: 'para-decidir.csv', lgpd: 'processo', hoje: '2026-10-31'
    });
  });

  it.each([
    [['--site', 'site.csv', '--outra', 'x'], /Opção desconhecida: --outra/],
    [['--site'], /Falta o valor de --site/],
    [['--site', 'site.csv', '--google', '--saida', 'x'], /Falta o valor de --google/],
    [['--site', 'site.csv', '--lgpd', 'qualquer'], /Base legal "qualquer" não existe/],
    [['--site', 'site.csv', '--lgpd', 'toString'], /Base legal "toString" não existe/],
    [['--site', 'site.csv', '--hoje', '31/10/2026'], /AAAA-MM-DD/]
  ])('quando os argumentos são %j, então dá erro claro', (argv, mensagem) => {
    // Quando / Então
    expect(() => lerArgumentos(argv)).toThrow(mensagem);
  });
});

describe('Rodar o conversor com arquivos fictícios', () => {
  let pasta = '';
  afterEach(() => { if (pasta) rmSync(pasta, { recursive: true, force: true }); });

  /** Uma pasta temporária (fora do repositório) com a planilha do site e a do Google. */
  function preparar() {
    pasta = mkdtempSync(join(tmpdir(), 'conversor-'));
    const cabecalho = [...Object.values(COLUNAS_DO_SITE), 'FÓRMULA'];
    const linha = (valores: Partial<Record<keyof typeof COLUNAS_DO_SITE, string>>) =>
      [...Object.keys(COLUNAS_DO_SITE).map(k => valores[k as keyof typeof COLUNAS_DO_SITE] ?? ''), '#N/A'];
    writeFileSync(join(pasta, 'site.csv'), escreverCSV([cabecalho,
      linha({ envio: '15/03/2019 13:22:33', nome: 'Maria Exemplo', tipo: 'Pessoa Física', cpf: CPF, nascimento: '01/02/1980', telefone: '(38) 99999-0000' }),
      linha({ envio: '20/06/2021 10:00:00', nome: 'Maria Exemplo', tipo: 'Pessoa Física', nascimento: '01/02/1995', telefone: '(38) 98888-0000' }),
      [], linha({ envio: '01/01/2020 09:00:00', nome: 'Bruno Fictício', tipo: 'Somente informações de contato', telefone: '(38) 97777-0000' })
    ], { separador: ',', bom: false }));
    writeFileSync(join(pasta, 'contatos.csv'), escreverCSV([CABECALHO_GOOGLE,
      ['Bruno', '', 'Fictício', '', '', '* myContacts', 'bruno@exemplo.com', '+55 38 97777-0000']], { separador: ',', bom: false }));
    return pasta;
  }
  const ler = (nome: string) => lerCSV(readFileSync(join(pasta, 'saida', nome), 'utf8'));

  it('quando roda, então grava os três arquivos e o console só tem contagens', () => {
    // Dado
    const base = preparar();
    // Quando
    const mensagens = converter({ site: 'site.csv', google: ['contatos.csv'], saida: 'saida', decisoes: null, lgpd: null, hoje: '2026-10-31' }, base, base);
    // Então
    const pessoas = ler(ARQUIVOS.pessoas), decidir = ler(ARQUIVOS.decidir), conferencia = ler(ARQUIVOS.conferencia);
    expect(pessoas).toHaveLength(4);
    expect(pessoas.slice(1).map(l => l[pessoas[0].indexOf('emails')])).toEqual(['', '', 'bruno@exemplo.com']);
    expect(decidir).toHaveLength(2);
    expect(conferencia[3]).toEqual([pessoas[3][0], 'Bruno Fictício', '5', 'contatos.csv:2', 'com o contato do Google pelo nome ou pelo telefone e nome contido, sem CPF/CNPJ em um dos lados']);
    expect(mensagens.filter(m => !m.startsWith('Arquivos gravados')).join('\n')).not.toMatch(/Maria|Bruno|99999|exemplo\.com|529/);
    expect(mensagens.some(m => m.startsWith('Na tela de importação: 0 linhas seriam recusadas'))).toBe(true);
  });

  it('quando roda com as decisões, então junta o par "sim" e regrava a decisão no para-decidir.csv', () => {
    // Dado
    const base = preparar();
    const args = { site: 'site.csv', google: [], saida: 'saida', decisoes: null, lgpd: null, hoje: '2026-10-31' };
    converter(args, base, base);
    const decidir = ler(ARQUIVOS.decidir);
    decidir[1][decidir[0].length - 1] = 'sim';
    writeFileSync(join(base, 'decisoes.csv'), escreverCSV(decidir));
    // Quando
    const mensagens = converter({ ...args, decisoes: 'decisoes.csv' }, base, base);
    // Então
    expect(ler(ARQUIVOS.pessoas)).toHaveLength(3);
    expect(ler(ARQUIVOS.decidir)[1].slice(-2)).toEqual(['juntados pela sua decisão', 'sim']);
    expect(mensagens).toContain('Decisões: 1 aplicadas; 0 ignoradas (o par não existe mais).');
  });

  it('quando a nova execução não tem pares, então o para-decidir.csv da execução anterior é regravado só com o cabeçalho', () => {
    // Dado: uma execução com um par; depois a planilha só com um cliente
    const base = preparar();
    const args = { site: 'site.csv', google: [], saida: 'saida', decisoes: null, lgpd: null, hoje: '2026-10-31' };
    converter(args, base, base);
    expect(ler(ARQUIVOS.decidir)).toHaveLength(2);
    writeFileSync(join(base, 'site.csv'), escreverCSV([['NOME', 'TIPO DE CADASTRO'], ['Bruno Fictício', 'Pessoa Física']], { separador: ',', bom: false }));
    // Quando
    converter(args, base, base);
    // Então
    expect(ler(ARQUIVOS.decidir)).toEqual([[...COLUNAS_PARA_DECIDIR]]);
  });

  it('quando mais da metade das datas de envio não pode ser lida, então o console avisa', () => {
    // Dado
    const base = preparar();
    writeFileSync(join(base, 'site.csv'), escreverCSV([['DATA DE ENVIO', 'NOME', 'TIPO DE CADASTRO'],
      ['3/15/2019 13:22:33', 'Maria Exemplo', 'Pessoa Física'], ['3/16/2019 13:22:33', 'Bruno Fictício', 'Pessoa Física']], { separador: ',', bom: false }));
    // Quando
    const mensagens = converter({ site: 'site.csv', google: [], saida: 'saida', decisoes: null, lgpd: null, hoje: '2026-10-31' }, base, base);
    // Então
    expect(mensagens).toContain('Data de envio: 2 de 2 não puderam ser lidas (ficaram sem data).');
    expect(mensagens).toContain(AVISO_DAS_DATAS);
  });

  it('quando o arquivo do site não existe, então dá erro sem gravar nada', () => {
    // Dado
    const base = preparar();
    // Quando / Então
    expect(() => converter({ site: 'nao-existe.csv', google: [], saida: 'saida', decisoes: null, lgpd: null, hoje: null }, base, base))
      .toThrow(/O arquivo de --site não existe/);
    expect(existsSync(join(base, 'saida'))).toBe(false);
  });
});
