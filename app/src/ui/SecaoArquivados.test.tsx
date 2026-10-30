// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { iniciarPreferencias } from './preferencias';
import { SecaoArquivados } from './SecaoArquivados';

type Item = { id: string; nome: string };
const MARIA: Item = { id: 'p1', nome: 'MARIA ARQUIVADA' };

function montar() {
  const listar = vi.fn(async () => ({ linhas: [MARIA], total: 1 }));
  const arquivar = vi.fn(async (ids: string[]) => ids.length);
  const excluir = vi.fn(async (ids: string[]) => ({ excluidas: ids.length, naoExcluidas: 0, motivo: '' }));
  const aoMudar = vi.fn();
  render(<SecaoArquivados<Item> modulo="teste" nome={{ um: 'pessoa', varios: 'pessoas', feminino: true }} total={1}
    listar={listar} arquivar={arquivar} excluir={excluir} versao={0} aoMudar={aoMudar}
    tabela={(pagina, _n, selecao) => <ul>{pagina.linhas.map(i => <li key={i.id}><label>
      <input type="checkbox" checked={selecao.selecionadas.has(i.id)} onChange={e => selecao.marcar([i.id], e.target.checked)} />{i.nome}
    </label></li>)}</ul>} />);
  return { listar, arquivar, aoMudar };
}

describe('Seção dos arquivados', () => {
  beforeEach(() => { iniciarPreferencias({}); });

  it('quando a página abre, então a seção vem recolhida, com quantos arquivados há, e a lista ainda não é lida', () => {
    // Quando
    const { listar } = montar();
    // Então
    const titulo = screen.getByRole('button', { name: /^Arquivados/ });
    expect(titulo).toHaveAttribute('aria-expanded', 'false');
    expect(titulo).toHaveTextContent('1');
    expect(listar).not.toHaveBeenCalled();
  });

  it('quando a pessoa abre a seção, marca um arquivado e desarquiva, então ele volta e a página é avisada', async () => {
    // Dado
    const { arquivar, aoMudar } = montar();
    await userEvent.click(screen.getByRole('button', { name: /^Arquivados/ }));
    // Quando
    await userEvent.click(await screen.findByRole('checkbox', { name: 'MARIA ARQUIVADA' }));
    await userEvent.click(screen.getByRole('button', { name: 'Desarquivar' }));
    // Então
    expect(arquivar).toHaveBeenCalledWith(['p1'], false);
    expect(aoMudar).toHaveBeenCalledOnce();
  });
});
