// @vitest-environment jsdom
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// A importação de pessoas inteira, com o banco simulado: o arquivo é montado aqui, só com dados fictícios.
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DadosImportacao, Importacao, Membro, Pessoa } from '../dados';
import { TAMANHO_MAXIMO_DO_ARQUIVO } from '../dados/limites';
import { modeloImportacao, NOME_DO_MODELO } from '../regras/importacao';
import { gravacao } from '../ui/gravacaoDaImportacao';
import { Janelas } from '../ui/janela';
import ImportarPessoas from './ImportarPessoas';

// A tela usa só as quatro operações da importação; o mock declara exatamente essas.
const SD = vi.hoisted(() => ({
  pessoasParaImportar: vi.fn<DadosImportacao['pessoasParaImportar']>(),
  importacaoIniciar: vi.fn<DadosImportacao['importacaoIniciar']>(),
  pessoasImportar: vi.fn<DadosImportacao['pessoasImportar']>(),
  importacaoConcluir: vi.fn<DadosImportacao['importacaoConcluir']>()
}));
vi.mock('../dados', () => ({ SD: SD satisfies DadosImportacao }));
// Quem está logado é o Mateus; se é administrador, e se a equipe tem mais alguém, cada caso diz.
const sessao = vi.hoisted(() => ({ ehAdmin: true, outros: [] as Membro[] }));
const EQUIPE: Membro[] = [
  { id: 'u-mateus', nome: 'Mateus Exemplo Gonçalves', usuario: 'mateus', ativo: true },
  { id: 'u-ana', nome: 'Ana Teste Lima', usuario: 'ana.lima', ativo: true }
];
vi.mock('../ui/sessao', () => {
  const ctx = () => ({ perfil: { id: 'u-mateus' }, equipe: [...EQUIPE, ...sessao.outros], ehAdmin: sessao.ehAdmin });
  return { useCtx: ctx, useSessao: () => ({ ctx: ctx() }) };
});
// O arquivo do modelo não é baixado de verdade: o teste só confere o que iria para o navegador.
const { baixarArquivo } = vi.hoisted(() => ({ baixarArquivo: vi.fn() }));
vi.mock('../ui/util', async original => ({ ...await original<typeof import('../ui/util')>(), baixarArquivo }));

/** Um cadastro que já está no SEMPER (fictício), com o que o caso mudar. */
const pessoa = (dados: Partial<Pessoa>): Pessoa => ({
  id: 'p-1', codigo: 'P-0001', tipo: 'pf', nome: '', genero: null, nacionalidade: null, profissao: null, estado_civil: null, rg: null,
  rg_expedicao: null, nome_mae: null, nome_pai: null, nascimento: null, nascimento_municipio: null, nascimento_uf: null, natureza: null,
  tipo_entidade: null, nome_fantasia: null, porte: null, abertura: null, representantes: null, documento: null, cep: null, logradouro: null,
  numero: null, complemento: null, bairro: null, municipio: null, uf: null, telefones: [], emails: [], lgpd_base: 'contrato',
  lgpd_consentimento: null, etapa_id: null, etapa_ordem: null, arquivado_em: null, arquivado_por: null, criado_por: 'u-mateus',
  criado_em: '2025-01-10T12:00:00Z', atualizado_por: null, atualizado_em: '2025-01-10T12:00:00Z', importacao_id: null, referencia: null,
  observacoes: null, pendencias: [], resp: [], ...dados
});
const importacao = (dados: Partial<Importacao> = {}): Importacao => ({
  id: 'imp-1', descricao: '', arquivo: 'pessoas.csv', criadas: 0, completadas: 0, incompletas: 0, feito_por: 'u-mateus',
  iniciada_em: '2026-10-31T12:00:00Z', concluida_em: '2026-10-31T12:01:00Z', ...dados
});

/** O CSV como o Excel salva (separado por ";"): a primeira linha é o cabeçalho. */
const csv = (...linhas: string[][]) => linhas.map(l => l.join(';')).join('\r\n');
const arquivo = (conteudo: string, nome = 'pessoas.csv') => new File([conteudo], nome, { type: 'text/csv' });
const CABECALHO = ['tipo', 'nome', 'documento', 'emails', 'responsaveis'];

