// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// A anotação aberta na janela do cartão, como uma nota do Obsidian (pedidos de 18/11): as caixinhas da lista de tarefas (#344),
// marcadas no próprio editor uma atrás da outra com o banco demorando a responder; o texto que já abre para escrever e salva
// sozinho, com a trava otimista (ninguém grava por cima do texto de outra pessoa); sair com a gravação a caminho; o título mudado
// no lugar; o ícone de etiqueta no topo e os selos entre o topo e o título; a etiqueta e o ⋯ junto dos botões da janela; o
// "Expandir tudo" da coluna da direita; e o que quem só lê vê.
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Anotacao, DadosAnotacoes, DadosComentarios, DadosDemandas, DadosEtiquetas, DadosPastas, DadosSessao, Demanda, Etiqueta, Pasta } from '../dados';
import { ITENS_DA_ANOTACAO } from '../dados/limites';
import { NOVO_ESPERA_A_ANOTACAO } from '../regras/novoNaAnotacao';
import { acharEditor, editorDe, escreverNoEditor, textoDoEditor } from '../testes/editorAoVivo';
import { Avisos } from '../ui/avisos';
import { SEM_SAIR_DA_TELA } from '../ui/AvisoAoSair';
import { lojaDeEtiquetas } from '../ui/Etiquetas';
import { lojaDePastas } from '../ui/pastasDoEscritorio';
import { ESPERA_PARA_SALVAR } from '../ui/tempos';
import { Janelas } from '../ui/janela';
import { BotoesNoPainel, ColunaDoCartao } from '../ui/PainelCartao';
import { iniciarPreferencias } from '../ui/preferencias';
import { CartaoAnotacao, ITEM_JA_LIGADO } from './CartaoAnotacao';

// O cartão lê a anotação, os itens ligados, o histórico, as etiquetas e as pastas (#342), e grava o texto (com a trava otimista)
// e o título; a anotação nova (#369) vai ao banco e lê o item de onde se veio; o mock declara exatamente essas operações.
const {
  anotacaoObter, anotacaoItens, anotacaoHistorico, anotacaoAtualizar, anotacaoGravarTexto, anotacaoLigar, anotacaoDesligar, itensParaLigar, salvarPreferencia,
  etiquetasListar, etiquetasDoCartao, etiquetaAplicar, pastasListar, comentariosListar, comentarioCriar, anotacaoCriar, demandaObter
} = vi.hoisted(() => ({
  anotacaoCriar: vi.fn<DadosAnotacoes['anotacaoCriar']>(),
  demandaObter: vi.fn<DadosDemandas['demandaObter']>(),
  comentariosListar: vi.fn<DadosComentarios['comentariosListar']>(async () => []),
  comentarioCriar: vi.fn<DadosComentarios['comentarioCriar']>(),
  anotacaoLigar: vi.fn<DadosAnotacoes['anotacaoLigar']>(),
  anotacaoDesligar: vi.fn<DadosAnotacoes['anotacaoDesligar']>(async () => {}),
  itensParaLigar: vi.fn<DadosAnotacoes['itensParaLigar']>(async () => []),
  etiquetasListar: vi.fn<DadosEtiquetas['etiquetasListar']>(async () => []),
  etiquetasDoCartao: vi.fn<DadosEtiquetas['etiquetasDoCartao']>(async () => []),
  etiquetaAplicar: vi.fn<DadosEtiquetas['etiquetaAplicar']>(async () => {}),
  pastasListar: vi.fn<DadosPastas['pastasListar']>(async () => []),
  anotacaoObter: vi.fn<DadosAnotacoes['anotacaoObter']>(),
  anotacaoItens: vi.fn<DadosAnotacoes['anotacaoItens']>(async () => ({ visiveis: [], ocultos: 0 })),
  anotacaoHistorico: vi.fn<DadosAnotacoes['anotacaoHistorico']>(async () => []),
  anotacaoAtualizar: vi.fn<DadosAnotacoes['anotacaoAtualizar']>(),
  anotacaoGravarTexto: vi.fn<DadosAnotacoes['anotacaoGravarTexto']>(),
  salvarPreferencia: vi.fn<DadosSessao['salvarPreferencia']>(async () => {})
}));
vi.mock('../dados', () => ({
  SD: { anotacaoObter, anotacaoItens, anotacaoHistorico, anotacaoAtualizar, anotacaoGravarTexto, anotacaoLigar, anotacaoDesligar, itensParaLigar, salvarPreferencia, etiquetasListar, etiquetasDoCartao, etiquetaAplicar,
    pastasListar, comentariosListar, comentarioCriar, anotacaoCriar, demandaObter } satisfies
    Pick<DadosAnotacoes & DadosSessao & DadosEtiquetas & DadosPastas & DadosComentarios & DadosDemandas, 'anotacaoCriar' | 'demandaObter' | 'comentariosListar' | 'comentarioCriar' | 'anotacaoObter' | 'anotacaoItens' | 'anotacaoHistorico' | 'anotacaoAtualizar' | 'anotacaoGravarTexto' | 'anotacaoLigar'
      | 'anotacaoDesligar' | 'itensParaLigar' | 'salvarPreferencia' | 'etiquetasListar' | 'etiquetasDoCartao' | 'etiquetaAplicar' | 'pastasListar'>
}));
/** A equipe do escritório: quem escreve e alguém com quem compartilhar (com o @usuario, para os comentários). */
const EQUIPE = [{ id: 'u-mauro', nome: 'Mauro', usuario: 'mauro', ativo: true }, { id: 'u-bruno', nome: 'Bruno', usuario: 'bruno', ativo: true }];
vi.mock('../ui/sessao', () => ({ useCtx: () => ({ perfil: { id: 'u-mauro', papel: 'usuario' }, equipe: EQUIPE, ehAdmin: false, escritorio: { modulos: {} } }) }));

/**
 * O "banco": o texto guardado, a marca de cada versão (o atualizado_em, que muda a cada gravação) e as gravações que ainda não
 * responderam, na ordem em que chegaram.
 */
const banco = { texto: '', titulo: '', marca: 'm0', versoes: 0, esperando: [] as { responder: (ok: boolean) => void }[] };
/** Uma gravação mudou a anotação no "banco": a marca é outra. */
const novaMarca = () => { banco.marca = 'm' + ++banco.versoes; return banco.marca; };
const anotacao = (texto: string): Anotacao => ({
  id: 'a1', codigo: 'A-1', titulo: banco.titulo || 'Lista do protocolo', texto, responsavel_id: 'u-mauro', participantes: [], ligada_a: [], pasta_id: null,
  arquivado_em: null, arquivado_por: null, criado_por: 'u-mauro', criado_em: '2026-11-10T12:00:00Z', atualizado_por: null, atualizado_em: banco.marca
});
/** A gravação do texto, que espera a resposta; com a marca velha (outra pessoa mudou a anotação), não grava e responde null. */
const gravacaoLenta: DadosAnotacoes['anotacaoGravarTexto'] = (_id, texto, esperado) => new Promise((ok, erro) => {
  banco.esperando.push({
    responder: deu => {
      if (!deu) { erro(new Error('Sem conexão.')); return; }
      if (esperado !== banco.marca) { ok(null); return; }
      banco.texto = texto;
      ok(novaMarca());
    }
  });
});
/** A gravação do título (e de outros campos), que também espera a resposta. */
const atualizacaoLenta: DadosAnotacoes['anotacaoAtualizar'] = (id, dados) => new Promise(ok => {
  banco.esperando.push({
    responder: () => {
      banco.texto = dados.texto ?? banco.texto;
      banco.titulo = dados.titulo ?? banco.titulo;
      novaMarca();
      ok({ id, codigo: 'A-1' });
    }
  });
});
/** Outra pessoa muda o texto no banco (sem passar por esta tela). */
const outraPessoaEscreve = (texto: string) => { banco.texto = texto; novaMarca(); };
/** O banco responde à gravação mais antiga ainda sem resposta (ok, ou com erro). */
async function responder(ok = true) {
  await act(async () => { banco.esperando.shift()!.responder(ok); });
}
const caixinha = (nome: string) => screen.getByRole('checkbox', { name: nome });
/** Marca (ou desmarca) a caixinha no editor ao vivo: o clique não leva o cursor para a linha (veja EditorAoVivoCodeMirror). */
const clicarNaCaixinha = (nome: string) => fireEvent.mouseDown(caixinha(nome));
/** A pausa depois da qual o texto mudado é gravado sozinho (com o relógio do teste). */
const esperarAPausa = () => act(async () => { vi.advanceTimersByTime(ESPERA_PARA_SALVAR); });
/** Duas etiquetas do escritório, para os selos do topo. */
const URGENTE: Etiqueta = { id: 'e-urgente', cor: 'vermelho', texto: 'Urgente', criado_por: 'u-mauro' };
const CLIENTE: Etiqueta = { id: 'e-cliente', cor: 'azul', texto: 'Cliente', criado_por: 'u-mauro' };

