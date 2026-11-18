// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// As caixinhas da lista de tarefas no texto da anotação (#344), marcadas uma atrás da outra, com o banco demorando a responder.
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, MemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Anotacao, DadosAnotacoes, DadosEtiquetas, DadosPastas, DadosSessao } from '../dados';
import { Avisos } from '../ui/avisos';
import { iniciarPreferencias } from '../ui/preferencias';
import { CartaoAnotacao } from './CartaoAnotacao';

// O cartão lê a anotação, os itens ligados, o histórico, as etiquetas e as pastas (#342), e grava o texto; o mock declara
// exatamente essas operações.
const { anotacaoObter, anotacaoItens, anotacaoHistorico, anotacaoAtualizar, salvarPreferencia, etiquetasListar, etiquetasDoCartao, pastasListar } = vi.hoisted(() => ({
  etiquetasListar: vi.fn<DadosEtiquetas['etiquetasListar']>(async () => []),
  etiquetasDoCartao: vi.fn<DadosEtiquetas['etiquetasDoCartao']>(async () => []),
  pastasListar: vi.fn<DadosPastas['pastasListar']>(async () => []),
  anotacaoObter: vi.fn<DadosAnotacoes['anotacaoObter']>(),
  anotacaoItens: vi.fn<DadosAnotacoes['anotacaoItens']>(async () => ({ visiveis: [], ocultos: 0 })),
  anotacaoHistorico: vi.fn<DadosAnotacoes['anotacaoHistorico']>(async () => []),
  anotacaoAtualizar: vi.fn<DadosAnotacoes['anotacaoAtualizar']>(),
  salvarPreferencia: vi.fn<DadosSessao['salvarPreferencia']>(async () => {})
}));
vi.mock('../dados', () => ({
  SD: { anotacaoObter, anotacaoItens, anotacaoHistorico, anotacaoAtualizar, salvarPreferencia, etiquetasListar, etiquetasDoCartao, pastasListar } satisfies
    Pick<DadosAnotacoes & DadosSessao & DadosEtiquetas & DadosPastas, 'anotacaoObter' | 'anotacaoItens' | 'anotacaoHistorico' | 'anotacaoAtualizar' | 'salvarPreferencia'
      | 'etiquetasListar' | 'etiquetasDoCartao' | 'pastasListar'>
}));
/** A equipe do escritório: quem escreve e alguém com quem compartilhar. */
const EQUIPE = [{ id: 'u-mateus', nome: 'Mateus', ativo: true }, { id: 'u-bruno', nome: 'Bruno', ativo: true }];
vi.mock('../ui/sessao', () => ({ useCtx: () => ({ perfil: { id: 'u-mateus', papel: 'usuario' }, equipe: EQUIPE, ehAdmin: false, escritorio: { modulos: {} } }) }));

/** O "banco": o texto guardado e as gravações que ainda não responderam, na ordem em que chegaram. */
const banco = { texto: '', esperando: [] as { responder: (ok: boolean) => void }[] };
const anotacao = (texto: string): Anotacao => ({
  id: 'a1', codigo: 'A-1', titulo: 'Lista do protocolo', texto, responsavel_id: 'u-mateus', participantes: [], ligada_a: [], pasta_id: null,
  arquivado_em: null, arquivado_por: null, criado_por: 'u-mateus', criado_em: '2026-11-10T12:00:00Z', atualizado_por: null,
  atualizado_em: '2026-11-16T12:00:00Z'
});
/** O banco responde à gravação mais antiga ainda sem resposta (ok, ou com erro). */
async function responder(ok = true) {
  await act(async () => { banco.esperando.shift()!.responder(ok); });
}
const caixinha = (nome: string) => screen.getByRole('checkbox', { name: nome });

describe('Caixinhas marcadas seguidas no cartão da anotação (#344)', () => {
  beforeEach(() => {
    iniciarPreferencias({});
    banco.texto = '- [ ] A\n- [ ] B\n- [ ] C';
    banco.esperando = [];
    anotacaoObter.mockReset();
    anotacaoObter.mockImplementation(async () => anotacao(banco.texto));
    anotacaoAtualizar.mockReset();
    anotacaoAtualizar.mockImplementation((id, dados) => new Promise((ok, erro) => {
      banco.esperando.push({
        responder: deu => {
          if (!deu) { erro(new Error('Sem conexão.')); return; }
          banco.texto = dados.texto ?? banco.texto;
          ok({ id, codigo: 'A-1' });
        }
      });
    }));
  });

  it('dado o banco lento, quando a pessoa marca A, B e C seguidas, então nenhuma marcação se perde: na tela e no banco ficam as três', async () => {
    // Dado
    render(<MemoryRouter><CartaoAnotacao id="a1" aoMudar={() => undefined} aoFechar={() => undefined} /></MemoryRouter>);
    expect(await screen.findByRole('checkbox', { name: 'A' })).not.toBeChecked();
    // Quando: marca A e B; a gravação de A termina enquanto a de B ainda está na fila
    await userEvent.click(caixinha('A'));
    await userEvent.click(caixinha('B'));
    await responder();
    // Então: a leitura do banco (só com A) não desmarca B na tela
    expect(caixinha('A')).toBeChecked();
    expect(caixinha('B')).toBeChecked();
    // Quando: marca C nesse intervalo, e o banco responde às outras
    await userEvent.click(caixinha('C'));
    await responder();
    await responder();
    // Então: cada gravação partiu da anterior, e o banco fica com as três
    expect(anotacaoAtualizar.mock.calls.map(([, d]) => d.texto)).toEqual([
      '- [x] A\n- [ ] B\n- [ ] C', '- [x] A\n- [x] B\n- [ ] C', '- [x] A\n- [x] B\n- [x] C'
    ]);
    expect(banco.texto).toBe('- [x] A\n- [x] B\n- [x] C');
    await vi.waitFor(() => expect(anotacaoObter).toHaveBeenCalledTimes(2));   // a leitura do começo e a do fim da fila
    expect(caixinha('A')).toBeChecked();
    expect(caixinha('B')).toBeChecked();
    expect(caixinha('C')).toBeChecked();
  });

  it('dado o banco lento, quando a gravação de A falha com B já na fila, então B não é gravada e a tela volta ao texto do banco', async () => {
    // Dado
    render(<MemoryRouter><CartaoAnotacao id="a1" aoMudar={() => undefined} aoFechar={() => undefined} /></MemoryRouter>);
    expect(await screen.findByRole('checkbox', { name: 'A' })).not.toBeChecked();
    await userEvent.click(caixinha('A'));
    await userEvent.click(caixinha('B'));
    // Quando
    await responder(false);
    // Então: B foi calculada com A marcada, que não foi gravada: fica de fora
    expect(anotacaoAtualizar).toHaveBeenCalledOnce();
    expect(banco.texto).toBe('- [ ] A\n- [ ] B\n- [ ] C');
    await vi.waitFor(() => expect(anotacaoObter).toHaveBeenCalledTimes(2));
    expect(caixinha('A')).not.toBeChecked();
    expect(caixinha('B')).not.toBeChecked();
    // Quando: a pessoa tenta de novo
    await userEvent.click(caixinha('B'));
    await responder();
    // Então: só B é marcada, a partir do texto do banco
    expect(anotacaoAtualizar).toHaveBeenLastCalledWith('a1', { texto: '- [ ] A\n- [x] B\n- [ ] C' });
    expect(banco.texto).toBe('- [ ] A\n- [x] B\n- [ ] C');
  });
});

