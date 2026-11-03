// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import type { PapelNoValor, SituacaoDoValor } from '../dados/tipos';
import { deQuemVem, erroDaDataDoPagamento, papeisComValor, PAPEIS_DO_VALOR, SITUACOES_DO_VALOR, totaisPorPapel } from './meusValores';

const linha = (papel: PapelNoValor, situacao: SituacaoDoValor, valor: number) => ({ papel, situacao, valor });

describe('Meus valores', () => {
  describe('Totais por papel', () => {
    it('quando não há linhas, então todos os totais são zero, e nenhum papel aparece', () => {
      // Quando
      const totais = totaisPorPapel([]);
      // Então
      expect(totais).toEqual({ responsavel: { a_receber: 0, recebido: 0 }, participante: { a_receber: 0, recebido: 0 }, indicador: { a_receber: 0, recebido: 0 } });
      expect(papeisComValor(totais)).toEqual([]);
    });

    it('dadas linhas de vários papéis, quando soma, então a receber e recebido ficam separados, e um papel não entra no outro', () => {
      // Dado
      const linhas = [linha('responsavel', 'a_receber', 74000), linha('responsavel', 'recebido', 70000), linha('responsavel', 'recebido', 1), linha('indicador', 'a_receber', 4625)];
      // Quando
      const totais = totaisPorPapel(linhas);
      // Então
      expect(totais.responsavel).toEqual({ a_receber: 74000, recebido: 70001 });
      expect(totais.indicador).toEqual({ a_receber: 4625, recebido: 0 });
      expect(totais.participante).toEqual({ a_receber: 0, recebido: 0 });
    });

    it('dados só alguns papéis, quando lista, então só eles aparecem, na ordem da tabela', () => {
      // Dado
      const totais = totaisPorPapel([linha('indicador', 'recebido', 10), linha('responsavel', 'a_receber', 20)]);
      // Quando / Então
      expect(papeisComValor(totais)).toEqual(['responsavel', 'indicador']);
    });
  });

  describe('Como aparece', () => {
    it.each<[PapelNoValor, string]>([['responsavel', 'Responsável'], ['participante', 'Participante'], ['indicador', 'Indicador']])('dado o papel %s, quando aparece, então é %s', (papel, nome) => {
      // Quando / Então
      expect(PAPEIS_DO_VALOR[papel]).toBe(nome);
    });

    it.each<[SituacaoDoValor, string, string]>([['a_receber', 'A receber', 'pend'], ['recebido', 'Recebido', 'ok']])('dada a situação %s, quando aparece, então diz %s, com o selo %s', (situacao, nome, selo) => {
      // Quando / Então
      expect(SITUACOES_DO_VALOR[situacao]).toEqual({ nome, selo });
    });

    it.each([['escritório', 'Escritório'], ['cliente', 'Cliente'], ['Ana Lima', 'Ana Lima']])('dado que vem de %s, quando aparece, então diz %s', (de_quem, texto) => {
      // Quando / Então
      expect(deQuemVem({ de_quem })).toBe(texto);
    });
  });

  describe('Data do pagamento', () => {
    it.each(['2026-03-20', '2000-01-01', '2100-12-31'])('dada a data %s, quando confere, então serve', data => {
      // Quando / Então
      expect(erroDaDataDoPagamento(data)).toBeNull();
    });

    it.each(['', '2026-02-30', '1999-12-31', '2101-01-01'])('dada a data "%s", quando confere, então pede uma válida', data => {
      // Quando / Então
      expect(erroDaDataDoPagamento(data)).toBe('Informe uma data válida.');
    });
  });
});