function zerarBanco(texto = '- [ ] A\n- [ ] B\n- [ ] C') {
  iniciarPreferencias({});
  Object.assign(banco, { texto, titulo: '', marca: 'm0', versoes: 0, esperando: [] });
  anotacaoObter.mockReset();
  anotacaoObter.mockImplementation(async () => anotacao(banco.texto));
  anotacaoGravarTexto.mockReset();
  anotacaoGravarTexto.mockImplementation(gravacaoLenta);
  anotacaoAtualizar.mockReset();
  anotacaoAtualizar.mockImplementation(atualizacaoLenta);
  anotacaoItens.mockClear();
  anotacaoHistorico.mockClear();
  salvarPreferencia.mockClear();
  lojaDeEtiquetas.mudar([URGENTE, CLIENTE]);
  etiquetasListar.mockImplementation(async () => [URGENTE, CLIENTE]);
  etiquetasDoCartao.mockReset();
  etiquetasDoCartao.mockImplementation(async () => []);
  etiquetaAplicar.mockClear();
}

// A regra mudou (pedido de 18/11): sem o modo de ler (o livro), as caixinhas se marcam no próprio editor, e o texto marcado é
// gravado como o resto, pela mesma fila: as falhas e o texto de outra pessoa seguem as regras do texto (testadas abaixo).
describe('Caixinhas marcadas seguidas no cartão da anotação (#344)', () => {
  beforeEach(() => { zerarBanco(); });
  afterEach(() => { vi.useRealTimers(); });

  it('dado o banco lento, quando a pessoa marca A e, com a gravação de A a caminho, marca B e C, então nenhuma marcação se perde', async () => {
    // Dado: o editor já chegou quando o relógio passa a ser o do teste
    abrirCartao();
    await acharEditor();
    vi.useFakeTimers();
    expect(caixinha('A')).not.toBeChecked();
    // Quando: marca A, e a pausa a grava; enquanto o banco não responde, marca B e C
    clicarNaCaixinha('A');
    await esperarAPausa();
    clicarNaCaixinha('B');
    clicarNaCaixinha('C');
    await responder();
    await esperarAPausa();
    await responder();
    // Então: a segunda gravação partiu da primeira (e da marca que ela deixou), e o banco fica com as três
    expect(anotacaoGravarTexto.mock.calls.map(([, texto, marca]) => [texto, marca])).toEqual([
      ['- [x] A\n- [ ] B\n- [ ] C', 'm0'], ['- [x] A\n- [x] B\n- [x] C', 'm1']
    ]);
    expect(banco.texto).toBe('- [x] A\n- [x] B\n- [x] C');
    expect(anotacaoObter).toHaveBeenCalledOnce();   // só a leitura do começo
    expect(caixinha('A')).toBeChecked();
    expect(caixinha('B')).toBeChecked();
    expect(caixinha('C')).toBeChecked();
    expect(screen.getByText('Salvo')).toBeInTheDocument();
  });
});

/**
 * A anotação num roteador de verdade (o aviso de sair com algo por gravar precisa dele), com uma página de fora. Com `coluna`, como
 * na janela no centro: o cartão recebe a coluna da direita (ColunaDoCartao), para onde vão as seções. Com `botoes`, como ao lado:
 * o lugar dos botões do cartão na linha dos botões da janela (BotoesNoPainel).
 */
function abrirCartao(aoMudar: () => void = () => undefined, coluna: HTMLElement | null = null, botoes: HTMLElement | null = null) {
  const roteador = createMemoryRouter([
    { path: '/', element: <BotoesNoPainel.Provider value={botoes}><ColunaDoCartao.Provider value={coluna}>
      <CartaoAnotacao id="a1" aoMudar={aoMudar} aoFechar={() => undefined} />
    </ColunaDoCartao.Provider></BotoesNoPainel.Provider> },
    { path: '/fora', element: <p>Outra página</p> }
  ]);
  const tela = render(<><RouterProvider router={roteador} /><Avisos /><Janelas /></>);
  return { roteador, tela };
}
const caixa = () => screen.getByRole('textbox', { name: 'Texto' });
/** Escreve no fim do texto (veja testes/editorAoVivo.ts), depois de o editor chegar. */
const escrever = async (texto: string) => escreverNoEditor(await acharEditor(), texto);
const situacao = () => screen.getByRole('status', { name: 'Gravação do texto' });

