// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// A reunião do Google Meet no cartão do compromisso (#437): o link, a gravação e o que está acontecendo com ela.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GRAVACAO_DA_REUNIAO, reuniaoNoCartao, TEXTO_DA_REUNIAO } from '../../regras/reuniaoGoogle';
import { ReuniaoNoCartao } from './ReuniaoNoCartao';

const LINK = 'https://meet.google.com/abc-mnop-xyz';
const mostrar = (r: Parameters<typeof ReuniaoNoCartao>[0]['reuniao']) => render(<dl><ReuniaoNoCartao reuniao={r} /></dl>);

describe('A reunião do Google Meet no cartão', () => {
  it('dada a reunião criada, então o link abre o Meet numa aba nova e a gravação ligada é dita', () => {
    // Dado / Quando
    mostrar(reuniaoNoCartao({ reuniao_google: true, reuniao: { link: LINK, gravacao: 'ligada' }, arquivado_em: null }, false));
    // Então
    expect(screen.getByText('Google Meet')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: LINK });
    expect(link).toHaveAttribute('href', LINK);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByText(GRAVACAO_DA_REUNIAO.ligada)).toBeInTheDocument();
  });

  it('dado o link ainda sendo criado, então o cartão diz que ele aparece em alguns minutos, sem link', () => {
    // Dado / Quando
    mostrar(reuniaoNoCartao({ reuniao_google: true, reuniao: null, arquivado_em: null }, false));
    // Então
    expect(screen.getByText(TEXTO_DA_REUNIAO.criando)).toBeInTheDocument();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('dado o compromisso sem a opção, então nada aparece', () => {
    // Dado / Quando
    mostrar(reuniaoNoCartao({ reuniao_google: false, reuniao: { link: LINK, gravacao: null }, arquivado_em: null }, false));
    // Então
    expect(screen.queryByText('Google Meet')).toBeNull();
  });
});
