// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Grupos de colunas nos quadros. Na semente do banco fictício nenhum quadro tem grupos, e JOSÉ DA SILVA TESTE está na
// coluna "Lead". Quem está logado é o Mateus (administrador).
import { expect, test, type Page } from '@playwright/test';

async function abrirQuadro(page: Page) {
  await page.goto('/pessoas/');
  await page.getByRole('button', { name: 'Kanban' }).click();
}
async function criarGrupo(page: Page, nome: string) {
  await page.getByLabel('Novo grupo').fill(nome);
  await page.getByRole('button', { name: 'Criar grupo' }).click();
  await expect(page.getByRole('region', { name: `Grupo ${nome}` })).toBeVisible();
}
async function moverParaGrupo(page: Page, coluna: string, grupo: string) {
  await page.getByRole('button', { name: `Opções da coluna ${coluna}` }).click();
  await page.getByRole('menuitemradio', { name: grupo }).click();
  await expect(page.getByRole('region', { name: `Grupo ${grupo}` }).getByRole('list', { name: coluna })).toBeVisible();
}

test.describe('Grupos de colunas', () => {
  test('quando o quadro não tem grupos, então continua como antes', async ({ page }) => {
    // Quando
    await abrirQuadro(page);
    // Então
    await expect(page.getByRole('list', { name: 'Lead' })).toContainText('JOSÉ DA SILVA TESTE');
    await expect(page.getByRole('region', { name: /^Grupo / })).toHaveCount(0);
    await expect(page.getByLabel('Grupo da coluna')).toHaveCount(0);
  });

  test('quando a pessoa fecha um grupo, então as colunas somem, fica a faixa com o nome e os cartões, e continua fechado ao recarregar', async ({ page }) => {
    // Dado
    await abrirQuadro(page);
    await criarGrupo(page, 'Início');
    await moverParaGrupo(page, 'Lead', 'Início');
    // Quando
    await page.getByRole('button', { name: 'Fechar o grupo Início' }).click();
    // Então
    const faixa = page.getByRole('button', { name: /^Abrir o grupo Início, \d+ cartões$/ });
    await expect(faixa).toBeVisible();
    await expect(page.getByRole('list', { name: 'Lead' })).toHaveCount(0);
    // Quando
    await page.reload();
    await page.getByRole('button', { name: 'Kanban' }).click();
    // Então
    await expect(faixa).toBeVisible();
    await expect(page.getByRole('list', { name: 'Lead' })).toHaveCount(0);
    // Quando
    await faixa.click();
    // Então
    await expect(page.getByRole('list', { name: 'Lead' })).toContainText('JOSÉ DA SILVA TESTE');
  });

  test('quando o grupo começa fechado, então ele abre fechado até a pessoa abrir', async ({ page }) => {
    // Dado
    await abrirQuadro(page);
    await criarGrupo(page, 'Encerrado');
    // Quando
    await page.getByRole('button', { name: 'Opções do grupo Encerrado' }).click();
    await page.getByRole('menuitemcheckbox', { name: 'Começa fechado para todos' }).click();
    // Então
    await expect(page.getByRole('button', { name: /^Abrir o grupo Encerrado/ })).toBeVisible();
  });

  test('quando alguém cria uma coluna, então escolhe o grupo dela', async ({ page }) => {
    // Dado
    await abrirQuadro(page);
    await criarGrupo(page, 'Conhecimento');
    // Quando
    await page.getByLabel('Nova coluna').fill('Contestação');
    await page.getByLabel('Grupo da coluna').selectOption({ label: 'Conhecimento' });
    await page.getByRole('button', { name: 'Criar coluna' }).click();
    // Então
    await expect(page.getByRole('region', { name: 'Grupo Conhecimento' }).getByRole('list', { name: 'Contestação' })).toBeVisible();
  });

  test('quando o grupo é excluído, então as colunas dele continuam no quadro, sem grupo', async ({ page }) => {
    // Dado
    await abrirQuadro(page);
    await criarGrupo(page, 'Início');
    await moverParaGrupo(page, 'Lead', 'Início');
    // Quando
    await page.getByRole('button', { name: 'Opções do grupo Início' }).click();
    await page.getByRole('menuitem', { name: 'Excluir grupo' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Excluir grupo' }).click();
    // Então
    await expect(page.getByRole('region', { name: 'Grupo Início' })).toHaveCount(0);
    await expect(page.getByRole('list', { name: 'Lead' })).toContainText('JOSÉ DA SILVA TESTE');
  });

  test('quando o grupo é renomeado, então o nome novo aparece no quadro', async ({ page }) => {
    // Dado
    await abrirQuadro(page);
    await criarGrupo(page, 'Inicio');
    // Quando
    await page.getByRole('button', { name: 'Opções do grupo Inicio' }).click();
    await page.getByRole('menuitem', { name: 'Renomear' }).click();
    await page.getByRole('dialog').getByRole('textbox').fill('Início');
    await page.getByRole('dialog').getByRole('button', { name: /Salvar|OK|Confirmar/ }).click();
    // Então
    await expect(page.getByRole('region', { name: 'Grupo Início' })).toBeVisible();
  });
});
