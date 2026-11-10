// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Os e-mails de prazo (#113) e dos lembretes (#286), em supabase/functions/_compartilhado/.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  emailDiario, emailDoLembrete, emailDoResumo, enviarEmailsDePrazo, tipoDeEnvioValido,
  type EmailDiario, type EmailDosLembretes, type ItemDePrazo, type ItemDoAviso, type ItemDoLembrete, type PassosDosEmails, type ResumoSemanal, type SecaoDoResumo
} from '../../../supabase/functions/_compartilhado/emailsDePrazo';

const item = (extras: Partial<ItemDePrazo> = {}): ItemDePrazo =>
  ({ modulo: 'tarefas', pagina: 'tarefas', cartao_id: 'c1', cartao_codigo: 'T1', titulo: 'Emitir a GRU', data: '2030-01-18', hora: null, ...extras });
const aviso = (extras: Partial<ItemDoAviso> = {}): ItemDoAviso => ({ ...item(extras), id: 'm1', aviso: 'hoje', ...extras });
const diario = (itens: ItemDoAviso[]): EmailDiario => ({ para: 'bia@exemplo.com', nome: 'Bia Souza', itens });
const lembrete = (extras: Partial<ItemDoLembrete> = {}): ItemDoLembrete => ({ ...item(extras), id: 'm1', aviso: 'lembrete', antecedencia: 60, hora: '14:00', ...extras });
const lembretes = (itens: ItemDoLembrete[]): EmailDosLembretes => ({ para: 'bia@exemplo.com', nome: 'Bia Souza', itens });
const secao = (itens: ItemDePrazo[] = [], total = itens.length): SecaoDoResumo => ({ total, itens });
const resumo = (extras: Partial<ResumoSemanal> = {}): ResumoSemanal => ({
  id: 'r1', para: 'bia@exemplo.com', nome: 'Bia Souza', semana: '2030-01-18', concluidos: 0, atrasados: secao(), esta_semana: secao(), proxima_semana: secao(), ...extras
});

describe('e-mail diário de prazos', () => {
  it('dado prazos para hoje e para os próximos dias, quando o e-mail é montado, então o assunto conta e o corpo separa os dois', () => {
    // Quando
    const m = emailDiario(diario([aviso({ id: 'a', titulo: 'Contestar' }), aviso({ id: 'b', titulo: 'Emitir a GRU', aviso: 'proximo' }), aviso({ id: 'c', titulo: 'Recorrer', aviso: 'proximo' })]));
    // Então
    expect(m.para).toBe('bia@exemplo.com');
    expect(m.assunto).toBe('Prazos: 1 para hoje, 2 nos próximos dias');
    expect(m.texto.indexOf('Para hoje')).toBeLessThan(m.texto.indexOf('Contestar'));
    expect(m.texto.indexOf('Nos próximos dias')).toBeLessThan(m.texto.indexOf('Emitir a GRU'));
  });

  it('dado só prazos de hoje, quando o e-mail é montado, então o assunto e o corpo não falam dos próximos dias', () => {
    // Quando
    const m = emailDiario(diario([aviso()]));
    // Então
    expect(m.assunto).toBe('Prazos: 1 para hoje');
    expect(m.texto).not.toContain('Nos próximos dias');
  });

  it('dado um compromisso com hora num processo, quando o e-mail é montado, então mostra o tipo, a data, a hora e o link para o cartão', () => {
    // Quando
    const m = emailDiario(diario([aviso({ modulo: 'compromissos', pagina: 'agenda', cartao_id: 'x y', hora: '14:30' })]));
    // Então
    expect(m.texto).toContain('Compromisso · 18/01/2030 às 14:30');
    expect(m.texto).toContain('https://semper.app.br/agenda/?id=x%20y');
  });

  it('dado um título com marcação, quando o e-mail é montado, então no HTML ele vira só texto', () => {
    // Quando
    const m = emailDiario({ ...diario([aviso({ titulo: '<img src=x onerror=alert(1)>' })]), nome: '<b>Bia</b>' });
    // Então
    expect(m.html).not.toContain('<img');
    expect(m.html).not.toContain('<b>Bia');
    expect(m.html).toContain('&lt;img');
  });

  it('dado qualquer e-mail, quando é montado, então diz como desligar', () => {
    // Quando
    const m = emailDiario(diario([aviso()]));
    // Então
    expect(m.texto).toContain('https://semper.app.br/minha-conta/');
  });
});

