// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// As pastas dos documentos na tela (#342): a árvore, o caminho acima do título e a escolha da pasta.
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, MemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SD, type Pasta } from '../dados';
import { Avisos } from './avisos';
import { Janelas } from './janela';
import { ArvoreDePastas, CaminhoDaPasta, PREFERENCIA_DA_NAVEGACAO, useNavegacaoRecolhida, type AnotacoesDaArvore } from './Pastas';
import { iniciarPreferencias, lerPreferencia } from './preferencias';

vi.mock('./sessao', () => ({ useCtx: () => ({ perfil: { id: 'u-bruno' }, ehAdmin: false }) }));

const pasta = (id: string, nome: string, pasta_mae_id: string | null = null): Pasta => ({ id, nome, pasta_mae_id, criada_por: 'u-ana', criada_em: '' });
const ESCRITORIO = pasta('esc', 'Escritório'), POPS = pasta('pops', 'POPs', 'esc'), FINANCEIRO = pasta('fin', 'Financeiro', 'pops');
const PASTAS = [ESCRITORIO, POPS, FINANCEIRO];
const arvore = () => within(screen.getByRole('navigation', { name: 'Pastas e anotações' }));

describe('A árvore das pastas', () => {
  beforeEach(() => {
    iniciarPreferencias({});
    vi.spyOn(SD, 'salvarPreferencia').mockResolvedValue();
    vi.spyOn(SD, 'pastasListar').mockResolvedValue(PASTAS);
  });

  it('dadas uma pasta e as subpastas, quando a pessoa abre e fecha a de cima, então as de dentro aparecem e somem', async () => {
    // Dado
    render(<ArvoreDePastas pastas={PASTAS} escolhida={null} aoEscolher={() => undefined} />);
    expect(arvore().queryByRole('button', { name: 'POPs' })).toBeNull();
    // Quando
    await userEvent.click(arvore().getByRole('button', { name: 'O que está em Escritório' }));
    // Então
    expect(arvore().getByRole('button', { name: 'O que está em Escritório' })).toHaveAttribute('aria-expanded', 'true');
    expect(arvore().getByRole('button', { name: 'POPs' })).toBeTruthy();
    // Quando
    await userEvent.click(arvore().getByRole('button', { name: 'O que está em Escritório' }));
    // Então
    expect(arvore().queryByRole('button', { name: 'POPs' })).toBeNull();
  });

  it('dada uma subpasta escolhida, quando a árvore aparece, então as pastas acima dela já vêm abertas e ela fica marcada', () => {
    // Quando
    render(<ArvoreDePastas pastas={PASTAS} escolhida="fin" aoEscolher={() => undefined} />);
    // Então
    expect(arvore().getByRole('button', { name: 'Financeiro' })).toHaveAttribute('aria-current', 'true');
    expect(arvore().getByRole('button', { name: 'Todos os documentos' })).not.toHaveAttribute('aria-current');
  });

  it('dada uma subpasta escolhida, quando a pessoa fecha a pasta acima dela, então ela fecha mesmo assim', async () => {
    // Dado
    render(<ArvoreDePastas pastas={PASTAS} escolhida="pops" aoEscolher={() => undefined} />);
    // Quando
    await userEvent.click(arvore().getByRole('button', { name: 'O que está em Escritório' }));
    // Então
    expect(arvore().getByRole('button', { name: 'O que está em Escritório' })).toHaveAttribute('aria-expanded', 'false');
    expect(arvore().queryByRole('button', { name: 'POPs' })).toBeNull();
  });

  it('quando a pessoa clica numa pasta ou em "Todos os documentos", então quem chama recebe a escolha', async () => {
    // Dado
    const aoEscolher = vi.fn();
    render(<ArvoreDePastas pastas={PASTAS} escolhida="esc" aoEscolher={aoEscolher} />);
    // Quando
    await userEvent.click(arvore().getByRole('button', { name: 'Escritório' }));
    await userEvent.click(arvore().getByRole('button', { name: 'Todos os documentos' }));
    // Então
    expect(aoEscolher.mock.calls).toEqual([['esc'], [null]]);
  });

  it('quando a pessoa cria uma subpasta pelo ⋯ da pasta, então ela é criada dentro dela e passa a ser a escolhida', async () => {
    // Dado
    const nova = pasta('nova', 'Atas', 'esc');
    const criar = vi.spyOn(SD, 'pastaCriar').mockResolvedValue(nova);
    const aoEscolher = vi.fn();
    render(<><ArvoreDePastas pastas={PASTAS} escolhida={null} aoEscolher={aoEscolher} /><Janelas /><Avisos /></>);
    // Quando
    await userEvent.click(arvore().getByRole('button', { name: 'Ações da pasta Escritório' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Nova subpasta' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Nova subpasta' }), 'Atas');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    // Então
    expect(criar).toHaveBeenCalledWith('Atas', 'esc');
    expect(await screen.findByText('Pasta "Atas" criada.')).toBeTruthy();
    expect(aoEscolher).toHaveBeenCalledWith('nova');
  });

  it('quando o nome repete o de uma irmã, então o SEMPER avisa e não cria', async () => {
    // Dado
    const criar = vi.spyOn(SD, 'pastaCriar');
    render(<><ArvoreDePastas pastas={PASTAS} escolhida={null} aoEscolher={() => undefined} /><Janelas /><Avisos /></>);
    // Quando
    await userEvent.click(arvore().getByRole('button', { name: 'Nova pasta' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Nova pasta' }), 'escritorio');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    // Então
    expect(await screen.findByText('Já existe uma pasta com esse nome aqui.')).toBeTruthy();
    expect(criar).not.toHaveBeenCalled();
  });

  it('dada uma pasta com conteúdo, quando a pessoa tenta apagá-la, então o aviso pede para esvaziá-la', async () => {
    // Dado
    vi.spyOn(SD, 'pastaExcluir').mockRejectedValue(new Error('Esvazie a pasta antes de apagá-la: tire dela as anotações e as subpastas.'));
    render(<><ArvoreDePastas pastas={PASTAS} escolhida={null} aoEscolher={() => undefined} /><Janelas /><Avisos /></>);
    // Quando
    await userEvent.click(arvore().getByRole('button', { name: 'Ações da pasta Escritório' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Apagar' }));
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Apagar a pasta' })).getByRole('button', { name: 'Apagar' }));
    // Então
    expect(await screen.findByText(/Esvazie a pasta antes de apagá-la/)).toBeTruthy();
  });

});

// O pedido de 18/11: a árvore vira o explorador do Obsidian, com as anotações dentro das pastas. (O seletor da tela estreita
// saiu: no celular, a mesma árvore abre numa gaveta, e o teste dele deu lugar a estes.)
describe('O explorador da página Documentos', () => {
  beforeEach(() => {
    iniciarPreferencias({});
    vi.spyOn(SD, 'salvarPreferencia').mockResolvedValue();
    vi.spyOn(SD, 'pastasListar').mockResolvedValue(PASTAS);
  });
  const nota = (id: string, titulo: string, pasta_id: string | null) => ({ id, titulo, pasta_id });
  const anotacoes = (extra: Partial<AnotacoesDaArvore> = {}): AnotacoesDaArvore => ({
    lista: [nota('a1', 'Ata de outubro', 'esc'), nota('a2', 'Rascunho solto', null), nota('a3', 'POP do caixa', 'fin')], aberta: null,
    endereco: id => '/documentos/?id=' + id, nova: '/documentos/nova/', ordem: 'nome', aoOrdenar: vi.fn(), ...extra
  });
  const explorador = (a = anotacoes()) =>
    render(<MemoryRouter><ArvoreDePastas pastas={PASTAS} escolhida={null} aoEscolher={() => undefined} anotacoes={a} /></MemoryRouter>);

  it('dadas anotações em pastas e fora delas, quando o explorador aparece, então as sem pasta ficam no primeiro nível e as outras aparecem ao abrir a pasta', async () => {
    // Dado
    explorador();
    expect(arvore().getByRole('link', { name: 'Rascunho solto' })).toHaveAttribute('href', '/documentos/?id=a2');
    expect(arvore().queryByRole('link', { name: 'Ata de outubro' })).toBeNull();
    // Quando
    await userEvent.click(arvore().getByRole('button', { name: 'O que está em Escritório' }));
    // Então
    expect(arvore().getByRole('link', { name: 'Ata de outubro' })).toBeTruthy();
  });

  it('dada uma anotação aberta numa subpasta, quando o explorador aparece, então as pastas do caminho já vêm abertas e ela fica destacada', () => {
    // Quando
    explorador(anotacoes({ aberta: 'a3' }));
    // Então
    expect(arvore().getByRole('link', { name: 'POP do caixa' })).toHaveAttribute('aria-current', 'page');
  });

  it('então a barra do alto tem nova anotação, nova pasta, ordenar e recolher tudo; recolher fecha as pastas abertas', async () => {
    // Dado
    explorador(anotacoes({ aberta: 'a3' }));
    const barra = within(screen.getByRole('toolbar', { name: 'Explorador' }));
    expect(barra.getByRole('link', { name: 'Nova anotação' })).toHaveAttribute('href', '/documentos/nova/');
    expect(barra.getByRole('button', { name: 'Nova pasta' })).toBeTruthy();
    expect(barra.getByRole('button', { name: 'Ordenar: Nome (A–Z)' })).toBeTruthy();
    // Quando
    await userEvent.click(barra.getByRole('button', { name: 'Recolher tudo' }));
    // Então
    expect(arvore().queryByRole('link', { name: 'POP do caixa' })).toBeNull();
    expect(arvore().getByRole('button', { name: 'O que está em Escritório' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('quando a pessoa escolhe outra ordem no botão Ordenar, então quem chama a recebe', async () => {
    // Dado
    const aoOrdenar = vi.fn();
    explorador(anotacoes({ aoOrdenar }));
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Ordenar: Nome (A–Z)' }));
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Atualizados recentemente' }));
    // Então
    expect(aoOrdenar).toHaveBeenCalledWith('recentes');
  });

  it('dadas mais anotações do que o explorador lê, quando ele aparece, então o pé diz quantas mostra de quantas, e como achar as outras', () => {
    // Quando: o explorador leu 3 de 620
    explorador(anotacoes({ total: 620 }));
    // Então
    expect(arvore().getByText(/Mostrando 3 de 620 anotações/)).toHaveTextContent('Use a busca');
  });

  it('dadas todas as anotações lidas, quando o explorador aparece, então não há aviso de que faltam', () => {
    // Quando
    explorador(anotacoes({ total: 3 }));
    // Então
    expect(arvore().queryByText(/Mostrando/)).toBeNull();
  });

  it('dada a página Documentos depois de outra, quando a pessoa abre uma anotação pela árvore, então o endereço troca sem criar entrada no histórico, como abrir um cartão', async () => {
    // Dado: veio de Tarefas para Documentos
    const roteador = createMemoryRouter([
      { path: '/documentos/', element: <ArvoreDePastas pastas={PASTAS} escolhida={null} aoEscolher={() => undefined} anotacoes={anotacoes()} /> },
      { path: '/tarefas/', element: <p>Tarefas</p> }
    ], { initialEntries: ['/tarefas/', '/documentos/'], initialIndex: 1 });
    render(<RouterProvider router={roteador} />);
    // Quando
    await userEvent.click(arvore().getByRole('link', { name: 'Rascunho solto' }));
    // Então: a anotação está no endereço, e um Voltar só já sai da página
    expect(roteador.state.location.search).toBe('?id=a2');
    expect(roteador.state.historyAction).toBe('REPLACE');
    await act(() => roteador.navigate(-1));
    expect(roteador.state.location.pathname).toBe('/tarefas/');
  });
});

// O pedido de 18/11: recolher a navegação de Documentos (a árvore à esquerda), como o botão do painel lateral do Obsidian.
describe('Recolher a navegação de Documentos', () => {
  beforeEach(() => {
    iniciarPreferencias({});
    vi.spyOn(SD, 'salvarPreferencia').mockResolvedValue();
    vi.spyOn(SD, 'pastasListar').mockResolvedValue(PASTAS);
  });
  /** O explorador com o botão da navegação, como a página Documentos o usa. */
  function ComNavegacao() {
    const navegacao = useNavegacaoRecolhida();
    return <MemoryRouter>
      <p>{navegacao.recolhida ? 'Navegação recolhida' : 'Navegação à vista'}</p>
      <ArvoreDePastas pastas={PASTAS} escolhida={null} aoEscolher={() => undefined} navegacao={{ recolhida: navegacao.recolhida, aoAlternar: navegacao.alternar }}
        anotacoes={{ lista: [], aberta: null, endereco: id => '/documentos/?id=' + id, nova: '/documentos/nova/', ordem: 'nome', aoOrdenar: () => undefined }} />
    </MemoryRouter>;
  }

  it('dada a navegação à vista, quando a pessoa clica em "Recolher a navegação", então ela recolhe, o botão passa a "Mostrar a navegação" e a escolha fica guardada', async () => {
    // Dado
    const salvar = vi.spyOn(SD, 'salvarPreferencia').mockResolvedValue();
    render(<ComNavegacao />);
    const recolher = arvore().getByRole('button', { name: 'Recolher a navegação' });
    expect(recolher).toHaveAttribute('aria-expanded', 'true');
    // Quando
    await userEvent.click(recolher);
    // Então
    expect(screen.getByText('Navegação recolhida')).toBeInTheDocument();
    expect(arvore().getByRole('button', { name: 'Mostrar a navegação' })).toHaveAttribute('aria-expanded', 'false');
    expect(lerPreferencia(PREFERENCIA_DA_NAVEGACAO, false)).toBe(true);
    expect(salvar).toHaveBeenCalledWith(PREFERENCIA_DA_NAVEGACAO, true);
  });

  it('dado que a pessoa recolheu a navegação antes, quando a página abre de novo, então ela já vem recolhida, e "Mostrar a navegação" a traz de volta', async () => {
    // Dado
    const salvar = vi.spyOn(SD, 'salvarPreferencia').mockResolvedValue();
    iniciarPreferencias({ [PREFERENCIA_DA_NAVEGACAO]: true });
    // Quando
    render(<ComNavegacao />);
    // Então
    expect(screen.getByText('Navegação recolhida')).toBeInTheDocument();
    // Quando
    await userEvent.click(arvore().getByRole('button', { name: 'Mostrar a navegação' }));
    // Então
    expect(screen.getByText('Navegação à vista')).toBeInTheDocument();
    expect(salvar).toHaveBeenCalledWith(PREFERENCIA_DA_NAVEGACAO, false);
  });

  it('então o botão fica no começo da barra, antes de "Nova anotação", e diz qual lista ele recolhe', () => {
    // Quando
    render(<ComNavegacao />);
    // Então
    const botao = arvore().getAllByRole('button')[0];
    expect(botao).toHaveAccessibleName('Recolher a navegação');
    expect(botao.compareDocumentPosition(arvore().getByRole('link', { name: 'Nova anotação' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const lista = document.getElementById(botao.getAttribute('aria-controls')!);
    expect(lista).toContainElement(arvore().getByRole('button', { name: 'Todos os documentos' }));
  });

  it('dado um valor guardado que não é sim nem não, quando a página abre, então a navegação fica à vista', () => {
    // Dado
    iniciarPreferencias({ [PREFERENCIA_DA_NAVEGACAO]: 'talvez' });
    // Quando
    render(<ComNavegacao />);
    // Então
    expect(screen.getByText('Navegação à vista')).toBeInTheDocument();
  });
});

describe('O caminho da pasta acima do título', () => {
  it('dada uma anotação numa subpasta, quando o caminho aparece com links, então cada pedaço leva à página Documentos naquela pasta', () => {
    // Quando
    render(<MemoryRouter><CaminhoDaPasta pastas={PASTAS} pastaId="fin" comLinks /></MemoryRouter>);
    // Então
    const caminho = within(screen.getByRole('navigation', { name: 'Pasta' }));
    expect(caminho.getAllByRole('link').map(l => [l.textContent, l.getAttribute('href')])).toEqual([
      ['Escritório', '/documentos/?pasta=esc'], ['POPs', '/documentos/?pasta=pops'], ['Financeiro', '/documentos/?pasta=fin']
    ]);
    expect(screen.queryByRole('button', { name: 'Escolher a pasta' })).toBeNull();
  });

  it('dada uma anotação fora das pastas, quando quem só lê a vê, então não aparece caminho; quem pode mudar vê "Sem pasta"', () => {
    // Quando
    const { container, rerender } = render(<CaminhoDaPasta pastas={PASTAS} pastaId={null} />);
    // Então
    expect(container.textContent).toBe('');
    // Quando
    rerender(<CaminhoDaPasta pastas={PASTAS} pastaId={null} aoMudar={() => undefined} />);
    // Então
    expect(screen.getByRole('button', { name: 'Escolher a pasta' })).toHaveTextContent('Sem pasta');
  });

  it('dada uma anotação numa pasta, quando as pastas ainda estão chegando, então mostra que carrega, e não "Sem pasta"', () => {
    // Quando
    render(<CaminhoDaPasta pastas={null} pastaId="fin" aoMudar={() => undefined} />);
    // Então
    expect(screen.getByRole('status')).toHaveTextContent('Carregando a pasta…');
    expect(screen.queryByText('Sem pasta')).toBeNull();
  });

  it('quando quem pode mudar escolhe outra pasta, então quem chama recebe a escolhida; sem links, os pedaços são só texto', async () => {
    // Dado
    const aoMudar = vi.fn();
    render(<CaminhoDaPasta pastas={PASTAS} pastaId="pops" aoMudar={aoMudar} />);
    expect(screen.queryByRole('link')).toBeNull();
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Escolher a pasta' }));
    // Então
    expect(screen.getByRole('menuitemradio', { name: 'Escritório › POPs' })).toHaveAttribute('aria-checked', 'true');
    // Quando
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Escritório › POPs › Financeiro' }));
    // Então
    expect(aoMudar).toHaveBeenCalledWith('fin');
  });
});
