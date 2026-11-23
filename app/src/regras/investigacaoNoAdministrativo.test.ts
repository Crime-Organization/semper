// Extrajudicial e Investigação saem; a investigação vira processo administrativo (#406).
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import type { MarcoColuna, Modulo } from '../dados/tipos';
import { TAMANHO_PROCESSO } from '../dados/limites';
import { blocosDoQuadro } from './quadro';
import {
  colunaEquivalente, colunasDaInvestigacaoNoQuadro, ehTipoQueSaiu, grupoDaFase, numeroQueNaoRepete, tipoQueFica, type ColunaDoQuadro, type GrupoDoQuadro
} from './investigacaoNoAdministrativo';

type Coluna = ColunaDoQuadro & { modulo: Modulo };
type Grupo = GrupoDoQuadro & { modulo: Modulo; comeca_fechado: boolean };
/** Folga entre as colunas e os grupos, como no banco (#296). */
const FOLGA = 1_000_000;

/** Um quadro como o banco monta: grupos depois das colunas, colunas numeradas em sequência, a primeira e a última são marcos. */
function quadro(modulo: Modulo, grupos: [string, string[]][]): { colunas: Coluna[]; grupos: Grupo[] } {
  const total = grupos.flatMap(([, c]) => c).length;
  const colunas: Coluna[] = [], gs: Grupo[] = [];
  let ordem = 0;
  grupos.forEach(([nome, nomes], i) => {
    const grupo = { id: `${modulo}-g${i}`, nome, ordem: total + FOLGA + i + 1, modulo, comeca_fechado: false };
    gs.push(grupo);
    for (const n of nomes) {
      ordem++;
      const marco: MarcoColuna | null = ordem === 1 ? 'inicio' : ordem === total ? 'concluido' : null;
      colunas.push({ id: `${modulo}-c${ordem}`, nome: n, ordem, grupo_id: grupo.id, marco, modulo });
    }
  });
  return { colunas, grupos: gs };
}
const ADMINISTRATIVO: [string, string[]][] = [
  ['Protocolo', ['Protocolado', 'Publicado']],
  ['Exigências e manifestações', ['Exigência a cumprir', 'Exigência cumprida', 'Prazo de oposição', 'Manifestar contra oposição', 'Perícia médica', 'Avaliação social']],
  ['Análise', ['Aguardando decisão']],
  ['Decisão', ['Deferido/concedido', 'Indeferido', 'Recurso administrativo', 'Ajuizar ação']],
  ['Concessão e vigência', ['Pagamento da concessão', 'Expedição do certificado', 'Registro em vigor', 'Retribuição anual', 'Prorrogação', 'Contra nulidade']],
  ['Encerrado', ['Arquivado/baixado']]
];
const EXTRAJUDICIAL: [string, string[]][] = [
  ['Início', ['Aberto', 'Reunir documentos']], ['Andamento', ['Notificação enviada', 'Aguardando resposta', 'Em negociação', 'Minuta em análise']],
  ['Conclusão', ['Acordo ou escritura assinada', 'Registro ou averbação']], ['Encerrado', ['Concluído/arquivado']]
];
const INVESTIGACAO: [string, string[]][] = [
  ['Instauração', ['Instaurado', 'Pedido de acesso aos autos']], ['Diligências', ['Oitiva ou depoimento', 'Perícia', 'Diligências pendentes', 'Manifestação da defesa']],
  ['Conclusão', ['Relatório final', 'Denúncia oferecida', 'Pedido de arquivamento']], ['Encerrado', ['Arquivado']]
];

/** O quadro com as colunas novas, como a tela o mostra: o nome de cada grupo e as colunas dele, na ordem. */
function comAsNovas(q: { colunas: Coluna[]; grupos: Grupo[] }) {
  const novas = colunasDaInvestigacaoNoQuadro(q.colunas, q.grupos).map((c, i) => ({ ...c, id: `nova${i}`, marco: null, modulo: q.colunas[0].modulo }));
  const colunas = [...q.colunas, ...novas];
  return { colunas, novas, blocos: blocosDoQuadro(colunas, q.grupos).map((b): [string | null, string[]] => [b.grupo?.nome ?? null, b.colunas.map(c => c.nome)]) };
}

