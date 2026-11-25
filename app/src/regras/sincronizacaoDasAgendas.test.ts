// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Os textos das agendas do escritório no Google (#166), em Configurações.
import { describe, expect, it } from 'vitest';
import type { ResultadoDasAgendas } from '../dados/tipos';
import {
  lerResultadoDasAgendas, linhaDaRecusa, PROBLEMAS_DAS_AGENDAS, RECUSAS_DAS_AGENDAS, RESULTADO_DAS_AGENDAS, resumoDasAgendas, situacaoDasAgendas
} from './sincronizacaoDasAgendas';

const NADA = { criar: 0, renomear: 0, compartilhar: 0, retirar: 0, gravar_evento: 0, apagar_evento: 0 };
const resultado = (campos: Partial<ResultadoDasAgendas> = {}): ResultadoDasAgendas => ({ resultado: 'ok', feitas: NADA, falhas: 0, restam: false, ...campos });

describe('Textos das agendas no Google', () => {
  it.each([
    [{ agendas: 5, compartilhamentos: 12, pendentes: 0, com_falha: 0 }, 'Tudo em dia: 5 agendas criadas, 12 compartilhamentos.'],
    [{ agendas: 1, compartilhamentos: 1, pendentes: 0, com_falha: 0 }, 'Tudo em dia: 1 agenda criada, 1 compartilhamento.'],
    [{ agendas: 0, compartilhamentos: 0, pendentes: 1, com_falha: 0 }, 'Há mudanças esperando para ir ao Google. Até agora: 0 agendas criadas, 0 compartilhamentos.'],
    [{ agendas: 2, compartilhamentos: 3, pendentes: 1, com_falha: 1 }, 'Há mudanças esperando para ir ao Google (1 com falha). Até agora: 2 agendas criadas, 3 compartilhamentos.']
  ])('dada a situação %o, quando é mostrada, então diz "%s"', (s, texto) => {
    // Quando / Então
    expect(situacaoDasAgendas(s)).toBe(texto);
  });

  it('quando o que foi feito é resumido, então só aparece o que aconteceu', () => {
    // Quando / Então
    expect(resumoDasAgendas({ ...NADA, criar: 2, compartilhar: 5, retirar: 1 })).toBe('2 agendas criadas, 5 compartilhamentos feitos, 1 compartilhamento retirado');
    expect(resumoDasAgendas({ ...NADA, renomear: 1 })).toBe('1 agenda com o nome atualizado');
    expect(resumoDasAgendas(NADA)).toBe('');
  });

  it('dados eventos levados e tirados das agendas, quando o que foi feito é resumido, então eles aparecem depois das agendas', () => {
    // Quando / Então
    expect(resumoDasAgendas({ ...NADA, compartilhar: 1, gravar_evento: 12, apagar_evento: 1 }))
      .toBe('1 compartilhamento feito, 12 eventos levados às agendas, 1 evento tirado da agenda');
    expect(resumoDasAgendas({ ...NADA, gravar_evento: 1 })).toBe('1 evento levado à agenda');
  });

  it.each([
    [resultado(), true, 'Nada a mudar: as agendas já estavam em dia.'],
    [resultado({ feitas: { ...NADA, criar: 1, compartilhar: 2 } }), true, '1 agenda criada, 2 compartilhamentos feitos.'],
    [resultado({ feitas: { ...NADA, criar: 40 }, restam: true }), true, '40 agendas criadas. O resto vai ao Google sozinho em alguns minutos.'],
    [resultado({ falhas: 1 }), false, 'Uma parte não foi: o SEMPER tenta de novo sozinho, e nada se perdeu.']
  ])('dado o "Sincronizar agora" com %o, quando termina, então o aviso é ok=%s e diz "%s"', (r, ok, texto) => {
    // Quando / Então
    expect(RESULTADO_DAS_AGENDAS[r.resultado](r)).toEqual({ ok, texto });
  });

  it('quando as agendas estão desligadas ou o servidor falha, então o aviso é de falha', () => {
    // Quando / Então
    expect(RESULTADO_DAS_AGENDAS.desligada(resultado({ resultado: 'desligada' })).ok).toBe(false);
    expect(RESULTADO_DAS_AGENDAS.erro(resultado({ resultado: 'erro' })).texto).toContain('nada se perdeu');
  });

  it('dada a resposta da função do servidor, quando é lida, então o que não vier certo conta como zero ou como erro', () => {
    // Quando / Então
    expect(lerResultadoDasAgendas({ resultado: 'ok', feitas: { criar: 2, compartilhar: '3' }, falhas: 1, restam: true }))
      .toEqual({ resultado: 'ok', feitas: { ...NADA, criar: 2 }, falhas: 1, restam: true });
    expect(lerResultadoDasAgendas({ resultado: 'ok', feitas: { gravar_evento: 3, apagar_evento: 1 } }).feitas).toEqual({ ...NADA, gravar_evento: 3, apagar_evento: 1 });
    expect(lerResultadoDasAgendas(null)).toEqual({ resultado: 'erro', feitas: NADA, falhas: 0, restam: false });
    expect(lerResultadoDasAgendas({ resultado: 'desligada' }).resultado).toBe('desligada');
  });

  it('quando a autorização venceu, então o aviso manda autorizar a agenda de novo', () => {
    // Quando / Então
    expect(PROBLEMAS_DAS_AGENDAS.autorizacao.oQueFazer).toContain('"Autorizar a agenda"');
  });

  it('dado um compartilhamento recusado pelo Google, então a linha diz o e-mail, a agenda e a resposta, e o aviso manda tentar de novo', () => {
    // Quando / Então
    expect(linhaDaRecusa({ email: 'fora@gmail.test', agenda: 'Geral', detalhe: '403 forbidden' })).toBe('fora@gmail.test, na agenda "Geral" (403 forbidden)');
    expect(linhaDaRecusa({ email: 'fora@gmail.test', agenda: 'Sala 1', detalhe: null })).toBe('fora@gmail.test, na agenda "Sala 1"');
    expect(RECUSAS_DAS_AGENDAS.oQueFazer).toContain('"Sincronizar agora"');
  });
});
