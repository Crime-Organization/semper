// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Membro } from '../dados';
import { ComoComentario, nomeDoAutor, SEM_AUTOR, USUARIO_REMOVIDO } from './ComoComentario';

const EQUIPE: Membro[] = [{ id: 'u-ana', nome: 'Ana Teste Lima', usuario: 'ana.lima', funcao: 'advogado', ativo: true }];
vi.mock('./sessao', () => ({ useCtx: () => ({ perfil: { id: 'u-ana' }, equipe: EQUIPE, ehAdmin: false }) }));

/** Agora menos duas horas, para o "há quanto tempo" sair sempre igual. */
const haDuasHoras = () => new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

describe('Como um comentário', () => {
  it('dado quem escreveu e quando, quando aparece, então mostra a bolinha com o nome, o nome, há quanto tempo e, embaixo, o que vem dentro', () => {
    // Quando
    render(<article><ComoComentario autorId="u-ana" quando={haDuasHoras()} depoisDoQuando=" (editado)"><p>Falar com o cliente</p></ComoComentario></article>);
    // Então
    expect(screen.getByTitle('Ana Teste Lima')).toHaveTextContent('AL');
    expect(screen.getByText('Ana Teste Lima', { selector: 'b' })).toBeInTheDocument();
    expect(screen.getByText('há 2 h (editado)')).toBeInTheDocument();
    expect(screen.getByRole('paragraph')).toHaveTextContent('Falar com o cliente');
  });

  it('dado um texto antes do quando e um detalhe a mais, quando aparece, então a linha de cima tem os dois, e a bolinha pode ficar sem a dica', () => {
    // Quando
    render(<article aria-describedby="cabeca"><ComoComentario autorId="u-ana" quando={haDuasHoras()} antesDoQuando="Atualizada" extra={<span>AN-7</span>}
      bolinhaSemDica idDaCabeca="cabeca"><p>Balão</p></ComoComentario></article>);
    // Então
    expect(screen.getByRole('article')).toHaveAccessibleDescription('Ana Teste Lima Atualizada há 2 h AN-7');
    expect(screen.queryByTitle('Ana Teste Lima')).not.toBeInTheDocument();
  });

  it('dado ninguém marcado como quem escreveu, ou alguém que saiu da equipe, então o nome diz cada caso', () => {
    // Quando / Então
    expect(nomeDoAutor(EQUIPE, 'u-ana')).toBe('Ana Teste Lima');
    expect(nomeDoAutor(EQUIPE, null)).toBe(SEM_AUTOR);
    expect(nomeDoAutor(EQUIPE, 'u-saiu')).toBe(USUARIO_REMOVIDO);
  });
});