describe('A anotação aberta, como uma nota do Obsidian (pedido de 18/11)', () => {
  beforeEach(() => { zerarBanco(); });

  // A regra mudou (pedido de 18/11): a seção "Etiquetas" e o livro (o modo de ler) saíram; no topo fica só o ícone de etiqueta.
  it('dado quem altera e uma anotação sem etiquetas, quando ela abre, então o texto já está na caixa de escrever, há só o ícone de etiqueta, sem a seção, sem a linha dos selos e sem o livro', async () => {
    // Quando
    abrirCartao();
    // Então
    expect(textoDoEditor(await acharEditor())).toBe('- [ ] A\n- [ ] B\n- [ ] C');
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Escolher etiquetas' })).toHaveLength(1);
    expect(screen.queryByRole('region', { name: 'Etiquetas' })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Etiquetas' })).not.toBeInTheDocument();
    expect(screen.queryByText('Nenhuma etiqueta.')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Modo de leitura' })).not.toBeInTheDocument();
  });

  // A regra mudou (pedido de 18/11): antes, as etiquetas ficavam numa seção entre o título e o texto.
  it('dada uma anotação com duas etiquetas, quando ela abre, então os selos ficam numa linha logo abaixo do topo e acima do título', async () => {
    // Dado
    etiquetasDoCartao.mockImplementation(async () => [URGENTE.id, CLIENTE.id]);
    // Quando
    abrirCartao();
    // Então
    const selos = await screen.findByRole('group', { name: 'Etiquetas' });
    expect(within(selos).getByText('Urgente')).toBeInTheDocument();
    expect(within(selos).getByText('Cliente')).toBeInTheDocument();
    const botao = screen.getByRole('button', { name: 'Escolher etiquetas' });
    const titulo = screen.getByRole('button', { name: /Lista do protocolo/ });
    const texto = await screen.findByRole('textbox', { name: 'Texto' });
    expect(botao.compareDocumentPosition(selos) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(selos.compareDocumentPosition(titulo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(titulo.compareDocumentPosition(texto) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('quando a pessoa clica no ícone de etiqueta e marca uma, então a mesma escolha dos outros cartões aplica a etiqueta, e o selo aparece acima do título', async () => {
    // Dado: o banco guarda a etiqueta aplicada (o cartão lê de novo depois de aplicar)
    const aplicadas: string[] = [];
    etiquetaAplicar.mockImplementation(async (_modulo, _id, etiqueta) => { aplicadas.push(etiqueta); });
    etiquetasDoCartao.mockImplementation(async () => [...aplicadas]);
    abrirCartao();
    await acharEditor();
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Escolher etiquetas' }));
    const escolha = within(screen.getByRole('dialog', { name: 'Escolher etiquetas' }));
    await userEvent.click(escolha.getByRole('checkbox', { name: 'Urgente' }));
    // Então
    expect(etiquetaAplicar).toHaveBeenCalledWith('anotacoes', 'a1', URGENTE.id);
    expect(within(await screen.findByRole('group', { name: 'Etiquetas' })).getByText('Urgente')).toBeInTheDocument();
    expect(screen.getByRole('form', { name: 'Nova etiqueta' })).toBeInTheDocument();
  });

  // A regra mudou (pedido de 18/11): a anotação voltou à janela do cartão, que tem o X dela; a anotação não tem mais o seu.
  it('dada a linha dos botões da janela (ao lado), quando a anotação abre, então a etiqueta e o ⋯ vão para lá, e a anotação não tem um X próprio', async () => {
    // Dado
    const linha = document.body.appendChild(document.createElement('div'));
    linha.setAttribute('aria-label', 'Botões da janela');
    linha.setAttribute('role', 'toolbar');
    // Quando
    abrirCartao(undefined, null, linha);
    // Então
    const naLinha = within(screen.getByRole('toolbar', { name: 'Botões da janela' }));
    expect(await naLinha.findByRole('button', { name: 'Escolher etiquetas' })).toBeInTheDocument();
    expect(naLinha.getByRole('button', { name: 'Mais ações da anotação' })).toBeInTheDocument();
    expect(within(screen.getByRole('article')).queryByRole('button', { name: 'Mais ações da anotação' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Fechar/ })).not.toBeInTheDocument();
    linha.remove();
  });

  it('quando a pessoa escreve e aperta Ctrl+S, então só o texto é gravado, com a marca da leitura, sem o aviso de "Anotação atualizada"', async () => {
    // Dado
    abrirCartao();
    await escrever(' feito');
    // (os avisos dos casos anteriores podem ainda estar no pé da tela: confere que nenhum novo apareceu)
    const avisosAntes = screen.queryAllByText('Anotação atualizada.').length;
    // Quando
    await userEvent.keyboard('{Control>}s{/Control}');
    await responder();
    // Então
    expect(anotacaoGravarTexto).toHaveBeenCalledExactlyOnceWith('a1', '- [ ] A\n- [ ] B\n- [ ] C feito', 'm0');
    expect(anotacaoAtualizar).not.toHaveBeenCalled();
    expect(banco.texto).toBe('- [ ] A\n- [ ] B\n- [ ] C feito');
    expect(screen.queryAllByText('Anotação atualizada.')).toHaveLength(avisosAntes);
    expect(await screen.findByText('Salvo')).toBeInTheDocument();
  });

  it('quando o texto é gravado sozinho, então a página não é avisada, e nem os itens ligados nem o histórico são lidos de novo', async () => {
    // Dado
    const aoMudar = vi.fn();
    abrirCartao(aoMudar);
    await escrever('!');
    const itensLidos = anotacaoItens.mock.calls.length, historicoLido = anotacaoHistorico.mock.calls.length;
    // Quando
    await userEvent.keyboard('{Control>}s{/Control}');
    await responder();
    // Então
    expect(await screen.findByText('Salvo')).toBeInTheDocument();
    expect(aoMudar).not.toHaveBeenCalled();
    expect(anotacaoItens).toHaveBeenCalledTimes(itensLidos);
    expect(anotacaoHistorico).toHaveBeenCalledTimes(historicoLido);
    expect(anotacaoObter).toHaveBeenCalledOnce();
  });

  it('dado que outra pessoa mudou o texto depois que a anotação abriu, quando a pessoa grava, então nada é gravado por cima e ela escolhe; "Manter o meu texto" grava o dela', async () => {
    // Dado
    abrirCartao();
    await escrever(' meu');
    outraPessoaEscreve('Texto de outra pessoa');
    // Quando
    await userEvent.keyboard('{Control>}s{/Control}');
    await responder();
    // Então: a gravação com a marca velha não passou; a anotação foi lida de novo, e o texto da outra pessoa ficou
    expect(await screen.findByRole('alert')).toHaveTextContent('Outra pessoa mudou o texto desta anotação enquanto você escrevia');
    expect(banco.texto).toBe('Texto de outra pessoa');
    expect(situacao()).toHaveTextContent('Outra pessoa mudou esta anotação. Escolha qual texto fica.');
    expect(textoDoEditor(caixa())).toBe('- [ ] A\n- [ ] B\n- [ ] C meu');
    // Quando: a pessoa escreve mais, e o salvar sozinho não grava por cima enquanto ela não escolhe
    await escrever('!');
    await userEvent.keyboard('{Control>}s{/Control}');
    expect(anotacaoGravarTexto).toHaveBeenCalledOnce();
    // Quando: ela escolhe manter o seu
    await userEvent.click(screen.getByRole('button', { name: 'Manter o meu texto' }));
    await responder();
    // Então
    expect(anotacaoGravarTexto).toHaveBeenLastCalledWith('a1', '- [ ] A\n- [ ] B\n- [ ] C meu!', 'm1');
    expect(banco.texto).toBe('- [ ] A\n- [ ] B\n- [ ] C meu!');
    expect(await screen.findByText('Salvo')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Manter o meu texto' })).not.toBeInTheDocument();
  });

  it('dado o conflito com o texto de outra pessoa, quando a pessoa escolhe "Usar o texto gravado", então a caixa mostra o texto dela e nada é gravado', async () => {
    // Dado
    abrirCartao();
    await escrever(' meu');
    outraPessoaEscreve('Texto de outra pessoa');
    await userEvent.keyboard('{Control>}s{/Control}');
    await responder();
    // Quando
    await userEvent.click(await screen.findByRole('button', { name: 'Usar o texto gravado' }));
    // Então
    expect(textoDoEditor(caixa())).toBe('Texto de outra pessoa');
    expect(situacao()).toHaveTextContent('Salvo');
    expect(anotacaoGravarTexto).toHaveBeenCalledOnce();
    expect(banco.texto).toBe('Texto de outra pessoa');
  });

  it('quando a pessoa muda o título no lugar e aperta Enter, então só o título é gravado e ele aparece uma vez, sem campo', async () => {
    // Dado
    abrirCartao();
    await userEvent.click(await screen.findByRole('button', { name: 'Lista do protocolo' }));
    // Quando
    const campo = screen.getByRole('textbox', { name: 'Título' });
    await userEvent.clear(campo);
    await userEvent.type(campo, 'Lista do cartório{Enter}');
    await responder();
    // Então
    expect(anotacaoAtualizar).toHaveBeenCalledExactlyOnceWith('a1', { titulo: 'Lista do cartório' });
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Lista do cartório');
    expect(screen.queryByRole('textbox', { name: 'Título' })).not.toBeInTheDocument();
  });

  // A regra mudou: antes, sair com o texto em edição perguntava "Sair sem salvar?"; agora o texto salva sozinho, e sair grava antes.
  it('dado um texto ainda por gravar, quando a pessoa sai por um link, então ele é gravado antes e ela sai sem pergunta', async () => {
    // Dado
    const { roteador } = abrirCartao();
    await escrever('!');
    // Quando
    await act(async () => { void roteador.navigate('/fora'); });
    await responder();
    // Então
    expect(await screen.findByText('Outra página')).toBeInTheDocument();
    expect(anotacaoGravarTexto).toHaveBeenCalledExactlyOnceWith('a1', '- [ ] A\n- [ ] B\n- [ ] C!', 'm0');
    expect(screen.queryByRole('dialog', { name: 'Sair sem salvar?' })).not.toBeInTheDocument();
  });

  it('dada a gravação que falha, quando a pessoa sai por um link, então a pergunta aparece, e o que ela escreveu fica se ela continuar', async () => {
    // Dado
    anotacaoGravarTexto.mockImplementation(() => Promise.reject(new Error('Sem conexão.')));
    const { roteador } = abrirCartao();
    await escrever('!');
    // Quando
    await act(async () => { void roteador.navigate('/fora'); });
    await userEvent.click(await screen.findByRole('button', { name: 'Continuar no cadastro' }));
    // Então
    expect(screen.queryByText('Outra página')).not.toBeInTheDocument();
    expect(textoDoEditor(caixa())).toBe('- [ ] A\n- [ ] B\n- [ ] C!');
  });

  it('dada uma gravação lenta já a caminho, quando a pessoa sai por um link, então a saída espera; se a gravação falhar, a pergunta aparece e o texto continua na caixa', async () => {
    // Dado: a primeira gravação demora e falha; a que a saída pede de novo também falha
    anotacaoGravarTexto.mockReset();
    anotacaoGravarTexto.mockRejectedValue(new Error('Sem conexão.'));
    anotacaoGravarTexto.mockImplementationOnce(gravacaoLenta);
    const { roteador } = abrirCartao();
    await escrever('!');
    await userEvent.keyboard('{Control>}s{/Control}');
    expect(situacao()).toHaveTextContent('Salvando…');
    // Quando
    await act(async () => { void roteador.navigate('/fora'); });
    // Então: enquanto a gravação está a caminho, a pessoa continua na anotação
    expect(screen.queryByText('Outra página')).not.toBeInTheDocument();
    // Quando: a gravação falha
    await responder(false);
    // Então
    await userEvent.click(await screen.findByRole('button', { name: 'Continuar no cadastro' }));
    expect(screen.queryByText('Outra página')).not.toBeInTheDocument();
    expect(textoDoEditor(caixa())).toBe('- [ ] A\n- [ ] B\n- [ ] C!');
  });
});

describe('A anotação que a pessoa só lê', () => {
  beforeEach(() => {
    iniciarPreferencias({});
    anotacaoObter.mockReset();
    // De outra pessoa, sem a pessoa na equipe dela: só para ler, com uma etiqueta.
    anotacaoObter.mockImplementation(async () => ({ ...anotacao('Texto **formatado**.'), criado_por: 'u-bruno', responsavel_id: 'u-bruno' }));
    lojaDeEtiquetas.mudar([URGENTE, CLIENTE]);
    etiquetasDoCartao.mockReset();
    etiquetasDoCartao.mockImplementation(async () => [URGENTE.id]);
  });

  it('quando abre, então vê o texto formatado e o selo da etiqueta, sem caixa, sem barra, sem o livro, sem o ícone de etiqueta nem o x do selo, e o ⋯ só baixa e duplica', async () => {
    // Quando
    abrirCartao();
    // Então
    expect(await screen.findByText('formatado')).toBeInTheDocument();
    // A única caixa de escrever é a do comentário: quem vê a anotação comenta, como nos outros cartões (#364)
    expect(screen.getAllByRole('textbox').map(c => c.getAttribute('aria-label'))).toEqual(['Escrever um comentário']);
    expect(screen.queryByRole('toolbar', { name: 'Formatação do texto' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Modo de leitura' })).not.toBeInTheDocument();
    expect(within(await screen.findByRole('group', { name: 'Etiquetas' })).getByText('Urgente')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Escolher etiquetas' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tirar a etiqueta Urgente' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Mais ações da anotação' }));
    expect(screen.getAllByRole('menuitem').map(b => b.textContent?.trim())).toEqual(['Duplicar', 'Baixar .md']);
  });
});

describe('Os comentários da anotação (#364)', () => {
  beforeEach(() => {
    zerarBanco('Texto.');
    comentariosListar.mockReset();
    comentariosListar.mockResolvedValue([
      { id: 'c1', autor_id: 'u-bruno', texto: 'Primeiro comentário', mencoes: [], criado_em: '2026-11-18T10:00:00Z', editado_em: null },
      { id: 'c2', autor_id: 'u-mauro', texto: 'Segundo comentário', mencoes: [], criado_em: '2026-11-18T09:00:00Z', editado_em: null }
    ]);
    comentarioCriar.mockReset();
    comentarioCriar.mockImplementation(async (_modulo, _id, texto) => ({ id: 'c3', autor_id: 'u-mauro', texto, mencoes: [], criado_em: '2026-11-18T11:00:00Z', editado_em: null }));
  });
  /** Os títulos das seções que recolhem, na ordem em que aparecem. */
  const secoes = () => screen.getAllByRole('button', { name: /^(Comentários|Ligada a|Histórico de alterações)/ });

  it('quando a anotação abre, então "Comentários" vem antes de "Ligada a" e do histórico, aberta e com o número; as outras, recolhidas', async () => {
    // Quando
    abrirCartao();
    // Então
    expect(await screen.findByText('Primeiro comentário')).toBeInTheDocument();
    expect(comentariosListar).toHaveBeenCalledWith('anotacoes', 'a1');
    expect(secoes().map(b => b.textContent?.replace(/\d+$/, '').trim())).toEqual(['Comentários', 'Ligada a', 'Histórico de alterações']);
    const [comentarios, ligada, historico] = secoes();
    expect(comentarios).toHaveTextContent(/^Comentários\s*2$/);
    expect(comentarios).toHaveAttribute('aria-expanded', 'true');
    expect(ligada).toHaveAttribute('aria-expanded', 'false');
    expect(historico).toHaveAttribute('aria-expanded', 'false');
  });

  it('dada a anotação sem a coluna (ao lado), quando abre, então o rodapé com o código e as datas vem por último, depois do histórico, como nos outros cartões', async () => {
    // Quando
    abrirCartao();
    await screen.findByText('Primeiro comentário');
    // Então
    const historico = screen.getByRole('button', { name: /^Histórico de alterações/ });
    // O rodapé, com a data (o "Criada em" da faixa das datas, #383, fica no alto, sem a data junto)
    const rodape = screen.getByText(/Criada em \d{2}\/\d{2}\/\d{4}/);
    expect(historico.compareDocumentPosition(rodape) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('dada a coluna da direita, como na janela no centro, quando a anotação abre, então os comentários vão para lá como seção que recolhe, primeiro, aberta e com o número', async () => {
    // Dado: a coluna da direita fora do cartão, como a da janela
    const coluna = document.body.appendChild(document.createElement('aside'));
    coluna.setAttribute('aria-label', 'Coluna da direita');
    // Quando
    abrirCartao(undefined, coluna);
    // Então: na coluna, as três seções que recolhem, na ordem; os comentários não viram o bloco fixo dos outros cartões
    const naColuna = within(screen.getByRole('complementary', { name: 'Coluna da direita' }));
    expect(await naColuna.findByText('Primeiro comentário')).toBeInTheDocument();
    const [comentarios, ligada, historico] = naColuna.getAllByRole('button', { name: /^(Comentários|Ligada a|Histórico de alterações)/ });
    expect([comentarios, ligada, historico].map(b => b.textContent?.replace(/\d+$/, '').trim())).toEqual(['Comentários', 'Ligada a', 'Histórico de alterações']);
    expect(comentarios).toHaveTextContent(/^Comentários\s*2$/);
    expect(comentarios).toHaveAttribute('aria-expanded', 'true');
    expect(ligada).toHaveAttribute('aria-expanded', 'false');
    expect(historico).toHaveAttribute('aria-expanded', 'false');
    coluna.remove();
  });

  it('dada a coluna da direita, quando a pessoa clica em "Expandir tudo", no topo dela, então as três seções abrem, e o botão passa a "Recolher tudo", que fecha todas', async () => {
    // Dado
    const coluna = document.body.appendChild(document.createElement('aside'));
    coluna.setAttribute('aria-label', 'Coluna da direita');
    abrirCartao(undefined, coluna);
    const naColuna = within(screen.getByRole('complementary', { name: 'Coluna da direita' }));
    await naColuna.findByText('Primeiro comentário');
    const titulos = () => naColuna.getAllByRole('button', { name: /^(Comentários|Ligada a|Histórico de alterações)/ });
    // Então: o botão é o primeiro da coluna, acima de "Comentários"
    expect(naColuna.getAllByRole('button')[0]).toHaveAccessibleName('Expandir tudo');
    // Quando
    await userEvent.click(naColuna.getByRole('button', { name: 'Expandir tudo' }));
    // Então
    expect(titulos().map(b => b.getAttribute('aria-expanded'))).toEqual(['true', 'true', 'true']);
    // Quando
    await userEvent.click(naColuna.getByRole('button', { name: 'Recolher tudo' }));
    // Então
    expect(titulos().map(b => b.getAttribute('aria-expanded'))).toEqual(['false', 'false', 'false']);
    expect(naColuna.getByRole('button', { name: 'Expandir tudo' })).toBeInTheDocument();
    coluna.remove();
  });

  it('dado que a pessoa recolhe os comentários, quando sai, então a escolha não fica guardada (os comentários dos outros cartões continuam como estavam)', async () => {
    // Dado
    abrirCartao();
    await screen.findByText('Primeiro comentário');
    // Quando
    await userEvent.click(secoes()[0]);
    // Então
    expect(secoes()[0]).toHaveAttribute('aria-expanded', 'false');
    expect(salvarPreferencia).not.toHaveBeenCalled();
  });

  it('quando a pessoa comenta, então o comentário vai para a anotação e aparece no topo, e o número sobe', async () => {
    // Dado
    abrirCartao();
    await screen.findByText('Primeiro comentário');
    // Quando
    await userEvent.type(screen.getByRole('textbox', { name: 'Escrever um comentário' }), 'Novo comentário');
    await userEvent.click(screen.getByRole('button', { name: 'Comentar' }));
    // Então
    expect(comentarioCriar).toHaveBeenCalledWith('anotacoes', 'a1', 'Novo comentário');
    const lista = await screen.findByRole('list', { name: 'Comentários do cartão' });
    await vi.waitFor(() => expect(within(lista).getAllByRole('listitem')[0]).toHaveTextContent('Novo comentário'));
    expect(secoes()[0]).toHaveTextContent(/^Comentários\s*3$/);
  });

  it('dada uma anotação que a pessoa só lê, quando abre, então ela comenta, e quem não está na anotação aparece desligado na lista do @', async () => {
    // Dado: de outra pessoa, sem ninguém mais nela
    anotacaoObter.mockImplementation(async () => ({ ...anotacao('Texto.'), criado_por: 'u-bruno', responsavel_id: 'u-bruno' }));
    abrirCartao();
    await screen.findByText('Primeiro comentário');
    // Quando
    await userEvent.type(screen.getByRole('textbox', { name: 'Escrever um comentário' }), 'Veja, @');
    // Então: o Bruno, que está na anotação, pode; o Mauro (quem comenta, que só a lê) aparece desligado
    expect(screen.getByRole('option', { name: /Bruno/ })).toHaveAttribute('aria-disabled', 'false');
    expect(screen.getByRole('option', { name: /Mauro/ })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: 'Comentar' })).toBeInTheDocument();
  });
});

describe('Ligar um item pela seção "Ligada a" (#341)', () => {
  beforeEach(() => {
    iniciarPreferencias({});
    anotacaoObter.mockReset();
    anotacaoObter.mockImplementation(async () => anotacao(''));
    itensParaLigar.mockResolvedValue([{ modulo: 'pessoas', id: 'p1', codigo: 'P-1', nome: 'JOSÉ DA SILVA', arquivado_em: null }]);
    anotacaoLigar.mockReset();
  });
  /** Abre a seção, busca e escolhe a pessoa. */
  async function ligarAPessoa() {
    abrirCartao();
    const secao = await screen.findByRole('button', { name: /^Ligada a/ });
    if (secao.getAttribute('aria-expanded') === 'false') await userEvent.click(secao);
    await userEvent.click(screen.getByRole('button', { name: /^Ligar a (outro|um) item/ }));
    await userEvent.click(await screen.findByRole('button', { name: /JOSÉ DA SILVA/ }));
  }

  it('dado um item que outra pessoa já ligou enquanto a busca estava aberta, quando a pessoa o escolhe, então o aviso diz que já estava, sem Desfazer', async () => {
    // Dado
    anotacaoLigar.mockResolvedValue(false);
    // Quando
    await ligarAPessoa();
    // Então
    // (os avisos dos casos anteriores podem ainda estar no pé da tela: confere só o deste)
    const aviso = (await screen.findByText(ITEM_JA_LIGADO)).closest('div')!;
    expect(within(aviso).queryByRole('button', { name: 'Desfazer' })).not.toBeInTheDocument();
    expect(screen.queryByText('Ligada a pessoa: JOSÉ DA SILVA.')).not.toBeInTheDocument();
  });

  it('dado um item ainda não ligado, quando a pessoa o escolhe, então o aviso oferece Desfazer, que desliga só ele', async () => {
    // Dado
    anotacaoLigar.mockResolvedValue(true);
    // Quando
    await ligarAPessoa();
    const aviso = (await screen.findByText('Ligada a pessoa: JOSÉ DA SILVA.')).closest('div')!;
    await userEvent.click(within(aviso).getByRole('button', { name: 'Desfazer' }));
    // Então
    expect(anotacaoDesligar).toHaveBeenCalledWith('a1', 'pessoas', 'p1');
  });
});

// O "+ Novo…" de "Ligada a" (#376): ao lado de "Ligar a outro item", com as mesmas condições (quem liga itens e a anotação com lugar).
describe('Criar um item já ligado pela seção "Ligada a" (#376)', () => {
  beforeEach(() => {
    iniciarPreferencias({});
    anotacaoObter.mockReset();
    anotacaoItens.mockReset();
    anotacaoItens.mockResolvedValue({ visiveis: [], ocultos: 0 });
  });
  // A anotação cheia de um caso não passa para os casos seguintes.
  afterEach(() => { anotacaoItens.mockResolvedValue({ visiveis: [], ocultos: 0 }); });
  /** Abre o cartão e a seção "Ligada a". */
  async function abrirLigadaA() {
    abrirCartao();
    const secao = await screen.findByRole('button', { name: /^Ligada a/ });
    if (secao.getAttribute('aria-expanded') === 'false') await userEvent.click(secao);
  }

  it('dado quem altera a anotação, quando abre "Ligada a", então o "+ Novo…" fica ao lado de "Ligar a outro item" e abre o menu', async () => {
    // Dado
    anotacaoObter.mockImplementation(async () => anotacao(''));
    // Quando
    await abrirLigadaA();
    await userEvent.click(await screen.findByRole('button', { name: 'Novo…' }));
    // Então
    expect(screen.getByRole('button', { name: /^Ligar a (outro|um) item/ })).toBeInTheDocument();
    // (o escritório destes casos não tem módulos ligados: só as pessoas, que existem sempre)
    expect(screen.getAllByRole('menuitem').map(b => b.textContent?.trim())).toEqual(['Pessoa']);
  });

  it('dada a anotação de outra pessoa, que esta só lê, quando abre "Ligada a", então não há "+ Novo…"', async () => {
    // Dado
    anotacaoObter.mockImplementation(async () => ({ ...anotacao(''), criado_por: 'u-bruno', responsavel_id: 'u-bruno' }));
    // Quando
    await abrirLigadaA();
    // Então
    expect(await screen.findByText('Esta anotação não está ligada a nenhum item.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Novo…' })).not.toBeInTheDocument();
  });

  it('dada a anotação arquivada, quando abre "Ligada a", então não há "+ Novo…"', async () => {
    // Dado
    anotacaoObter.mockImplementation(async () => ({ ...anotacao(''), arquivado_em: '2026-11-15T12:00:00Z', arquivado_por: 'u-mauro' }));
    // Quando
    await abrirLigadaA();
    // Então
    expect(await screen.findByText('Esta anotação não está ligada a nenhum item.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Novo…' })).not.toBeInTheDocument();
  });

  it('dada a anotação já ligada ao máximo de itens, quando abre "Ligada a", então não há "+ Novo…", e a nota diz o máximo', async () => {
    // Dado
    anotacaoObter.mockImplementation(async () => anotacao(''));
    anotacaoItens.mockResolvedValue({ visiveis: [], ocultos: ITENS_DA_ANOTACAO });
    // Quando
    await abrirLigadaA();
    // Então
    expect(await screen.findByText(`A anotação já está ligada a ${ITENS_DA_ANOTACAO} itens, o máximo.`)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Novo…' })).not.toBeInTheDocument();
  });
});

// A anotação nova (#369, pedido do dono): sem tela própria, ela abre nesta mesma janela, com o cursor no título, e vai ao banco
// sozinha quando a pessoa escreve algo no título ou no texto. A regra mudou: antes, "Salvar anotação" e Ctrl+Enter a criavam.
describe('A anotação nova, na mesma janela da anotação aberta (#369)', () => {
  /** A pasta da semente destes casos, para a anotação nova nascer nela. */
  const POPS: Pasta = { id: 'pa1', nome: 'POPs', pasta_mae_id: null, criada_por: 'u-mauro', criada_em: '2026-11-10T12:00:00Z' };
  /** A demanda de onde se vem, quando a anotação nova é escrita pelo "+" do cartão dela. */
  const DEMANDA = { id: 'd1', codigo: 'D-7', titulo: 'Registro de marca', arquivado_em: null } as Demanda;
  const aoCriar = vi.fn<(id: string) => void>();
  /** O banco grava a anotação nova (a de id a1), com o que ela leva. */
  const criarNoBanco: DadosAnotacoes['anotacaoCriar'] = async dados => {
    banco.titulo = dados.titulo;
    banco.texto = dados.texto ?? '';
    return { id: 'a1', codigo: 'A-1' };
  };

  beforeEach(() => {
    zerarBanco('');
    pastasListar.mockResolvedValue([POPS]);
    anotacaoCriar.mockReset();
    anotacaoCriar.mockImplementation(criarNoBanco);
    demandaObter.mockReset();
    demandaObter.mockResolvedValue(DEMANDA);
    aoCriar.mockReset();
  });

  /** A anotação nova num roteador de verdade, como a de abrirCartao, vinda da pasta POPs ou do cartão da demanda. */
  function abrirNova(origem: 'pasta' | 'demanda' | null = null, initialEntries = ['/']) {
    const nova = { pasta: origem === 'pasta' ? POPS.id : null, origem: origem === 'demanda' ? { modulo: 'demandas' as const, id: DEMANDA.id } : null };
    const roteador = createMemoryRouter([
      { path: '/', element: <CartaoAnotacao nova={nova} aoMudar={() => undefined} aoFechar={() => undefined} aoCriar={aoCriar} /> },
      { path: '/fora', element: <p>Outra página</p> }
    ], { initialEntries, initialIndex: initialEntries.length - 1 });
    render(<><RouterProvider router={roteador} /><Avisos /><Janelas /></>);
    return roteador;
  }
  /**
   * Como na página Documentos: quando a anotação nova vai ao banco, a página troca o endereço no lugar, com a marca de que não sai
   * da tela (o AvisoAoSair não segura essa troca).
   */
  function trocarOEnderecoAoCriar(roteador: ReturnType<typeof abrirNova>) {
    aoCriar.mockImplementation(id => { void roteador.navigate('/?id=' + id, { replace: true, state: { [SEM_SAIR_DA_TELA]: true } }); });
  }
  const campoDoTitulo = () => screen.getByRole('textbox', { name: 'Título' });

  it('quando a anotação nova abre, então é a mesma janela da aberta, com o cursor no título em branco, sem "Salvar anotação" nem "Ctrl+Enter salva", e sem o ⋯', async () => {
    // Quando
    abrirNova();
    // Então
    expect(screen.getByRole('article', { name: 'Anotação nova' })).toBeInTheDocument();
    await vi.waitFor(() => expect(campoDoTitulo()).toHaveFocus());
    expect(campoDoTitulo()).toHaveAttribute('placeholder', 'Sem título');
    expect(await acharEditor()).toBeInTheDocument();
    expect(situacao()).toHaveTextContent('Ainda não gravada');
    expect(screen.getByRole('button', { name: /^Comentários/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Ligada a/ })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: /^Histórico de alterações/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Salvar anotação' })).not.toBeInTheDocument();
    expect(screen.queryByText('Ctrl+Enter salva')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mais ações da anotação' })).not.toBeInTheDocument();
    expect(anotacaoObter).not.toHaveBeenCalled();
  });

  it('dado nada escrito, quando a pessoa sai, então nada vai ao banco e ninguém pergunta nada', async () => {
    // Dado
    const roteador = abrirNova('pasta');
    await acharEditor();
    // Quando
    await act(async () => { void roteador.navigate('/fora'); });
    // Então
    expect(await screen.findByText('Outra página')).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Sair sem salvar?' })).not.toBeInTheDocument();
    expect(anotacaoCriar).not.toHaveBeenCalled();
  });

  it('dadas a etiqueta, a pasta e a demanda escolhidas antes, quando a pessoa escreve o título e aperta Enter, então a anotação vai ao banco uma vez, com tudo, e o cursor desce ao texto', async () => {
    // Dado: veio do cartão da demanda, e escolhe uma etiqueta e a pasta POPs antes de escrever
    abrirNova('demanda');
    expect(within(await screen.findByRole('list', { name: 'Itens ligados' })).getByText('Registro de marca')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Escolher etiquetas' }));
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Escolher etiquetas' })).getByRole('checkbox', { name: 'Urgente' }));
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('button', { name: 'Escolher a pasta' }));
    await userEvent.click(await screen.findByRole('menuitemradio', { name: 'POPs' }));
    const texto = await acharEditor();
    // Quando: o título, que saiu da edição com os cliques, volta a ela com um clique em "Sem título"
    await userEvent.click(screen.getByRole('button', { name: 'Sem título' }));
    await userEvent.type(campoDoTitulo(), 'Visita{Enter}');
    // Então
    await vi.waitFor(() => expect(aoCriar).toHaveBeenCalledWith('a1'));
    expect(anotacaoCriar).toHaveBeenCalledExactlyOnceWith(
      { titulo: 'Visita', texto: '', responsavel_id: 'u-mauro', participantes: [], pasta_id: POPS.id }, [{ modulo: 'demandas', id: DEMANDA.id }], [URGENTE.id]);
    expect(await screen.findByRole('article', { name: 'Anotação A-1' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Visita');
    expect(editorDe(texto).hasFocus).toBe(true);
    // E a caixa de escrever é a mesma: não recomeçou quando a anotação foi ao banco
    expect(caixa()).toBe(texto);
  });

  it('quando a pessoa começa pelo texto, então a anotação vai ao banco com ele e o título "Sem título"; o que ela continua a escrever grava na mesma anotação', async () => {
    // Dado
    abrirNova();
    const texto = await acharEditor();
    // Quando
    escreverNoEditor(texto, 'Levar');
    await userEvent.keyboard('{Control>}s{/Control}');
    // Então
    await vi.waitFor(() => expect(aoCriar).toHaveBeenCalledWith('a1'));
    expect(anotacaoCriar).toHaveBeenCalledExactlyOnceWith(
      { titulo: 'Sem título', texto: 'Levar', responsavel_id: 'u-mauro', participantes: [], pasta_id: null }, [], []);
    expect(anotacaoGravarTexto).not.toHaveBeenCalled();
    expect(await screen.findByText('Salvo')).toBeInTheDocument();
    // Quando
    escreverNoEditor(caixa(), ' a procuração');
    await userEvent.keyboard('{Control>}s{/Control}');
    await responder();
    // Então
    expect(anotacaoGravarTexto).toHaveBeenCalledExactlyOnceWith('a1', 'Levar a procuração', 'm0');
    expect(anotacaoCriar).toHaveBeenCalledOnce();
    expect(caixa()).toBe(texto);
  });

  it('dado o título indo ao banco devagar, quando o texto também pede para gravar, então a anotação vai ao banco uma vez só, e o texto grava nela depois', async () => {
    // Dado: o banco demora a responder à ida da anotação nova
    let responderCriacao: () => void = () => undefined;
    anotacaoCriar.mockImplementation(dados => new Promise(ok => { responderCriacao = () => void criarNoBanco(dados).then(ok); }));
    abrirNova();
    const texto = await acharEditor();
    await userEvent.type(campoDoTitulo(), 'Visita');
    // Quando: vai para o texto (o título sai do campo e leva a anotação ao banco) e grava o texto antes de o banco responder
    escreverNoEditor(texto, 'Levar');
    await userEvent.keyboard('{Control>}s{/Control}');
    await act(async () => { responderCriacao(); });
    await responder();
    // Então
    expect(anotacaoCriar).toHaveBeenCalledOnce();
    expect(anotacaoCriar.mock.calls[0][0]).toMatchObject({ titulo: 'Visita', texto: '' });
    expect(anotacaoGravarTexto).toHaveBeenCalledExactlyOnceWith('a1', 'Levar', 'm0');
  });

  it('dado o banco demorando a responder à ida da anotação nova, quando a pessoa compartilha com o Bruno nesse meio-tempo, então ele é gravado logo depois, e não se perde', async () => {
    // Dado: o banco demora a responder à ida da anotação nova
    let responderCriacao: () => void = () => undefined;
    anotacaoCriar.mockImplementation(dados => new Promise(ok => { responderCriacao = () => void criarNoBanco(dados).then(ok); }));
    abrirNova();
    await acharEditor();
    await userEvent.type(campoDoTitulo(), 'Visita{Enter}');
    // Quando: compartilha com o Bruno antes de o banco responder
    await userEvent.click(screen.getByRole('button', { name: 'Compartilhar com mais alguém' }));
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Compartilhar com mais alguém' })).getByRole('button', { name: 'Bruno' }));
    await act(async () => { responderCriacao(); });
    await vi.waitFor(() => expect(anotacaoAtualizar).toHaveBeenCalled());
    await responder();
    // Então: a anotação foi sem o Bruno, e ele foi gravado em seguida
    expect(anotacaoCriar.mock.calls[0][0]).toMatchObject({ titulo: 'Visita', participantes: [] });
    expect(anotacaoAtualizar).toHaveBeenCalledExactlyOnceWith('a1', { responsavel_id: 'u-mauro', participantes: ['u-bruno'] });
    await vi.waitFor(() => expect(aoCriar).toHaveBeenCalledWith('a1'));
  });

  it('dado um título escrito e ainda no campo, quando a pessoa sai, então a anotação vai ao banco com ele antes, sem pergunta', async () => {
    // Dado
    const roteador = abrirNova();
    await acharEditor();
    await userEvent.type(campoDoTitulo(), 'Visita');
    // Quando
    await act(async () => { void roteador.navigate('/fora'); });
    // Então
    expect(await screen.findByText('Outra página')).toBeInTheDocument();
    expect(anotacaoCriar).toHaveBeenCalledOnce();
    expect(anotacaoCriar.mock.calls[0][0]).toMatchObject({ titulo: 'Visita' });
    expect(screen.queryByRole('dialog', { name: 'Sair sem salvar?' })).not.toBeInTheDocument();
  });

  it('quando a pessoa escolhe duas etiquetas pelo ícone, então os selos aparecem entre o topo e o título, e o x de um selo o tira', async () => {
    // Dado
    abrirNova();
    const titulo = campoDoTitulo();
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Escolher etiquetas' }));
    const escolha = within(screen.getByRole('dialog', { name: 'Escolher etiquetas' }));
    await userEvent.click(escolha.getByRole('checkbox', { name: 'Urgente' }));
    await userEvent.click(escolha.getByRole('checkbox', { name: 'Cliente' }));
    await userEvent.keyboard('{Escape}');
    // Então
    const selos = screen.getByRole('group', { name: 'Etiquetas' });
    expect(within(selos).getByText('Urgente')).toBeInTheDocument();
    expect(within(selos).getByText('Cliente')).toBeInTheDocument();
    expect(selos.compareDocumentPosition(titulo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Tirar a etiqueta Urgente' }));
    // Então
    expect(within(screen.getByRole('group', { name: 'Etiquetas' })).queryByText('Urgente')).not.toBeInTheDocument();
    expect(anotacaoCriar).not.toHaveBeenCalled();
  });

  // A regra mudou (#388, pedido do dono): a bolinha abre um menu, e o "Tirar" fica nele. Na anotação nova, sem "Ver perfil" (o
  // link fecharia a anotação, que ainda não foi gravada).
  it('dada uma pessoa compartilhada, quando escolhe "Tirar da anotação" no menu da bolinha dela, então ela sai, com o aviso e o Desfazer, que a põe de volta', async () => {
    // Dado
    abrirNova();
    const equipe = () => within(screen.getByRole('group', { name: 'Equipe' }));
    await userEvent.click(screen.getByRole('button', { name: 'Compartilhar com mais alguém' }));
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Compartilhar com mais alguém' })).getByRole('button', { name: 'Bruno' }));
    // Quando
    await userEvent.click(equipe().getByRole('button', { name: 'Bruno, Compartilhada' }));
    // Então
    expect(within(screen.getByRole('menu', { name: 'Bruno, Compartilhada' })).getAllByRole('menuitem').map(i => i.textContent?.trim()))
      .toEqual(['Tornar responsável', 'Tirar da anotação']);
    // Quando
    await userEvent.click(screen.getByRole('menuitem', { name: 'Tirar da anotação' }));
    // Então
    expect(equipe().queryByRole('button', { name: 'Bruno, Compartilhada' })).not.toBeInTheDocument();
    const aviso = (await screen.findByText('Bruno saiu da anotação.')).closest('div')!;
    // Quando
    await userEvent.click(within(aviso).getByRole('button', { name: 'Desfazer' }));
    // Então
    expect(await equipe().findByRole('button', { name: 'Bruno, Compartilhada' })).toBeInTheDocument();
    expect(anotacaoCriar).not.toHaveBeenCalled();
  });

  it('dada uma pessoa compartilhada na anotação nova, quando escolhe "Tornar responsável", então ela passa a responder e quem escreve continua compartilhando', async () => {
    // Dado
    abrirNova();
    const equipe = () => within(screen.getByRole('group', { name: 'Equipe' }));
    await userEvent.click(screen.getByRole('button', { name: 'Compartilhar com mais alguém' }));
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Compartilhar com mais alguém' })).getByRole('button', { name: 'Bruno' }));
    const antes = equipe().getAllByRole('button').map(b => b.getAttribute('aria-label'));
    // Quando
    await userEvent.click(equipe().getByRole('button', { name: 'Bruno, Compartilhada' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Tornar responsável' }));
    // Então
    expect(await equipe().findByRole('button', { name: 'Bruno, Responsável' })).toBeInTheDocument();
    const quemEscrevia = antes[0]!.replace(', Responsável', '');
    expect(equipe().getByRole('button', { name: `${quemEscrevia}, Compartilhada` })).toBeInTheDocument();
    expect(anotacaoCriar).not.toHaveBeenCalled();
  });

  it.each([
    ['por um link', (r: ReturnType<typeof abrirNova>) => r.navigate('/fora')],
    ['pelo Voltar', (r: ReturnType<typeof abrirNova>) => r.navigate(-1)]
  ])('dado um título escrito e ainda no campo, numa página que troca o endereço quando a anotação vai ao banco, quando a pessoa sai %s, então sai de primeira, com a anotação gravada', async (_caso, sair) => {
    // Dado: veio de outra página (o Voltar leva para lá)
    const roteador = abrirNova(null, ['/fora', '/']);
    trocarOEnderecoAoCriar(roteador);
    await acharEditor();
    await userEvent.type(campoDoTitulo(), 'Visita');
    // Quando
    await act(async () => { void sair(roteador); });
    // Então: a troca do endereço, no meio da saída, não a desfez
    expect(await screen.findByText('Outra página')).toBeInTheDocument();
    expect(anotacaoCriar).toHaveBeenCalledOnce();
    expect(aoCriar).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: 'Sair sem salvar?' })).not.toBeInTheDocument();
  });

  it('dado um texto por gravar e a leitura da anotação falhando logo depois de ela ir ao banco, quando a pessoa sai e escolhe continuar, então ela fica, e só aí a página troca o endereço', async () => {
    // Dado
    const roteador = abrirNova();
    trocarOEnderecoAoCriar(roteador);
    anotacaoObter.mockRejectedValueOnce(new Error('Sem conexão.'));
    escreverNoEditor(await acharEditor(), 'Levar');
    // Quando
    await act(async () => { void roteador.navigate('/fora'); });
    await userEvent.click(await screen.findByRole('button', { name: 'Continuar no cadastro' }));
    // Então
    expect(screen.queryByText('Outra página')).not.toBeInTheDocument();
    await vi.waitFor(() => expect(aoCriar).toHaveBeenCalledExactlyOnceWith('a1'));
    expect(roteador.state.location.search).toBe('?id=a1');
    expect(anotacaoCriar).toHaveBeenCalledOnce();
  });

  it('dada a leitura falhando logo depois de a anotação ir ao banco, quando a pessoa continua a escrever, então ela não é criada de novo: o texto grava na mesma', async () => {
    // Dado
    abrirNova();
    anotacaoObter.mockRejectedValueOnce(new Error('Sem conexão.'));
    await acharEditor();
    await userEvent.type(campoDoTitulo(), 'Visita{Enter}');
    // (o último aviso: os de casos anteriores podem ainda estar no pé da tela)
    expect((await screen.findAllByText('Sem conexão.')).at(-1)).toBeInTheDocument();
    // E a janela passa a mostrar a anotação como está no banco
    expect(await screen.findByRole('article', { name: 'Anotação A-1' })).toBeInTheDocument();
    // Quando
    escreverNoEditor(caixa(), 'Levar');
    await userEvent.keyboard('{Control>}s{/Control}');
    await responder();
    // Então
    expect(anotacaoCriar).toHaveBeenCalledOnce();
    expect(anotacaoGravarTexto).toHaveBeenCalledExactlyOnceWith('a1', 'Levar', 'm0');
  });

  it('dado um texto só com uma linha em branco, tomado por gravado, quando a pessoa escreve o título e depois o texto, então o texto grava sem conflito com ninguém', async () => {
    // Dado: a linha em branco não leva a anotação ao banco
    abrirNova();
    escreverNoEditor(await acharEditor(), '\n');
    await userEvent.keyboard('{Control>}s{/Control}');
    expect(anotacaoCriar).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Sem título' }));
    await userEvent.type(campoDoTitulo(), 'Visita{Enter}');
    await vi.waitFor(() => expect(aoCriar).toHaveBeenCalledWith('a1'));
    // Quando
    escreverNoEditor(caixa(), 'Levar');
    await userEvent.keyboard('{Control>}s{/Control}');
    await responder();
    // Então
    expect(anotacaoGravarTexto).toHaveBeenCalledExactlyOnceWith('a1', '\nLevar', 'm0');
    expect(screen.queryByText(/Outra pessoa mudou/)).not.toBeInTheDocument();
    expect(situacao()).toHaveTextContent('Salvo');
  });

  it('dada a anotação gravada com o título provisório (começou pelo texto), quando a pessoa clica no título, então ele abre vazio, para escrever o título de verdade', async () => {
    // Dado
    abrirNova();
    escreverNoEditor(await acharEditor(), 'Levar');
    await userEvent.keyboard('{Control>}s{/Control}');
    await vi.waitFor(() => expect(aoCriar).toHaveBeenCalledWith('a1'));
    // Quando
    await userEvent.click(await screen.findByRole('button', { name: 'Sem título' }));
    // Então
    expect(campoDoTitulo()).toHaveValue('');
    // Quando
    await userEvent.type(campoDoTitulo(), 'Visita{Enter}');
    // Então
    expect(anotacaoAtualizar).toHaveBeenCalledExactlyOnceWith('a1', { titulo: 'Visita' });
    await responder();
  });

  it('dado o Bruno compartilhado antes de a anotação ir ao banco, quando ela vai e a pessoa clica no Desfazer daquele aviso, então ele sai da anotação gravada', async () => {
    // Dado
    abrirNova();
    await acharEditor();
    await userEvent.click(screen.getByRole('button', { name: 'Compartilhar com mais alguém' }));
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Compartilhar com mais alguém' })).getByRole('button', { name: 'Bruno' }));
    // O último aviso (os de casos anteriores podem ainda estar no pé da tela)
    const aviso = (await screen.findAllByText('Bruno agora está na anotação.')).at(-1)!.closest('div')!;
    await userEvent.click(screen.getByRole('button', { name: 'Sem título' }));
    await userEvent.type(campoDoTitulo(), 'Visita{Enter}');
    await vi.waitFor(() => expect(aoCriar).toHaveBeenCalledWith('a1'));
    expect(anotacaoCriar.mock.calls[0][0]).toMatchObject({ participantes: ['u-bruno'] });
    anotacaoObter.mockImplementation(async () => ({ ...anotacao(banco.texto), participantes: ['u-bruno'] }));
    // Quando
    await userEvent.click(within(aviso).getByRole('button', { name: 'Desfazer' }));
    // Então
    await vi.waitFor(() => expect(anotacaoAtualizar).toHaveBeenCalledExactlyOnceWith('a1', { participantes: [] }));
    await responder();
  });

  it('dado um item de origem que não existe mais, quando a anotação nova abre, então o aviso diz que ela será gravada sem ligação a ele', async () => {
    // Dado
    demandaObter.mockResolvedValue(null);
    // Quando
    abrirNova('demanda');
    // Então
    expect(await screen.findByText(/O item de onde você veio não foi encontrado/)).toBeInTheDocument();
    expect(screen.getByText('Ainda não está ligada a nenhum item.')).toBeInTheDocument();
  });

  it('dada a anotação nova, quando ainda não foi ao banco, então o "+ Novo…" espera; quando a pessoa escreve o título, então ele abre o menu (#376)', async () => {
    // Dado
    abrirNova();
    const esperando = screen.getByRole('button', { name: 'Novo…' });
    expect(esperando).toHaveAttribute('aria-disabled', 'true');
    expect(esperando).toHaveAccessibleDescription(NOVO_ESPERA_A_ANOTACAO);
    await userEvent.click(esperando);
    expect(screen.queryByRole('menu', { name: 'Novo item ligado a esta anotação' })).not.toBeInTheDocument();
    // Quando: o título, que saiu da edição com o clique, volta a ela com um clique em "Sem título"
    await userEvent.click(screen.getByRole('button', { name: 'Sem título' }));
    await userEvent.type(campoDoTitulo(), 'Visita{Enter}');
    await vi.waitFor(() => expect(aoCriar).toHaveBeenCalledWith('a1'));
    // Então
    await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Novo…' })).not.toHaveAttribute('aria-disabled'));
    await userEvent.click(screen.getByRole('button', { name: 'Novo…' }));
    expect(screen.getByRole('menu', { name: 'Novo item ligado a esta anotação' })).toBeInTheDocument();
  });
});

// O pedido do dono (#370): a anotação vai para outra pasta também pelo ⋯ do cartão, em "Mover para pasta".
describe('Mover a anotação para outra pasta pelo ⋯ do cartão (#370)', () => {
  const PASTA = (id: string, nome: string, pasta_mae_id: string | null = null) => ({ id, nome, pasta_mae_id, criada_por: 'u-mauro', criada_em: '2026-11-18T12:00:00Z' });
  beforeEach(() => {
    zerarBanco();
    lojaDePastas.mudar({ dono: 'u-mauro', lista: [PASTA('esc', 'Escritório'), PASTA('pops', 'POPs', 'esc')] });
  });

  it('dado quem altera a anotação ativa, quando escolhe "Mover para pasta" no ⋯ e a pasta na janela, então a anotação vai para ela, com o aviso e o Desfazer', async () => {
    // Dado
    abrirCartao();
    await userEvent.click(await screen.findByRole('button', { name: 'Mais ações da anotação' }));
    expect(screen.getAllByRole('menuitem').map(b => b.textContent?.trim())).toEqual(['Mover para pasta', 'Duplicar', 'Baixar .md', 'Arquivar']);
    // Quando
    await userEvent.click(screen.getByRole('menuitem', { name: 'Mover para pasta' }));
    const janela = await screen.findByRole('dialog', { name: 'Mover "Lista do protocolo" para a pasta' });
    await userEvent.selectOptions(within(janela).getByRole('combobox', { name: 'Pasta' }), 'Escritório › POPs');
    await userEvent.click(within(janela).getByRole('button', { name: 'Mover' }));
    await responder();
    // Então
    expect(anotacaoAtualizar).toHaveBeenCalledWith('a1', { pasta_id: 'pops' });
    const aviso = (await screen.findByText('Anotação levada para a pasta Escritório › POPs.')).closest('div')!;
    expect(within(aviso).getByRole('button', { name: 'Desfazer' })).toBeInTheDocument();
  });

  it('dada a anotação arquivada, quando quem altera abre o ⋯, então não há "Mover para pasta"', async () => {
    // Dado
    anotacaoObter.mockImplementation(async () => ({ ...anotacao(banco.texto), arquivado_em: '2026-11-18T12:00:00Z', arquivado_por: 'u-mauro' }));
    abrirCartao();
    // Quando
    await userEvent.click(await screen.findByRole('button', { name: 'Mais ações da anotação' }));
    // Então
    expect(screen.getAllByRole('menuitem').map(b => b.textContent?.trim())).not.toContain('Mover para pasta');
  });
});
