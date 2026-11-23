// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Comentario, DadosComentarios, ItemDaAnotacao, Membro } from '../dados';
import { SecaoComentarios } from './Comentarios';
import { ColunaDoCartao } from './PainelCartao';
import { iniciarPreferencias } from './preferencias';
import { GrupoDeSecoes, Recolhivel } from './Recolhivel';
import { ESPERA_AO_DIGITAR } from './tempos';

// A seção usa só as operações de comentários; o mock declara exatamente essas.
const SD = vi.hoisted(() => ({
  comentariosListar: vi.fn<DadosComentarios['comentariosListar']>(), comentarioCriar: vi.fn<DadosComentarios['comentarioCriar']>(),
  comentarioEditar: vi.fn<DadosComentarios['comentarioEditar']>(), comentarioExcluir: vi.fn<DadosComentarios['comentarioExcluir']>(),
  itensMencionados: vi.fn<DadosComentarios['itensMencionados']>()
}));
vi.mock('../dados', () => ({ SD: SD satisfies DadosComentarios }));
// Quem está logado é o Mauro; se é administrador, cada caso diz.
const sessao = vi.hoisted(() => ({ ehAdmin: false }));
const EQUIPE: Membro[] = [
  { id: 'u-mauro', nome: 'Mauro Teixeira Duarte', usuario: 'mauro.duarte', funcao: 'advogado', ativo: true },
  { id: 'u-ana', nome: 'Ana Teste Lima', usuario: 'ana.lima', funcao: 'advogado', ativo: true },
  { id: 'u-bruno', nome: 'Bruno Exemplo Souza', usuario: 'bruno.souza', funcao: 'estagiario', ativo: true }
];
vi.mock('./sessao', () => ({ useCtx: () => ({ perfil: { id: 'u-mauro' }, equipe: EQUIPE, ehAdmin: sessao.ehAdmin }) }));

const comentario = (id: string, autor: string, texto: string, criado_em: string): Comentario =>
  ({ id, autor_id: autor, texto, mencoes: [], criado_em, editado_em: null });
const caixa = () => screen.getByRole('textbox', { name: 'Escrever um comentário' });

