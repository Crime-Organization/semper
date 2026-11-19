// O cadastro de pessoa aberto a partir de um cartão (#376). Padrão Dado / Quando / Então: app/TESTES.md.
import { describe, expect, it } from 'vitest';
import {
  ACOES_DO_EXISTENTE, AVISO_SEM_ORIGEM, cadastradaNaOrigem, cadastroDePessoaDe, cadastroDePessoaVinculada, cartaoDeOrigem, casoDoExistente,
  existenteNaOrigem, faixaDaOrigem, lerOrigem, naoLigouNaOrigem, TEXTO_DO_EXISTENTE,
  ORIGEM_DA_PESSOA, type OrigemDaPessoa
} from './origemDaPessoa';

const ler = (endereco: string, descricao?: string) => lerOrigem(new URL(endereco, 'http://x').searchParams, descricao);

describe('O endereço do cadastro aberto por um cartão', () => {
  it.each<[Exclude<OrigemDaPessoa, 'vinculos'>, string]>([
    ['demandas', '/pessoas/nova/?demanda=d1'], ['processos', '/pessoas/nova/?processo=d1'], ['tarefas', '/pessoas/nova/?tarefa=d1'],
    ['compromissos', '/pessoas/nova/?compromisso=d1'], ['anotacoes', '/pessoas/nova/?anotacao=d1']
  ])('dado o cartão de %s, quando monta o "+ Nova pessoa", então o endereço é %s, e lido de volta dá a mesma origem', (modulo, endereco) => {
    // Dado / Quando
    const montado = cadastroDePessoaDe(modulo, 'd1');
    // Então
    expect(montado).toBe(endereco);
    expect(ler(montado)).toEqual({ modulo, id: 'd1' });
  });

  it('dado o vínculo escolhido no cartão de uma pessoa, quando monta o endereço, então ele leva a pessoa e o tipo, e a descrição vem à parte', () => {
    // Dado / Quando
    const montado = cadastroDePessoaVinculada('p1', 'tv3:de');
    // Então
    expect(montado).toBe('/pessoas/nova/?vinculo_com=p1&tipo=tv3%3Ade');
    expect(ler(montado, '  sócia administradora ')).toEqual({ modulo: 'vinculos', id: 'p1', tipoDoVinculo: 'tv3:de', descricao: 'sócia administradora' });
    expect(ler(montado, '   ')).toEqual({ modulo: 'vinculos', id: 'p1', tipoDoVinculo: 'tv3:de', descricao: undefined });
  });

  it('dado o vínculo sem o tipo, quando lê o endereço, então não há origem (não haveria como gravar o vínculo)', () => {
    // Dado / Quando / Então
    expect(ler('/pessoas/nova/?vinculo_com=p1')).toBeNull();
  });

  it('dado o cadastro comum (ou a atualização, ?id=), quando lê o endereço, então não há origem', () => {
    // Dado / Quando / Então
    expect(ler('/pessoas/nova/')).toBeNull();
    expect(ler('/pessoas/nova/?id=p1&etapa=c2')).toBeNull();
    expect(ler('/pessoas/nova/?demanda=')).toBeNull();
  });
});

describe('A volta ao cartão de origem', () => {
  it.each<[OrigemDaPessoa, string | null, string]>([
    ['demandas', null, '/demandas/?id=x'], ['tarefas', null, '/tarefas/?id=x'], ['compromissos', null, '/agenda/?id=x'],
    ['anotacoes', null, '/documentos/?id=x'], ['vinculos', null, '/pessoas/?id=x'], ['processos', 'administrativo', '/processos/administrativo/?id=x'],
    ['processos', 'judicial', '/processos/judicial/?id=x']
  ])('dada a origem %s (processo %s), quando termina, então volta a %s', (modulo, tipo, endereco) => {
    // Dado / Quando / Então
    expect(cartaoDeOrigem({ modulo, id: 'x' }, tipo as 'judicial' | 'administrativo' | null)).toBe(endereco);
  });
});

