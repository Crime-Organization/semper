// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import {
  DATAS_VAZIAS, dataAtivaAoAbrir, dataMarcada, datasMudaram, datasQueValem, escolherDia, escreverData, marcarData, podeRemover, removerDatas, resumoDasDatas,
  textoDaData, type CamposDasDatas, type PartesDasDatas
} from './janelaDasDatas';

/** A tarefa: o início obrigatório e a entrega que pode ficar vazia. */
const DA_TAREFA: PartesDasDatas = { inicio: { opcional: false }, entrega: { opcional: true } };
/** Uma tarefa com o início e o prazo, a hora e o lembrete. */
const COM_PRAZO: CamposDasDatas = { ...DATAS_VAZIAS, inicio: '18/11/2026', temInicio: true, entrega: '15/12/2030', temEntrega: true, hora: '14:00', lembrete: 60 };

describe('A janela das datas do cartão (#422)', () => {
  it('dado um item com entrega, quando a janela abre, então o calendário preenche a entrega; sem entrega, o início', () => {
    // Quando / Então
    expect(dataAtivaAoAbrir(DA_TAREFA)).toBe('entrega');
    expect(dataAtivaAoAbrir({ inicio: { opcional: false } })).toBe('inicio');
  });

  it('dada a entrega desmarcada, quando a pessoa escolhe um dia no calendário, então ele vai para a entrega, que fica marcada', () => {
    // Dado
    const sem = { ...COM_PRAZO, entrega: '', temEntrega: false };
    // Quando
    const depois = escolherDia(sem, 'entrega', '2026-11-25');
    // Então
    expect(textoDaData(depois, 'entrega')).toBe('25/11/2026');
    expect(dataMarcada(depois, 'entrega')).toBe(true);
    expect(textoDaData(depois, 'inicio')).toBe('18/11/2026');
  });

  it('quando a pessoa escreve no início, então só o início muda, e fica marcado', () => {
    // Quando
    const depois = escreverData({ ...COM_PRAZO, temInicio: false }, 'inicio', '01/12/2026');
    // Então
    expect(depois).toEqual({ ...COM_PRAZO, inicio: '01/12/2026', temInicio: true });
  });

  it('dada a entrega vazia, quando a pessoa marca a caixa, então ela começa no dia de hoje; desmarcada, o texto fica para voltar', () => {
    // Dado
    const sem = { ...DATAS_VAZIAS, inicio: '18/11/2026', temInicio: true };
    // Quando
    const marcada = marcarData(sem, 'entrega', true, '2026-11-23');
    // Então
    expect(marcada).toMatchObject({ entrega: '23/11/2026', temEntrega: true });
    // Quando: desmarca
    const desmarcada = marcarData(COM_PRAZO, 'entrega', false, '2026-11-23');
    // Então
    expect(desmarcada).toMatchObject({ entrega: '15/12/2030', temEntrega: false });
    expect(marcarData(desmarcada, 'entrega', true, '2026-11-23').entrega).toBe('15/12/2030');
  });

  it('dada a entrega desmarcada, quando a janela confere o que vale, então a entrega, a hora e o lembrete ficam vazios, e o início, obrigatório, fica', () => {
    // Quando
    const vale = datasQueValem({ ...COM_PRAZO, temEntrega: false, temInicio: false }, DA_TAREFA);
    // Então
    expect(vale).toEqual({ ...DATAS_VAZIAS, inicio: '18/11/2026', temInicio: true });
  });

  it('dada a entrega apagada com a hora e o lembrete ainda lá, quando a janela confere o que vale, então eles vão junto com ela', () => {
    // Quando / Então
    expect(datasQueValem({ ...COM_PRAZO, entrega: '' }, DA_TAREFA)).toMatchObject({ entrega: '', hora: '', lembrete: null });
  });

  it('dado um item com prazo, quando a pessoa usa o Remover, então só sai o que pode ficar sem data: a entrega, com a hora e o lembrete', () => {
    // Quando
    const sem = removerDatas(COM_PRAZO, DA_TAREFA);
    // Então
    expect(sem).toEqual({ ...DATAS_VAZIAS, inicio: '18/11/2026', temInicio: true });
    expect(podeRemover(COM_PRAZO, DA_TAREFA)).toBe(true);
    expect(podeRemover(sem, DA_TAREFA)).toBe(false);
    // O compromisso, com a data obrigatória, não tem o que remover
    expect(podeRemover(COM_PRAZO, { entrega: { opcional: false } })).toBe(false);
  });

  it('dado o rascunho, quando só muda o que não vale (o texto de uma data desmarcada), então não conta como mudança', () => {
    // Dado
    const gravado = { ...COM_PRAZO, entrega: '', temEntrega: false, hora: '', lembrete: null };
    // Quando / Então
    expect(datasMudaram({ ...gravado, entrega: '01/01/2031' }, gravado, DA_TAREFA)).toBe(false);
    expect(datasMudaram({ ...gravado, entrega: '01/01/2031', temEntrega: true }, gravado, DA_TAREFA)).toBe(true);
  });

  it('dados os pedaços do resumo, quando o cartão o mostra, então ficam numa linha, com o nome antes do valor', () => {
    // Quando / Então
    expect(resumoDasDatas([{ rotulo: 'Início', valor: '18/11/2026' }, { rotulo: 'Entrega', valor: '15/12/2030 às 14:00' }])).toBe('Início 18/11/2026 · Entrega 15/12/2030 às 14:00');
    expect(resumoDasDatas([{ rotulo: 'Início', valor: '18/11/2026' }, { rotulo: '', valor: 'Sem prazo' }])).toBe('Início 18/11/2026 · Sem prazo');
  });
});
