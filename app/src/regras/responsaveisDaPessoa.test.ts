// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import { AVISO_NOS_RESPONSAVEIS, tirarDosResponsaveis } from './responsaveisDaPessoa';

describe('Responsáveis da pessoa no topo do cartão (#387)', () => {
  // A regra mudou (#388): a bolinha abre um menu com o nome no alto, e o "Tirar" do menu não repete o nome.
  it('dada a bolinha de outra pessoa da equipe, quando o menu abre, então o "Tirar" diz que tira a pessoa dos responsáveis', () => {
    // Quando
    const texto = tirarDosResponsaveis({ id: 'u-ana' }, 'u-bruno');
    // Então
    expect(texto).toBe('Tirar dos responsáveis');
  });

  it('dada a bolinha de quem está logado, quando o menu abre, então o "Tirar" diz que ele deixa de ser responsável', () => {
    // Quando
    const texto = tirarDosResponsaveis({ id: 'u-ana' }, 'u-ana');
    // Então
    expect(texto).toBe('Deixar de ser responsável');
  });

  it('quando alguém é posto ou tirado, então o aviso diz o que aconteceu e o Desfazer tem o nome da mudança', () => {
    // Então
    expect(AVISO_NOS_RESPONSAVEIS.por.texto('Ana Teste Lima')).toBe('Ana Teste Lima agora é responsável.');
    expect(AVISO_NOS_RESPONSAVEIS.por.oQue).toBe('inclusão do responsável');
    expect(AVISO_NOS_RESPONSAVEIS.tirar.texto('Ana Teste Lima')).toBe('Ana Teste Lima saiu dos responsáveis.');
    expect(AVISO_NOS_RESPONSAVEIS.tirar.oQue).toBe('retirada do responsável');
  });
});
