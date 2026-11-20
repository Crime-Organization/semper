// A equipe do contrato mudada no topo do cartão (#356). Padrão Dado / Quando / Então: app/TESTES.md.
import { describe, expect, it } from 'vitest';
import { PARTICIPANTES_MAXIMOS } from '../dados/limites';
import { PARTICIPANTES_DEMAIS } from './contrato';
import {
  AVISO_NO_CONTRATO, desfazerNoContrato, equipeDoContrato, FICARIA_FORA, IMPEDIMENTO_NO_CONTRATO, MUDANCAS_NO_CONTRATO, PERCENTUAL_DE_QUEM_ENTRA, planoNoContrato, tirarDoContrato,
  type EquipeDoContratoGravada
} from './equipeDoContrato';

/** Um contrato do Bruno (usuário u-bruno), cadastrado pela Ana, com os participantes dados (pessoa e %). */
const contrato = (participantes: [string, number | null][] = [], mais: Partial<EquipeDoContratoGravada> = {}): EquipeDoContratoGravada => ({
  criado_por: 'u-ana', responsavel_id: 'u-bruno', indicador_id: null,
  participantes: participantes.map(([pessoa_id, percentual]) => ({ pessoa_id, percentual })), ...mais
});
const administrador = { id: 'u-master', pessoa_id: 'p-master', papel: 'master' };
const participanteComum = { id: 'u-carla', pessoa_id: 'p-carla', papel: 'usuario' };
const responsavelComum = { id: 'u-bruno', pessoa_id: 'p-bruno', papel: 'usuario' };

describe('Pôr alguém no contrato pelo "+"', () => {
  it('dado um contrato com um participante de 10%, quando põe a Ana, então ela entra no fim com 0% e o outro fica com os 10% dele', () => {
    // Dado / Quando
    const r = MUDANCAS_NO_CONTRATO.por(contrato([['p-bruno', 10]]), 'p-ana', 'Ana');
    // Então
    expect(r).toEqual({ gravar: { participantes: [{ pessoa_id: 'p-bruno', percentual: 10 }, { pessoa_id: 'p-ana', percentual: 0 }] } });
    expect(PERCENTUAL_DE_QUEM_ENTRA).toBe(0);
  });

  it('dada a Ana já participante (alguém a pôs com a busca aberta), quando é posta de novo, então avisa e não grava', () => {
    // Dado / Quando / Então
    expect(MUDANCAS_NO_CONTRATO.por(contrato([['p-ana', 5]]), 'p-ana', 'Ana')).toEqual({ aviso: 'Ana já participa do contrato.', tipo: 'info' });
  });

  it('dado o indicador do contrato, quando é posto como participante, então recusa, como o lápis', () => {
    // Dado / Quando / Então
    expect(MUDANCAS_NO_CONTRATO.por(contrato([], { indicador_id: 'p-ana' }), 'p-ana', 'Ana'))
      .toEqual({ aviso: 'Ana é o indicador deste contrato, e o indicador não pode ser também participante.', tipo: 'erro' });
  });

  it('dado o contrato com o máximo de participantes, quando põe mais um, então recusa com o máximo do banco', () => {
    // Dado
    const cheio = contrato(Array.from({ length: PARTICIPANTES_MAXIMOS }, (_, i) => ['p' + i, 1] as [string, number]));
    // Quando / Então
    expect(MUDANCAS_NO_CONTRATO.por(cheio, 'p-novo', 'Novo')).toEqual({ aviso: PARTICIPANTES_DEMAIS, tipo: 'erro' });
  });
});

describe('Tirar alguém do contrato pela bolinha', () => {
  it('dados dois participantes, quando tira o primeiro, então o outro fica com o % dele', () => {
    // Dado / Quando / Então
    expect(MUDANCAS_NO_CONTRATO.tirar(contrato([['p-ana', 10], ['p-bruno', 5]]), 'p-ana', 'Ana'))
      .toEqual({ gravar: { participantes: [{ pessoa_id: 'p-bruno', percentual: 5 }] } });
  });

  it('dada a Ana já tirada por outra pessoa, quando é tirada de novo, então avisa e não grava', () => {
    // Dado / Quando / Então
    expect(MUDANCAS_NO_CONTRATO.tirar(contrato(), 'p-ana', 'Ana')).toEqual({ aviso: 'Ana já não participava do contrato.', tipo: 'info' });
  });
});

