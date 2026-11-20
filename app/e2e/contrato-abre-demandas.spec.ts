// Quem está num contrato vê as demandas e as tarefas dele, só para ler (#326). Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Na semente do banco fictício, Bruno (estagiário, não é administrador) não é parte do contrato de JOSÉ DA SILVA TESTE, de Mauro,
// não está na demanda "Busca de anterioridade" (ligada a esse contrato) e é colaborador da demanda "Registro de marca". A tarefa
// "Renovar a procuração" é avulsa, da Ana, com o Mauro de participante.
// O banco fictício ainda lista todas as demandas e tarefas; aqui o teste confere o cartão e a lista de quem chega a eles pelo contrato.
import { expect, test, type Page } from '@playwright/test';
import { abrir, abrirSecao, acoesNoMenuDoCartao, entrarComo, menuDoCartao } from './ajudantes';

type BancoFalso = {
  contratos: { id: string; servico: string; participantes: unknown[] }[];
  demandas: { id: string; codigo: string; titulo: string }[];
  tarefas: { titulo: string; demanda_id: string | null; demanda_codigo: string | null; contrato_id: string | null }[];
};
/** O contrato de JOSÉ DA SILVA TESTE, na semente. */
const CONTRATO = 'Registro de marca';

/** O que o teste muda no banco fictício, direto na aba (pela tela, quem faz isso é quem está no contrato ou na tarefa). */
type Mudanca = 'bruno no contrato' | 'procuração na demanda' | 'procuração no contrato';
async function mudarBanco(page: Page, mudanca: Mudanca) {
  await page.goto('/inicio/');
  await page.evaluate(([qual, servico]) => {
    const bd = JSON.parse(sessionStorage.getItem('semper-dados-falsos')!) as BancoFalso;
    const contrato = bd.contratos.find(k => k.servico.startsWith(servico))!;
    const procuracao = bd.tarefas.find(t => t.titulo === 'Renovar a procuração')!;
    const busca = bd.demandas.find(d => d.titulo === 'Busca de anterioridade')!;
    const MUDAR: Record<Mudanca, () => void> = {
      'bruno no contrato': () => { contrato.participantes.push({ pessoa_id: 'p-bruno', percentual: null }); },
      'procuração na demanda': () => { procuracao.demanda_id = busca.id; procuracao.demanda_codigo = busca.codigo; },
      'procuração no contrato': () => { procuracao.contrato_id = contrato.id; }
    };
    MUDAR[qual as Mudanca]();
    sessionStorage.setItem('semper-dados-falsos', JSON.stringify(bd));
  }, [mudanca, CONTRATO]);
  // O banco fictício lê a aba ao abrir a página: recarrega para valer a mudança.
  await page.reload();
}
/** Põe Bruno como participante do contrato de JOSÉ DA SILVA TESTE. */
const brunoNoContrato = (page: Page) => mudarBanco(page, 'bruno no contrato');
/** Liga a tarefa "Renovar a procuração" à demanda "Busca de anterioridade" (do contrato) ou só ao contrato. */
const procuracaoLigada = (page: Page, a: 'demanda' | 'contrato') => mudarBanco(page, a === 'demanda' ? 'procuração na demanda' : 'procuração no contrato');

async function abrirDemanda(page: Page, titulo: string) {
  await abrir(page, 'Demandas');
  await page.getByRole('button', { name: 'Tabela' }).click();
  await page.getByRole('row').filter({ hasText: titulo }).click();
  return page.getByRole('dialog');
}
async function abrirTarefa(page: Page, titulo: string) {
  await page.goto('/tarefas/');
  await page.getByRole('button', { name: 'Tabela' }).click();
  await page.getByRole('row').filter({ hasText: titulo }).click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: titulo, level: 2 })).toBeVisible();
  return page.getByRole('dialog');
}

