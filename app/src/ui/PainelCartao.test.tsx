// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DadosSessao } from '../dados';
import { PainelCartao, PREFERENCIA_FORMATO, useTravarPainel } from './PainelCartao';
import { iniciarPreferencias } from './preferencias';
import { Recolhivel } from './Recolhivel';

// O painel só grava a preferência do formato; o mock declara exatamente essa operação.
const { salvarPreferencia } = vi.hoisted(() => ({ salvarPreferencia: vi.fn<DadosSessao['salvarPreferencia']>() }));
vi.mock('../dados', () => ({ SD: { salvarPreferencia } satisfies Pick<DadosSessao, 'salvarPreferencia'> }));
// O painel travado avisa o motivo no pé da tela; o teste confere o pedido do aviso.
const { avisar } = vi.hoisted(() => ({ avisar: vi.fn<typeof import('./avisos').avisar>() }));
vi.mock('./avisos', () => ({ avisar }));

function abrir() {
  const aoFechar = vi.fn();
  render(<PainelCartao aoFechar={aoFechar}><h2>JOSÉ DA SILVA TESTE</h2></PainelCartao>);
  return aoFechar;
}

describe('Formato do cartão', () => {
  beforeEach(() => { iniciarPreferencias({}); salvarPreferencia.mockReset(); salvarPreferencia.mockResolvedValue(); });

  it('quando a pessoa nunca escolheu, então o cartão abre ao lado, com o botão para abrir no centro', () => {
    // Quando
    abrir();
    // Então
    expect(screen.getByRole('dialog')).toHaveTextContent('JOSÉ DA SILVA TESTE');
    expect(screen.getByRole('button', { name: 'Abrir no centro da tela' })).toBeInTheDocument();
  });

  it('quando a pessoa clica em "Abrir no centro da tela", então o cartão muda e a escolha fica guardada', async () => {
    // Dado
    abrir();
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Abrir no centro da tela' }));
    // Então
    expect(screen.getByRole('button', { name: 'Abrir ao lado' })).toBeInTheDocument();
    expect(salvarPreferencia).toHaveBeenCalledWith(PREFERENCIA_FORMATO, 'centro');
  });

  it('dado que a pessoa escolheu o centro, quando abre o próximo cartão, então ele já abre no centro', () => {
    // Dado
    iniciarPreferencias({ [PREFERENCIA_FORMATO]: 'centro' });
    // Quando
    abrir();
    // Então
    expect(screen.getByRole('button', { name: 'Abrir ao lado' })).toBeInTheDocument();
  });

  it('quando a preferência guardada não é um formato conhecido, então o cartão abre ao lado', () => {
    // Dado
    iniciarPreferencias({ [PREFERENCIA_FORMATO]: 'flutuante' });
    // Quando
    abrir();
    // Então
    expect(screen.getByRole('button', { name: 'Abrir no centro da tela' })).toBeInTheDocument();
  });

  it.each([['lado'], ['centro']])('dado o cartão %s, quando a pessoa aperta Esc, então ele fecha', async formato => {
    // Dado
    iniciarPreferencias({ [PREFERENCIA_FORMATO]: formato });
    const aoFechar = abrir();
    // Quando
    await userEvent.keyboard('{Escape}');
    // Então
    expect(aoFechar).toHaveBeenCalledOnce();
  });
});

describe('Janela do cadastro novo', () => {
  beforeEach(() => { iniciarPreferencias({ [PREFERENCIA_FORMATO]: 'lado' }); });

  it('quando abre, então fica no centro mesmo para quem prefere o cartão ao lado, sem o botão de trocar', () => {
    // Quando
    render(<PainelCartao soNoCentro aoFechar={() => {}}><h1>Nova pessoa</h1></PainelCartao>);
    // Então
    expect(screen.getByRole('dialog')).toHaveClass('centro');
    expect(screen.queryByRole('button', { name: /Abrir/ })).not.toBeInTheDocument();
  });

  it('quando a pessoa clica fora, então não fecha (perderia o que digitou); o X fecha', async () => {
    // Dado
    const aoFechar = vi.fn();
    render(<PainelCartao soNoCentro aoFechar={aoFechar}><h1>Nova pessoa</h1></PainelCartao>);
    // Quando: o clique cai no véu, o fundo escurecido logo antes da janela
    await userEvent.click(screen.getByRole('dialog').previousElementSibling!);
    const depoisDoClique = aoFechar.mock.calls.length;
    await userEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    // Então
    expect(depoisDoClique).toBe(0);
    expect(aoFechar).toHaveBeenCalledOnce();
  });
});

