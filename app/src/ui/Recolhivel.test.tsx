// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CriarNoCartao } from './ItensLigados';
import { iniciarPreferencias, lerPreferencia } from './preferencias';
import { GrupoDeSecoes, Recolhivel, usePedidoDeNovo } from './Recolhivel';

describe('Seção recolhível', () => {
  it('quando começa fechada, então só o título aparece', () => {
    // Quando
    render(<Recolhivel titulo="Vínculos" icone="vinculo" contador={2}><p>João é cônjuge</p></Recolhivel>);
    // Então
    expect(screen.getByRole('button', { name: /Vínculos/ })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: /Vínculos/ })).toHaveTextContent('2');
    expect(screen.queryByText('João é cônjuge')).not.toBeInTheDocument();
  });

  it('quando a pessoa clica no título, então o conteúdo aparece', async () => {
    // Dado
    render(<Recolhivel titulo="Vínculos" icone="vinculo"><p>João é cônjuge</p></Recolhivel>);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Vínculos' }));
    // Então
    expect(screen.getByRole('button', { name: 'Vínculos' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('João é cônjuge')).toBeInTheDocument();
  });

  it('quando a pessoa usa o teclado (Tab e Enter), então abre e fecha do mesmo jeito', async () => {
    // Dado
    render(<Recolhivel titulo="Vínculos" icone="vinculo"><p>João é cônjuge</p></Recolhivel>);
    await userEvent.tab();
    // Quando
    await userEvent.keyboard('{Enter}');
    const depoisDeAbrir = screen.getByRole('button', { name: 'Vínculos' }).getAttribute('aria-expanded');
    await userEvent.keyboard('{Enter}');
    // Então
    expect(depoisDeAbrir).toBe('true');
    expect(screen.getByRole('button', { name: 'Vínculos' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('João é cônjuge')).not.toBeInTheDocument();
  });

  it('quando o usuário nunca mexeu na seção, então ela começa recolhida; se já a abriu, começa aberta', () => {
    // Dado
    iniciarPreferencias({ 'teste.aberta': true });
    // Quando
    render(<>
      <Recolhivel titulo="Nunca mexida" icone="vinculo" preferencia="teste.nunca"><p>a</p></Recolhivel>
      <Recolhivel titulo="Já aberta" icone="vinculo" preferencia="teste.aberta"><p>b</p></Recolhivel>
    </>);
    // Então
    expect(screen.getByRole('button', { name: 'Nunca mexida' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: 'Já aberta' })).toHaveAttribute('aria-expanded', 'true');
  });
});

describe('Seção aberta por quem chegou com um destino', () => {
  it('dado a seção recolhida na preferência, quando pede para abrir ao iniciar, então aparece aberta e a preferência continua como estava', () => {
    // Dado
    iniciarPreferencias({ 'teste.fechada': false });
    // Quando
    render(<Recolhivel titulo="Comentários" icone="comentario" preferencia="teste.fechada" abertaAoIniciar><p>texto</p></Recolhivel>);
    // Então
    expect(screen.getByRole('button', { name: 'Comentários' })).toHaveAttribute('aria-expanded', 'true');
    expect(lerPreferencia('teste.fechada', false)).toBe(false);
  });
});

describe('O número ao lado do título', () => {
  it('dado uma seção conferida e vazia, quando aparece, então mostra 0 (para não confundir com "ainda não contou")', () => {
    // Quando
    render(<Recolhivel titulo="Tarefas" icone="tarefas" contador={0}><p>nada</p></Recolhivel>);
    // Então
    expect(screen.getByRole('button', { name: /^Tarefas\s?0$/ })).toBeInTheDocument();
  });

  it('dado uma seção que ainda não contou, quando aparece, então não mostra número', () => {
    // Quando
    render(<Recolhivel titulo="Tarefas" icone="tarefas"><p>nada</p></Recolhivel>);
    // Então
    expect(screen.getByRole('button', { name: 'Tarefas' })).toBeInTheDocument();
  });
});

describe('O nome do "Expandir tudo" diz o alcance do grupo (#397)', () => {
  it('dado um grupo com o alcance, quando abre, então o nome do botão o diz, e a dica continua curta', () => {
    // Quando
    render(<GrupoDeSecoes alcance="da coluna da direita">
      <Recolhivel titulo="Comentários" icone="comentario"><p>Os comentários</p></Recolhivel>
      <Recolhivel titulo="Histórico de alterações" icone="relogio"><p>As mudanças</p></Recolhivel>
    </GrupoDeSecoes>);
    // Então: e quem procura a seção pelo título acha só a seção
    const botao = screen.getByRole('button', { name: 'Expandir tudo da coluna da direita' });
    expect(botao).toHaveAttribute('data-dica', 'Expandir tudo');
    expect(screen.getAllByRole('button', { name: /Histórico de alterações/ })).toHaveLength(1);
  });

  it('dado as seções todas abertas, quando a pessoa olha o botão, então ele se chama "Recolher tudo", com o mesmo alcance', async () => {
    // Dado
    render(<GrupoDeSecoes alcance="do pé do cartão"><Recolhivel titulo="Dados" icone="lista"><p>Os dados</p></Recolhivel></GrupoDeSecoes>);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Expandir tudo do pé do cartão' }));
    // Então
    expect(screen.getByRole('button', { name: 'Recolher tudo do pé do cartão' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('dado um grupo sem alcance, quando abre, então o botão se chama só "Expandir tudo"', () => {
    // Quando
    render(<GrupoDeSecoes><Recolhivel titulo="Dados" icone="lista"><p>Os dados</p></Recolhivel></GrupoDeSecoes>);
    // Então
    expect(screen.getByRole('button', { name: 'Expandir tudo' })).toBeInTheDocument();
  });
});

describe('Um grupo dentro de outro (#360, #397)', () => {
  it('dado um grupo próprio dentro do do cartão, quando abre, então cada um tem o seu botão, que abre só as dele', async () => {
    // Dado
    render(<GrupoDeSecoes alcance="do alto do cartão">
      <Recolhivel titulo="Dados" icone="lista"><p>Os dados</p></Recolhivel>
      <GrupoDeSecoes alcance="do pé do cartão"><Recolhivel titulo="Histórico" icone="relogio"><p>As mudanças</p></Recolhivel></GrupoDeSecoes>
    </GrupoDeSecoes>);
    const botoes = screen.getAllByRole('button', { name: /^Expandir tudo/ });
    expect(botoes.map(b => b.getAttribute('aria-label'))).toEqual(['Expandir tudo do alto do cartão', 'Expandir tudo do pé do cartão']);
    // Quando
    await userEvent.click(botoes[1]);
    // Então
    expect(screen.getByText('As mudanças')).toBeInTheDocument();
    expect(screen.queryByText('Os dados')).not.toBeInTheDocument();
  });
});

/** O conteúdo de uma seção como o dos prazos: a lista e, com o pedido do "+" do título, o formulário do item novo. */
function ComFormulario({ aoPedir = () => {} }: { aoPedir?: (botao: HTMLElement) => void }) {
  const [novo, setNovo] = useState(false);
  usePedidoDeNovo(botao => { setNovo(true); aoPedir(botao); });
  return novo ? <form aria-label="Novo prazo"><input type="hidden" /><label>Que prazo é este<input /></label></form> : <p>Os prazos</p>;
}
/** Quem atende o "+" só aparece depois da leitura (como as parcelas e os vínculos). */
function DepoisDeLer({ lido }: { lido: boolean }) {
  return lido ? <ComFormulario /> : <p>Carregando…</p>;
}
const maisDoTitulo = (titulo: RegExp) => within(screen.getByRole('heading', { name: titulo })).getByRole('button', { name: 'Novo prazo' });

describe('O "+" do título que pede o item novo à própria seção (#390)', () => {
  it('dada a seção fechada, quando a pessoa clica no "+", então ela abre com o formulário do item novo, e a escolha guardada continua fechada', async () => {
    // Dado
    iniciarPreferencias({ 'teste.prazos': false });
    render(<Recolhivel titulo="Prazos" icone="calendario" preferencia="teste.prazos" novo={{ rotulo: 'Novo prazo' }}><ComFormulario /></Recolhivel>);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Novo prazo' }));
    // Então
    expect(screen.getByRole('button', { name: 'Prazos' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('form', { name: 'Novo prazo' })).toBeInTheDocument();
    expect(lerPreferencia('teste.prazos', true)).toBe(false);
  });

  it('dada a seção já aberta, quando a pessoa clica no "+" duas vezes, então quem está dentro atende cada clique, com o "+" clicado', async () => {
    // Dado
    const aoPedir = vi.fn();
    render(<Recolhivel titulo="Prazos" icone="calendario" abertaAoIniciar novo={{ rotulo: 'Novo prazo' }}><ComFormulario aoPedir={aoPedir} /></Recolhivel>);
    expect(screen.getByText('Os prazos')).toBeInTheDocument();
    // Quando
    await userEvent.click(maisDoTitulo(/^Prazos/));
    await userEvent.click(maisDoTitulo(/^Prazos/));
    // Então
    expect(aoPedir).toHaveBeenCalledTimes(2);
    expect(aoPedir).toHaveBeenLastCalledWith(maisDoTitulo(/^Prazos/));
  });

  it('dado o "+", quando o leitor de tela chega a ele, então tem o nome do botão de dentro e só diz que abre um menu quando abre', () => {
    // Quando
    render(<>
      <Recolhivel titulo="Prazos" icone="calendario" novo={{ rotulo: 'Novo prazo' }}><ComFormulario /></Recolhivel>
      <Recolhivel titulo="Checklists" icone="check" novo={{ rotulo: 'Adicionar checklist', menu: true }}><p>nada</p></Recolhivel>
    </>);
    // Então
    expect(screen.getByRole('button', { name: 'Novo prazo' })).not.toHaveAttribute('aria-haspopup');
    expect(screen.getByRole('button', { name: 'Adicionar checklist' })).toHaveAttribute('aria-haspopup', 'menu');
  });

  it('dada uma seção dentro da outra (o histórico das parcelas em Honorários), quando a pessoa clica no "+" da de fora, então a de dentro não recebe o pedido', async () => {
    // Dado
    const deDentro = vi.fn();
    render(<Recolhivel titulo="Honorários" icone="dinheiro" abertaAoIniciar novo={{ rotulo: 'Novo prazo' }}>
      <ComFormulario />
      <Recolhivel titulo="Histórico" icone="relogio" abertaAoIniciar><ComFormulario aoPedir={deDentro} /></Recolhivel>
    </Recolhivel>);
    // Quando
    await userEvent.click(maisDoTitulo(/^Honorários/));
    // Então
    expect(screen.getAllByRole('form', { name: 'Novo prazo' })).toHaveLength(1);
    expect(deDentro).not.toHaveBeenCalled();
  });

  it('dada a seção fechada, quando a pessoa clica no "+", então o foco vai ao primeiro campo do formulário novo', async () => {
    // Dado
    iniciarPreferencias({ 'teste.prazos': false });
    render(<Recolhivel titulo="Prazos" icone="calendario" preferencia="teste.prazos" novo={{ rotulo: 'Novo prazo' }}><ComFormulario /></Recolhivel>);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Novo prazo' }));
    // Então
    expect(screen.getByRole('textbox', { name: 'Que prazo é este' })).toHaveFocus();
  });

  it('dado o "+" que abre um menu, quando a pessoa clica nele, então a seção não tira o foco do "+" (o menu cuida dele)', async () => {
    // Dado
    render(<Recolhivel titulo="Checklists" icone="check" abertaAoIniciar novo={{ rotulo: 'Adicionar checklist', menu: true }}><ComFormulario /></Recolhivel>);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar checklist' }));
    // Então
    expect(screen.getByRole('button', { name: 'Adicionar checklist' })).toHaveFocus();
  });

  it('dado o "+" clicado antes de quem o atende aparecer, quando a pessoa fecha e reabre a seção, então o formulário novo não abre sozinho', async () => {
    // Dado
    const { rerender } = render(<Recolhivel titulo="Prazos" icone="calendario" novo={{ rotulo: 'Novo prazo' }}><DepoisDeLer lido={false} /></Recolhivel>);
    await userEvent.click(maisDoTitulo(/^Prazos/));
    expect(screen.getByText('Carregando…')).toBeInTheDocument();
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Prazos' }));
    await userEvent.click(screen.getByRole('button', { name: 'Prazos' }));
    rerender(<Recolhivel titulo="Prazos" icone="calendario" novo={{ rotulo: 'Novo prazo' }}><DepoisDeLer lido /></Recolhivel>);
    // Então
    expect(screen.getByText('Os prazos')).toBeInTheDocument();
    expect(screen.queryByRole('form', { name: 'Novo prazo' })).not.toBeInTheDocument();
  });

  it('dado o cartão arquivado ou só para ler, quando a seção aparece, então não há "+" no título', () => {
    // Quando
    render(<CriarNoCartao pode={false}><Recolhivel titulo="Prazos" icone="calendario" novo={{ rotulo: 'Novo prazo' }}><ComFormulario /></Recolhivel></CriarNoCartao>);
    // Então
    expect(screen.queryByRole('button', { name: 'Novo prazo' })).not.toBeInTheDocument();
  });
});
