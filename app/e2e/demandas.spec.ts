// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Módulo Demandas. Na semente do banco fictício: o contrato de JOSÉ DA SILVA TESTE (assinado) já gerou as demandas
// "Registro de marca" (Fazendo, com o Bruno de colaborador) e "Busca de anterioridade" (Para fazer); "Notificar o
// devedor" é avulsa, do Bruno, com o prazo vencido. Quem está logado é o Mateus (administrador).
import { expect, test, type Page } from '@playwright/test';

/** Abre o cartão de um item do quadro ou da tabela pelo texto. */
async function abrirDemanda(page: Page, titulo: string) {
  await page.goto('/demandas/');
  await page.getByRole('button', { name: 'Tabela' }).click();
  await page.getByRole('row').filter({ hasText: titulo }).click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: titulo, level: 2 })).toBeVisible();
  return page.getByRole('dialog');
}

test.describe('Cadastro de demandas', () => {
  test('quando a pessoa cadastra uma demanda pelas etapas, então ela entra em "Para fazer", com a equipe e o cliente no cartão', async ({ page }) => {
    // Dado
    await page.goto('/demandas/nova/');
    await expect(page.getByText('Etapa 1 de 3')).toBeVisible();
    // Quando
    await page.getByLabel('Título').fill('Contestação do processo');
    await page.getByLabel('Prazo de entrega').fill('10112030');
    await page.getByRole('button', { name: 'Próxima' }).click();
    await page.getByRole('group', { name: 'Colaboradores' }).getByText('Ana Teste Lima', { exact: true }).click();
    await page.getByRole('textbox', { name: 'Cliente', exact: true }).fill('luciana');
    await page.getByRole('button', { name: /LUCIANA ROCHA AMOSTRA/ }).click();
    await page.getByRole('button', { name: 'Próxima' }).click();
    await page.getByRole('button', { name: 'Salvar demanda' }).click();
    // Então
    const cartao = page.getByRole('dialog');
    await expect(cartao.getByRole('heading', { name: 'Contestação do processo' })).toBeVisible();
    await expect(cartao).toContainText('Prazo: 10/11/2030');
    await expect(cartao.getByRole('link', { name: /Mateus Freitas Gonçalves/ })).toContainText('Responsável');
    await expect(cartao.getByRole('link', { name: /Ana Teste Lima/ })).toContainText('Colaborador');
    await expect(cartao.getByRole('link', { name: /LUCIANA ROCHA AMOSTRA/ })).toContainText('Cliente');
    await expect(cartao.getByLabel('Situação da demanda').getByRole('option', { selected: true })).toHaveText('Para fazer');
  });

  test('quando falta o título, então a etapa avisa e não segue', async ({ page }) => {
    // Dado
    await page.goto('/demandas/nova/');
    // Quando
    await page.getByRole('button', { name: 'Próxima' }).click();
    // Então
    await expect(page.getByText('Dê um título à demanda.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'A demanda', level: 2 })).toBeVisible();
  });
});

test.describe('Demandas automáticas', () => {
  test('quando o contrato vai para a coluna do contrato assinado, então nasce uma demanda por objeto, ligada a ele', async ({ page }) => {
    // Dado: o contrato de MARIA APARECIDA EXEMPLO está em negociação, com o objeto "Ação de cobrança"
    await page.goto('/contratos/');
    await page.getByRole('row').filter({ hasText: 'MARIA APARECIDA EXEMPLO' }).click();
    const contrato = page.getByRole('dialog');
    // Quando
    await contrato.getByLabel('Situação do contrato').selectOption({ label: 'Assinado / em andamento' });
    // Então
    await expect(contrato.getByRole('link', { name: /Ação de cobrança/ })).toContainText('Para fazer');
    await contrato.getByRole('link', { name: /Ação de cobrança/ }).click();
    const demanda = page.getByRole('dialog');
    await expect(demanda.getByRole('heading', { name: 'Ação de cobrança', level: 2 })).toBeVisible();
    await expect(demanda.getByRole('link', { name: /MARIA APARECIDA EXEMPLO/ })).toContainText('Cliente');
    await expect(demanda.getByRole('link', { name: /Ação de cobrança/ })).toContainText('Contrato');
  });
});

test.describe('Demandas ligadas', () => {
  test('quando alguém abre o cartão de uma pessoa, então vê as demandas dela, com o papel e a situação', async ({ page }) => {
    // Quando
    await page.goto('/pessoas/');
    await page.getByRole('row').filter({ hasText: 'JOSÉ DA SILVA TESTE' }).click();
    // Então
    await expect(page.getByRole('dialog').getByRole('link', { name: /Registro de marca/ }).filter({ hasText: 'Fazendo' })).toContainText('Cliente');
  });

  test('quando a demanda tem o prazo vencido, então o cartão avisa', async ({ page }) => {
    // Quando
    const cartao = await abrirDemanda(page, 'Notificar o devedor');
    // Então
    await expect(cartao.getByText(/Prazo vencido/)).toBeVisible();
  });

  test('quando o comentário da demanda menciona quem não participa dela, então a pessoa aparece desligada na lista do @', async ({ page }) => {
    // Dado: "Busca de anterioridade" é do Mateus, sem colaboradores; a Ana é administradora e vê todas
    const cartao = await abrirDemanda(page, 'Busca de anterioridade');
    // Quando
    await cartao.getByRole('textbox', { name: 'Escrever um comentário' }).fill('Veja isto, @');
    // Então
    await expect(page.getByRole('option', { name: /Bruno Exemplo Souza/ })).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByRole('option', { name: /Bruno Exemplo Souza/ })).toContainText('não participa');
    await expect(page.getByRole('option', { name: /Ana Teste Lima/ })).toHaveAttribute('aria-disabled', 'false');
  });
});
