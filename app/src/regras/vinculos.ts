// Regras dos vínculos entre pessoas: como cada vínculo aparece em cada uma das duas pessoas
// e quais escolhas o formulário oferece (cada tipo nos dois sentidos).
import type { PessoaResumida, Vinculo, VinculoTipo } from '../dados/tipos';

/** O vínculo visto a partir de uma das pessoas: "Representante legal de" + a outra pessoa. */
export function lerVinculo(v: Vinculo, pessoaId: string): { rotulo: string; outra: PessoaResumida } {
  return v.pessoa_de === pessoaId
    ? { rotulo: v.tipo.nome, outra: v.para }
    : { rotulo: v.tipo.inverso, outra: v.de };
}

/** Escolha do formulário: o tipo e o sentido (quem está aberta é "de" ou "para"). */
export interface OpcaoVinculo { chave: string; tipoId: string; rotulo: string; sentido: 'de' | 'para'; proprio: boolean }

/** Cada tipo vira uma ou duas escolhas: "Pai/mãe de" e "Filho(a) de"; os simétricos ("Cônjuge"), uma só. */
export function opcoesDeVinculo(tipos: VinculoTipo[]): OpcaoVinculo[] {
  return tipos.flatMap(t => {
    const proprio = !!t.escritorio_id;
    const ida: OpcaoVinculo = { chave: `${t.id}:de`, tipoId: t.id, rotulo: t.nome, sentido: 'de', proprio };
    if (t.inverso.trim().toLowerCase() === t.nome.trim().toLowerCase()) return [ida];
    return [ida, { chave: `${t.id}:para`, tipoId: t.id, rotulo: t.inverso, sentido: 'para', proprio }];
  });
}

/** Quem fica em cada ponta, conforme a escolha feita no cartão da pessoa aberta. */
export const pontasDoVinculo = (opcao: OpcaoVinculo, aberta: string, outra: string) =>
  opcao.sentido === 'de' ? { de: aberta, para: outra } : { de: outra, para: aberta };

/** "Outro" pede uma descrição, já que o tipo sozinho não diz nada. */
export const exigeDescricao = (rotulo: string) => /^outro$/i.test(rotulo.trim());
