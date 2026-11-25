// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// A lista dos papéis do cliente escritos pela equipe (#443): só o que a pessoa escreveu agora vai para a lista do escritório.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PapelEscrito } from '../dados';
import { incluirNaListaDoEscritorio, incluirOEscrito, iniciarPapeisEscritos, lojaDePapeisEscritos } from './papeisEscritos';

const SD = vi.hoisted(() => ({
  processoPapeisEscritos: vi.fn<() => Promise<PapelEscrito[]>>(),
  processoPapeisIncluir: vi.fn<(nomes: string[]) => Promise<void>>()
}));
vi.mock('../dados', () => ({ SD }));

describe('Pôr na lista do escritório o papel escrito (#443)', () => {
  beforeEach(() => {
    SD.processoPapeisEscritos.mockReset().mockResolvedValue([{ id: 'x1', nome: 'Inventariante' }]);
    SD.processoPapeisIncluir.mockReset().mockResolvedValue();
    iniciarPapeisEscritos('u-' + Math.random());
  });

  it('dado um nome escrito agora, quando o processo foi gravado, então ele vai para a lista, e a lista é lida de novo', async () => {
    // Quando
    incluirNaListaDoEscritorio(['Inventariante']);
    // Então
    expect(SD.processoPapeisIncluir).toHaveBeenCalledWith(['Inventariante']);
    await vi.waitFor(() => expect(lojaDePapeisEscritos.ler()).toEqual([{ id: 'x1', nome: 'Inventariante' }]));
  });

  it('dado nenhum nome escrito agora, quando o processo foi gravado, então nada vai para a lista', () => {
    // Quando
    incluirNaListaDoEscritorio([]);
    // Então
    expect(SD.processoPapeisIncluir).not.toHaveBeenCalled();
  });

  it('dado o papel escolhido na pergunta do cartão, quando a pessoa entrou, então só o escrito agora vai para a lista', () => {
    // Quando: escolhido da lista (ou copiado), e depois escrito agora
    incluirOEscrito({ papel: 'outro', escrito: 'Curador' });
    incluirOEscrito({ papel: 'reu' });
    incluirOEscrito(undefined);
    incluirOEscrito({ papel: 'outro', escrito: 'Tutor', escritoAgora: true });
    // Então
    expect(SD.processoPapeisIncluir).toHaveBeenCalledTimes(1);
    expect(SD.processoPapeisIncluir).toHaveBeenCalledWith(['Tutor']);
  });
});
