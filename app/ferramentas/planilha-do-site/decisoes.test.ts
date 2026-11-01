// Testes das decisões sobre os pares (para-decidir.csv). Padrão Dado / Quando / Então: veja app/TESTES.md. Só dados fictícios.
import { describe, expect, it } from 'vitest';
import { escreverCSV, lerCSV } from '../../src/regras/csv';
import { chaveDoPar, COLUNAS_PARA_DECIDIR, lerDecisoes, linhasParaDecidir, type Decisoes } from './decisoes';
import { CASOS, limpar, MOTIVOS, type Entrada } from './limpar';
import { site } from './ficticios';

/** Dois clientes de mesmo nome sem nada em comum: viram um par para decidir. */
const DOIS_IGUAIS: Entrada = {
  site: [site(2, { nome: 'Maria Exemplo', telefone: '(38) 99999-0000' }), site(3, { nome: 'Maria Exemplo', telefone: '(38) 98888-0000' })],
  google: []
};
const referenciasDoPar = () => {
  const [par] = limpar(DOIS_IGUAIS).rel.pares;
  return [par.a.referencia, par.b.referencia];
};
/** Uma tabela no formato de para-decidir.csv, com as decisões dadas. */
const tabela = (linhas: [string, string, string][]) =>
  [[...COLUNAS_PARA_DECIDIR], ...linhas.map(([a, b, decisao]) => ['caso', a, 'nome', '2', b, 'nome', '3', 'feito', decisao])];

describe('Decisões sobre os pares', () => {
  describe('Ler o arquivo de decisões', () => {
    it.each([['sim', 'sim'], ['S', 'sim'], ['x', 'sim'], ['Mesma', 'sim'], ['não', 'nao'], ['NAO', 'nao'], ['n', 'nao']])(
      'quando a decisão é "%s", então vale %s', (texto, decisao) => {
        // Quando
        const decisoes = lerDecisoes(tabela([['site-a', 'site-b', texto]]));
        // Então
        expect(decisoes.get(chaveDoPar('site-b', 'site-a'))).toBe(decisao);
      });

    it('quando a decisão está vazia, então o par fica sem decisão', () => {
      // Quando
      const decisoes = lerDecisoes(tabela([['site-a', 'site-b', '']]));
      // Então
      expect(decisoes.size).toBe(0);
    });

    it('quando a decisão não é sim nem não, então dá erro com o número da linha', () => {
      // Dado
      const t = tabela([['site-a', 'site-b', 'sim'], ['site-c', 'site-d', 'talvez']]);
      // Quando / Então
      expect(() => lerDecisoes(t)).toThrow(/^Linha 3 do arquivo de decisões/);
    });

    it('quando o arquivo não tem as colunas do conversor, então dá erro', () => {
      // Quando / Então
      expect(() => lerDecisoes([['Nome', 'CPF']])).toThrow(/não é o para-decidir.csv/);
    });

    it('quando o para-decidir.csv é gravado e lido de volta, então as decisões continuam as mesmas', () => {
      // Dado
      const [a, b] = referenciasDoPar();
      const pares = limpar(DOIS_IGUAIS, new Map([[chaveDoPar(a, b), 'nao']])).rel.pares;
      // Quando
      const lidas = lerDecisoes(lerCSV(escreverCSV(linhasParaDecidir(pares), { protegerFormulas: true }), { manterVazias: true }));
      // Então
      expect([...lidas]).toEqual([[chaveDoPar(a, b), 'nao']]);
    });
  });

  describe('Aplicar as decisões', () => {
    it('quando a decisão é sim, então os dois clientes juntam', () => {
      // Dado
      const [a, b] = referenciasDoPar();
      const decisoes: Decisoes = new Map([[chaveDoPar(a, b), 'sim']]);
      // Quando
      const { finais, rel } = limpar(DOIS_IGUAIS, decisoes);
      // Então
      expect(finais).toHaveLength(1);
      expect(finais[0].site.linhas).toEqual([2, 3]);
      expect(finais[0].comoJuntado).toContain(MOTIVOS.decisao);
      expect(finais[0].pendentes).toEqual([]);
      expect(rel.pares).toMatchObject([{ caso: CASOS.mesmoNomeSemProva, decisao: 'sim', feito: 'juntados pela sua decisão' }]);
      expect(rel.decisoes).toEqual({ aplicadas: 1, ignoradas: 0 });
    });

    it('quando a decisão é não, então ficam separados e sem nada a conferir', () => {
      // Dado
      const [a, b] = referenciasDoPar();
      // Quando
      const { finais, rel } = limpar(DOIS_IGUAIS, new Map([[chaveDoPar(a, b), 'nao']]));
      // Então
      expect(finais).toHaveLength(2);
      expect(finais.map(c => c.pendentes)).toEqual([[], []]);
      expect(rel.pares[0]).toMatchObject({ decisao: 'nao', feito: 'mantidos separados pela sua decisão' });
    });

    it('quando a decisão é de um par que não existe mais, então é ignorada e contada', () => {
      // Dado
      const decisoes: Decisoes = new Map([[chaveDoPar('site-sumiu', 'site-outro'), 'sim']]);
      // Quando
      const { finais, rel } = limpar(DOIS_IGUAIS, decisoes);
      // Então
      expect(finais).toHaveLength(2);
      expect(rel.decisoes).toEqual({ aplicadas: 0, ignoradas: 1 });
    });

    it('quando um par decidido sim liga dois clientes a um terceiro de mesmo nome com prova, então os três juntam', () => {
      // Dado
      const dados: Entrada = {
        site: [
          site(2, { nome: 'Maria Exemplo', telefone: '(38) 99999-0000', nascimento: '01/02/1980' }),
          site(3, { nome: 'Maria Exemplo', telefone: '(38) 98888-0000' }),
          site(4, { nome: 'Maria Exemplo', telefone: '(38) 97777-0000', nascimento: '01/02/1980' })
        ],
        google: []
      };
      const decisoes: Decisoes = new Map(limpar(dados).rel.pares.map(p => [chaveDoPar(p.a.referencia, p.b.referencia), 'sim']));
      // Quando
      const { finais } = limpar(dados, decisoes);
      // Então
      expect(finais).toHaveLength(1);
      expect(finais[0].site.linhas).toEqual([2, 3, 4]);
    });
  });
});