function abrir() {
  return render(<MemoryRouter initialEntries={['/pessoas/importar/']}>
    <Routes>
      <Route path="/pessoas/importar/" element={<ImportarPessoas />} />
      <Route path="/pessoas/" element={<p>Lista de pessoas</p>} />
    </Routes>
    <Janelas />
  </MemoryRouter>);
}
/** Escolhe o arquivo e espera a etapa dos responsáveis. */
async function escolher(f: File) {
  await userEvent.upload(screen.getByLabelText('Arquivo CSV'), f);
}
/** Do arquivo à conferência: escolhe, segue pelos responsáveis e espera as abas. */
async function conferir(conteudo: string) {
  abrir();
  await escolher(arquivo(conteudo));
  await userEvent.click(await screen.findByRole('button', { name: 'Conferir' }));
  await screen.findByRole('tablist', { name: 'Conferência' });
}
/** Grava pela confirmação ("Gravar") e espera o resumo. */
async function gravarEConfirmar(botao: RegExp) {
  await userEvent.click(screen.getByRole('button', { name: botao }));
  const confirmacao = await screen.findByRole('dialog', { name: 'Gravar a importação?' });
  const texto = confirmacao.textContent;
  await userEvent.click(within(confirmacao).getByRole('button', { name: 'Gravar' }));
  await screen.findByRole('heading', { name: 'Pronto' });
  return texto;
}