describe('As colunas da investigação no quadro administrativo', () => {
  it('dado o quadro de sempre, quando ganha as colunas, então cada uma entra no fim do grupo da fase dela', () => {
    // Quando
    const { blocos } = comAsNovas(quadro('processos_administrativos', ADMINISTRATIVO));
    // Então
    expect(blocos).toEqual([
      ['Protocolo', ['Protocolado', 'Publicado', 'Instaurado', 'Pedido de acesso aos autos']],
      ['Exigências e manifestações', ['Exigência a cumprir', 'Exigência cumprida', 'Prazo de oposição', 'Manifestar contra oposição', 'Perícia médica', 'Avaliação social',
        'Oitiva ou depoimento', 'Perícia', 'Diligências pendentes', 'Manifestação da defesa']],
      ['Análise', ['Aguardando decisão', 'Relatório final']],
      ['Decisão', ['Deferido/concedido', 'Indeferido', 'Recurso administrativo', 'Ajuizar ação', 'Denúncia oferecida', 'Pedido de arquivamento']],
      ['Concessão e vigência', ['Pagamento da concessão', 'Expedição do certificado', 'Registro em vigor', 'Retribuição anual', 'Prorrogação', 'Contra nulidade']],
      ['Encerrado', ['Arquivado/baixado']]
    ]);
  });

  it('dado o quadro de sempre, quando ganha as colunas, então a ordem do quadro todo segue a dos grupos, e nenhuma nova é marco', () => {
    // Quando
    const { colunas, blocos, novas } = comAsNovas(quadro('processos_administrativos', ADMINISTRATIVO));
    // Então
    expect([...colunas].sort((a, b) => a.ordem - b.ordem).map(c => c.nome)).toEqual(blocos.flatMap(([, c]) => c));
    expect(novas.map(c => c.marco)).toEqual(novas.map(() => null));
    expect(novas).toHaveLength(9);
  });

  it('dado um quadro que já tem a coluna com outra grafia, quando ganha as colunas, então ela não se repete', () => {
    // Dado
    const q = quadro('processos_administrativos', ADMINISTRATIVO);
    q.colunas.push({ id: 'minha', nome: 'PERICIA', ordem: 8.5, grupo_id: q.grupos[1].id, marco: null, modulo: 'processos_administrativos' });
    // Quando
    const { novas, blocos } = comAsNovas(q);
    // Então
    expect(novas.map(c => c.nome)).not.toContain('Perícia');
    expect(blocos[1][1].slice(-5)).toEqual(['Avaliação social', 'PERICIA', 'Oitiva ou depoimento', 'Diligências pendentes', 'Manifestação da defesa']);
  });

  it('dado um quadro que já tem todas, quando ganha as colunas, então nada entra; e um quadro vazio fica como está', () => {
    // Dado
    const { colunas } = comAsNovas(quadro('processos_administrativos', ADMINISTRATIVO));
    // Então
    expect(colunasDaInvestigacaoNoQuadro(colunas, quadro('processos_administrativos', ADMINISTRATIVO).grupos)).toEqual([]);
    expect(colunasDaInvestigacaoNoQuadro([], [])).toEqual([]);
  });

  it('dado um escritório que renomeou o Protocolo e a Decisão e apagou a Análise, quando ganha as colunas, então o início vai para o grupo da coluna do início e o meio para o último grupo antes do Encerrado', () => {
    // Dado
    const q = quadro('processos_administrativos', ADMINISTRATIVO);
    q.grupos[0].nome = 'Entrada';
    q.grupos[3].nome = 'Julgamento';
    q.colunas.filter(c => c.grupo_id === q.grupos[2].id).forEach(c => { c.grupo_id = null; });
    q.grupos.splice(2, 1);
    // Quando
    const { blocos } = comAsNovas(q);
    // Então
    expect(blocos.find(([g]) => g === 'Entrada')![1].slice(2)).toEqual(['Instaurado', 'Pedido de acesso aos autos']);
    expect(blocos.find(([g]) => g === 'Concessão e vigência')![1].slice(6)).toEqual(['Relatório final', 'Denúncia oferecida', 'Pedido de arquivamento']);
    expect(blocos.find(([g]) => g === 'Exigências e manifestações')![1].slice(6)).toEqual(['Oitiva ou depoimento', 'Perícia', 'Diligências pendentes', 'Manifestação da defesa']);
  });

  it('dado um quadro sem grupos, quando ganha as colunas, então as do início entram logo depois da coluna do início e as outras logo antes da das concluídas', () => {
    // Dado
    const q = quadro('processos_administrativos', ADMINISTRATIVO);
    q.colunas.forEach(c => { c.grupo_id = null; });
    // Quando
    const { colunas } = comAsNovas({ colunas: q.colunas, grupos: [] });
    // Então
    const ordem = [...colunas].sort((a, b) => a.ordem - b.ordem).map(c => c.nome);
    expect(ordem.slice(0, 3)).toEqual(['Protocolado', 'Instaurado', 'Pedido de acesso aos autos']);
    expect(ordem.slice(-8)).toEqual(['Oitiva ou depoimento', 'Perícia', 'Diligências pendentes', 'Manifestação da defesa', 'Relatório final', 'Denúncia oferecida',
      'Pedido de arquivamento', 'Arquivado/baixado']);
  });

  it('dado um grupo com o nome em outra grafia, quando procura o grupo da fase, então ele é achado pelo nome', () => {
    // Dado
    const q = quadro('processos_administrativos', ADMINISTRATIVO);
    q.grupos[2].nome = 'ANALISE';
    // Quando / Então
    expect(grupoDaFase(q.colunas, q.grupos, 'Análise', 'meio')).toBe(q.grupos[2].id);
  });
});

