// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import { SEGUNDO } from '../ui/tempos';
import { celulaCSV, decodificarTexto, escreverCSV, lerCSV } from './csv';

/** Tempo máximo para ler poucos KB: passou disso, a leitura travou (antes do conserto, 120 bytes levavam horas). */
const LEITURA_RAPIDA = SEGUNDO;

describe('Ler CSV', () => {
  it('quando o arquivo tem BOM e \\r\\n, então o primeiro cabeçalho vem sem o BOM', () => {
    // Dado
    const texto = '﻿nome;documento\r\nMARIA EXEMPLO;529.982.247-25\r\n';
    // Quando
    const linhas = lerCSV(texto);
    // Então
    expect(linhas).toEqual([['nome', 'documento'], ['MARIA EXEMPLO', '529.982.247-25']]);
  });

  it('quando uma célula entre aspas tem vírgula, então vira um campo só', () => {
    // Dado
    const texto = 'nome,logradouro\nMARIA EXEMPLO,"Rua A, 10"\n';
    // Quando
    const linhas = lerCSV(texto);
    // Então
    expect(linhas[1]).toEqual(['MARIA EXEMPLO', 'Rua A, 10']);
  });

  it('quando uma célula tem aspas dobradas, então vira uma aspa só', () => {
    // Dado
    const texto = 'observacoes\n"diz ""oi"""\n';
    // Quando
    const linhas = lerCSV(texto);
    // Então
    expect(linhas[1]).toEqual(['diz "oi"']);
  });

  it('quando há quebra de linha dentro de aspas, então a linha não se parte', () => {
    // Dado
    const texto = 'nome;observacoes\r\nMARIA EXEMPLO;"primeira linha\r\nsegunda linha"\r\nJOÃO EXEMPLO;\r\n';
    // Quando
    const linhas = lerCSV(texto);
    // Então
    expect(linhas).toEqual([['nome', 'observacoes'], ['MARIA EXEMPLO', 'primeira linha\r\nsegunda linha'], ['JOÃO EXEMPLO', '']]);
  });

  it('quando o arquivo é separado por ";", então as colunas saem certas', () => {
    // Dado
    const texto = 'tipo;nome;documento\npj;PADARIA MODELO, PÃES LTDA;11.222.333/0001-81\n';
    // Quando
    const linhas = lerCSV(texto);
    // Então
    expect(linhas[1]).toEqual(['pj', 'PADARIA MODELO, PÃES LTDA', '11.222.333/0001-81']);
  });

  it('quando a primeira vírgula fora de aspas vem antes do ";", então o separador é a vírgula', () => {
    // Dado
    const texto = '"nome; completo",documento\n"MARIA; EXEMPLO",529.982.247-25\n';
    // Quando
    const linhas = lerCSV(texto);
    // Então
    expect(linhas[1]).toEqual(['MARIA; EXEMPLO', '529.982.247-25']);
  });

  it('quando o arquivo não tem quebra de linha no final, então a última linha não se perde', () => {
    // Dado
    const texto = 'nome;documento\nMARIA EXEMPLO;529.982.247-25\nJOÃO EXEMPLO;111.444.777-35';
    // Quando
    const linhas = lerCSV(texto);
    // Então
    expect(linhas[2]).toEqual(['JOÃO EXEMPLO', '111.444.777-35']);
  });

  it('quando a linha termina no separador, então a última célula vazia continua lá', () => {
    // Dado
    const texto = 'nome;documento\nMARIA EXEMPLO;\n';
    // Quando
    const linhas = lerCSV(texto);
    // Então
    expect(linhas[1]).toEqual(['MARIA EXEMPLO', '']);
  });

  it.each([
    ['uma linha em branco', 'nome;documento\n\nMARIA EXEMPLO;529.982.247-25\n'],
    ['uma linha só de separadores', 'nome;documento\n;\nMARIA EXEMPLO;529.982.247-25\n'],
    ['uma linha só de espaços', 'nome;documento\n  ;  \nMARIA EXEMPLO;529.982.247-25\n']
  ])('quando o arquivo tem %s, então ela sai', (_caso, texto) => {
    // Quando
    const linhas = lerCSV(texto);
    // Então
    expect(linhas).toEqual([['nome', 'documento'], ['MARIA EXEMPLO', '529.982.247-25']]);
  });

  it('quando o arquivo tem linhas em branco e pede para mantê-las, então cada linha fica no lugar dela', () => {
    // Dado
    const texto = 'nome;documento\n;\nMARIA EXEMPLO;529.982.247-25\n\nJOÃO EXEMPLO;111.444.777-35';
    // Quando
    const linhas = lerCSV(texto, { manterVazias: true });
    // Então
    expect(linhas.map(l => l[0])).toEqual(['nome', '', 'MARIA EXEMPLO', '', 'JOÃO EXEMPLO']);
  });

  it('quando a 1ª linha não tem separador e tem muitas aspas dobradas, então a leitura termina logo, com uma coluna só', () => {
    // Dado
    const celula = '"' + 'a""'.repeat(2000) + '"';
    // Quando
    const inicio = performance.now();
    const linhas = lerCSV(`${celula}\nb`);
    const demorou = performance.now() - inicio;
    // Então
    expect(linhas).toEqual([['a"'.repeat(2000)], ['b']]);
    expect(demorou).toBeLessThan(LEITURA_RAPIDA);
  });

  it('quando o texto está vazio, então não há linhas', () => {
    // Quando
    const linhas = lerCSV('');
    // Então
    expect(linhas).toEqual([]);
  });

  it('quando as aspas não fecham, então a célula vai até o fim do arquivo', () => {
    // Dado
    const texto = 'nome;observacoes\nMARIA EXEMPLO;"sem fechar\nJOÃO EXEMPLO;x';
    // Quando
    const linhas = lerCSV(texto);
    // Então
    expect(linhas[1]).toEqual(['MARIA EXEMPLO', 'sem fechar\nJOÃO EXEMPLO;x']);
  });
});

