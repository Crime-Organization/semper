// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import { pedirEdicao, type EdicaoAberta, type RespostaAoPedido } from './edicaoUnica';

describe('Uma edição aberta de cada vez (#395)', () => {
  it.each<[string, string, RespostaAoPedido, EdicaoAberta | null]>([
    ['nada aberto', 'prazo', 'abrir', null],
    ['o mesmo aberto, com algo por salvar', 'prazo', 'abrir', { id: 'prazo', sujo: true }],
    ['outro aberto, sem nada por salvar', 'inicio', 'abrir', { id: 'prazo', sujo: false }],
    ['outro aberto, com algo por salvar', 'inicio', 'manter', { id: 'prazo', sujo: true }]
  ])('dado %s, quando a pessoa pede o formulário "%s", então a resposta é "%s"', (_caso, pedida, resposta, aberta) => {
    // Quando
    const r = pedirEdicao(aberta, pedida);
    // Então
    expect(r).toBe(resposta);
  });
});
