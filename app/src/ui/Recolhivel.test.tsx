// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CriarNoCartao } from './ItensLigados';
import { iniciarPreferencias, lerPreferencia } from './preferencias';
import { GrupoDeSecoes, Recolhivel, usePedidoDeLigar, usePedidoDeNovo } from './Recolhivel';
import { MemoryRouter } from 'react-router';

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

/** O conteúdo de uma seção com a busca de ligar (como a das tarefas): fora da seção com a corrente, o botão; dentro, só a busca. */
function ComBusca({ rotulo = 'Ligar tarefa existente', aoPedir = () => {} }: { rotulo?: string; aoPedir?: (botao: HTMLElement) => void }) {
  const [buscando, setBuscando] = useState(false);
  const peloTitulo = usePedidoDeLigar(rotulo, botao => { setBuscando(true); aoPedir(botao); });
  return <>
    <p>As tarefas</p>
    {buscando ? <input aria-label={`Busca: ${rotulo}`} /> : !peloTitulo && <button type="button">{rotulo}</button>}
  </>;
}
/** Quem atende o "+" diz se o título o tem: com ele, o botão de dentro some. */
function ComBotaoDeDentro() {
  const { peloTitulo } = usePedidoDeNovo(() => {});
  return peloTitulo ? <p>Sem botão</p> : <button type="button">Novo prazo</button>;
}

