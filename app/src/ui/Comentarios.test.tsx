// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Comentario, DadosComentarios, Membro } from '../dados';
import { SecaoComentarios } from './Comentarios';
import { iniciarPreferencias } from './preferencias';

// A seção usa só as operações de comentários; o mock declara exatamente essas.
const SD = vi.hoisted(() => ({
  comentariosListar: vi.fn<DadosComentarios['comentariosListar']>(), comentarioCriar: vi.fn<DadosComentarios['comentarioCriar']>(),
  comentarioEditar: vi.fn<DadosComentarios['comentarioEditar']>(), comentarioExcluir: vi.fn<DadosComentarios['comentarioExcluir']>()
}));
vi.mock('../dados', () => ({ SD: SD satisfies DadosComentarios }));
// Quem está logado é o Mateus; se é administrador, cada caso diz.
const sessao = vi.hoisted(() => ({ ehAdmin: false }));
const EQUIPE: Membro[] = [
  { id: 'u-mateus', nome: 'Mateus Freitas Gonçalves', usuario: 'mateus.goncalves', funcao: 'advogado', ativo: true },
  { id: 'u-ana', nome: 'Ana Teste Lima', usuario: 'ana.lima', funcao: 'advogado', ativo: true },
  { id: 'u-bruno', nome: 'Bruno Exemplo Souza', usuario: 'bruno.souza', funcao: 'estagiario', ativo: true }
];
vi.mock('./sessao', () => ({ useCtx: () => ({ perfil: { id: 'u-mateus' }, equipe: EQUIPE, ehAdmin: sessao.ehAdmin }) }));

const comentario = (id: string, autor: string, texto: string, criado_em: string): Comentario =>
  ({ id, autor_id: autor, texto, mencoes: [], criado_em, editado_em: null });
const caixa = () => screen.getByRole('textbox', { name: 'Escrever um comentário' });

describe('Comentários do cartão', () => {
  beforeEach(() => {
    // Dado que a pessoa deixou a seção de comentários aberta (toda seção começa recolhida; a escolha fica guardada).
    iniciarPreferencias({ 'cartao.comentarios': true });
    sessao.ehAdmin = false;
    Object.values(SD).forEach(f => f.mockReset());
    SD.comentariosListar.mockResolvedValue([
      comentario('c2', 'u-ana', 'Falei com @mateus.goncalves', '2026-10-29T15:00:00Z'),
      comentario('c1', 'u-mateus', 'Primeiro contato', '2026-10-28T15:00:00Z')
    ]);
  });

  it('quando o cartão abre, então os comentários vêm na ordem do banco, com o autor e a menção destacada', async () => {
    // Quando
    render(<SecaoComentarios modulo="pessoas" cartaoId="p1" />);
    // Então
    const itens = await screen.findAllByRole('listitem', { name: /Comentário de/ });
    expect(itens.map(i => i.getAttribute('aria-label'))).toEqual(['Comentário de Ana Teste Lima', 'Comentário de Mateus Freitas Gonçalves']);
    expect(within(itens[0]).getByText('@mateus.goncalves')).toHaveAttribute('title', 'Mateus Freitas Gonçalves');
  });

  it('quando a pessoa digita @ e escolhe um colega com Enter, então o @usuario entra no texto', async () => {
    // Dado
    render(<SecaoComentarios modulo="pessoas" cartaoId="p1" />);
    // Quando
    await userEvent.type(caixa(), 'Oi @an');
    expect(screen.getByRole('option', { name: /Ana Teste Lima/ })).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{Enter}');
    // Então
    expect(caixa()).toHaveValue('Oi @ana.lima ');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('dado um contrato, quando a lista do @ mostra quem não é advogado, então ele vem desligado e não entra no texto', async () => {
    // Dado
    render(<SecaoComentarios modulo="contratos" cartaoId="k1" />);
    await userEvent.type(caixa(), '@br');
    const bruno = screen.getByRole('option', { name: /Bruno Exemplo Souza/ });
    // Quando
    await userEvent.click(bruno);
    // Então
    expect(bruno).toHaveAttribute('aria-disabled', 'true');
    expect(bruno).toHaveTextContent('em contratos, só advogados');
    expect(caixa()).toHaveValue('@br');
  });

  it('quando a pessoa envia com Ctrl+Enter, então o comentário novo entra no topo e a caixa fica vazia', async () => {
    // Dado
    SD.comentarioCriar.mockResolvedValue(comentario('c3', 'u-mateus', 'Novo', '2026-10-29T16:00:00Z'));
    render(<SecaoComentarios modulo="pessoas" cartaoId="p1" />);
    await screen.findAllByRole('listitem', { name: /Comentário de/ });
    // Quando
    await userEvent.type(caixa(), 'Novo');
    await userEvent.keyboard('{Control>}{Enter}{/Control}');
    // Então
    expect(SD.comentarioCriar).toHaveBeenCalledWith('pessoas', 'p1', 'Novo');
    expect((await screen.findAllByRole('listitem', { name: /Comentário de/ }))[0]).toHaveTextContent('Novo');
    expect(caixa()).toHaveValue('');
  });

  it.each([
    ['quem escreveu', 'Comentário de Mateus Freitas Gonçalves', false, ['Editar', 'Excluir']],
    ['um administrador, no comentário de outra pessoa', 'Comentário de Ana Teste Lima', true, ['Excluir']],
    ['quem não escreveu e não é administrador', 'Comentário de Ana Teste Lima', false, []]
  ])('quando %s vê o comentário, então as ações são %j', async (_quem, item, ehAdmin, acoes) => {
    // Dado
    sessao.ehAdmin = ehAdmin;
    // Quando
    render(<SecaoComentarios modulo="pessoas" cartaoId="p1" />);
    // Então
    const alvo = await screen.findByRole('listitem', { name: item });
    expect(within(alvo).queryAllByRole('button').map(b => b.textContent)).toEqual(acoes);
  });
});
