// O processo administrativo ligado ao judicial que nasceu dele (#425): a ligação "judicial", nos dois cartões.
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import {
  CAMPOS_PROCESSO, cadastroDoDerivado, errosDaEtapaProcesso, judicialParaDesligar, judicialParaLigar, LIGACOES, ligacaoDaOrigem, ligacaoDoEndereco, ligacoesDaOrigem, origemAoCriar,
  RELACOES, relacionadosDoProcesso, ROTULO_DO_NOVO_DERIVADO, SO_JUDICIAL_NO_ADMINISTRATIVO, tipoDoDerivado, processoVazio, valorLegivelProcesso
} from './processo';

const base = { codigo: 'X', numero: '1', titulo: null, cliente_nome: '', etapa_id: null, arquivado_em: null };

describe('O judicial que nasce do administrativo', () => {
  it('dado um processo administrativo de qualquer área, quando a pessoa cria um processo a partir dele, então pode escolher o judicial', () => {
    // Então
    expect(ligacoesDaOrigem('administrativo')).toEqual(['recurso', 'incidental', 'judicial']);
    expect(LIGACOES.judicial.novo).toBe('Novo processo judicial a partir deste');
    expect(ROTULO_DO_NOVO_DERIVADO.administrativo).toContain('processo judicial');
  });

  it('dado um processo judicial, quando a pessoa cria um processo a partir dele, então só recurso e incidental aparecem', () => {
    // Então
    expect(ligacoesDaOrigem('judicial')).toEqual(['recurso', 'incidental']);
    expect(ROTULO_DO_NOVO_DERIVADO.judicial).toBe('Novo recurso ou incidental deste processo');
  });

  it('quando a ligação é o judicial, então o processo novo é judicial; sem ela, é do tipo da origem', () => {
    // Então
    expect(tipoDoDerivado('judicial', 'administrativo')).toBe('judicial');
    expect(tipoDoDerivado('recurso', 'administrativo')).toBe('administrativo');
    expect(tipoDoDerivado('', 'administrativo')).toBe('administrativo');
  });

  it('quando o botão do cartão abre o cadastro, então o endereço traz a ligação judicial, que o cadastro lê de volta', () => {
    // Então
    expect(cadastroDoDerivado('a1', 'judicial')).toBe('/processos/novo/?processo=a1&ligacao=judicial');
    expect(ligacaoDoEndereco('judicial')).toBe('judicial');
    expect(origemAoCriar({ origemId: 'a1', ligacao: 'judicial' })).toEqual({ origem_id: 'a1', ligacao: 'judicial' });
  });

  it('dado um endereço com a ligação judicial e uma origem judicial (link antigo ou mudado à mão), quando o cadastro lê a origem, então a ligação fica para a pessoa escolher', () => {
    // Quando / Então: o judicial só nasce do administrativo; o recurso e o incidental, de qualquer um.
    expect(ligacaoDaOrigem('judicial', 'judicial')).toBe('');
    expect(ligacaoDaOrigem('judicial', 'administrativo')).toBe('judicial');
    expect(ligacaoDaOrigem('recurso', 'judicial')).toBe('recurso');
    expect(ligacaoDaOrigem('', 'administrativo')).toBe('');
  });

  it('dado o cadastro que nasce do administrativo, quando falta escolher a ligação ou o tipo não bate, então ele avisa', () => {
    // Dado
    const c = { ...processoVazio('administrativo'), origemId: 'a1' };
    // Então
    expect(errosDaEtapaProcesso('processo', c).ligacao).toContain('processo judicial');
    expect(errosDaEtapaProcesso('processo', { ...c, ligacao: 'judicial' }).ligacao).toBe(SO_JUDICIAL_NO_ADMINISTRATIVO);
    expect(errosDaEtapaProcesso('processo', { ...c, tipo: 'judicial', ligacao: 'judicial' }).ligacao).toBeUndefined();
  });
});

describe('A ligação nos dois cartões', () => {
  const administrativo = { ...base, id: 'adm', tipo: 'administrativo' as const, origem_id: null, ligacao: null, criado_em: '2025-01-01' };
  const judicial = { ...base, id: 'jud', tipo: 'judicial' as const, origem_id: 'adm', ligacao: 'judicial' as const, criado_em: '2026-01-01' };
  const recurso = { ...base, id: 'rec', tipo: 'judicial' as const, origem_id: 'jud', ligacao: 'recurso' as const, criado_em: '2026-02-01' };

  it('quando a pessoa abre o administrativo, então vê o judicial em "Processos relacionados"', () => {
    // Quando
    const lista = relacionadosDoProcesso([administrativo, judicial, recurso], administrativo);
    // Então
    expect(lista.map(p => [p.id, p.relacao])).toEqual([['jud', 'judicial']]);
    expect(RELACOES.judicial).toBe('Processo judicial deste administrativo');
  });

  it('quando a pessoa abre o judicial, então vê primeiro o administrativo de origem e depois os recursos dele', () => {
    // Quando
    const lista = relacionadosDoProcesso([administrativo, judicial, recurso], judicial);
    // Então
    expect(lista.map(p => [p.id, p.relacao])).toEqual([['adm', 'administrativo'], ['rec', 'recurso']]);
    expect(RELACOES.administrativo).toBe('Processo administrativo de origem');
  });

  it('quando a pessoa desfaz a ligação em qualquer dos dois cartões, então quem perde a origem é o judicial; o recurso não se desfaz', () => {
    // Então
    expect(judicialParaDesligar({ id: 'jud', relacao: 'judicial' }, 'adm')).toBe('jud');
    expect(judicialParaDesligar({ id: 'adm', relacao: 'administrativo' }, 'jud')).toBe('jud');
    expect(judicialParaDesligar({ id: 'rec', relacao: 'recurso' }, 'jud')).toBeNull();
    expect(judicialParaDesligar({ id: 'jud', relacao: 'origem' }, 'rec')).toBeNull();
  });

  it('quando a pessoa liga um judicial que já existe, então só servem os judiciais ativos e sem origem', () => {
    // Então
    expect(judicialParaLigar({ tipo: 'judicial', origem_id: null, arquivado_em: null })).toBe(true);
    expect(judicialParaLigar({ tipo: 'judicial', origem_id: 'x', arquivado_em: null })).toBe(false);
    expect(judicialParaLigar({ tipo: 'judicial', origem_id: null, arquivado_em: '2026-01-01' })).toBe(false);
    expect(judicialParaLigar({ tipo: 'administrativo', origem_id: null, arquivado_em: null })).toBe(false);
  });

  it('quando a ligação muda, então o histórico diz o nome dela', () => {
    // Então
    expect(CAMPOS_PROCESSO.ligacao).toBe('Ligação com o processo de origem');
    expect(valorLegivelProcesso('ligacao', 'judicial')).toBe('Processo judicial a partir do administrativo');
    expect(valorLegivelProcesso('origem_id', null)).toBe('sem ligação');
  });
});
