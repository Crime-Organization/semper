// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { useContext, useEffect } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DadosSessao } from '../dados';
import { BotoesNoPainel, ColunaDoCartao, NaColunaDoCartao, PainelCartao, PREFERENCIA_FORMATO, useTravarPainel } from './PainelCartao';
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

  it('dado um cartão (não um cadastro) com o rótulo "Anotação", então a janela ao lado tem esse nome; sem o rótulo, nenhum', () => {
    // Quando
    const { unmount } = render(<PainelCartao rotulo="Anotação" aoFechar={() => {}}><h2>Ata</h2></PainelCartao>);
    // Então
    expect(screen.getByRole('dialog', { name: 'Anotação' })).toBeInTheDocument();
    // Quando
    unmount();
    render(<PainelCartao aoFechar={() => {}}><h2>Ata</h2></PainelCartao>);
    // Então
    expect(screen.getByRole('dialog')).not.toHaveAccessibleName();
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
    expect(screen.queryByRole('button', { name: /^Expandir tudo/ })).toBeNull();
  });

  it('dado um cartão com seções fechadas, quando clica em "Expandir tudo", então todas abrem (menos as sigilosas) e o botão vira "Recolher tudo"', async () => {
    // Dado
    render(<PainelCartao aoFechar={() => {}}>
      <Recolhivel titulo="Partes" icone="pessoas"><p>As partes</p></Recolhivel>
      <Recolhivel titulo="Histórico" icone="relogio"><p>O histórico</p></Recolhivel>
      <Recolhivel titulo="Informações sigilosas" icone="cadeado" foraDoExpandirTudo><p>O sigilo</p></Recolhivel>
    </PainelCartao>);
    // O botão aparece uma vez só, logo acima da primeira seção (junto das setas)
    const expandir = screen.getByRole('button', { name: /^Expandir tudo/ });
    expect(expandir.compareDocumentPosition(screen.getByRole('button', { name: 'Partes' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Quando
    await userEvent.click(expandir);
    // Então
    expect(screen.getByText('As partes')).toBeInTheDocument();
    expect(screen.getByText('O histórico')).toBeInTheDocument();
    expect(screen.queryByText('O sigilo')).toBeNull();
    // E quando recolhe tudo, então todas fecham, sem gravar a escolha de cada seção
    await userEvent.click(screen.getByRole('button', { name: /^Recolher tudo/ }));
    expect(screen.queryByText('As partes')).toBeNull();
    expect(screen.queryByText('O histórico')).toBeNull();
    expect(salvarPreferencia).not.toHaveBeenCalled();
  });

  // Desde a #366, o botão é só o ícone das duas setas: o nome fica para o leitor de tela e para a dica.
  it('dado um cartão com seções, quando olha o botão de expandir e recolher, então ele é só o ícone, sem texto à vista, com o nome e a dica conforme o estado', async () => {
    // Dado
    render(<PainelCartao aoFechar={() => {}}>
      <Recolhivel titulo="Partes" icone="pessoas"><p>As partes</p></Recolhivel>
      <Recolhivel titulo="Histórico" icone="relogio"><p>O histórico</p></Recolhivel>
    </PainelCartao>);
    // Quando
    const botao = screen.getByRole('button', { name: /^Expandir tudo/ });
    // Então: nenhum texto à vista (só o ícone), a dica diz o mesmo que o nome e o leitor de tela sabe que está fechado
    expect(botao.textContent).toBe('');
    expect(screen.queryByText(/Expandir tudo|Recolher tudo/)).toBeNull();
    expect(botao).toHaveAttribute('data-dica', 'Expandir tudo');
    expect(botao).toHaveAttribute('aria-expanded', 'false');
    // Quando: abre todas
    await userEvent.click(botao);
    // Então: o nome e a dica passam a "Recolher tudo", e o leitor de tela sabe que está aberto
    const recolher = screen.getByRole('button', { name: /^Recolher tudo/ });
    expect(recolher.textContent).toBe('');
    expect(recolher).toHaveAttribute('data-dica', 'Recolher tudo');
    expect(recolher).toHaveAttribute('aria-expanded', 'true');
  });

  it('dado o botão só de ícone, quando a pessoa chega nele pelo Tab, então ele recebe o foco e tem a dica com o nome dele', async () => {
    // Dado
    render(<PainelCartao aoFechar={() => {}}>
      <Recolhivel titulo="Partes" icone="pessoas"><p>As partes</p></Recolhivel>
    </PainelCartao>);
    const botao = screen.getByRole('button', { name: /^Expandir tudo/ });
    // Quando: o Tab sai dos botões da janela e chega nele
    screen.getByRole('button', { name: 'Fechar' }).focus();
    await userEvent.tab();
    // Então
    expect(botao).toHaveFocus();
    expect(botao).toHaveAttribute('data-dica', 'Expandir tudo');
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
    await userEvent.click(screen.getByRole('button', { name: /^Expandir tudo/ }));
    // Então
    expect(screen.getByText('Os honorários')).toBeInTheDocument();
    expect(screen.getByText('As partes')).toBeInTheDocument();
    expect(screen.queryByText('O histórico')).toBeNull();
    expect(screen.getByRole('button', { name: /^Recolher tudo/ })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Expandir tudo|Recolher tudo/ })).toHaveLength(1);
  });
});