describe('Nome da janela no centro', () => {
  beforeEach(() => { iniciarPreferencias({}); });

  it('quando o cadastro não diz o nome, então a janela se chama "Cadastro", como antes', () => {
    // Quando
    render(<PainelCartao soNoCentro aoFechar={() => {}}><h1>Nova pessoa</h1></PainelCartao>);
    // Então
    expect(screen.getByRole('dialog', { name: 'Cadastro' })).toBeInTheDocument();
  });

  it('dado o rótulo "Importar pessoas", então a janela tem esse nome', () => {
    // Quando
    render(<PainelCartao soNoCentro rotulo="Importar pessoas" aoFechar={() => {}}><h1>Importar pessoas</h1></PainelCartao>);
    // Então
    expect(screen.getByRole('dialog', { name: 'Importar pessoas' })).toBeInTheDocument();
  });
});

describe('Painel travado', () => {
  const MOTIVO = 'A importação está gravando. Espere terminar.';
  /** Uma tela que trava o painel enquanto "gravando" estiver marcado. */
  function Gravacao({ gravando }: { gravando: boolean }) {
    useTravarPainel(gravando ? MOTIVO : null);
    return <p>Gravando…</p>;
  }
  function abrirTravado(props: { soNoCentro?: boolean; gravando?: boolean } = {}) {
    const aoFechar = vi.fn();
    const { gravando = true, soNoCentro = true } = props;
    const tela = render(<PainelCartao soNoCentro={soNoCentro} aoFechar={aoFechar}><Gravacao gravando={gravando} /></PainelCartao>);
    const mudar = (agora: boolean) => tela.rerender(<PainelCartao soNoCentro={soNoCentro} aoFechar={aoFechar}><Gravacao gravando={agora} /></PainelCartao>);
    return { aoFechar, mudar };
  }
  beforeEach(() => { iniciarPreferencias({}); avisar.mockReset(); });

  it('dado um painel travado, quando aperta Esc, então não fecha e mostra o motivo', async () => {
    // Dado
    const { aoFechar } = abrirTravado();
    // Quando
    await userEvent.keyboard('{Escape}');
    // Então
    expect(aoFechar).not.toHaveBeenCalled();
    expect(avisar).toHaveBeenCalledWith(MOTIVO, 'erro');
  });

  it('dado um painel travado, quando clica em "Fechar", então não fecha e mostra o motivo', async () => {
    // Dado
    const { aoFechar } = abrirTravado();
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    // Então
    expect(aoFechar).not.toHaveBeenCalled();
    expect(avisar).toHaveBeenCalledWith(MOTIVO, 'erro');
  });

  it('dado um cartão ao lado travado, quando clica fora, então não fecha', async () => {
    // Dado
    const { aoFechar } = abrirTravado({ soNoCentro: false });
    // Quando: o clique cai no véu, o fundo escurecido logo antes do painel
    await userEvent.click(screen.getByRole('dialog').previousElementSibling!);
    // Então
    expect(aoFechar).not.toHaveBeenCalled();
    expect(avisar).toHaveBeenCalledWith(MOTIVO, 'erro');
  });

  it('dado um painel travado, quando a tela destrava, então o X volta a fechar', async () => {
    // Dado
    const { aoFechar, mudar } = abrirTravado();
    // Quando
    mudar(false);
    await userEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    // Então
    expect(aoFechar).toHaveBeenCalledOnce();
  });

  it('dada uma tela que não trava, quando aperta Esc, então fecha sem aviso', async () => {
    // Dado
    const { aoFechar } = abrirTravado({ gravando: false });
    // Quando
    await userEvent.keyboard('{Escape}');
    // Então
    expect(aoFechar).toHaveBeenCalledOnce();
    expect(avisar).not.toHaveBeenCalled();
  });
});

