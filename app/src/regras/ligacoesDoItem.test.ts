// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import { ligacoesComCodigo, ligacoesPorExtenso, nomeDaLigacao, type LigacaoDoItem } from './ligacoesDoItem';

describe('Ligações de um item fora do cartão (#300)', () => {
  describe('Dada uma tarefa ligada a uma demanda e a um contrato', () => {
    const ligacoes: LigacaoDoItem[] = [{ modulo: 'demandas', codigo: 'D3A1F09C' }, { modulo: 'contratos', codigo: 'MA96-0001-2026' }];

    it('quando escreve as ligações para a tabela, então ficam por extenso, na ordem, separadas por ponto', () => {
      // Quando
      const texto = ligacoesPorExtenso(ligacoes);
      // Então
      expect(texto).toBe('demanda D3A1F09C · contrato MA96-0001-2026');
    });

    it('quando dá o nome de cada ligação, então é o tipo com maiúscula seguido do código', () => {
      // Quando
      const nomes = ligacoesComCodigo(ligacoes).map(nomeDaLigacao);
      // Então
      expect(nomes).toEqual(['Demanda D3A1F09C', 'Contrato MA96-0001-2026']);
    });
  });

  it.each([
    ['sem código', null],
    ['com o código indefinido', undefined],
    ['com o código vazio', '']
  ])('dada uma ligação %s, quando separa as que existem, então ela fica de fora', (_caso, codigo) => {
    // Dado
    const ligacoes: LigacaoDoItem[] = [{ modulo: 'demandas', codigo }, { modulo: 'contratos', codigo: 'MA96-0001-2026' }];
    // Quando
    const existentes = ligacoesComCodigo(ligacoes);
    // Então
    expect(existentes).toEqual([{ modulo: 'contratos', codigo: 'MA96-0001-2026' }]);
  });

  it('dado um item sem nenhuma ligação, quando escreve as ligações para a tabela, então o texto fica vazio', () => {
    // Quando
    const texto = ligacoesPorExtenso([{ modulo: 'demandas', codigo: null }, { modulo: 'contratos', codigo: null }]);
    // Então
    expect(texto).toBe('');
  });
});