/** O cartão num roteador de verdade (o aviso de sair sem salvar da edição no lugar precisa dele). */
function abrirCartao() {
  const roteador = createMemoryRouter([{ path: '/', element: <CartaoAnotacao id="a1" aoMudar={() => undefined} aoFechar={() => undefined} /> }]);
  render(<RouterProvider router={roteador} />);
}

describe('Título e texto mudados no próprio cartão (#339)', () => {
  /** O título guardado no "banco" (o texto fica em banco.texto). */
  let tituloNoBanco = 'Lista do protocolo';
  beforeEach(() => {
    iniciarPreferencias({});
    banco.texto = '- [ ] A\n- [ ] B\n- [ ] C';
    banco.esperando = [];
    anotacaoObter.mockReset();
    tituloNoBanco = 'Lista do protocolo';
    anotacaoObter.mockImplementation(async () => ({ ...anotacao(banco.texto), titulo: tituloNoBanco }));
    anotacaoAtualizar.mockReset();
    anotacaoAtualizar.mockImplementation((id, dados) => new Promise(ok => {
      banco.esperando.push({ responder: () => { banco.texto = dados.texto ?? banco.texto; tituloNoBanco = dados.titulo ?? tituloNoBanco; ok({ id, codigo: 'A-1' }); } });
    }));
  });

  it('dada uma caixinha ainda na fila, quando a pessoa edita o texto no lugar e salva, então o texto espera a caixinha e parte do texto da tela, sem perder a marcação', async () => {
    // Dado
    abrirCartao();
    await userEvent.click(await screen.findByRole('checkbox', { name: 'A' }));
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Mudar o texto' }));
    const caixa = screen.getByRole('textbox', { name: 'Texto' });
    expect(caixa).toHaveValue('- [x] A\n- [ ] B\n- [ ] C');
    await userEvent.type(caixa, ' feito');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    // Então: a gravação do texto só começa depois da caixinha
    expect(anotacaoAtualizar).toHaveBeenCalledOnce();
    await responder();
    await responder();
    expect(anotacaoAtualizar.mock.calls.map(([, d]) => d)).toEqual([{ texto: '- [x] A\n- [ ] B\n- [ ] C' }, { texto: '- [x] A\n- [ ] B\n- [ ] C feito' }]);
    expect(banco.texto).toBe('- [x] A\n- [ ] B\n- [ ] C feito');
    await vi.waitFor(() => expect(screen.queryByRole('textbox', { name: 'Texto' })).not.toBeInTheDocument());
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

  it('dada a equipe sendo salva pelo lápis, quando a pessoa sai por um link, então o SEMPER pede para esperar, em vez de dizer que o que ela fez será perdido', async () => {
    // Dado: o banco ainda não respondeu à gravação da equipe
    const roteador = createMemoryRouter([
      { path: '/', element: <CartaoAnotacao id="a1" aoMudar={() => undefined} aoFechar={() => undefined} /> },
      { path: '/fora', element: <p>Outra página</p> }
    ]);
    render(<><RouterProvider router={roteador} /><Avisos /></>);
    await userEvent.click(await screen.findByRole('button', { name: 'Editar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar pessoa da equipe' }));
    await userEvent.click(within(screen.getByRole('list', { name: 'Equipe' })).getByRole('button', { name: /Bruno/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(screen.getByRole('button', { name: 'Salvando…' })).toBeDisabled();
    // Quando
    await act(async () => { await roteador.navigate('/fora'); });
    // Então
    expect(await screen.findByText('Espere terminar de salvar.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Sair sem salvar?' })).not.toBeInTheDocument();
    expect(screen.queryByText('Outra página')).not.toBeInTheDocument();
    // E, quando a gravação termina, sai sem perguntar
    await responder();
    await act(async () => { await roteador.navigate('/fora'); });
    expect(await screen.findByText('Outra página')).toBeInTheDocument();
  });
});