describe('Trocar o responsável do contrato pela bolinha', () => {
  it('dado o contrato do Bruno com participantes, quando a Ana passa a responder, então só o responsável muda', () => {
    // Dado / Quando / Então
    expect(MUDANCAS_NO_CONTRATO.responsavel(contrato([['p-ana', 10]]), 'u-ana', 'Ana')).toEqual({ gravar: { responsavel_id: 'u-ana' } });
  });

  it('dado o Bruno já responsável, quando é escolhido de novo, então avisa e não grava', () => {
    // Dado / Quando / Então
    expect(MUDANCAS_NO_CONTRATO.responsavel(contrato(), 'u-bruno', 'Bruno'))
      .toEqual({ aviso: 'Bruno já é o advogado responsável pelo contrato.', tipo: 'info' });
  });
});

describe('Quem grava e ficaria fora do contrato', () => {
  it('dado um participante comum, quando se tira pela própria bolinha, então recusa antes de gravar, porque deixaria de poder alterar o contrato', () => {
    // Dado / Quando
    const r = planoNoContrato({ tipo: 'tirar', id: 'p-carla', nome: 'Carla' }, contrato([['p-carla', 10]]), participanteComum);
    // Então
    expect(r).toEqual({ aviso: FICARIA_FORA.tirar, tipo: 'erro' });
  });

  it('dado o responsável comum, quando passa o contrato a outro advogado, então recusa e diz como fazer', () => {
    // Dado / Quando
    const r = planoNoContrato({ tipo: 'responsavel', id: 'u-ana', nome: 'Ana' }, contrato(), responsavelComum);
    // Então
    expect(r).toEqual({ aviso: FICARIA_FORA.responsavel, tipo: 'erro' });
  });

  it('dado o responsável comum que também participa, quando passa o contrato a outro advogado, então grava: ele continua no contrato', () => {
    // Dado / Quando
    const r = planoNoContrato({ tipo: 'responsavel', id: 'u-ana', nome: 'Ana' }, contrato([['p-bruno', 0]]), responsavelComum);
    // Então
    expect(r).toEqual({ gravar: { responsavel_id: 'u-ana' } });
  });

  it('dado um administrador participante, quando se tira, então grava: ele continua vendo o contrato', () => {
    // Dado / Quando
    const r = planoNoContrato({ tipo: 'tirar', id: 'p-master', nome: 'Mauro' }, contrato([['p-master', 10]]), administrador);
    // Então
    expect(r).toEqual({ gravar: { participantes: [] } });
  });

  it('dado quem cadastrou o contrato e participa dele, quando se tira, então grava', () => {
    // Dado
    const quemCadastrou = { id: 'u-ana', pessoa_id: 'p-ana', papel: 'usuario' };
    // Quando
    const r = planoNoContrato({ tipo: 'tirar', id: 'p-ana', nome: 'Ana' }, contrato([['p-ana', 10]]), quemCadastrou);
    // Então
    expect(r).toEqual({ gravar: { participantes: [] } });
  });

  it('dado um participante comum, quando tira outro participante, então grava', () => {
    // Dado / Quando
    const r = planoNoContrato({ tipo: 'tirar', id: 'p-ana', nome: 'Ana' }, contrato([['p-carla', 10], ['p-ana', 5]]), participanteComum);
    // Então
    expect(r).toEqual({ gravar: { participantes: [{ pessoa_id: 'p-carla', percentual: 10 }] } });
  });

  it('dado o aviso de que já estava assim, quando o plano é feito, então o aviso vem antes da conferência de quem fica', () => {
    // Dado / Quando / Então
    expect(planoNoContrato({ tipo: 'tirar', id: 'p-carla', nome: 'Carla' }, contrato(), participanteComum))
      .toEqual({ aviso: 'Carla já não participava do contrato.', tipo: 'info' });
  });
});