describe('Os processos dos tipos que saíram', () => {
  const adm = quadro('processos_administrativos', ADMINISTRATIVO), extra = quadro('processos_extrajudiciais', EXTRAJUDICIAL), inv = quadro('processos_investigacoes', INVESTIGACAO);
  const novas = comAsNovas(adm).colunas;
  const colunas = [...novas, ...extra.colunas, ...inv.colunas], grupos = [...adm.grupos, ...extra.grupos, ...inv.grupos];
  const id = (lista: Coluna[], nome: string) => lista.find(c => c.nome === nome)!.id;
  const destino = (de: Coluna[], nome: string) => colunas.find(c => c.id === colunaEquivalente(id(de, nome), colunas, grupos))?.nome;

  it.each([
    ['Oitiva ou depoimento', 'Oitiva ou depoimento'], ['Relatório final', 'Relatório final'], ['Instaurado', 'Instaurado'], ['Arquivado', 'Arquivado/baixado']
  ])('dada uma investigação em "%s", quando vira administrativa, então vai para "%s"', (de, para) => {
    // Quando / Então
    expect(destino(inv.colunas, de)).toBe(para);
  });

  it.each([
    ['Aberto', 'Protocolado'], ['Reunir documentos', 'Protocolado'], ['Em negociação', 'Exigência a cumprir'], ['Registro ou averbação', 'Deferido/concedido'],
    ['Concluído/arquivado', 'Arquivado/baixado']
  ])('dado um extrajudicial em "%s", quando vira administrativo, então vai para "%s" (a fase equivalente)', (de, para) => {
    // Quando / Então
    expect(destino(extra.colunas, de)).toBe(para);
  });

  it('dado um grupo do meio sem correspondente, quando vira administrativo, então vai para a primeira de Exigências e manifestações', () => {
    // Dado
    const renomeados = grupos.map(g => g.id === extra.grupos[1].id ? { ...g, nome: 'Tratativas' } : g);
    // Quando
    const para = colunaEquivalente(id(extra.colunas, 'Em negociação'), colunas, renomeados);
    // Então
    expect(colunas.find(c => c.id === para)?.nome).toBe('Exigência a cumprir');
  });

  it('dado um quadro administrativo sem o grupo da fase, quando vira administrativo, então vai para a coluna do início', () => {
    // Dado
    const semGrupos = colunas.map(c => c.modulo === 'processos_administrativos' ? { ...c, grupo_id: null } : c);
    // Quando
    const para = colunaEquivalente(id(extra.colunas, 'Em negociação'), semGrupos, grupos.filter(g => g.modulo !== 'processos_administrativos'));
    // Então
    expect(semGrupos.find(c => c.id === para)?.nome).toBe('Protocolado');
  });

  it('dado um processo sem coluna, ou numa coluna que não é dos quadros que saíram, quando vira administrativo, então a coluna fica como estava', () => {
    // Quando / Então
    expect(colunaEquivalente(null, colunas, grupos)).toBeNull();
    expect(colunaEquivalente(id(novas, 'Indeferido'), colunas, grupos)).toBe(id(novas, 'Indeferido'));
    expect(colunaEquivalente('de-outro-escritorio', colunas, grupos)).toBe('de-outro-escritorio');
  });

  it.each([['extrajudicial', 'administrativo'], ['investigacao', 'administrativo'], ['judicial', 'judicial'], ['ambos', 'ambos']] as const)(
    'dado o tipo %s, quando se vê o tipo que vale hoje, então é %s', (tipo, hoje) => {
      // Quando / Então
      expect(tipoQueFica(tipo)).toBe(hoje);
      expect(ehTipoQueSaiu(tipo)).toBe(tipo !== hoje);
    });

  it('dado um número que repetiria entre os administrativos, quando vira administrativo, então ganha o nome do tipo de antes, sem passar do tamanho', () => {
    // Quando / Então
    expect(numeroQueNaoRepete('NOT-1', 'extrajudicial')).toBe('NOT-1 (extrajudicial)');
    expect(numeroQueNaoRepete('IP 1/2026', 'investigacao')).toBe('IP 1/2026 (investigação)');
    const longo = numeroQueNaoRepete('9'.repeat(TAMANHO_PROCESSO.numero), 'investigacao');
    expect(longo).toHaveLength(TAMANHO_PROCESSO.numero);
    expect(longo.endsWith(' (investigação)')).toBe(true);
  });
});