describe('Os textos de cada origem', () => {
  it('dada a demanda de origem, quando o cadastro abre, termina e falha ao ligar, então cada aviso diz onde a pessoa entra', () => {
    // Dado
    const item = 'DM-0001 (Registro de marca)';
    // Quando / Então
    expect(faixaDaOrigem('demandas', item)).toBe('Ao terminar, a pessoa fica ligada como cliente da demanda DM-0001 (Registro de marca), e você volta ao cartão de origem.');
    expect(cadastradaNaOrigem('demandas', item)).toBe('Pessoa cadastrada e ligada como cliente da demanda DM-0001 (Registro de marca).');
    expect(existenteNaOrigem('demandas', item)).toBe('Pessoa já cadastrada, agora ligada como cliente da demanda DM-0001 (Registro de marca).');
    expect(naoLigouNaOrigem('demandas', item, 'Esta lista já está cheia.')).toBe('A pessoa foi cadastrada, mas não ficou ligada como cliente da demanda DM-0001 (Registro de marca). Esta lista já está cheia.');
  });

  it('dado o vínculo de origem, quando a pessoa é cadastrada, então o aviso diz o vínculo como ele aparece no cartão dela', () => {
    // Dado / Quando / Então
    expect(cadastradaNaOrigem('vinculos', 'Filho(a) de MARIA')).toBe('Pessoa cadastrada e vinculada: Filho(a) de MARIA.');
  });

  it('dada cada origem, quando monta os botões da seção, então o de baixo é curto e o "+" do título diz onde a pessoa entra', () => {
    // Dado / Quando / Então
    for (const d of Object.values(ORIGEM_DA_PESSOA)) {
      expect(d.novo).toMatch(/^Nova pessoa/);
      expect(d.novoNoTitulo.startsWith(d.novo)).toBe(true);
    }
  });
});

describe('O cadastro aberto por um cartão que segue sem ligar', () => {
  it('dado o item de origem não achado ou arquivado, quando o cadastro abre, então a faixa diz por que a pessoa será cadastrada sem ligação', () => {
    // Dado / Quando / Então
    expect(AVISO_SEM_ORIGEM.sumiu).toBe('O item de onde este cadastro foi aberto não foi encontrado: a pessoa será cadastrada sem ligação.');
    expect(AVISO_SEM_ORIGEM.arquivada).toBe('O item de onde este cadastro foi aberto está arquivado: a pessoa será cadastrada sem ligação.');
  });
});

describe('A janela "Cadastro já existente"', () => {
  const valores = (caso: Parameters<typeof casoDoExistente>) => ACOES_DO_EXISTENTE[casoDoExistente(...caso)].map(a => a.valor);
  const principal = (caso: Parameters<typeof casoDoExistente>) => ACOES_DO_EXISTENTE[casoDoExistente(...caso)].find(a => a.tipo === 'pri')!.rotulo;

  it('dado o cadastro comum, quando o CPF já existe (ativo ou arquivado), então oferece ver, cancelar e atualizar, como antes', () => {
    // Dado / Quando / Então
    expect(casoDoExistente(false, false)).toBe('semOrigem');
    expect(casoDoExistente(false, true)).toBe('semOrigem');
    expect(valores([false, false])).toEqual(['ver', null, 'atualizar']);
    expect(principal([false, false])).toBe('Atualizar este cadastro');
  });

  it('dado o cadastro aberto por um cartão, quando a pessoa achada está ativa, então ligar como está é o principal, e atualizar também liga', () => {
    // Dado / Quando
    const caso = casoDoExistente(true, false);
    // Então
    expect(caso).toBe('comOrigem');
    expect(valores([true, false])).toEqual([null, 'atualizar', 'ligar']);
    expect(principal([true, false])).toBe('Ligar esta pessoa');
    expect(TEXTO_DO_EXISTENTE[caso]('ligada à tarefa X', false)[0]).toBe('Você pode ligar essa pessoa como ela está: ela fica ligada à tarefa X.');
  });

  it('dado o cadastro aberto por um cartão, quando a pessoa achada está arquivada, então não há "ligar": só atualizar, que a devolve às ativas e liga', () => {
    // Dado / Quando
    const caso = casoDoExistente(true, true);
    // Então
    expect(caso).toBe('comOrigemArquivada');
    expect(valores([true, true])).toEqual([null, 'atualizar']);
    expect(principal([true, true])).toBe('Atualizar e ligar');
    expect(TEXTO_DO_EXISTENTE[caso]('ligada à tarefa X', true).join(' ')).toMatch(/volta para as ativas e, ao salvar, a pessoa fica ligada à tarefa X\./);
  });

  it('dado cada caso, quando monta a janela, então há um só botão principal', () => {
    // Dado / Quando / Então
    for (const acoes of Object.values(ACOES_DO_EXISTENTE)) expect(acoes.filter(a => a.tipo === 'pri')).toHaveLength(1);
  });
});