describe('A bolinha que já vem desligada, antes do clique', () => {
  it('dado um participante comum, quando a própria bolinha aparece, então vem desligada com o motivo de não poder sair; a de outro participante, não', () => {
    // Dado
    const k = contrato([['p-carla', 10], ['p-ana', 5]]);
    // Quando / Então
    expect(IMPEDIMENTO_NO_CONTRATO.tirar(k, 'p-carla', participanteComum)).toBe(FICARIA_FORA.tirar);
    expect(IMPEDIMENTO_NO_CONTRATO.tirar(k, 'p-ana', participanteComum)).toBeUndefined();
  });

  it('dados um administrador e quem cadastrou o contrato, quando as próprias bolinhas aparecem, então podem sair', () => {
    // Dado
    const k = contrato([['p-master', 10], ['p-ana', 5]]);
    // Quando / Então
    expect(IMPEDIMENTO_NO_CONTRATO.tirar(k, 'p-master', administrador)).toBeUndefined();
    expect(IMPEDIMENTO_NO_CONTRATO.tirar(k, 'p-ana', { id: 'u-ana', pessoa_id: 'p-ana', papel: 'usuario' })).toBeUndefined();
  });

  it('dado o responsável comum que não participa, quando a bolinha dele aparece, então vem desligada com o motivo; participando, não', () => {
    // Dado / Quando / Então
    expect(IMPEDIMENTO_NO_CONTRATO.responsavel(contrato(), responsavelComum)).toBe(FICARIA_FORA.responsavel);
    expect(IMPEDIMENTO_NO_CONTRATO.responsavel(contrato([['p-bruno', 0]]), responsavelComum)).toBeUndefined();
  });

  it('dado um participante comum, quando a bolinha do responsável aparece, então ele pode trocar o responsável: continua participando', () => {
    // Dado / Quando / Então
    expect(IMPEDIMENTO_NO_CONTRATO.responsavel(contrato([['p-carla', 10]]), participanteComum)).toBeUndefined();
  });

  it('dados os motivos de não poder sair, quando aparecem, então falam em deixar de alterar o contrato, e não em deixar de vê-lo (quem foi mencionado continua vendo)', () => {
    // Dado / Quando / Então
    Object.values(FICARIA_FORA).forEach(m => expect(m).toMatch(/deixaria de poder alterá-lo/));
  });
});