describe('Escrever CSV', () => {
  describe('Dada uma célula', () => {
    it.each([
      ['MARIA EXEMPLO', ',', 'MARIA EXEMPLO'],
      ['Rua A, 10', ',', '"Rua A, 10"'],
      ['Rua A, 10', ';', 'Rua A, 10'],
      ['Rua A; 10', ';', '"Rua A; 10"'],
      ['diz "oi"', ';', '"diz ""oi"""'],
      ['linha 1\nlinha 2', ';', '"linha 1\nlinha 2"'],
      [' espaço na frente', ';', '" espaço na frente"'],
      ['', ';', '']
    ])('quando a célula é %j com o separador "%s", então sai %j', (valor, separador, esperado) => {
      // Quando
      const celula = celulaCSV(valor, separador as ',' | ';');
      // Então
      expect(celula).toBe(esperado);
    });
  });

  it('quando o arquivo é escrito sem opções, então sai no modelo do SEMPER: BOM, ";" e \\r\\n', () => {
    // Quando
    const texto = escreverCSV([['nome', 'documento'], ['MARIA EXEMPLO', '529.982.247-25']]);
    // Então
    expect(texto).toBe('﻿nome;documento\r\nMARIA EXEMPLO;529.982.247-25\r\n');
  });

  it('quando o arquivo é escrito com vírgula e sem BOM, então sai como o Google espera', () => {
    // Quando
    const texto = escreverCSV([['First Name', 'Notes'], ['MARIA EXEMPLO', 'Rua A, 10']], { separador: ',', bom: false });
    // Então
    expect(texto).toBe('First Name,Notes\r\nMARIA EXEMPLO,"Rua A, 10"\r\n');
  });

  it('quando a saída é lida de novo, então volta igual (";" e aspas dentro da célula incluídos)', () => {
    // Dado
    const linhas = [
      ['tipo', 'nome', 'documento', 'logradouro', 'observacoes'],
      ['pf', 'MARIA EXEMPLO', '529.982.247-25', 'Rua A; 10', 'diz "oi"\r\nem duas linhas'],
      ['pj', 'PADARIA MODELO LTDA', '11.222.333/0001-81', 'Rua B, 20', '']
    ];
    // Quando
    const relido = lerCSV(escreverCSV(linhas));
    // Então
    expect(relido).toEqual(linhas);
  });

  describe('Dada uma célula que a planilha leria como fórmula', () => {
    it.each([
      ['=HYPERLINK("http://exemplo.com")', "\"'=HYPERLINK(\"\"http://exemplo.com\"\")\""],
      ['+5+5', "'+5+5"],
      ['-2+3', "'-2+3"],
      ['@SOMA(A1)', "'@SOMA(A1)"],
      ['\t=1+1', "'\t=1+1"],
      ['\r=1+1', "\"'\r=1+1\""]
    ])('quando %j é escrita com a proteção ligada, então ganha o apóstrofo na frente', (valor, esperado) => {
      // Quando
      const texto = escreverCSV([[valor]], { bom: false, protegerFormulas: true });
      // Então
      expect(texto).toBe(`${esperado}\r\n`);
    });

    it('quando a proteção está desligada (o padrão), então a célula sai como está', () => {
      // Quando
      const texto = escreverCSV([['=1+1']], { bom: false });
      // Então
      expect(texto).toBe('=1+1\r\n');
    });

    it('quando a célula só tem um = no meio, então não ganha apóstrofo', () => {
      // Quando
      const texto = escreverCSV([['a=b']], { bom: false, protegerFormulas: true });
      // Então
      expect(texto).toBe('a=b\r\n');
    });

    it('quando a coluna está na lista de isentas, então só ela sai sem apóstrofo', () => {
      // Quando
      const texto = escreverCSV([['=1+1', '+55 38 99999-0000']], { bom: false, protegerFormulas: { exceto: [1] } });
      // Então
      expect(texto).toBe("'=1+1;+55 38 99999-0000\r\n");
    });

    it('quando o predicado isenta a coluna, então só ela sai sem apóstrofo', () => {
      // Dado
      const cabecalho = ['observacoes', 'telefones'];
      // Quando
      const texto = escreverCSV([['-x', '+55 38 99999-0000']], { bom: false, protegerFormulas: { exceto: c => cabecalho[c] === 'telefones' } });
      // Então
      expect(texto).toBe("'-x;+55 38 99999-0000\r\n");
    });

    it('quando o predicado olha o valor, então só o valor aceito sai sem apóstrofo na coluna isenta', () => {
      // Dado
      const soTelefone = (_coluna: number, valor: string) => /^\+\d[\d\s-]*$/.test(valor);
      // Quando
      const texto = escreverCSV([['+55 38 99999-0000'], ['+SOMA(A1)']], { bom: false, protegerFormulas: { exceto: soTelefone } });
      // Então
      expect(texto).toBe("+55 38 99999-0000\r\n'+SOMA(A1)\r\n");
    });
  });
});

describe('Decodificar o arquivo', () => {
  // "JOSÉ" em cada codificação: o É é 0xC3 0x89 em UTF-8 e 0xC9 no windows-1252.
  const JOSE_UTF8 = [0x4a, 0x4f, 0x53, 0xc3, 0x89];
  const JOSE_WINDOWS_1252 = [0x4a, 0x4f, 0x53, 0xc9];
  const BOM_UTF8 = [0xef, 0xbb, 0xbf];

  it.each([
    ['UTF-8', JOSE_UTF8],
    ['UTF-8 com BOM', [...BOM_UTF8, ...JOSE_UTF8]],
    ['windows-1252', JOSE_WINDOWS_1252]
  ])('quando os bytes de "JOSÉ" estão em %s, então o texto é "JOSÉ"', (_codificacao, bytes) => {
    // Dado
    const arquivo = new Uint8Array(bytes).buffer;
    // Quando
    const texto = decodificarTexto(arquivo);
    // Então
    expect(texto).toBe('JOSÉ');
  });
});