describe('resumo de sexta-feira', () => {
  it('dado atrasados e prazos da semana seguinte, quando o resumo é montado, então mostra o período, as contas e as seções com itens', () => {
    // Quando
    const m = emailDoResumo(resumo({ concluidos: 3, atrasados: secao([item({ titulo: 'Atrasada' })]), proxima_semana: secao([item({ titulo: 'Futura' }), item({ titulo: 'Outra' })]) }));
    // Então
    expect(m.assunto).toBe('Resumo da semana: 1 atrasado, 2 na próxima semana');
    expect(m.texto).toContain('Semana de 14/01/2030 a 20/01/2030.');
    expect(m.texto).toContain('3 prazos desta semana foram concluídos.');
    expect(m.texto).toContain('Atrasados');
    expect(m.texto).toContain('Na próxima semana');
    expect(m.texto).not.toContain('Ainda nesta semana');
  });

  it('dado mais prazos do que a lista mostra, quando o resumo é montado, então diz quantos faltam', () => {
    // Quando
    const m = emailDoResumo(resumo({ atrasados: secao([item()], 26) }));
    // Então
    expect(m.texto).toContain('E mais 25, no sistema.');
    expect(m.assunto).toBe('Resumo da semana: 26 atrasados');
  });

  it('dado uma semana sem nada pendente, quando o resumo é montado, então o e-mail sai e diz isso', () => {
    // Quando
    const m = emailDoResumo(resumo({ concluidos: 1 }));
    // Então
    expect(m.assunto).toBe('Resumo da semana');
    expect(m.texto).toContain('1 prazo desta semana foi concluído.');
    expect(m.texto).toContain('Você não tem prazos em aberto nesta semana nem na próxima.');
  });
});

describe('e-mail dos lembretes', () => {
  it('dado um lembrete só, quando o e-mail é montado, então o assunto traz o título e o texto diz quando é o prazo e a antecedência', () => {
    // Quando
    const m = emailDoLembrete(lembretes([lembrete({ cartao_id: 'x y' })]));
    // Então
    expect(m.para).toBe('bia@exemplo.com');
    expect(m.assunto).toBe('Lembrete: Emitir a GRU');
    expect(m.texto).toContain('o prazo é 18/01/2030 às 14:00');
    expect(m.texto).toContain('Tarefa · prazo: 18/01/2030 às 14:00 · lembrete: 1 hora antes');
    expect(m.texto).toContain('https://semper.app.br/tarefas/?id=x%20y');
  });

  it('dado vários lembretes na mesma hora, quando o e-mail é montado, então o assunto conta e o corpo lista cada um', () => {
    // Quando
    const m = emailDoLembrete(lembretes([lembrete({ id: 'a', titulo: 'Contestar' }), lembrete({ id: 'b', titulo: 'Recorrer', modulo: 'demandas', pagina: 'demandas', antecedencia: 1440 })]));
    // Então
    expect(m.assunto).toBe('Lembretes: 2 prazos');
    expect(m.texto).toContain('Contestar');
    expect(m.texto).toContain('Demanda · prazo: 18/01/2030 às 14:00 · lembrete: 1 dia antes');
  });

  it.each([[0, 'na hora do prazo'], [30, '30 minutos antes'], [60, '1 hora antes'], [1440, '1 dia antes']] as const)(
    'dado o lembrete de %s minutos, quando o e-mail é montado, então diz "%s"', (antecedencia, texto) => {
      // Quando
      const m = emailDoLembrete(lembretes([lembrete({ antecedencia })]));
      // Então
      expect(m.texto).toContain(`lembrete: ${texto}`);
    });

  it('dado um prazo sem hora, quando o e-mail é montado, então diz que o lembrete conta o prazo às 9h', () => {
    // Quando
    const m = emailDoLembrete(lembretes([lembrete({ hora: null, antecedencia: 0 })]));
    // Então
    expect(m.texto).toContain('prazo: 18/01/2030 (sem hora; o lembrete conta o prazo às 09:00) · lembrete: na hora do prazo');
    expect(m.texto).not.toContain(' às 14:00');
  });

  it('dado um título com marcação, quando o e-mail é montado, então no HTML ele vira só texto, e o e-mail diz como desligar', () => {
    // Quando
    const m = emailDoLembrete({ ...lembretes([lembrete({ titulo: '<img src=x onerror=alert(1)>' })]), nome: '<b>Bia</b>' });
    // Então
    expect(m.html).not.toContain('<img');
    expect(m.html).not.toContain('<b>Bia');
    expect(m.texto).toContain('https://semper.app.br/minha-conta/');
  });
});

