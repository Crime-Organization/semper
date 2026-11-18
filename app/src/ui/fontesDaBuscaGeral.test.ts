// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Dados, PessoaLista, ProcessoLista, TarefaLista } from '../dados';
import { BUSCA_GERAL_CANDIDATOS } from '../dados/limites';
import { buscarEmTudo } from './fontesDaBuscaGeral';

// A busca geral usa as listagens de cada módulo, as mesmas das páginas: o mock declara só essas.
const sd = vi.hoisted(() => ({
  pessoasListar: vi.fn(), processosListar: vi.fn(), contratosListar: vi.fn(), demandasListar: vi.fn(), tarefasListar: vi.fn(), compromissosListar: vi.fn(), anotacoesListar: vi.fn()
}));
vi.mock('../dados', () => ({ SD: sd satisfies Partial<Record<keyof Dados, unknown>> }));

const jose = { id: 'p1', codigo: 'AB12CD34', tipo: 'pf', nome: 'JOSÉ DA SILVA TESTE', nome_fantasia: null, documento: '52998224725', municipio: null, uf: null,
  criado_em: '2026-11-10T10:00:00-03:00' } as unknown as PessoaLista;
const processo = { id: 'pr1', codigo: 'F1F1F1F1', tipo: 'judicial', numero: '00012349720268130024', titulo: null, cliente_nome: 'JOSÉ DA SILVA TESTE', orgao: 'TJMG',
  vara: null, comarca: null, criado_em: '2026-11-10T10:00:00-03:00' } as unknown as ProcessoLista;
const gru = { id: 't1', codigo: 'C0FFEE12', titulo: 'Emitir a GRU', pessoa_nome: '', demanda_codigo: null, prazo: null, criado_em: '2026-11-10T10:00:00-03:00' } as unknown as TarefaLista;

describe('Busca geral: onde ela busca', () => {
  beforeEach(() => {
    Object.values(sd).forEach(f => f.mockReset());
    sd.pessoasListar.mockResolvedValue({ linhas: [jose], total: 9 });
    sd.processosListar.mockImplementation(async (f: { tipo: string }) => f.tipo === 'judicial' ? { linhas: [processo], total: 1 } : { linhas: [], total: 0 });
    sd.tarefasListar.mockResolvedValue({ linhas: [gru], total: 1 });
  });

  it('quando a busca vai aos módulos, então cada um recebe o termo, a quantidade de candidatos e a ordem dos mais novos, e os processos vão pelos dois tipos', async () => {
    // Quando
    await buscarEmTudo('jose', ['pessoas', 'judiciais', 'administrativos', 'tarefas']);
    // Então
    const daJanela = { termo: 'jose', porPagina: BUSCA_GERAL_CANDIDATOS, ordem: 'novos' };
    expect(sd.pessoasListar).toHaveBeenCalledWith(daJanela);
    expect(sd.processosListar).toHaveBeenCalledWith({ tipo: 'judicial', ...daJanela });
    expect(sd.processosListar).toHaveBeenCalledWith({ tipo: 'administrativo', ...daJanela });
    expect(sd.tarefasListar).toHaveBeenCalledWith(daJanela);
    expect(sd.contratosListar).not.toHaveBeenCalled();
  });

  it('quando as listagens respondem, então cada linha vira um achado do grupo dela, com o total do módulo', async () => {
    // Quando
    const r = await buscarEmTudo('jose', ['pessoas', 'judiciais', 'tarefas']);
    // Então
    expect(r.buscas.map(b => [b.grupo, b.itens.map(i => i.titulo), b.total])).toEqual([
      ['pessoas', ['JOSÉ DA SILVA TESTE'], 9], ['judiciais', ['0001234-97.2026.8.13.0024'], 1], ['tarefas', ['Emitir a GRU'], 1]
    ]);
    expect(r.falhas).toEqual([]);
    expect(r.semAcesso).toEqual([]);
  });

  it('dado um módulo que falha, quando a busca responde, então os outros aparecem e ele fica na lista das falhas', async () => {
    // Dado
    sd.tarefasListar.mockRejectedValue(new Error('sem rede'));
    // Quando
    const r = await buscarEmTudo('jose', ['pessoas', 'tarefas']);
    // Então
    expect(r.buscas.map(b => b.grupo)).toEqual(['pessoas']);
    expect(r.falhas).toEqual(['tarefas']);
  });
});
