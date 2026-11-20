// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { describe, expect, it } from 'vitest';
import { EXCLUIR_PELO_MENU, faixaDoArquivado, TOPO_DO_CARTAO, type ModuloDoTopo } from './topoDoCartao';

const MODULOS = Object.keys(TOPO_DO_CARTAO) as ModuloDoTopo[];

describe('O que o topo dos cartões diz (#382)', () => {
  it('dados os seis cartões com o topo comum, então cada um tem os textos', () => {
    // Então
    expect(MODULOS.sort()).toEqual(['compromissos', 'contratos', 'demandas', 'pessoas', 'processos', 'tarefas']);
  });

  describe.each(MODULOS)('Dado o cartão de %s', modulo => {
    const t = TOPO_DO_CARTAO[modulo];

    it('quando o leitor de tela chega ao ⋯, então o nome dele não é o do ⋯ da página ("Mais ações")', () => {
      // Então
      expect(t.menu).toMatch(/^Mais ações d[aeo] \S+$/);
      expect(t.menu).not.toBe('Mais ações');
    });

    it('quando a janela pergunta antes de excluir, então chama o item com o artigo ("a tarefa", "o processo")', () => {
      // Então
      expect(t.oQue).toMatch(/^[ao] \S+$/);
    });

    it('quando quem pode excluir abre o arquivado, então a faixa diz que o Excluir está no menu ⋯', () => {
      // Quando
      const texto = faixaDoArquivado(modulo, true);
      // Então
      expect(texto).toContain(EXCLUIR_PELO_MENU);
      expect(texto).not.toContain('lixeira');
    });

    it('quando quem não pode excluir abre o arquivado, então a faixa diz quem pode, sem mandar ao menu', () => {
      // Quando
      const texto = faixaDoArquivado(modulo, false);
      // Então
      expect(texto).toMatch(/administrador pode excluí-l[ao]\.$/);
      expect(texto).not.toContain(EXCLUIR_PELO_MENU);
    });
  });

  it('dado o contrato arquivado, quando quem pode excluir o lê, então a faixa lembra que o número volta a ser usado', () => {
    // Então
    expect(faixaDoArquivado('contratos', true)).toContain('o número dele volta a ser usado');
  });
});