describe('Importar pessoas', () => {
  beforeEach(() => {
    // O jsdom não rola a página (não tem scrollIntoView); a tela volta ao topo a cada etapa.
    Element.prototype.scrollIntoView = vi.fn();
    sessao.ehAdmin = true;
    sessao.outros = [];
    gravacao.reiniciar();
    Object.values(SD).forEach(f => f.mockReset());
    baixarArquivo.mockReset();
    SD.pessoasParaImportar.mockResolvedValue([]);
    SD.importacaoIniciar.mockResolvedValue('imp-1');
    SD.pessoasImportar.mockImplementation(async (_id, lote) =>
      ({ criadas: lote.filter(i => !i.existente_id).length, completadas: lote.filter(i => i.existente_id).length, ids: [] }));
    SD.importacaoConcluir.mockImplementation(async (_id, completadas) => importacao({ completadas }));
  });
  afterEach(() => { gravacao.reiniciar(); });

  it('quando quem abre não é administrador, então vai para Pessoas', () => {
    // Dado
    sessao.ehAdmin = false;
    // Quando
    abrir();
    // Então
    expect(screen.getByText('Lista de pessoas')).toBeInTheDocument();
  });

  it('quando clica em "Baixar o modelo", então baixa o modelo do SEMPER com o nome certo', async () => {
    // Dado
    abrir();
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Baixar o modelo' }));
    // Então
    expect(baixarArquivo).toHaveBeenCalledWith(NOME_DO_MODELO, modeloImportacao());
  });

  it('quando o arquivo passa do tamanho máximo, então avisa e fica na primeira etapa, sem ler', async () => {
    // Dado
    abrir();
    const grande = arquivo('tipo;nome');
    Object.defineProperty(grande, 'size', { value: TAMANHO_MAXIMO_DO_ARQUIVO + 1 });
    // Quando
    await escolher(grande);
    // Então
    expect(await screen.findByRole('alert')).toHaveTextContent('o máximo é 10 MB');
    expect(screen.getByRole('heading', { name: 'Escolher o arquivo' })).toBeInTheDocument();
  });

  it('quando falta a coluna "nome", então explica qual coluna falta e fica na primeira etapa', async () => {
    // Dado
    abrir();
    // Quando
    await escolher(arquivo(csv(['tipo', 'documento'], ['pf', '529.982.247-25'])));
    // Então
    expect(await screen.findByRole('alert')).toHaveTextContent('Este arquivo não tem a coluna “nome”.');
    expect(screen.getByRole('heading', { name: 'Escolher o arquivo' })).toBeInTheDocument();
  });

  it('quando o arquivo é .xls, mesmo com o tipo que o Excel informa, então pede um CSV e fica na primeira etapa', async () => {
    // Dado: no seletor de arquivos, a pessoa escolheu "Todos os arquivos"
    abrir();
    const usuario = userEvent.setup({ applyAccept: false });
    // Quando
    await usuario.upload(screen.getByLabelText('Arquivo CSV'), new File(['planilha'], 'clientes.xls', { type: 'application/vnd.ms-excel' }));
    // Então
    expect(await screen.findByRole('alert')).toHaveTextContent('Ele precisa ser um CSV');
    expect(screen.getByRole('heading', { name: 'Escolher o arquivo' })).toBeInTheDocument();
  });

  it('quando o arquivo não tem extensão mas o navegador diz que é CSV, então ele é lido', async () => {
    // Dado
    abrir();
    // Quando
    await escolher(arquivo(csv(CABECALHO, ['pf', 'FULANA NOVA EXEMPLO', '', '', '']), 'pessoas'));
    // Então
    expect(await screen.findByRole('heading', { name: 'Responsáveis' })).toBeInTheDocument();
  });

  it('quando a etapa muda (ir e voltar), então o foco vai para o título da etapa nova', async () => {
    // Dado
    await conferir(csv(CABECALHO, ['pf', 'FULANA NOVA EXEMPLO', '', '', '']));
    expect(screen.getByRole('heading', { name: 'Conferir' })).toHaveFocus();
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Voltar' }));
    // Então
    expect(screen.getByRole('heading', { name: 'Responsáveis' })).toHaveFocus();
  });

  it('quando a importação está gravando, então o caminho de volta a Pessoas some até terminar', () => {
    // Dado
    gravacao.mudar({ fase: 'gravando', gravadas: 0, total: 3 });
    abrir();
    expect(screen.queryByRole('link', { name: 'Pessoas' })).not.toBeInTheDocument();
    // Quando
    act(() => gravacao.mudar({ fase: 'concluida', total: 3, gravadas: 3, totais: { criadas: 3, completadas: 0, incompletas: 0 }, falha: null, erroAoRegistrar: null }));
    // Então
    expect(screen.getByRole('link', { name: 'Pessoas' })).toBeInTheDocument();
  });

  it('quando duas pessoas da equipe têm o mesmo nome, então a lista dos responsáveis mostra o usuário de cada uma', async () => {
    // Dado
    sessao.outros = [{ id: 'u-ana-2', nome: 'Ana Teste Lima', usuario: 'ana.teste', ativo: true }];
    abrir();
    // Quando
    await escolher(arquivo(csv(CABECALHO, ['pf', 'FULANA NOVA EXEMPLO', '', '', 'Ana Lima'])));
    // Então
    const lista = await screen.findByLabelText('Usuário para Ana Lima');
    expect(within(lista).getByRole('option', { name: 'Ana Teste Lima (@ana.lima)' })).toBeInTheDocument();
    expect(within(lista).getByRole('option', { name: 'Ana Teste Lima (@ana.teste)' })).toBeInTheDocument();
    expect(within(lista).getByRole('option', { name: 'Mateus Exemplo Gonçalves' })).toBeInTheDocument();
  });

  it('quando uma linha tem CPF inválido e nenhuma referência, então o aviso conta que ela entraria de novo, repetida', async () => {
    // Quando: o CPF inválido fica de fora do cadastro (só na observação), e a outra linha tem CPF válido
    await conferir(csv(CABECALHO,
      ['pf', 'FULANA NOVA EXEMPLO', '123.456.789-00', '', ''],
      ['pf', 'MARIA COM CPF EXEMPLO', '111.444.777-35', '', '']));
    // Então
    expect(screen.getByText(/^1 linha não tem CPF\/CNPJ válido nem referência\./)).toBeInTheDocument();
  });

  it('quando o arquivo traz responsáveis, então liga quem a equipe tem e avisa de quem não tem', async () => {
    // Dado
    abrir();
    // Quando
    await escolher(arquivo(csv(CABECALHO, ['pf', 'FULANA NOVA EXEMPLO', '', '', 'Ana Lima | Fulano Desconhecido'])));
    // Então
    expect(await screen.findByLabelText('Usuário para Ana Lima')).toHaveValue('u-ana');
    expect(screen.getByLabelText('Usuário para Fulano Desconhecido')).toHaveValue('');
    expect(screen.getByText('Ninguém da equipe com esse nome.')).toBeInTheDocument();
  });

  it('quando o arquivo tem 1 pessoa nova, 1 que já existe e 1 sem nome, então as abas contam cada caso', async () => {
    // Dado
    SD.pessoasParaImportar.mockResolvedValue([pessoa({ nome: 'MARIA EXISTENTE EXEMPLO', documento: '11144477735' })]);
    // Quando
    await conferir(csv(CABECALHO,
      ['pf', 'FULANA NOVA EXEMPLO', '', '', ''],
      ['pf', 'MARIA EXISTENTE EXEMPLO', '111.444.777-35', 'maria@exemplo.com', ''],
      ['pf', '', '', '', '']));
    // Então
    expect(SD.pessoasParaImportar).toHaveBeenCalledWith({ documentos: ['11144477735'], referencias: [] });
    expect(screen.getByRole('tab', { name: 'Novos 1' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Completar 1' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Com erro 1' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Para decidir 0' })).toBeInTheDocument();
    // E a aba "Completar" diz o que muda no cadastro.
    await userEvent.click(screen.getByRole('tab', { name: 'Completar 1' }));
    expect(screen.getByText('Vai preencher: E-mails.')).toBeInTheDocument();
  });

  it('quando uma linha para decidir fica sem decisão, então ela não vai para o banco e a confirmação diz que fica de fora', async () => {
    // Dado: o CPF já é de um cadastro com outro nome
    SD.pessoasParaImportar.mockResolvedValue([pessoa({ nome: 'OUTRO NOME EXEMPLO', documento: '11144477735' })]);
    SD.importacaoConcluir.mockResolvedValue(importacao({ criadas: 1 }));
    await conferir(csv(CABECALHO,
      ['pf', 'FULANA NOVA EXEMPLO', '', '', ''],
      ['pf', 'MARIA EXISTENTE EXEMPLO', '111.444.777-35', '', '']));
    // Quando
    const confirmacao = await gravarEConfirmar(/^Gravar 1 pessoa$/);
    // Então
    expect(confirmacao).toContain('1 pessoa nova entra.');
    expect(confirmacao).toContain('Fica de fora 1 linha para decidir.');
    expect(SD.pessoasImportar).toHaveBeenCalledTimes(1);
    expect(SD.pessoasImportar.mock.calls[0][1].map(i => i.linha)).toEqual([2]);
    expect(screen.getByText('Importação concluída: 1 pessoa incluída, 0 completadas.')).toBeInTheDocument();
  });

  it('quando a linha para decidir recebe "Completar o cadastro que já existe", então ela vai para o banco como cadastro existente', async () => {
    // Dado
    SD.pessoasParaImportar.mockResolvedValue([pessoa({ id: 'p-maria', nome: 'OUTRO NOME EXEMPLO', documento: '11144477735' })]);
    await conferir(csv(CABECALHO, ['pf', 'MARIA EXISTENTE EXEMPLO', '111.444.777-35', 'maria@exemplo.com', '']));
    // Quando
    await userEvent.click(within(screen.getByRole('group', { name: 'Linha 2' })).getByLabelText('Completar o cadastro que já existe'));
    await gravarEConfirmar(/^Gravar 1 pessoa$/);
    // Então
    const [item] = SD.pessoasImportar.mock.calls[0][1];
    expect(item).toMatchObject({ linha: 2, existente_id: 'p-maria', dados: { emails: ['maria@exemplo.com'] } });
    expect(item.observacoes).toContain('Nome no arquivo importado: MARIA EXISTENTE EXEMPLO');
  });

  it('quando o 2º lote dá erro, então o resumo diz quais linhas não foram gravadas e a importação é registrada mesmo assim', async () => {
    // Dado: 202 pessoas novas, em dois lotes (200 + 2)
    const linhas = Array.from({ length: 202 }, (_, i) => ['pf', `PESSOA EXEMPLO ${i + 1}`, '', '', '']);
    SD.pessoasImportar.mockResolvedValueOnce({ criadas: 200, completadas: 0, ids: [] })
      .mockRejectedValueOnce(new Error('Linha 202: já existe um cadastro com este CPF/CNPJ ou esta referência.'));
    SD.importacaoConcluir.mockResolvedValue(importacao({ criadas: 200 }));
    await conferir(csv(CABECALHO, ...linhas));
    // Quando
    await gravarEConfirmar(/^Gravar 202 pessoas$/);
    // Então
    expect(SD.pessoasImportar).toHaveBeenCalledTimes(2);
    expect(SD.importacaoConcluir).toHaveBeenCalledWith('imp-1', 0);
    expect(screen.getByText(/As linhas 202 a 203 não foram gravadas: Linha 202: já existe um cadastro/)).toBeInTheDocument();
    expect(screen.getByText('Importação interrompida: 200 pessoas incluídas, 0 completadas.')).toBeInTheDocument();
  });

  it('quando a importação é aberta de novo depois de gravada, então o resumo reaparece, e "Ver em Pessoas" volta a Pessoas', async () => {
    // Dado
    gravacao.mudar({ fase: 'concluida', total: 3, gravadas: 3, totais: { criadas: 2, completadas: 1, incompletas: 1 }, falha: null, erroAoRegistrar: null });
    abrir();
    expect(screen.getByText('Importação concluída: 2 pessoas incluídas, 1 completada, 1 com pendência (marcada como incompleta).')).toBeInTheDocument();
    // Quando
    await userEvent.click(screen.getByRole('button', { name: 'Ver em Pessoas' }));
    // Então
    await waitFor(() => expect(screen.getByText('Lista de pessoas')).toBeInTheDocument());
    expect(gravacao.ler().fase).toBe('ocioso');
  });
});
