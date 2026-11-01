// Testes da leitura das planilhas de entrada do conversor. Padrão Dado / Quando / Então: veja app/TESTES.md. Só dados fictícios.
import { describe, expect, it } from 'vitest';
import { CABECALHO_GOOGLE } from './ficticios';
import { conferirCabecalhosDoGoogle, lerExportacaoDoGoogle, lerPlanilhaDoSite } from './planilhas';

describe('Planilhas de entrada do conversor', () => {
  describe('Dada a planilha do site', () => {
    it('quando o cabeçalho tem outra caixa e acentos, então cada coluna é achada e as outras são ignoradas', () => {
      // Dado
      const tabela = [['nome', 'Tipo de Cadastro', 'Profissao', 'Fórmula'], ['Maria Exemplo', 'Pessoa Física', 'Professora', '=A1']];
      // Quando
      const [linha] = lerPlanilhaDoSite(tabela);
      // Então
      expect(linha).toEqual({ linha: 2, valores: { nome: 'Maria Exemplo', tipo: 'Pessoa Física', profissao: 'Professora' } });
    });

    it('quando há linhas vazias, então o número da linha é o da planilha', () => {
      // Dado
      const tabela = [['NOME', 'TIPO DE CADASTRO'], ['', ''], ['Maria Exemplo', 'Pessoa Física']];
      // Quando
      const linhas = lerPlanilhaDoSite(tabela);
      // Então
      expect(linhas.map(l => l.linha)).toEqual([3]);
    });

    it.each([['#N/A'], ['#ERROR!'], ['#REF!']])('quando a célula tem o erro de fórmula %s, então vale vazia', erro => {
      // Quando
      const [linha] = lerPlanilhaDoSite([['NOME', 'TIPO DE CADASTRO', 'CPF'], ['Maria Exemplo', 'Pessoa Física', erro]]);
      // Então
      expect(linha.valores.cpf).toBe('');
    });

    it('quando o cabeçalho repete o nome de uma coluna, então vale a última (como na leitura usada nos dados reais)', () => {
      // Dado
      const tabela = [['NOME', 'TIPO DE CADASTRO', 'CPF', 'CPF'], ['Maria Exemplo', 'Pessoa Física', 'primeira', 'última']];
      // Quando
      const [linha] = lerPlanilhaDoSite(tabela);
      // Então
      expect(linha.valores.cpf).toBe('última');
    });

    it('quando falta uma coluna obrigatória, então dá erro dizendo qual', () => {
      // Quando / Então
      expect(() => lerPlanilhaDoSite([['NOME', 'CPF'], ['Maria Exemplo', '']])).toThrow(/não tem a coluna TIPO DE CADASTRO/);
    });

    it('quando só há o cabeçalho, então dá erro', () => {
      // Quando / Então
      expect(() => lerPlanilhaDoSite([['NOME', 'TIPO DE CADASTRO']])).toThrow(/não tem nenhum cadastro/);
    });
  });

  describe('Dadas exportações do Google Contatos', () => {
    it('quando lê um arquivo, então cada contato guarda o arquivo e a linha', () => {
      // Quando
      const arquivo = lerExportacaoDoGoogle('contatos.csv', [CABECALHO_GOOGLE, [], ['Maria', '', 'Exemplo']]);
      // Então
      expect(arquivo.arquivo).toBe('contatos.csv');
      expect(arquivo.contatos.map(c => [c.linha, c.campos['First Name'], c.campos['Last Name']])).toEqual([[3, 'Maria', 'Exemplo']]);
    });

    it('quando o arquivo não é do Google Contatos, então dá erro', () => {
      // Quando / Então
      expect(() => lerExportacaoDoGoogle('outro.csv', [['Nome', 'Telefone']])).toThrow(/não parece uma exportação do Google Contatos/);
    });

    it('quando os arquivos têm cabeçalhos diferentes, então dá erro', () => {
      // Dado
      const [um, outro] = [lerExportacaoDoGoogle('a.csv', [CABECALHO_GOOGLE]), lerExportacaoDoGoogle('b.csv', [[...CABECALHO_GOOGLE, 'Nickname']])];
      // Quando / Então
      expect(() => conferirCabecalhosDoGoogle([um, outro])).toThrow(/2º arquivo do Google tem colunas diferentes/);
    });
  });
});
