// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// O Google Meet no compromisso (#437): a opção no cadastro, o que o cartão mostra da reunião e os textos de Configurações.
import { describe, expect, it } from 'vitest';
import {
  DICA_DO_MEET, dicaDoMeet, estadoDaReuniao, GRAVACAO_DA_REUNIAO, MEET_NAS_AGENDAS, mostraOpcaoDoMeet, OPCAO_DO_MEET, reuniaoNoCartao, TEXTO_DA_REUNIAO
} from './reuniaoGoogle';
import { camposDoCompromisso, compromissoVazio, dadosDoCompromisso, valorLegivelCompromisso, CAMPOS_COMPROMISSO } from './compromisso';
import type { Compromisso } from '../dados/tipos';

const LINK = 'https://meet.google.com/abc-mnop-xyz';
const c = (campos: Partial<Pick<Compromisso, 'reuniao_google' | 'reuniao' | 'arquivado_em'>> = {}) =>
  ({ reuniao_google: true, reuniao: null, arquivado_em: null, ...campos });

describe('A opção "Criar link do Google Meet"', () => {
  it.each([
    ['com o Meet disponível', { autorizado: true, disponivel: true }, false, true],
    ['sem o Meet ligado, desmarcada', { autorizado: true, disponivel: false }, false, false],
    ['sem conta ligada, desmarcada', null, false, false],
    ['sem o Meet ligado, já marcada (para poder desmarcar)', { autorizado: false, disponivel: false }, true, true]
  ] as const)('dado o escritório %s, então a opção aparece: %s', (_caso, situacao, marcada, aparece) => {
    // Quando / Então
    expect(mostraOpcaoDoMeet(situacao, marcada)).toBe(aparece);
  });

  it('dada a situação do Meet, então a dica diz o que acontece, ou quando a reunião nasce', () => {
    // Quando / Então
    expect(OPCAO_DO_MEET).toBe('Criar link do Google Meet');
    expect(dicaDoMeet({ autorizado: true, disponivel: true })).toBe(DICA_DO_MEET.disponivel);
    expect(dicaDoMeet(null)).toBe(DICA_DO_MEET.indisponivel);
    expect(DICA_DO_MEET.disponivel).toContain('conta Google do escritório');
  });

  it('dado o cadastro, então a opção começa desmarcada, vai ao banco e volta ao abrir o lápis', () => {
    // Dado
    const campos = { ...compromissoVazio(), titulo: 'Reunião', data: '10/12/2026', hora: '14:00', responsavelId: 'a1', reuniaoGoogle: true };
    // Quando
    const dados = dadosDoCompromisso(campos);
    // Então
    expect(compromissoVazio().reuniaoGoogle).toBe(false);
    expect(dados.reuniao_google).toBe(true);
    expect(camposDoCompromisso({ ...dados, reuniao_google: true, pessoas: [], participantes: [] } as unknown as Compromisso).reuniaoGoogle).toBe(true);
    expect(camposDoCompromisso({ ...dados, reuniao_google: undefined, pessoas: [], participantes: [] } as unknown as Compromisso).reuniaoGoogle).toBe(false);
  });

  it('quando a opção muda, então o histórico a mostra com o nome dela', () => {
    // Quando / Então
    expect(CAMPOS_COMPROMISSO.reuniao_google).toBe('Google Meet');
    expect(valorLegivelCompromisso('reuniao_google', true)).toBe('Sim');
    expect(valorLegivelCompromisso('reuniao_google', false)).toBe('Não');
  });
});

describe('A reunião no cartão', () => {
  it.each([
    ['sem a opção', c({ reuniao_google: false }), false, 'sem'],
    ['arquivado', c({ arquivado_em: '2026-12-01T10:00:00Z', reuniao: { link: LINK, gravacao: null } }), false, 'cancelada'],
    ['na coluna "Cancelado"', c({ reuniao: { link: LINK, gravacao: null } }), true, 'cancelada'],
    ['com o link ainda sendo criado', c(), false, 'criando'],
    ['com a reunião sem link guardado', c({ reuniao: { link: null, gravacao: null } }), false, 'criando'],
    ['com o link', c({ reuniao: { link: LINK, gravacao: null } }), false, 'pronta']
  ] as const)('dado o compromisso %s, então a reunião está %s', (_caso, compromisso, cancelado, estado) => {
    // Quando / Então
    expect(estadoDaReuniao(compromisso, cancelado)).toBe(estado);
  });

  it('dada a reunião pronta, então o cartão mostra o link e a gravação, se já se sabe', () => {
    // Quando / Então
    expect(reuniaoNoCartao(c({ reuniao: { link: LINK, gravacao: 'recusada' } }), false)).toEqual({ link: LINK, gravacao: GRAVACAO_DA_REUNIAO.recusada });
    expect(reuniaoNoCartao(c({ reuniao: { link: LINK, gravacao: null } }), false)).toEqual({ link: LINK, gravacao: null });
    expect(GRAVACAO_DA_REUNIAO.recusada).toContain('quem grava é a conta do escritório');
  });

  it('dada a reunião criando, cancelada ou sem a opção, então o cartão mostra o texto, ou nada', () => {
    // Quando / Então
    expect(reuniaoNoCartao(c(), false)).toEqual({ texto: TEXTO_DA_REUNIAO.criando });
    expect(reuniaoNoCartao(c(), true)).toEqual({ texto: TEXTO_DA_REUNIAO.cancelada });
    expect(reuniaoNoCartao(c({ reuniao_google: false }), false)).toBeNull();
  });

  it('dadas as Agendas no Google, então o texto do Meet diz o que falta e, depois, o que ele faz', () => {
    // Quando / Então
    expect(MEET_NAS_AGENDAS.falta).toContain('autorize o Meet');
    expect(MEET_NAS_AGENDAS.autorizado).toContain('Google Meet autorizado');
  });
});