describe('envio dos e-mails de prazo', () => {
  beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => {}); });
  afterEach(() => { vi.restoreAllMocks(); });
  const passos = (extras: Partial<PassosDosEmails> = {}) => ({
    diarios: vi.fn<PassosDosEmails['diarios']>(async () => []),
    resumos: vi.fn<PassosDosEmails['resumos']>(async () => []),
    lembretes: vi.fn<PassosDosEmails['lembretes']>(async () => []),
    enviar: vi.fn<PassosDosEmails['enviar']>(async () => {}),
    marcarDiario: vi.fn<PassosDosEmails['marcarDiario']>(async () => {}),
    marcarResumo: vi.fn<PassosDosEmails['marcarResumo']>(async () => {}),
    ...extras
  });

  it('dado e-mails diários devidos, quando a rotina da manhã chama, então envia e marca, e não mexe nos resumos', async () => {
    // Dado
    const p = passos({ diarios: vi.fn(async () => [diario([aviso({ id: 'a' }), aviso({ id: 'b' })])]), resumos: vi.fn(async () => [resumo()]) });
    // Quando
    const feito = await enviarEmailsDePrazo(p, 'diario');
    // Então
    expect(feito).toEqual({ enviados: 1, falhas: 0 });
    expect(p.enviar).toHaveBeenCalledTimes(1);
    expect(p.marcarDiario).toHaveBeenCalledWith(['a', 'b']);
    expect(p.resumos).not.toHaveBeenCalled();
  });

  it('dado resumos devidos, quando a rotina de sexta chama, então envia e marca, e não mexe nos avisos diários', async () => {
    // Dado
    const p = passos({ diarios: vi.fn(async () => [diario([aviso()])]), resumos: vi.fn(async () => [resumo()]) });
    // Quando
    const feito = await enviarEmailsDePrazo(p, 'resumo');
    // Então
    expect(feito).toEqual({ enviados: 1, falhas: 0 });
    expect(p.marcarResumo).toHaveBeenCalledWith('r1');
    expect(p.diarios).not.toHaveBeenCalled();
  });

  it('dado lembretes devidos, quando a rotina de cada minuto chama, então envia e marca como os avisos, e não mexe nos outros e-mails', async () => {
    // Dado
    const p = passos({ lembretes: vi.fn(async () => [lembretes([lembrete({ id: 'a' }), lembrete({ id: 'b' })])]), diarios: vi.fn(async () => [diario([aviso()])]) });
    // Quando
    const feito = await enviarEmailsDePrazo(p, 'lembrete');
    // Então
    expect(feito).toEqual({ enviados: 1, falhas: 0 });
    expect(p.enviar).toHaveBeenCalledWith(expect.objectContaining({ assunto: 'Lembretes: 2 prazos' }));
    expect(p.marcarDiario).toHaveBeenCalledWith(['a', 'b']);
    expect(p.diarios).not.toHaveBeenCalled();
    expect(p.resumos).not.toHaveBeenCalled();
  });

  it('dado um lembrete cujo envio falha, quando a rotina chama, então ele fica sem marca, para a próxima tentativa', async () => {
    // Dado
    const p = passos({ lembretes: vi.fn(async () => [lembretes([lembrete()])]), enviar: vi.fn(async () => { throw new Error('SMTP fora'); }) });
    // Quando
    const feito = await enviarEmailsDePrazo(p, 'lembrete');
    // Então
    expect(feito).toEqual({ enviados: 0, falhas: 1 });
    expect(p.marcarDiario).not.toHaveBeenCalled();
  });

  it('dado um e-mail que saiu e não foi marcado, quando a rotina chama, então conta como falha', async () => {
    // Dado
    const p = passos({ diarios: vi.fn(async () => [diario([aviso()])]), marcarDiario: vi.fn(async () => { throw new Error('banco fora'); }) });
    // Quando
    const feito = await enviarEmailsDePrazo(p, 'diario');
    // Então
    expect(feito).toEqual({ enviados: 0, falhas: 1 });
  });

  it.each([['diario', true], ['resumo', true], ['lembrete', true], ['outro', false], [undefined, false]])('dado o tipo %s, quando a chamada chega, então a validade é %s', (tipo, esperado) => {
    // Então
    expect(tipoDeEnvioValido(tipo)).toBe(esperado);
  });

  it('dado um envio que falha, quando a rotina chama, então só ele fica sem marca e o motivo não leva o endereço aos registros', async () => {
    // Dado
    const enviar = vi.fn<PassosDosEmails['enviar']>(async m => {
      if (m.para === 'ruim@exemplo.com') throw Object.assign(new Error('recusado: ruim@exemplo.com'), { code: 'EENVELOPE' });
    });
    const p = passos({ enviar, diarios: vi.fn(async () => [{ ...diario([aviso({ id: 'ruim' })]), para: 'ruim@exemplo.com' }, diario([aviso({ id: 'boa' })])]) });
    // Quando
    const feito = await enviarEmailsDePrazo(p, 'diario');
    // Então
    expect(feito).toEqual({ enviados: 1, falhas: 1 });
    expect(p.marcarDiario).toHaveBeenCalledTimes(1);
    expect(p.marcarDiario).toHaveBeenCalledWith(['boa']);
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('ruim@exemplo.com');
  });

  it('dado mais e-mails do que cabem numa leva, quando a rotina chama, então não envia todos ao mesmo tempo', async () => {
    // Dado
    let aoMesmoTempo = 0, maior = 0;
    const enviar = vi.fn<PassosDosEmails['enviar']>(async () => {
      maior = Math.max(maior, ++aoMesmoTempo);
      await Promise.resolve();
      aoMesmoTempo--;
    });
    const p = passos({ enviar, diarios: vi.fn(async () => Array.from({ length: 12 }, () => diario([aviso()]))) });
    // Quando
    await enviarEmailsDePrazo(p, 'diario');
    // Então
    expect(enviar).toHaveBeenCalledTimes(12);
    expect(maior).toBeLessThanOrEqual(5);
  });
});