describe('Desfazer a mudança na equipe do contrato', () => {
  it('dada a Ana posta com 0%, quando desfaz, então ela sai e quem entrou depois fica', () => {
    // Dado
    const antes = contrato([['p-bruno', 10]]), atual = contrato([['p-bruno', 10], ['p-ana', 0], ['p-carla', 0]]);
    // Quando / Então
    expect(desfazerNoContrato({ tipo: 'por', id: 'p-ana', nome: 'Ana' }, antes, atual))
      .toEqual({ participantes: [{ pessoa_id: 'p-bruno', percentual: 10 }, { pessoa_id: 'p-carla', percentual: 0 }] });
  });

  it('dada a Ana posta e já tirada por outra pessoa, quando desfaz, então não há o que voltar', () => {
    // Dado / Quando / Então
    expect(desfazerNoContrato({ tipo: 'por', id: 'p-ana', nome: 'Ana' }, contrato(), contrato())).toBeNull();
  });

  it('dada a Ana tirada do meio da lista, quando desfaz, então ela volta ao mesmo lugar e com o % de antes', () => {
    // Dado
    const antes = contrato([['p-bruno', 10], ['p-ana', 15], ['p-carla', 5]]), atual = contrato([['p-bruno', 10], ['p-carla', 5]]);
    // Quando / Então
    expect(desfazerNoContrato({ tipo: 'tirar', id: 'p-ana', nome: 'Ana' }, antes, atual)).toEqual({ participantes: [
      { pessoa_id: 'p-bruno', percentual: 10 }, { pessoa_id: 'p-ana', percentual: 15 }, { pessoa_id: 'p-carla', percentual: 5 }] });
  });

  it('dada a Ana tirada e a lista encurtada por outra pessoa, quando desfaz, então ela volta no fim', () => {
    // Dado
    const antes = contrato([['p-bruno', 10], ['p-carla', 5], ['p-ana', 15]]), atual = contrato([['p-bruno', 10]]);
    // Quando / Então
    expect(desfazerNoContrato({ tipo: 'tirar', id: 'p-ana', nome: 'Ana' }, antes, atual))
      .toEqual({ participantes: [{ pessoa_id: 'p-bruno', percentual: 10 }, { pessoa_id: 'p-ana', percentual: 15 }] });
  });

  it('dada a Ana tirada e posta de volta por outra pessoa, quando desfaz, então não há o que voltar', () => {
    // Dado / Quando / Então
    expect(desfazerNoContrato({ tipo: 'tirar', id: 'p-ana', nome: 'Ana' }, contrato([['p-ana', 15]]), contrato([['p-ana', 0]]))).toBeNull();
  });

  it('dada a Ana tirada e virada indicadora depois, quando desfaz, então recusa com o motivo', () => {
    // Dado / Quando
    const r = desfazerNoContrato({ tipo: 'tirar', id: 'p-ana', nome: 'Ana' }, contrato([['p-ana', 15]]), contrato([], { indicador_id: 'p-ana' }));
    // Então
    expect(r).toEqual({ aviso: 'Ana é o indicador deste contrato, e o indicador não pode ser também participante.' });
  });

  it('dado o responsável trocado, quando desfaz, então o de antes volta; trocado de novo depois, não há o que voltar', () => {
    // Dado
    const pedido = { tipo: 'responsavel' as const, id: 'u-ana', nome: 'Ana' };
    // Quando / Então
    expect(desfazerNoContrato(pedido, contrato(), contrato([], { responsavel_id: 'u-ana' }))).toEqual({ responsavel_id: 'u-bruno' });
    expect(desfazerNoContrato(pedido, contrato(), contrato([], { responsavel_id: 'u-master' }))).toBeNull();
  });
});