describe('A corrente do título, que liga um item que já existe (#427)', () => {
  it('dada a seção com a corrente, quando aparece, então o título tem o número, a corrente e o "+", com o nome na dica e para o leitor de tela', () => {
    // Quando
    render(<MemoryRouter><Recolhivel titulo="Tarefas" icone="tarefas" contador={2} ligar={{ rotulo: 'Ligar tarefa existente' }}
      novo={{ para: '/tarefas/nova/', rotulo: 'Nova tarefa deste contrato' }}><ComBusca /></Recolhivel></MemoryRouter>);
    // Então
    const titulo = screen.getByRole('heading', { name: /Tarefas/ });
    expect(within(titulo).getByRole('button', { name: 'Tarefas2' })).toBeInTheDocument();
    expect(within(titulo).getByRole('button', { name: 'Ligar tarefa existente' })).toHaveAttribute('data-dica', 'Ligar tarefa existente');
    expect(within(titulo).getByRole('link', { name: 'Nova tarefa deste contrato' })).toHaveAttribute('data-dica', 'Nova tarefa deste contrato');
  });

  it('dada a seção fechada, quando a pessoa clica na corrente, então ela abre só com a busca de dentro, sem o botão de baixo, e a escolha guardada continua fechada', async () => {
    // Dado
    iniciarPreferencias({ 'teste.tarefas': false });
    const aoPedir = vi.fn();
    render(<Recolhivel titulo="Tarefas" icone="tarefas" preferencia="teste.tarefas" ligar={{ rotulo: 'Ligar tarefa existente' }}><ComBusca aoPedir={aoPedir} /></Recolhivel>);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Ligar tarefa existente' }));
    // Então
    expect(screen.getByRole('textbox', { name: 'Busca: Ligar tarefa existente' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Ligar tarefa existente' })).toHaveLength(1);
    expect(aoPedir).toHaveBeenCalledWith(screen.getByRole('button', { name: 'Ligar tarefa existente' }));
    expect(lerPreferencia('teste.tarefas', true)).toBe(false);
  });

  it('dada uma busca de outro rótulo na seção (a de uma linha da lista), quando aparece, então ela continua com o seu botão e não atende a corrente', async () => {
    // Dado
    const deOutra = vi.fn();
    render(<Recolhivel titulo="Prazos" icone="calendario" abertaAoIniciar ligar={{ rotulo: 'Ligar tarefa existente' }}>
      <ComBusca rotulo="Ligar tarefa ao prazo" aoPedir={deOutra} />
    </Recolhivel>);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Ligar tarefa existente' }));
    // Então
    expect(screen.getByRole('button', { name: 'Ligar tarefa ao prazo' })).toBeInTheDocument();
    expect(deOutra).not.toHaveBeenCalled();
  });

  it('dada a corrente sem lugar (a lista cheia), quando a pessoa clica nela, então nada abre, e a dica diz o motivo', async () => {
    // Dado
    const aoPedir = vi.fn();
    render(<Recolhivel titulo="Clientes" icone="pessoas" abertaAoIniciar ligar={{ rotulo: 'Ligar cliente existente', indisponivel: 'A lista já está cheia.' }}>
      <ComBusca rotulo="Ligar cliente existente" aoPedir={aoPedir} />
    </Recolhivel>);
    const corrente = screen.getByRole('button', { name: 'Ligar cliente existente' });
    // Quando
    await userEvent.click(corrente);
    // Então
    expect(corrente).toHaveAttribute('aria-disabled', 'true');
    expect(corrente).toHaveAttribute('data-dica', 'A lista já está cheia.');
    expect(aoPedir).not.toHaveBeenCalled();
  });

  it('dada a corrente de vários tipos, quando a pessoa clica nela e escolhe um, então a busca desse tipo abre', async () => {
    // Dado
    render(<Recolhivel titulo="Ligado a" icone="vinculo" ligar={{ rotulo: 'Ligar a um item existente', opcoes: [{ rotulo: 'Ligar tarefa existente' }, { rotulo: 'Ligar demanda existente' }] }}>
      <ComBusca /><ComBusca rotulo="Ligar demanda existente" />
    </Recolhivel>);
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Ligar a um item existente' }));
    await userEvent.click(within(screen.getByRole('menu', { name: 'Ligar a um item existente' })).getByRole('menuitem', { name: 'Ligar demanda existente' }));
    // Então
    expect(screen.getByRole('textbox', { name: 'Busca: Ligar demanda existente' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Busca: Ligar tarefa existente' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});

describe('O "+" de vários tipos e o botão de dentro (#427)', () => {
  it('dado o "+" com dois tipos, quando a pessoa clica nele, então escolhe o tipo num menu pequeno, cada um com o seu cadastro', async () => {
    // Dado
    render(<MemoryRouter><Recolhivel titulo="Recursos e incidentais" icone="processos" novo={{ rotulo: 'Novo recurso ou incidental', opcoes: [
      { para: '/processos/novo/?ligacao=recurso', rotulo: 'Novo recurso' }, { para: '/processos/novo/?ligacao=incidental', rotulo: 'Novo incidental' }] }}><p>nada</p></Recolhivel></MemoryRouter>);
    const mais = screen.getByRole('button', { name: 'Novo recurso ou incidental' });
    // Quando
    await userEvent.click(mais);
    // Então
    expect(mais).toHaveAttribute('aria-haspopup', 'menu');
    const menu = screen.getByRole('menu', { name: 'Novo recurso ou incidental' });
    expect(within(menu).getAllByRole('menuitem').map(i => i.getAttribute('href'))).toEqual(['/processos/novo/?ligacao=recurso', '/processos/novo/?ligacao=incidental']);
  });

  it('dado o "+" no título, quando a seção abre, então quem está dentro sabe e não mostra o seu botão; fora de uma seção, mostra', () => {
    // Dado / Quando
    render(<>
      <Recolhivel titulo="Prazos" icone="calendario" abertaAoIniciar novo={{ rotulo: 'Novo prazo' }}><ComBotaoDeDentro /></Recolhivel>
      <ComBotaoDeDentro />
    </>);
    // Então
    expect(screen.getByText('Sem botão')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Novo prazo' })).toHaveLength(2);
    expect(within(screen.getByRole('heading', { name: /Prazos/ })).getByRole('button', { name: 'Novo prazo' })).toBeInTheDocument();
  });
});
