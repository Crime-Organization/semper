// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import type { FuncaoNaTarefa } from '../dados/tipos';
import { TAMANHO_FUNCAO_NA_TAREFA } from '../dados/limites';
import {
  avisoDaFuncaoTrocada, comAFuncaoDeQuemEntra, comAFuncaoTrocada, ehAcompanhaDeFabrica, errosDaFuncao, FILTRO_DELEGADAS, FUNCAO_DE_FORA, FUNCAO_REPETIDA, funcaoDe, funcaoEmUso,
  funcoesAoGravar, idsDoFiltroDeFuncao, opcoesDoFiltroDeFuncao, participantesComFuncao, quemTrocouDeFuncao, semAFuncao, temAFuncao
} from './funcoesNaTarefa';

const EXECUTA: FuncaoNaTarefa = { id: 'f-exe', nome: 'Executa', executa: true, ordem: 1 };
const ACOMPANHA: FuncaoNaTarefa = { id: 'f-aco', nome: 'Acompanha', executa: false, ordem: 2 };
const REVISA: FuncaoNaTarefa = { id: 'f-rev', nome: 'Revisa', executa: false, ordem: 3 };
const LISTA = [REVISA, ACOMPANHA, EXECUTA];

describe('Funções dos participantes da tarefa (#313)', () => {
  describe('Dada a lista do escritório', () => {
    it('quando a tarefa é gravada, então cada participante fica com a função escolhida, quem saiu sai e quem entrou sem função fica sem (#421)', () => {
      // Quando: o escritório tem funções que não são de execução, e ainda assim nenhuma é posta sozinha
      const funcoes = funcoesAoGravar(['ana', 'bia', 'caio'], { ana: EXECUTA.id, caio: '', davi: REVISA.id }, LISTA);
      // Então
      expect(funcoes).toEqual({ ana: EXECUTA.id });
    });

    it('quando a função é trocada no menu da bolinha, então fica a nova; "Sem função" tira a função, sem mexer nas outras', () => {
      // Dado
      const atuais = { ana: EXECUTA.id, bia: REVISA.id };
      // Então
      expect(comAFuncaoTrocada(atuais, 'bia', EXECUTA.id)).toEqual({ ana: EXECUTA.id, bia: EXECUTA.id });
      expect(comAFuncaoTrocada(atuais, 'bia', null)).toEqual({ ana: EXECUTA.id });
      expect(comAFuncaoTrocada(undefined, 'ana', null)).toEqual({});
      expect(avisoDaFuncaoTrocada('Bia', 'Executa')).toBe('Bia agora com a função "Executa".');
      expect(avisoDaFuncaoTrocada('Bia', null)).toBe('Bia agora sem função.');
    });

    it('quando o histórico olha as funções, então conta só quem continua na tarefa e trocou, também de e para nenhuma', () => {
      // Dado: a Ana ganha função, a Bia perde a dela, o Caio fica igual e o Davi sai
      const antes = { bia: REVISA.id, caio: EXECUTA.id, davi: EXECUTA.id }, depois = { ana: EXECUTA.id, caio: EXECUTA.id };
      // Então
      expect(quemTrocouDeFuncao(antes, depois, ['ana', 'bia', 'caio'])).toEqual(['ana', 'bia']);
    });

    it('quando a função não é do escritório, então é recusada; a de quem já estava não é conferida de novo', () => {
      // Então
      expect(() => funcoesAoGravar(['ana'], { ana: 'de-fora' }, LISTA)).toThrow(FUNCAO_DE_FORA);
      expect(funcoesAoGravar(['ana'], { ana: 'apagada' }, LISTA, { ana: 'apagada' })).toEqual({ ana: 'apagada' });
    });

    it('quando os filtros leem as funções, então cada participante vira "participante:função", em ordem', () => {
      // Então
      expect(participantesComFuncao({ bia: 'f2', ana: 'f1' })).toEqual(['ana:f1', 'bia:f2']);
    });

    it('quando o cartão mostra a função de alguém, então acha a função pelo id; sem função, nada', () => {
      // Então
      expect(funcaoDe(LISTA, { ana: EXECUTA.id }, 'ana')).toEqual(EXECUTA);
      expect(funcaoDe(LISTA, { ana: EXECUTA.id }, 'bia')).toBeNull();
    });
  });

  describe('O filtro "Função" da lista de tarefas', () => {
    it.each([
      ['', []],
      [FILTRO_DELEGADAS, [EXECUTA.id]],
      [REVISA.id, [REVISA.id]]
    ])('quando o filtro é "%s", então pede as funções %j', (valor, ids) => {
      // Então
      expect(idsDoFiltroDeFuncao(valor, LISTA)).toEqual(ids);
    });

    it('quando a pessoa logada é participante com a função de execução, então a tarefa está entre as delegadas a ela', () => {
      // Dado
      const filtro = { de: 'ana', ids: idsDoFiltroDeFuncao(FILTRO_DELEGADAS, LISTA) };
      // Então
      expect(temAFuncao({ ana: EXECUTA.id }, filtro)).toBe(true);
      expect(temAFuncao({ ana: ACOMPANHA.id, bia: EXECUTA.id }, filtro)).toBe(false);
      expect(temAFuncao(undefined, filtro)).toBe(false);
    });

    it('quando o filtro abre, então oferece "Delegadas a mim" e cada função na ordem da lista; com outra pessoa escolhida, fala dela', () => {
      // Então
      expect(opcoesDoFiltroDeFuncao(LISTA, null)).toEqual([['', 'Qualquer função'], [FILTRO_DELEGADAS, 'Delegadas a mim'],
        [EXECUTA.id, 'Eu como "Executa"'], [ACOMPANHA.id, 'Eu como "Acompanha"'], [REVISA.id, 'Eu como "Revisa"']]);
      expect(opcoesDoFiltroDeFuncao([EXECUTA], 'Ana')).toEqual([['', 'Qualquer função'], [FILTRO_DELEGADAS, 'Delegadas a Ana'], [EXECUTA.id, 'Ana como "Executa"']]);
    });
  });

  describe('O cadastro das funções (Configurações)', () => {
    it.each([
      ['', 'Dê um nome à função.'],
      ['x'.repeat(TAMANHO_FUNCAO_NA_TAREFA.nome + 1), `O nome pode ter até ${TAMANHO_FUNCAO_NA_TAREFA.nome} caracteres.`],
      [' acompanhá ', FUNCAO_REPETIDA]
    ])('quando o nome é "%s", então o formulário avisa', (nome, erro) => {
      // Então
      expect(errosDaFuncao({ nome, executa: false }, LISTA)).toEqual({ nome: erro });
    });

    it('quando a própria função é mudada sem trocar o nome, então não é repetida', () => {
      // Então
      expect(errosDaFuncao({ nome: 'Acompanha', executa: true }, LISTA, ACOMPANHA.id)).toEqual({});
    });

    it('quando a função está em uso, então a recusa diz em quantas tarefas', () => {
      // Então
      expect(funcaoEmUso('Executa', 1)).toBe('A função "Executa" está em 1 tarefa. Troque a função dessas pessoas antes de apagá-la.');
      expect(funcaoEmUso('Executa', 3)).toContain('em 3 tarefas');
    });
  });

  describe('Dada a busca do "+" no cartão da tarefa', () => {
    it('quando alguém entra com a função escolhida, então ela vai junto com as de quem já estava', () => {
      // Quando
      const r = comAFuncaoDeQuemEntra({ 'u-ana': 'f-aco' }, 'u-bruno', 'f-exe');
      // Então
      expect(r).toEqual({ 'u-ana': 'f-aco', 'u-bruno': 'f-exe' });
      expect(comAFuncaoDeQuemEntra(undefined, 'u-bruno', 'f-exe')).toEqual({ 'u-bruno': 'f-exe' });
    });
  });

  describe('A "Acompanha" que vinha de fábrica (#421)', () => {
    it('dada a que veio pronta, com o nome de fábrica e sem ser de execução, então ela sai; renomeada, de execução ou criada pelo escritório, fica', () => {
      // Então
      expect(ehAcompanhaDeFabrica(ACOMPANHA, true)).toBe(true);
      expect(ehAcompanhaDeFabrica({ ...ACOMPANHA, nome: REVISA.nome }, true)).toBe(false);
      expect(ehAcompanhaDeFabrica({ ...ACOMPANHA, executa: true }, true)).toBe(false);
      expect(ehAcompanhaDeFabrica(ACOMPANHA, false)).toBe(false);
    });

    it('quando ela sai, então quem estava com ela fica sem função e os outros ficam como estão', () => {
      // Quando
      const r = semAFuncao({ ana: EXECUTA.id, bia: ACOMPANHA.id }, ACOMPANHA.id);
      // Então
      expect(r).toEqual({ ana: EXECUTA.id });
      expect(semAFuncao(undefined, ACOMPANHA.id)).toEqual({});
    });
  });
});
