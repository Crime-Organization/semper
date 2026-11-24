// Os avisos da tarefa na caixa de Mensagens (#415). Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import type { AvisoDaTarefaDaMensagem } from '../dados/tipos';
import { AVISO_DESFEITO, SEGUNDO } from '../ui/tempos';
import {
  AVISOS_DA_TAREFA, aprovacaoMudouDeDono, avisoDesfeito, avisoDoSolicitante, chegouAAprovacao, DEVOLUCAO_SEM_COMENTARIO, enderecoDoAvisoDaTarefa, nomeDaTarefaDoAviso,
  quemExecuta, rotulosDoAvisoDaTarefa, saiuDaAprovacao, TAREFA_QUE_NAO_VE, textoDaDevolucao
} from './avisosDaTarefa';

const tarefa = { id: 't1', codigo: 'F00D1234', titulo: 'Minutar a petição' };
const COLUNAS = [
  { id: 'c-inicio', marco: 'inicio' as const }, { id: 'c-fazendo', marco: null }, { id: 'c-aprovacao', marco: null, de_aprovacao: true },
  { id: 'c-fim', marco: 'concluido' as const }
];

describe('Avisos da tarefa: as palavras (#415)', () => {
  it.each([
    ['solicitante', 'incluiu você como solicitante da tarefa', 'Agora você é o solicitante da tarefa.'],
    ['aprovacao', 'enviou para a sua aprovação a tarefa', 'Aprove ou devolva com um comentário do que falta.']
  ] as const)('dado o aviso de %s, quando a caixa o mostra, então diz o que quem fez fez e o que fazer', (aviso, acao, trecho) => {
    // Quando
    const t = AVISOS_DA_TAREFA[aviso];
    // Então
    expect(t.acao).toBe(acao);
    expect(t.trecho({ comentario: null })).toBe(trecho);
  });

  it('dada a devolução, quando a caixa a mostra, então a segunda linha é o comentário, sem o "Tarefa devolvida:" do cartão', () => {
    // Quando
    const t = AVISOS_DA_TAREFA.devolvida;
    // Então
    expect(t.acao).toBe('devolveu a tarefa');
    expect(t.trecho({ comentario: { id: 'k1', texto: 'Tarefa devolvida: Falta o pedido de tutela.' } })).toBe('Falta o pedido de tutela.');
    expect(t.trecho({ comentario: null })).toBe(DEVOLUCAO_SEM_COMENTARIO);
    expect(textoDaDevolucao('Outro texto')).toBe('Outro texto');
  });

  it('dada a tarefa sem título, quando a caixa a mostra, então usa o código', () => {
    // Quando / Então
    expect(nomeDaTarefaDoAviso({ ...tarefa, titulo: '' })).toBe('F00D1234');
  });

  it('dado o aviso, quando a pessoa clica, então abre o cartão; na devolução, no comentário', () => {
    // Quando / Então
    expect(enderecoDoAvisoDaTarefa(tarefa, null)).toBe('/tarefas/?id=t1');
    expect(enderecoDoAvisoDaTarefa(tarefa, { id: 'k1', texto: 'x' })).toBe('/tarefas/?id=t1&comentario=k1');
  });

  it('dado o aviso, então os rótulos têm quem fez, o aviso e a tarefa; sem a tarefa, nada dela', () => {
    // Dado
    const a: Pick<AvisoDaTarefaDaMensagem, 'aviso' | 'tarefa'> = { aviso: 'aprovacao', tarefa };
    // Quando / Então
    expect(rotulosDoAvisoDaTarefa(a, 'Ana', 'não lido')).toEqual({
      linha: 'Aviso não lido: Ana enviou para a sua aprovação a tarefa Minutar a petição',
      marcarLida: 'Marcar como lido o aviso de aprovação da tarefa Minutar a petição'
    });
    expect(rotulosDoAvisoDaTarefa({ ...a, tarefa: null }, 'Ana', 'lido')).toEqual({
      linha: `Aviso lido: ${TAREFA_QUE_NAO_VE.replace(/\.$/, '')}`,
      marcarLida: 'Marcar como lido o aviso de aprovação de uma tarefa que você não vê mais'
    });
  });
});

describe('Avisos da tarefa: o solicitante (#415)', () => {
  const agora = 1_000 * SEGUNDO;

  it('dada uma tarefa nova com solicitante, então ele é avisado', () => {
    // Quando
    const r = avisoDoSolicitante(undefined, null, 'u-caio', agora);
    // Então
    expect(r).toEqual({ sequencia: { solicitante_antes: null, desde: agora, em: agora }, vale: 'u-caio' });
  });

  it('dada a troca desfeita logo depois, então ninguém é avisado (quem volta nunca deixou de ser o solicitante)', () => {
    // Dado
    const { sequencia } = avisoDoSolicitante(undefined, 'u-caio', 'u-eva', agora);
    // Quando
    const r = avisoDoSolicitante(sequencia, 'u-eva', 'u-caio', agora + 10 * SEGUNDO);
    // Então
    expect(r).toEqual({ sequencia: { solicitante_antes: 'u-caio', desde: agora, em: agora + 10 * SEGUNDO }, vale: null });
  });

  it('dada uma troca antiga, quando vem outra depois do tempo do desfazer, então começa outra sequência', () => {
    // Dado
    const { sequencia } = avisoDoSolicitante(undefined, 'u-caio', 'u-eva', agora);
    // Quando
    const r = avisoDoSolicitante(sequencia, 'u-eva', 'u-caio', agora + AVISO_DESFEITO);
    // Então
    expect(r.vale).toBe('u-caio');
    expect(r.sequencia.desde).toBe(agora + AVISO_DESFEITO);
  });

  it('dado o solicitante tirado (sem ninguém no lugar), então ninguém é avisado', () => {
    // Quando / Então
    expect(avisoDoSolicitante(undefined, 'u-caio', null, agora).vale).toBeNull();
  });
});

