// Para onde o cadastro volta depois de gravar (#376). Padrão Dado / Quando / Então: app/TESTES.md.
import { describe, expect, it } from 'vitest';
import { cadastroComVolta, cartaoDeOrigem } from './origemDoCadastro';

/** O endereço que o "+ Novo …" da seção abre, lido como o cadastro lê. */
const doNovo = (busca: string) => new URLSearchParams(busca + '&volta=cartao');
const sempreLigada = () => true;

describe('O endereço do "+ Novo …" de uma seção', () => {
  it('dado a origem e o id, quando monta o endereço, então ele leva a origem e a marca da volta', () => {
    // Dado / Quando
    const endereco = cadastroComVolta('/processos/novo/', 'demanda', 'd 1');
    // Então
    expect(endereco).toBe('/processos/novo/?demanda=d+1&volta=cartao');
  });

  it('dado o endereço montado, quando o cadastro grava, então volta ao cartão da origem', () => {
    // Dado
    const params = new URLSearchParams(cadastroComVolta('/contratos/novo/', 'cliente', 'p1').split('?')[1]);
    // Quando / Então
    expect(cartaoDeOrigem(params, { cliente: sempreLigada })).toBe('/pessoas/?id=p1');
  });
});

describe('O cartão de onde o cadastro foi aberto', () => {
  it('dado o cadastro aberto pelo cartão da pessoa (?cliente=), quando grava com ela entre os clientes, então volta ao cartão dela', () => {
    // Dado
    const params = doNovo('cliente=p1');
    // Quando / Então
    expect(cartaoDeOrigem(params, { cliente: id => ['p1', 'p2'].includes(id) })).toBe('/pessoas/?id=p1');
  });

  it('dado o cadastro aberto pelo cartão da demanda (?demanda=), quando grava e liga, então volta ao cartão dela', () => {
    // Dado
    const params = doNovo('demanda=d1');
    // Quando / Então
    expect(cartaoDeOrigem(params, { demanda: sempreLigada, cliente: sempreLigada })).toBe('/demandas/?id=d1');
  });

  it('dado o endereço com duas origens, quando grava, então vale a primeira da ordem pedida', () => {
    // Dado
    const params = doNovo('cliente=p1&demanda=d1');
    // Quando / Então
    expect(cartaoDeOrigem(params, { demanda: sempreLigada, cliente: sempreLigada })).toBe('/demandas/?id=d1');
    expect(cartaoDeOrigem(params, { cliente: sempreLigada, demanda: sempreLigada })).toBe('/pessoas/?id=p1');
  });

  it('dado o cadastro aberto sem origem (ou com uma que este cadastro não aceita), quando grava, então não há cartão de origem', () => {
    // Dado / Quando / Então
    expect(cartaoDeOrigem(doNovo(''), { cliente: sempreLigada })).toBeNull();
    expect(cartaoDeOrigem(doNovo('demanda=d1'), { cliente: sempreLigada })).toBeNull();
    expect(cartaoDeOrigem(doNovo('cliente='), { cliente: sempreLigada })).toBeNull();
  });

  it('dado o cadastro aberto sem a marca da volta (o "Criar o processo?" da demanda concluída), quando grava, então segue para o item novo', () => {
    // Dado
    const params = new URLSearchParams('demanda=d1');
    // Quando / Então
    expect(cartaoDeOrigem(params, { demanda: sempreLigada })).toBeNull();
    expect(cartaoDeOrigem(new URLSearchParams('demanda=d1&volta=outra'), { demanda: sempreLigada })).toBeNull();
  });

  it('dado que a pessoa trocou o cliente que veio pronto, quando grava, então não volta ao cartão dela, onde o item não aparece', () => {
    // Dado
    const params = doNovo('cliente=p1');
    const gravados = ['p9'];
    // Quando / Então
    expect(cartaoDeOrigem(params, { cliente: id => gravados.includes(id) })).toBeNull();
  });

  it('dado uma demanda que não existe ou uma ligação que falhou, quando grava, então não volta à demanda', () => {
    // Dado
    const params = doNovo('demanda=nao-existe');
    // Quando / Então
    expect(cartaoDeOrigem(params, { demanda: () => false, cliente: sempreLigada })).toBeNull();
  });

  it('dado a primeira origem que não ficou ligada e a segunda que ficou, quando grava, então volta à segunda', () => {
    // Dado
    const params = doNovo('demanda=d1&cliente=p1');
    // Quando / Então
    expect(cartaoDeOrigem(params, { demanda: () => false, cliente: sempreLigada })).toBe('/pessoas/?id=p1');
  });
});