describe('Janela ajustada ao conteúdo', () => {
  beforeEach(() => { iniciarPreferencias({}); });

  it('dado um formulário curto, quando abre ajustada, então a janela ganha a marca de ajustada; sem pedir, não ganha', () => {
    // Quando
    const { unmount } = render(<PainelCartao soNoCentro ajustado rotulo="Nova saída" aoFechar={() => {}}><h1>Nova saída</h1></PainelCartao>);
    // Então
    expect(screen.getByRole('dialog', { name: 'Nova saída' })).toHaveClass('centro', 'ajustado');
    unmount();
    render(<PainelCartao soNoCentro aoFechar={() => {}}><h1>Nova pessoa</h1></PainelCartao>);
    expect(screen.getByRole('dialog')).not.toHaveClass('ajustado');
  });
});

describe('Expandir e recolher todas as seções', () => {
  beforeEach(() => { iniciarPreferencias({}); salvarPreferencia.mockReset(); salvarPreferencia.mockResolvedValue(); });

  it('dado um cartão sem seções que recolhem, quando abre, então não há o botão', () => {
    // Quando
    abrir();
    // Então
    expect(screen.queryByRole('button', { name: 'Expandir tudo' })).toBeNull();
  });

  it('dado um cartão com seções fechadas, quando clica em "Expandir tudo", então todas abrem (menos as sigilosas) e o botão vira "Recolher tudo"', async () => {
    // Dado
    render(<PainelCartao aoFechar={() => {}}>
      <Recolhivel titulo="Partes" icone="pessoas"><p>As partes</p></Recolhivel>
      <Recolhivel titulo="Histórico" icone="relogio"><p>O histórico</p></Recolhivel>
      <Recolhivel titulo="Informações sigilosas" icone="cadeado" foraDoExpandirTudo><p>O sigilo</p></Recolhivel>
    </PainelCartao>);
    // O botão aparece uma vez só, logo acima da primeira seção (junto das setas)
    const expandir = screen.getByRole('button', { name: 'Expandir tudo' });
    expect(expandir.compareDocumentPosition(screen.getByRole('button', { name: 'Partes' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Quando
    await userEvent.click(expandir);
    // Então
    expect(screen.getByText('As partes')).toBeInTheDocument();
    expect(screen.getByText('O histórico')).toBeInTheDocument();
    expect(screen.queryByText('O sigilo')).toBeNull();
    // E quando recolhe tudo, então todas fecham, sem gravar a escolha de cada seção
    await userEvent.click(screen.getByRole('button', { name: 'Recolher tudo' }));
    expect(screen.queryByText('As partes')).toBeNull();
    expect(screen.queryByText('O histórico')).toBeNull();
    expect(salvarPreferencia).not.toHaveBeenCalled();
  });
});

describe('Expandir tudo com uma seção dentro de outra', () => {
  beforeEach(() => { iniciarPreferencias({}); salvarPreferencia.mockReset(); salvarPreferencia.mockResolvedValue(); });

  it('dado uma seção dentro de outra, quando expande tudo, então só as do cartão abrem, e o botão vira "Recolher tudo"', async () => {
    // Dado
    render(<PainelCartao aoFechar={() => {}}>
      <Recolhivel titulo="Honorários" icone="dinheiro"><p>Os honorários</p>
        <Recolhivel titulo="Histórico das parcelas" icone="relogio"><p>O histórico</p></Recolhivel>
      </Recolhivel>
      <Recolhivel titulo="Partes" icone="pessoas"><p>As partes</p></Recolhivel>
    </PainelCartao>);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Expandir tudo' }));
    // Então
    expect(screen.getByText('Os honorários')).toBeInTheDocument();
    expect(screen.getByText('As partes')).toBeInTheDocument();
    expect(screen.queryByText('O histórico')).toBeNull();
    expect(screen.getByRole('button', { name: 'Recolher tudo' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Expandir tudo|Recolher tudo/ })).toHaveLength(1);
  });
});