describe('Avisos da tarefa: a coluna de aprovação (#415)', () => {
  const comAprovacao = { precisa_aprovacao: true, arquivado_em: null };

  it.each([
    ['vinda de "Fazendo"', comAprovacao, 'c-fazendo', true],
    ['nova, já na de aprovação', comAprovacao, null, true],
    ['que já estava lá', comAprovacao, 'c-aprovacao', false],
    ['sem a caixa "Precisa de aprovação"', { ...comAprovacao, precisa_aprovacao: false }, 'c-fazendo', false],
    ['arquivada', { ...comAprovacao, arquivado_em: '2026-11-24T10:00:00Z' }, 'c-fazendo', false]
  ])('dada a tarefa %s, quando chega à coluna de aprovação, então avisar o solicitante é %s', (_caso, t, de, avisa) => {
    // Quando / Então
    expect(chegouAAprovacao(t, de, 'c-aprovacao', COLUNAS)).toBe(avisa);
  });

  it.each([
    ['na de aprovação, com outro solicitante', { solicitante_id: 'u-eva' }, true],
    ['na de aprovação, com o mesmo solicitante', {}, false],
    ['em "Fazendo", com outro solicitante', { solicitante_id: 'u-eva', etapa_id: 'c-fazendo' }, false],
    ['na de aprovação, sem a caixa "Precisa de aprovação"', { solicitante_id: 'u-eva', precisa_aprovacao: false }, false],
    ['na de aprovação, arquivada', { solicitante_id: 'u-eva', arquivado_em: '2026-11-24T10:00:00Z' }, false]
  ])('dada a tarefa %s, quando o solicitante muda, então o aviso de aprovação passar para o novo é %s', (_caso, mudou, passa) => {
    // Dado
    const t = { ...comAprovacao, solicitante_id: 'u-caio', etapa_id: 'c-aprovacao', ...mudou };
    // Quando / Então
    expect(aprovacaoMudouDeDono(t, 'u-caio', COLUNAS)).toBe(passa);
  });

  it('dado um quadro sem coluna de aprovação, então ninguém é avisado', () => {
    // Quando / Então
    expect(chegouAAprovacao(comAprovacao, 'c-fazendo', 'c-fim', COLUNAS.filter(c => !c.de_aprovacao))).toBe(false);
  });

  it.each([
    ['"Fazendo" (o Desfazer)', 'c-fazendo', true],
    ['as concluídas (a aprovação)', 'c-fim', false]
  ])('dada a tarefa na aprovação, quando sai para %s, então o aviso não lido pode sair: %s', (_caso, para, sai) => {
    // Quando / Então
    expect(saiuDaAprovacao('c-aprovacao', para, COLUNAS)).toBe(sai);
    expect(saiuDaAprovacao('c-fazendo', para, COLUNAS)).toBe(false);
  });

  it('dado o aviso de aprovação, então o Desfazer só apaga o não lido, de quem retirou, e só dentro do tempo do desfazer', () => {
    // Dado
    const criado = '2026-11-24T10:00:00Z', depois = Date.parse(criado) + 10 * SEGUNDO;
    const m = { lido_em: null, feito_por: 'u-bia', criado_em: criado };
    // Quando / Então
    expect(avisoDesfeito(m, 'u-bia', depois)).toBe(true);
    expect(avisoDesfeito(m, 'u-ana', depois)).toBe(false);
    expect(avisoDesfeito({ ...m, lido_em: criado }, 'u-bia', depois)).toBe(false);
    expect(avisoDesfeito(m, 'u-bia', Date.parse(criado) + AVISO_DESFEITO)).toBe(false);
  });
});

describe('Avisos da tarefa: quem executa (#415)', () => {
  it('dada a tarefa com o responsável e participantes com e sem função de execução, então executam o responsável e os de execução', () => {
    // Dado
    const funcoes = [{ id: 'f-executa', executa: true }, { id: 'f-revisa', executa: false }];
    const t = { responsavel_id: 'u-bia', participantes: ['u-eva', 'u-ana', 'u-caio'], funcoes: { 'u-eva': 'f-executa', 'u-ana': 'f-revisa' } };
    // Quando / Então
    expect(quemExecuta(t, funcoes)).toEqual(['u-bia', 'u-eva']);
  });
});
