// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// O primeiro acesso pelo link do convite (#295): o código do link vai junto com o cadastro, e um link novo aberto na mesma
// aba troca o código. O banco é simulado: só os e-mails e códigos inventados daqui.
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DadosDuasEtapas, DadosSessao } from '../dados';
import Entrada from './Entrada';

type DadosDaEntrada = Pick<DadosSessao, 'sessao' | 'entrar' | 'primeiroAcesso' | 'recuperarSenha' | 'confirmarLink' | 'novaSenha' | 'sair' | 'aoMudarSessao'>
  & Pick<DadosDuasEtapas, 'duasEtapasPendente' | 'duasEtapasEntrar'>;
const SD = vi.hoisted(() => ({
  sessao: vi.fn<DadosSessao['sessao']>(),
  entrar: vi.fn<DadosSessao['entrar']>(),
  primeiroAcesso: vi.fn<DadosSessao['primeiroAcesso']>(),
  recuperarSenha: vi.fn<DadosSessao['recuperarSenha']>(),
  confirmarLink: vi.fn<DadosSessao['confirmarLink']>(),
  novaSenha: vi.fn<DadosSessao['novaSenha']>(),
  sair: vi.fn<DadosSessao['sair']>(),
  aoMudarSessao: vi.fn<DadosSessao['aoMudarSessao']>(),
  duasEtapasPendente: vi.fn<DadosDuasEtapas['duasEtapasPendente']>(),
  duasEtapasEntrar: vi.fn<DadosDuasEtapas['duasEtapasEntrar']>()
}));
vi.mock('../dados', () => ({ SD: SD satisfies DadosDaEntrada }));

const EMAIL = 'convidada@exemplo.test';
const SENHA = 'senha-de-teste';
const RECUSADO = 'Convite não encontrado ou vencido.';

/** Abre a entrada pelo link do convite, com o código depois do "#", como chega no navegador. */
function abrirPeloLink(codigo: string) {
  history.replaceState(null, '', '/entrar/?primeiro-acesso#convite=' + codigo);
  render(<MemoryRouter initialEntries={['/entrar/?primeiro-acesso']}><Entrada /></MemoryRouter>);
}
async function criarAcesso() {
  await userEvent.clear(screen.getByLabelText('E-mail do convite'));
  await userEvent.paste(EMAIL);
  await userEvent.clear(screen.getByLabelText('Crie uma senha'));
  await userEvent.paste(SENHA);
  await userEvent.clear(screen.getByLabelText('Repita a senha'));
  await userEvent.paste(SENHA);
  await userEvent.click(screen.getByRole('button', { name: 'Criar meu acesso' }));
}

describe('Primeiro acesso pelo link do convite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    SD.sessao.mockResolvedValue(null);
    SD.aoMudarSessao.mockReturnValue(() => {});
    SD.primeiroAcesso.mockResolvedValue({ entrou: false });
  });

  it('quando a pessoa cria a senha, então o cadastro vai com o código do link, que sai do endereço', async () => {
    // Dado
    abrirPeloLink('codigo-do-link');
    // Quando
    await criarAcesso();
    // Então
    expect(SD.primeiroAcesso).toHaveBeenCalledWith(EMAIL, SENHA, expect.any(String), 'codigo-do-link');
    expect(location.hash).toBe('');
  });

  it('quando um link novo é aberto na mesma aba, então o cadastro vai com o código do link novo e o aviso do anterior some', async () => {
    // Dado: o link antigo foi recusado
    SD.primeiroAcesso.mockRejectedValueOnce(new Error(RECUSADO));
    abrirPeloLink('codigo-vencido');
    await criarAcesso();
    expect(await screen.findByText(RECUSADO)).toBeInTheDocument();
    // Quando: o navegador só troca o que vem depois do "#", sem recarregar a página
    location.hash = 'convite=codigo-novo';
    await waitFor(() => expect(screen.queryByText(RECUSADO)).not.toBeInTheDocument());
    await criarAcesso();
    // Então
    expect(SD.primeiroAcesso).toHaveBeenLastCalledWith(EMAIL, SENHA, expect.any(String), 'codigo-novo');
    expect(location.hash).toBe('');
  });
});