describe('Janela larga (a anotação, #340)', () => {
  /** Diz, como texto, onde o cartão pode pôr os comentários e os botões dele (o que o PainelCartao oferece a quem está dentro). */
  function OndeFica() {
    const coluna = useContext(ColunaDoCartao), botoes = useContext(BotoesNoPainel);
    return <p>{coluna ? 'Com a coluna' : 'Sem a coluna'}; {botoes ? 'botões no painel' : 'botões no cartão'}</p>;
  }
  beforeEach(() => { iniciarPreferencias({ [PREFERENCIA_FORMATO]: 'centro' }); });

  it('dado um cartão no centro sem pedir nada, quando abre, então tem a coluna da direita, com os botões no cartão, e não fica largo', async () => {
    // Quando
    render(<PainelCartao aoFechar={() => {}}><OndeFica /></PainelCartao>);
    // Então
    expect(await screen.findByText('Com a coluna; botões no cartão')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).not.toHaveClass('largo');
    expect(screen.getByRole('dialog')).not.toHaveClass('sem-coluna');
  });

  it('dado um cartão largo, quando abre no centro, então a janela fica larga, com a coluna da direita e os botões no cartão, e a troca de formato continua', async () => {
    // Quando
    render(<PainelCartao largo aoFechar={() => {}}><OndeFica /></PainelCartao>);
    // Então
    expect(await screen.findByText('Com a coluna; botões no cartão')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toHaveClass('centro', 'largo');
    expect(screen.getByRole('dialog')).not.toHaveClass('sem-coluna');
    expect(screen.getByRole('button', { name: 'Abrir ao lado' })).toBeInTheDocument();
  });

  it('dado um cartão largo, quando abre ao lado, então não há a coluna, e os botões ficam na linha do painel, como nos outros', () => {
    // Dado
    iniciarPreferencias({ [PREFERENCIA_FORMATO]: 'lado' });
    // Quando
    render(<PainelCartao largo aoFechar={() => {}}><OndeFica /></PainelCartao>);
    // Então
    expect(screen.getByText('Sem a coluna; botões no painel')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toHaveClass('lado');
  });
});

/** Uma tela que, ao abrir, põe o cursor no próprio campo (como o título da anotação nova, #339). */
function ComCursorNoCampo() {
  useEffect(() => {
    const t = setTimeout(() => document.getElementById('campo-do-teste')?.focus(), 0);
    return () => clearTimeout(t);
  }, []);
  return <input id="campo-do-teste" aria-label="Título" />;
}
/** Espera o quadro seguinte da tela, em que o painel aparece. */
const proximoQuadro = () => new Promise(pronto => requestAnimationFrame(() => pronto(null)));

describe('O foco ao abrir o painel', () => {
  beforeEach(() => iniciarPreferencias({}));

  it('dada uma tela sem campo com foco, quando o painel abre, então o foco vai ao painel', async () => {
    // Quando
    abrir();
    // Então
    await vi.waitFor(() => expect(screen.getByRole('dialog')).toHaveFocus());
  });

  it('dada uma tela que já pôs o cursor num campo dela, quando o painel abre, então o painel não tira o foco do campo', async () => {
    // Quando
    render(<PainelCartao aoFechar={() => {}}><ComCursorNoCampo /></PainelCartao>);
    await vi.waitFor(() => expect(screen.getByRole('textbox', { name: 'Título' })).toHaveFocus());
    await proximoQuadro();
    await proximoQuadro();
    // Então: mesmo depois do quadro em que o painel aparece
    expect(screen.getByRole('textbox', { name: 'Título' })).toHaveFocus();
  });
});

describe('O que vai para a coluna da direita', () => {
  it('dada uma coluna (a da janela no centro), quando as seções pedem para ir para ela, então aparecem nela, e não no fluxo', () => {
    // Dado
    const coluna = document.createElement('aside');
    document.body.append(coluna);
    // Quando
    render(<ColunaDoCartao.Provider value={coluna}><main><p>Texto da anotação</p><NaColunaDoCartao><section>Ligada a</section></NaColunaDoCartao></main></ColunaDoCartao.Provider>);
    // Então
    expect(coluna).toHaveTextContent('Ligada a');
    expect(screen.getByRole('main')).not.toHaveTextContent('Ligada a');
    coluna.remove();
  });

  it('dada a coluna, quando as seções que recolhem vão para ela, então formam um grupo só delas, com o "Expandir tudo" no topo da coluna, que abre só as dela', async () => {
    // Dado: uma seção no cartão e duas na coluna
    const coluna = document.createElement('aside');
    coluna.setAttribute('aria-label', 'Coluna da direita');
    document.body.append(coluna);
    render(<ColunaDoCartao.Provider value={coluna}><main>
      <Recolhivel titulo="Etapas" icone="lista"><p>Etapas do cartão</p></Recolhivel>
      <NaColunaDoCartao>
        <Recolhivel titulo="Ligada a" icone="vinculo"><p>Itens ligados</p></Recolhivel>
        <Recolhivel titulo="Histórico" icone="relogio"><p>Mudanças</p></Recolhivel>
      </NaColunaDoCartao>
    </main></ColunaDoCartao.Provider>);
    const naColuna = within(screen.getByRole('complementary', { name: 'Coluna da direita' }));
    expect(naColuna.getAllByRole('button')[0]).toHaveAccessibleName(/^Expandir tudo/);
    // Quando
    await userEvent.click(naColuna.getByRole('button', { name: /^Expandir tudo/ }));
    // Então: as da coluna abrem; a do cartão, não
    expect(naColuna.getByText('Itens ligados')).toBeInTheDocument();
    expect(naColuna.getByText('Mudanças')).toBeInTheDocument();
    expect(screen.queryByText('Etapas do cartão')).not.toBeInTheDocument();
    expect(naColuna.getByRole('button', { name: /^Recolher tudo/ })).toBeInTheDocument();
    coluna.remove();
  });

  it('dado o cartão sem coluna, quando as seções pedem para ir para ela, então ficam ali mesmo, no fluxo', () => {
    // Quando
    render(<main><NaColunaDoCartao><section>Ligada a</section></NaColunaDoCartao></main>);
    // Então
    expect(screen.getByRole('main')).toHaveTextContent('Ligada a');
  });

  it('dado algo escrito numa seção da coluna, quando a pessoa troca o formato da janela, então a seção muda de lugar sem perder o que estava escrito', async () => {
    // Dado: ao lado, a seção no fluxo do cartão, com um texto começado
    iniciarPreferencias({ [PREFERENCIA_FORMATO]: 'lado' });
    render(<PainelCartao aoFechar={() => {}}><p>Texto do cartão</p><NaColunaDoCartao><input aria-label="Rascunho" /></NaColunaDoCartao></PainelCartao>);
    await userEvent.type(screen.getByRole('textbox', { name: 'Rascunho' }), 'Falar com o cliente');
    // Quando: abre no centro
    await userEvent.click(screen.getByRole('button', { name: 'Abrir no centro da tela' }));
    // Então: a caixa foi para a coluna da direita, com o texto
    const naColuna = await vi.waitFor(() => {
      const caixa = screen.getByRole('textbox', { name: 'Rascunho' });
      expect(screen.getByText('Texto do cartão').parentElement).not.toContainElement(caixa);
      return caixa;
    });
    expect(naColuna).toHaveValue('Falar com o cliente');
    // E: de volta ao lado, o texto continua
    await userEvent.click(screen.getByRole('button', { name: 'Abrir ao lado' }));
    await vi.waitFor(() => expect(screen.getByText('Texto do cartão').parentElement).toContainElement(screen.getByRole('textbox', { name: 'Rascunho' })));
    expect(screen.getByRole('textbox', { name: 'Rascunho' })).toHaveValue('Falar com o cliente');
  });
});

/** O cartão com uma seção no corpo, duas que vão para a coluna e o rodapé, por último, como os cartões dos módulos (#360). */
function cartaoComColuna() {
  render(<PainelCartao aoFechar={() => {}}>
    <Recolhivel titulo="Dados do cadastro" icone="lista"><p>Os dados</p></Recolhivel>
    <NaColunaDoCartao>
      <Recolhivel titulo="Anotações" icone="documentos"><p>As anotações</p></Recolhivel>
      <Recolhivel titulo="Histórico de alterações" icone="relogio"><p>As mudanças</p></Recolhivel>
    </NaColunaDoCartao>
    <footer>Cadastrada em 10/11/2026</footer>
  </PainelCartao>);
}
/** Para as seções na ordem em que estão na página. */
const naFrente = (a: Node, b: Node) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
const botoesDoGrupo = () => screen.queryAllByRole('button', { name: /^(Expandir|Recolher) tudo/ });

describe('As seções da coluna sem a coluna (#360, #397)', () => {
  beforeEach(() => { iniciarPreferencias({}); salvarPreferencia.mockReset(); salvarPreferencia.mockResolvedValue(); });

  it('dado o cartão ao lado, quando abre, então cada parte tem o seu "Expandir tudo": o do corpo abre só as do corpo, e o de baixo, acima das seções da coluna, só as dela', async () => {
    // Dado
    iniciarPreferencias({ [PREFERENCIA_FORMATO]: 'lado' });
    cartaoComColuna();
    // Então
    const [doCorpo, deBaixo] = botoesDoGrupo();
    expect(botoesDoGrupo()).toHaveLength(2);
    expect(naFrente(doCorpo, screen.getByRole('button', { name: 'Dados do cadastro' }))).toBe(true);
    expect(naFrente(screen.getByRole('button', { name: 'Dados do cadastro' }), deBaixo)).toBe(true);
    expect(naFrente(deBaixo, screen.getByRole('button', { name: 'Anotações' }))).toBe(true);
    // Quando
    await userEvent.click(doCorpo);
    // Então
    expect(screen.getByText('Os dados')).toBeInTheDocument();
    expect(screen.queryByText('As anotações')).toBeNull();
    // Quando
    await userEvent.click(deBaixo);
    // Então
    expect(screen.getByText('As anotações')).toBeInTheDocument();
    expect(screen.getByText('As mudanças')).toBeInTheDocument();
  });

  it('dado o cartão ao lado com o histórico aberto, quando passa para o centro e volta, então cada grupo continua com o seu botão e as seções continuam abertas', async () => {
    // Dado
    iniciarPreferencias({ [PREFERENCIA_FORMATO]: 'lado' });
    cartaoComColuna();
    await userEvent.click(screen.getByRole('button', { name: 'Histórico de alterações' }));
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Abrir no centro da tela' }));
    // Então: o do corpo e o da coluna, cada um com o alcance no nome
    await vi.waitFor(() => expect(botoesDoGrupo().map(b => b.getAttribute('aria-label')))
      .toEqual(['Expandir tudo da coluna da esquerda', 'Expandir tudo da coluna da direita']));
    expect(screen.getByText('As mudanças')).toBeInTheDocument();
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Abrir ao lado' }));
    // Então
    await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Abrir no centro da tela' })).toBeInTheDocument());
    expect(botoesDoGrupo()).toHaveLength(2);
    expect(screen.getByText('As mudanças')).toBeInTheDocument();
  });

  it('dado o cartão no centro largo, quando abre, então os botões da janela são o abrir ao lado e o X, e o "Expandir tudo" da coluna vem na ordem do Tab depois do corpo, logo antes das seções que abre', async () => {
    // Dado
    iniciarPreferencias({ [PREFERENCIA_FORMATO]: 'centro' });
    // Quando
    cartaoComColuna();
    // Então
    const linha = screen.getByRole('group', { name: 'Botões da janela' });
    expect(within(linha).getAllByRole('button').map(b => b.getAttribute('aria-label'))).toEqual(['Abrir ao lado', 'Fechar']);
    const daColuna = await screen.findByRole('button', { name: 'Expandir tudo da coluna da direita' });
    expect(naFrente(screen.getByRole('button', { name: 'Dados do cadastro' }), daColuna)).toBe(true);
    expect(naFrente(daColuna, screen.getByRole('button', { name: 'Anotações' }))).toBe(true);
    // Quando: o da coluna abre só as da coluna
    await userEvent.click(daColuna);
    // Então
    expect(screen.getByText('As anotações')).toBeInTheDocument();
    expect(screen.queryByText('Os dados')).toBeNull();
  });

  describe('na janela estreita', () => {
    beforeEach(() => {
      // A janela tem 900px ou menos: a medida de JANELA_ESTREITA vale.
      vi.stubGlobal('matchMedia', (consulta: string) => ({ matches: true, media: consulta, addEventListener: () => {}, removeEventListener: () => {} }));
      return () => vi.unstubAllGlobals();
    });

    it('dado o cartão no centro, quando abre, então não há a coluna: as seções dela ficam no pé do cartão, antes do rodapé, com o "Expandir tudo" delas', () => {
      // Dado
      iniciarPreferencias({ [PREFERENCIA_FORMATO]: 'centro' });
      // Quando
      cartaoComColuna();
      // Então
      const historico = screen.getByRole('button', { name: 'Histórico de alterações' });
      expect(naFrente(screen.getByRole('button', { name: 'Dados do cadastro' }), screen.getByRole('button', { name: 'Anotações' }))).toBe(true);
      expect(naFrente(historico, screen.getByText('Cadastrada em 10/11/2026'))).toBe(true);
      expect(botoesDoGrupo().map(b => b.getAttribute('aria-label')))
        .toEqual(['Expandir tudo do alto do cartão', 'Expandir tudo do pé do cartão']);
      expect(within(screen.getByRole('group', { name: 'Botões da janela' })).queryByRole('button', { name: /tudo/ })).toBeNull();
    });
  });
});