describe('Comentários do cartão', () => {
  beforeEach(() => {
    // Os comentários abrem abertos em todos os formatos da janela (#360): nenhuma preferência guardada.
    iniciarPreferencias({});
    sessao.ehAdmin = false;
    Object.values(SD).forEach(f => f.mockReset());
    SD.comentariosListar.mockResolvedValue([
      comentario('c2', 'u-ana', 'Falei com @mauro.duarte', '2026-10-29T15:00:00Z'),
      comentario('c1', 'u-mauro', 'Primeiro contato', '2026-10-28T15:00:00Z')
    ]);
  });

  it('quando o cartão abre, então os comentários vêm na ordem do banco, com o autor e a menção destacada', async () => {
    // Quando
    render(<SecaoComentarios modulo="pessoas" cartaoId="p1" />);
    // Então
    const itens = await screen.findAllByRole('listitem', { name: /Comentário de/ });
    expect(itens.map(i => i.getAttribute('aria-label'))).toEqual(['Comentário de Ana Teste Lima', 'Comentário de Mauro Teixeira Duarte']);
    expect(within(itens[0]).getByText('@mauro.duarte')).toHaveAttribute('title', 'Mauro Teixeira Duarte');
  });

  it('dado o endereço de uma mensagem, quando o cartão abre, então a seção vem aberta e o comentário citado aparece destacado', async () => {
    // Dado: a seção estava recolhida na preferência da pessoa
    iniciarPreferencias({});
    window.history.pushState({}, '', '/pessoas/?id=p1&comentario=c2');
    const rolar = vi.fn();
    Element.prototype.scrollIntoView = rolar;
    // Quando
    render(<SecaoComentarios modulo="pessoas" cartaoId="p1" />);
    // Então
    const citado = (await screen.findAllByRole('listitem', { name: /Comentário de/ }))[0];
    expect(citado).toHaveAttribute('aria-current', 'true');
    expect(rolar).toHaveBeenCalled();
    window.history.pushState({}, '', '/');
  });

  it('dado um aviso do cartão sobre a menção, quando a seção abre, então ele aparece junto da caixa', async () => {
    // Quando
    render(<SecaoComentarios modulo="contratos" cartaoId="k1" aviso="Quem você mencionar passa a ver este contrato." />);
    // Então
    expect(await screen.findByText('Quem você mencionar passa a ver este contrato.')).toBeVisible();
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

  it('dado um texto depois do @, quando a pessoa escolhe um colega, então o cursor já está depois da menção, sem esperar temporizador', async () => {
    // Dado
    render(<SecaoComentarios modulo="pessoas" cartaoId="p1" />);
    const campo = caixa() as HTMLTextAreaElement;
    await userEvent.type(campo, 'Oi @an e mais');
    campo.setSelectionRange('Oi @an'.length, 'Oi @an'.length);
    fireEvent.click(campo);
    // Quando
    fireEvent.keyDown(campo, { key: 'Enter' });
    // Então: sem nenhum await, a tecla seguinte já entra no lugar certo
    expect(campo).toHaveValue('Oi @ana.lima e mais');
    expect(campo.selectionStart).toBe('Oi @ana.lima '.length);
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
    SD.comentarioCriar.mockResolvedValue(comentario('c3', 'u-mauro', 'Novo', '2026-10-29T16:00:00Z'));
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

  it('dado um rascunho na caixa, quando o cartão grava um comentário por outro caminho (a devolução da tarefa, #313), então a lista é relida e o rascunho fica', async () => {
    // Dado
    const { rerender } = render(<SecaoComentarios modulo="tarefas" cartaoId="t1" versao={0} />);
    await screen.findAllByRole('listitem', { name: /Comentário de/ });
    await userEvent.type(caixa(), 'Rascunho');
    SD.comentariosListar.mockResolvedValue([comentario('c3', 'u-ana', 'Tarefa devolvida: falta a guia', '2026-10-30T15:00:00Z')]);
    // Quando
    rerender(<SecaoComentarios modulo="tarefas" cartaoId="t1" versao={1} />);
    // Então
    expect(await screen.findByText('Tarefa devolvida: falta a guia')).toBeInTheDocument();
    expect(caixa()).toHaveValue('Rascunho');
  });

  it.each([
    ['quem escreveu', 'Comentário de Mauro Teixeira Duarte', false, ['Editar', 'Excluir']],
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

describe('Comentários no cartão ao lado (#360)', () => {
  beforeEach(() => {
    // Dado que, antes da #360, a pessoa deixara os comentários recolhidos no painel ao lado (a escolha não vale mais)
    iniciarPreferencias({ 'cartao.comentarios': false });
    Object.values(SD).forEach(f => f.mockReset());
    SD.comentariosListar.mockResolvedValue([comentario('c1', 'u-ana', 'Primeiro contato', '2026-10-28T15:00:00Z')]);
  });

  it('dado o cartão ao lado (sem a coluna), quando abre, então os comentários vêm abertos, embaixo do cartão, com o "Expandir tudo" deles, que não mexe nas seções de cima (#397)', async () => {
    // Quando: o cartão, com o grupo das seções dele (o do painel), uma seção fechada e, embaixo, os comentários
    render(<ColunaDoCartao.Provider value={null}><GrupoDeSecoes><main>
      <Recolhivel titulo="Dados do cartão" icone="lista"><p>Dados</p></Recolhivel>
      <SecaoComentarios modulo="tarefas" cartaoId="t1" />
    </main></GrupoDeSecoes></ColunaDoCartao.Provider>);
    // Então
    const secao = await screen.findByRole('button', { name: /^Comentários\s*1$/ });
    expect(secao).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('main')).toHaveTextContent('Primeiro contato');
    const [doCartao, dosComentarios] = screen.getAllByRole('button', { name: /^(Expandir|Recolher) tudo/ });
    expect(within(screen.getByRole('main')).getAllByRole('button')[0]).toBe(doCartao);
    expect(doCartao).toHaveAccessibleName('Expandir tudo');
    expect(dosComentarios).toHaveAccessibleName('Recolher tudo do pé do cartão');
    expect(dosComentarios.compareDocumentPosition(secao) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Quando: o botão de baixo, acima dos comentários
    await userEvent.click(dosComentarios);
    // Então: fecha os comentários, e a seção de cima continua como estava
    expect(secao).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Dados')).toBeNull();
    // Quando: o botão do alto do cartão
    await userEvent.click(doCartao);
    // Então: abre a seção de cima, e os comentários continuam fechados
    expect(screen.getByText('Dados')).toBeInTheDocument();
    expect(secao).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('Comentários na coluna da direita (a janela no centro, pedido de 18/11)', () => {
  /** A coluna da direita, como a da janela no centro, fora do cartão. */
  let coluna: HTMLElement;
  beforeEach(() => {
    // Dado que a pessoa deixou os comentários recolhidos no painel ao lado (a escolha não vale na coluna)
    iniciarPreferencias({ 'cartao.comentarios': false });
    Object.values(SD).forEach(f => f.mockReset());
    SD.comentariosListar.mockResolvedValue([comentario('c1', 'u-ana', 'Primeiro contato', '2026-10-28T15:00:00Z')]);
    coluna = document.body.appendChild(document.createElement('aside'));
    coluna.setAttribute('aria-label', 'Coluna da direita');
    return () => coluna.remove();
  });
  const naColuna = () => within(screen.getByRole('complementary', { name: 'Coluna da direita' }));

  it('quando o cartão abre no centro, então os comentários são uma seção que recolhe, aberta, com o número e o "Recolher tudo" acima', async () => {
    // Quando
    render(<ColunaDoCartao.Provider value={coluna}><main><SecaoComentarios modulo="tarefas" cartaoId="t1" /></main></ColunaDoCartao.Provider>);
    // Então
    const secao = await naColuna().findByRole('button', { name: /^Comentários\s*1$/ });
    expect(secao).toHaveAttribute('aria-expanded', 'true');
    expect(naColuna().getAllByRole('button')[0]).toHaveAccessibleName(/^Recolher tudo/);
    expect(naColuna().getByRole('textbox', { name: 'Escrever um comentário' })).toBeInTheDocument();
    expect(screen.getByRole('main')).not.toHaveTextContent('Comentários');
  });

  it('dados os comentários na coluna, quando a pessoa clica em "Recolher tudo", então a seção fecha, e o botão passa a "Expandir tudo"', async () => {
    // Dado
    render(<ColunaDoCartao.Provider value={coluna}><SecaoComentarios modulo="tarefas" cartaoId="t1" /></ColunaDoCartao.Provider>);
    await naColuna().findByRole('button', { name: /^Comentários\s*1$/ });
    // Quando
    await userEvent.click(naColuna().getByRole('button', { name: /^Recolher tudo/ }));
    // Então
    expect(naColuna().getByRole('button', { name: /^Comentários\s*1$/ })).toHaveAttribute('aria-expanded', 'false');
    expect(naColuna().queryByRole('textbox', { name: 'Escrever um comentário' })).not.toBeInTheDocument();
    expect(naColuna().getByRole('button', { name: /^Expandir tudo/ })).toBeInTheDocument();
  });

  it('dado um comentário começado no painel ao lado, quando a janela passa para o centro, então ele continua na caixa, agora na coluna', async () => {
    // Dado: ao lado (sem a coluna), com a seção aberta, como ela abre
    const { rerender } = render(<ColunaDoCartao.Provider value={null}><SecaoComentarios modulo="tarefas" cartaoId="t1" /></ColunaDoCartao.Provider>);
    await userEvent.type(await screen.findByRole('textbox', { name: 'Escrever um comentário' }), 'Falar com o cliente');
    // Quando
    rerender(<ColunaDoCartao.Provider value={coluna}><SecaoComentarios modulo="tarefas" cartaoId="t1" /></ColunaDoCartao.Provider>);
    // Então
    expect(await naColuna().findByRole('textbox', { name: 'Escrever um comentário' })).toHaveValue('Falar com o cliente');
  });
});

describe('Menções de itens pelo código, com ! (#297)', () => {
  const item = (modulo: ItemDaAnotacao['modulo'], id: string, codigo: string, nome: string, arquivado_em: string | null = null): ItemDaAnotacao =>
    ({ modulo, id, codigo, nome, arquivado_em });
  const REGISTRO = item('demandas', 'd1', 'D3A1F09C', 'Registro de marca');
  const buscarItens = vi.fn<(termo: string, modulos: readonly string[]) => Promise<ItemDaAnotacao[]>>();
  /** Espera a pausa da digitação passar (e um pouco mais), para ver que a busca não foi feita. */
  const esperarAPausa = () => new Promise(fim => setTimeout(fim, 2 * ESPERA_AO_DIGITAR));
  const abrir = () => render(<MemoryRouter><SecaoComentarios modulo="tarefas" cartaoId="t1" buscarItens={buscarItens} /></MemoryRouter>);

  beforeEach(() => {
    iniciarPreferencias({});
    Object.values(SD).forEach(f => f.mockReset());
    buscarItens.mockReset();
    buscarItens.mockResolvedValue([REGISTRO]);
    SD.comentariosListar.mockResolvedValue([]);
    SD.itensMencionados.mockResolvedValue([]);
  });

  it('quando a pessoa digita ! e parte do título e escolhe o item com Enter, então o código entra no texto, já em destaque', async () => {
    // Dado
    abrir();
    // Quando
    await userEvent.type(caixa(), 'Fazer !regis');
    const opcao = await screen.findByRole('option', { name: /Registro de marca/ });
    expect(opcao).toHaveTextContent('Demanda · !D3A1F09C');
    await userEvent.keyboard('{Enter}');
    // Então
    expect(buscarItens).toHaveBeenLastCalledWith('regis', ['pessoas']);
    expect(caixa()).toHaveValue('Fazer !D3A1F09C ');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByText('!D3A1F09C', { selector: 'mark' })).toBeInTheDocument();
  });

  it('quando a pessoa digita o @ de um colega, então a menção aparece em destaque enquanto ela digita', async () => {
    // Dado
    abrir();
    // Quando
    await userEvent.type(caixa(), 'Oi @ana.lima, tudo bem');
    // Então
    expect(screen.getByText('@ana.lima', { selector: 'mark' })).toBeInTheDocument();
    expect(screen.queryByText('tudo bem', { selector: 'mark' })).not.toBeInTheDocument();
  });

  it.each([
    ['um ! no fim da frase', 'Urgente!'],
    ['um ! seguido de espaço', 'Atenção ! agora']
  ])('quando a pessoa digita %s, então nada é buscado e nenhuma lista abre', async (_caso, texto) => {
    // Dado
    abrir();
    // Quando
    await userEvent.type(caixa(), texto);
    await esperarAPausa();
    // Então
    expect(buscarItens).not.toHaveBeenCalled();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('dado um comentário com um item visto, um arquivado e um que a pessoa não vê, quando ele aparece, então só os vistos abrem, e o outro mostra só o código', async () => {
    // Dado
    SD.comentariosListar.mockResolvedValue([comentario('c1', 'u-ana', 'Ver !D3A1F09C, !7B42C0DE e !FFFF0000.', '2026-11-20T15:00:00Z')]);
    SD.itensMencionados.mockResolvedValue([REGISTRO, item('demandas', 'd2', '7B42C0DE', 'Busca de anterioridade', '2026-11-01T00:00:00Z')]);
    // Quando
    abrir();
    // Então
    const visto = await screen.findByRole('link', { name: '!D3A1F09C Registro de marca' });
    expect(visto).toHaveAttribute('href', '/demandas/?id=d1');
    expect(visto).toHaveTextContent('!D3A1F09C Registro de marca');
    const arquivado = screen.getByRole('link', { name: '!7B42C0DE Busca de anterioridade · arquivado' });
    expect(arquivado).toHaveAccessibleDescription('Abrir Demanda 7B42C0DE: Busca de anterioridade, que está arquivado');
    const semAcesso = screen.getByTitle('Você não tem acesso a este item, ou ele não existe mais');
    expect(semAcesso).toHaveTextContent('!FFFF0000 · sem acesso ou excluído');
    expect(screen.getAllByRole('link')).toHaveLength(2);
    expect(SD.itensMencionados).toHaveBeenCalledTimes(1);
    expect(SD.itensMencionados).toHaveBeenCalledWith(['7B42C0DE', 'D3A1F09C', 'FFFF0000']);
  });

  it('dado uma consulta dos itens que falhou, quando um comentário novo entra, então os códigos são consultados de novo e o atalho aparece', async () => {
    // Dado
    SD.comentariosListar.mockResolvedValue([comentario('c1', 'u-ana', 'Ver !D3A1F09C', '2026-11-20T15:00:00Z')]);
    SD.itensMencionados.mockRejectedValueOnce(new Error('Sem conexão')).mockResolvedValue([REGISTRO]);
    SD.comentarioCriar.mockResolvedValue(comentario('c2', 'u-mauro', 'Combinado', '2026-11-20T16:00:00Z'));
    abrir();
    await waitFor(() => expect(SD.itensMencionados).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('!D3A1F09C')).toHaveAttribute('title', 'Item mencionado');
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    // Quando
    await userEvent.type(caixa(), 'Combinado');
    await userEvent.keyboard('{Control>}{Enter}{/Control}');
    // Então
    expect(await screen.findByRole('link', { name: '!D3A1F09C Registro de marca' })).toHaveAttribute('href', '/demandas/?id=d1');
    expect(SD.itensMencionados).toHaveBeenCalledTimes(2);
  });

  it('dado um item arquivado com o cartão aberto, quando a lista muda, então a menção passa a avisar que ele está arquivado', async () => {
    // Dado
    SD.comentariosListar.mockResolvedValue([comentario('c1', 'u-ana', 'Ver !D3A1F09C', '2026-11-20T15:00:00Z')]);
    SD.itensMencionados.mockResolvedValueOnce([REGISTRO]).mockResolvedValue([{ ...REGISTRO, arquivado_em: '2026-11-20T15:30:00Z' }]);
    SD.comentarioCriar.mockResolvedValue(comentario('c2', 'u-mauro', 'Arquivei', '2026-11-20T16:00:00Z'));
    abrir();
    await screen.findByRole('link', { name: '!D3A1F09C Registro de marca' });
    // Quando
    await userEvent.type(caixa(), 'Arquivei');
    await userEvent.keyboard('{Control>}{Enter}{/Control}');
    // Então
    expect(await screen.findByRole('link', { name: '!D3A1F09C Registro de marca · arquivado' })).toBeInTheDocument();
  });

  it('dado um !palavra que não achou nada na edição, quando a pessoa aperta Esc, então a edição é cancelada já na primeira vez', async () => {
    // Dado
    SD.comentariosListar.mockResolvedValue([comentario('c1', 'u-mauro', 'Primeiro contato', '2026-11-20T15:00:00Z')]);
    buscarItens.mockResolvedValue([]);
    abrir();
    await userEvent.click(await screen.findByRole('button', { name: 'Editar' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Editar o comentário' }), ' !urgente');
    await esperarAPausa();
    expect(buscarItens).toHaveBeenCalledWith('urgente', ['pessoas']);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    // Quando
    await userEvent.keyboard('{Escape}');
    // Então
    expect(screen.queryByRole('textbox', { name: 'Editar o comentário' })).not.toBeInTheDocument();
    expect(screen.getByText('Primeiro contato')).toBeInTheDocument();
  });

  it.each([
    ['sem lista aberta (o !palavra não achou nada)', [], 'Ver !urgente', 1],
    ['com a lista do ! aberta', [REGISTRO], 'Ver !regis', 0]
  ])('dado a caixa nova %s, quando a pessoa aperta Esc, então o cartão recebe a tecla %#: %i vez(es)', async (_caso, achados, texto, vezes) => {
    // Dado
    buscarItens.mockResolvedValue(achados);
    const cartaoRecebeuOEsc = vi.fn();
    render(<MemoryRouter><div onKeyDown={e => { if (e.key === 'Escape') cartaoRecebeuOEsc(); }}>
      <SecaoComentarios modulo="tarefas" cartaoId="t1" buscarItens={buscarItens} />
    </div></MemoryRouter>);
    await userEvent.type(caixa(), texto);
    await esperarAPausa();
    // Quando
    await userEvent.keyboard('{Escape}');
    // Então
    expect(cartaoRecebeuOEsc).toHaveBeenCalledTimes(vezes);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(caixa()).toHaveValue(texto);
  });
});