// A regra mudou (#388, pedido do dono): a bolinha abre um menu com o nome e o papel (com o %) no alto, e o "Tirar" do menu não os
// repete.
describe('Tornar responsável um participante do contrato (#388)', () => {
  /** A pessoa do cadastro de cada usuário: o Bruno tem a p-bruno; o Davi, sem cadastro em Pessoas. */
  const pessoaDe = (perfilId: string) => ({ 'u-bruno': 'p-bruno', 'u-ana': 'p-ana', 'u-carla': 'p-carla' } as Record<string, string>)[perfilId] ?? null;
  const tornarAna = { tipo: 'tornarResponsavel' as const, id: 'u-ana', nome: 'Ana' };

  it('dada a Ana participante com 10%, quando passa a responder, então ela continua com os 10% e o Bruno, de antes, entra com 0%', () => {
    // Dado / Quando / Então
    expect(MUDANCAS_NO_CONTRATO.tornarResponsavel(contrato([['p-ana', 10]]), 'u-ana', 'Ana', pessoaDe))
      .toEqual({ gravar: { responsavel_id: 'u-ana', participantes: [{ pessoa_id: 'p-ana', percentual: 10 }, { pessoa_id: 'p-bruno', percentual: 0 }] } });
  });

  it('dado o Bruno já participante, quando a Ana passa a responder, então os participantes e os % ficam como estão', () => {
    // Dado / Quando / Então
    expect(MUDANCAS_NO_CONTRATO.tornarResponsavel(contrato([['p-ana', 10], ['p-bruno', 5]]), 'u-ana', 'Ana', pessoaDe)).toEqual({ gravar: { responsavel_id: 'u-ana' } });
  });

  it('dada a lista de participantes cheia, quando a Ana passa a responder, então recusa (o Bruno não teria lugar)', () => {
    // Dado
    const cheio = contrato([['p-ana', 1], ...Array.from({ length: PARTICIPANTES_MAXIMOS - 1 }, (_, i): [string, number] => ['p' + i, 1])]);
    // Quando / Então
    expect(MUDANCAS_NO_CONTRATO.tornarResponsavel(cheio, 'u-ana', 'Ana', pessoaDe)).toEqual({ aviso: PARTICIPANTES_DEMAIS, tipo: 'erro' });
  });

  it('dado o Bruno, responsável comum sem cadastro em Pessoas, quando torna a Ana responsável, então recusa: ele ficaria fora do contrato', () => {
    // Dado
    const semCadastro = { ...responsavelComum, pessoa_id: null };
    const atual = contrato([['p-ana', 10]], { criado_por: 'u-master' });
    // Quando / Então
    expect(planoNoContrato(tornarAna, atual, semCadastro, () => null)).toEqual({ aviso: FICARIA_FORA.tornarResponsavel, tipo: 'erro' });
    expect(IMPEDIMENTO_NO_CONTRATO.tornarResponsavel(atual, 'u-ana', semCadastro, () => null)).toBe(FICARIA_FORA.tornarResponsavel);
    // Com o cadastro, ele continua como participante, e pode.
    expect(IMPEDIMENTO_NO_CONTRATO.tornarResponsavel(atual, 'u-ana', responsavelComum, pessoaDe)).toBeUndefined();
  });

  it('dada a Ana que passou a responder, quando desfaz, então o Bruno volta a responder e sai dos participantes, onde entrou por isso', () => {
    // Dado
    const antes = contrato([['p-ana', 10]]);
    const depois = contrato([['p-ana', 10], ['p-bruno', 0]], { responsavel_id: 'u-ana' });
    // Quando / Então
    expect(desfazerNoContrato(tornarAna, antes, depois, pessoaDe)).toEqual({ responsavel_id: 'u-bruno', participantes: [{ pessoa_id: 'p-ana', percentual: 10 }] });
    // Dado o Bruno, que já participava antes: ele fica.
    expect(desfazerNoContrato(tornarAna, contrato([['p-ana', 10], ['p-bruno', 5]]), contrato([['p-ana', 10], ['p-bruno', 5]], { responsavel_id: 'u-ana' }), pessoaDe))
      .toEqual({ responsavel_id: 'u-bruno' });
    // Dado o responsável trocado de novo depois: não há o que voltar.
    expect(desfazerNoContrato(tornarAna, antes, contrato([], { responsavel_id: 'u-master' }), pessoaDe)).toBeNull();
  });

  it('quando a Ana passa a responder, então o aviso diz que quem respondia continua no contrato', () => {
    // Então
    expect(AVISO_NO_CONTRATO.tornarResponsavel('Ana')).toBe('Advogado responsável pelo contrato: Ana. Quem respondia antes continua no contrato como participante.');
  });
});

describe('As palavras das bolinhas do contrato', () => {
  it('quando a bolinha é de outra pessoa, então o menu tira do contrato; quando é a própria, então sai do contrato', () => {
    // Dado / Quando / Então
    expect(tirarDoContrato({ id: 'u-ana' }, 'u-master')).toBe('Tirar do contrato');
    expect(tirarDoContrato({ id: 'u-ana' }, 'u-ana')).toBe('Sair do contrato');
  });

  it('quando alguém entra pelo "+", então o aviso diz que ele está com 0% e onde mudar o %', () => {
    // Dado / Quando / Então
    expect(AVISO_NO_CONTRATO.por('Ana')).toBe('Ana agora participa do contrato, com 0% na divisão. O % se muda em Editar.');
  });

  it('dado um contrato lido do banco, quando vira a equipe gravada, então os participantes vêm pela pessoa, com o %', () => {
    // Dado
    const k = { criado_por: 'u-ana', responsavel_id: 'u-bruno', indicador_id: 'p-ind',
      participantes: [{ pessoa: { id: 'p-ana', nome: 'ANA', codigo: '1', tipo: 'pf' as const }, percentual: 10 }] };
    // Quando / Então
    expect(equipeDoContrato(k))
      .toEqual({ criado_por: 'u-ana', responsavel_id: 'u-bruno', indicador_id: 'p-ind', participantes: [{ pessoa_id: 'p-ana', percentual: 10 }] });
  });
});