test.describe('Quem está no contrato vê as demandas dele', () => {
  test('dado um participante do contrato, quando abre uma demanda dele em que não está, então lê, mas não vê os botões de alterar', async ({ page }) => {
    // Dado
    await brunoNoContrato(page);
    await entrarComo(page, 'u-bruno');
    // Quando
    const cartao = await abrirDemanda(page, 'Busca de anterioridade');
    // Então
    await expect(cartao.getByText('Você vê este cartão porque está no contrato ligado a ele.', { exact: false })).toBeVisible();
    await expect(cartao.getByRole('button', { name: 'Editar' })).toHaveCount(0);
    // Sem o ⋯ (o Arquivar e o Excluir moram nele desde a #382) e sem o ícone de etiqueta.
    await expect(menuDoCartao(cartao)).toHaveCount(0);
    await expect(cartao.getByRole('button', { name: 'Escolher etiquetas' })).toHaveCount(0);
    await expect(cartao.getByRole('combobox', { name: 'Situação da demanda' })).toBeDisabled();
    await abrirSecao(cartao, 'Checklists');
    await expect(cartao.getByRole('button', { name: 'Adicionar checklist' })).toHaveCount(0);
  });

  test('dado alguém fora do contrato, quando abre (no banco fictício) uma demanda dele em que não está, então o cartão não diz que ele está no contrato', async ({ page }) => {
    // Dado
    await entrarComo(page, 'u-bruno');
    // Quando
    const cartao = await abrirDemanda(page, 'Busca de anterioridade');
    // Então
    await expect(cartao.getByText('Você não participa deste cartão.', { exact: false })).toBeVisible();
    await expect(cartao.getByText('Você vê este cartão porque está no contrato ligado a ele.', { exact: false })).toHaveCount(0);
    await expect(cartao.getByRole('button', { name: 'Editar' })).toHaveCount(0);
  });

  test('dado um participante do contrato, quando abre uma demanda dele em que é colaborador, então altera como antes', async ({ page }) => {
    // Dado
    await brunoNoContrato(page);
    await entrarComo(page, 'u-bruno');
    // Quando
    const cartao = await abrirDemanda(page, 'Registro de marca');
    // Então
    await expect(cartao.getByRole('button', { name: 'Editar' })).toBeVisible();
    // O caso de controle do primeiro: quem altera tem o ⋯, com o Arquivar, e o ícone de etiqueta.
    expect(await acoesNoMenuDoCartao(page, cartao)).toEqual(['Arquivar']);
    await expect(cartao.getByRole('button', { name: 'Escolher etiquetas' })).toBeVisible();
    await expect(cartao.getByText('Você vê este cartão porque está no contrato ligado a ele.', { exact: false })).toHaveCount(0);
    await expect(cartao.getByRole('combobox', { name: 'Situação da demanda' })).toBeEnabled();
  });
});

test.describe('Quem está no contrato pode ser mencionado nas demandas e tarefas dele', () => {
  test('dado o Bruno no contrato, quando o Mauro escreve @ num comentário de uma demanda dele em que o Bruno não está, então o Bruno pode ser escolhido', async ({ page }) => {
    // Dado
    await brunoNoContrato(page);
    const cartao = await abrirDemanda(page, 'Busca de anterioridade');
    await abrirSecao(cartao, 'Comentários');
    // Quando
    await cartao.getByRole('textbox', { name: 'Escrever um comentário' }).fill('Veja isto, @');
    await expect(page.getByRole('option', { name: /Bruno Exemplo Souza/ })).toHaveAttribute('aria-disabled', 'false');
    await page.getByRole('option', { name: /Bruno Exemplo Souza/ }).click();
    // Então
    await expect(cartao.getByRole('textbox', { name: 'Escrever um comentário' })).toHaveValue(/@bruno\.souza/);
  });

  for (const a of ['demanda', 'contrato'] as const) {
    test(`dado o Bruno no contrato e a tarefa ligada ${a === 'demanda' ? 'a uma demanda dele' : 'a ele'}, quando o Mauro escreve @ num comentário da tarefa, então o Bruno pode ser escolhido`, async ({ page }) => {
      // Dado
      await brunoNoContrato(page);
      await procuracaoLigada(page, a);
      const cartao = await abrirTarefa(page, 'Renovar a procuração');
      await abrirSecao(cartao, 'Comentários');
      // Quando
      await cartao.getByRole('textbox', { name: 'Escrever um comentário' }).fill('Veja isto, @');
      // Então
      await expect(page.getByRole('option', { name: /Bruno Exemplo Souza/ })).toHaveAttribute('aria-disabled', 'false');
      await expect(page.getByRole('option', { name: /Bruno Exemplo Souza/ })).not.toContainText('não participa');
    });
  }
});

test.describe('Quem vê a tarefa só pelo contrato não a altera pela lista', () => {
  test('dado o Bruno no contrato e uma tarefa de uma demanda dele em que o Bruno não está, quando ele abre a tabela de Tarefas, então não pode selecioná-la', async ({ page }) => {
    // Dado
    await brunoNoContrato(page);
    await procuracaoLigada(page, 'demanda');
    await entrarComo(page, 'u-bruno');
    // Quando
    await page.goto('/tarefas/');
    await page.getByRole('button', { name: 'Tabela' }).click();
    // Então: a tarefa dele continua selecionável; a que ele vê pelo contrato, não
    await expect(page.getByRole('checkbox', { name: 'Selecionar 9B3D4E51' })).toBeEnabled();
    await expect(page.getByRole('checkbox', { name: 'Selecionar F00D1234' })).toBeDisabled();
  });
});
