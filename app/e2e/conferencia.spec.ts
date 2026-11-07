// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// O banco fictício entra como administrador; quem não é administrador está em paginas/Conferencia.test.tsx e no teste do banco.
import { expect, test, type Page } from '@playwright/test';
import { abrirNoFinanceiro } from './ajudantes';

async function abrirConferencia(page: Page) {
  await page.goto('/inicio/');
  await abrirNoFinanceiro(page, 'Conferência');
  await expect(page.getByRole('heading', { name: /^Conferência/ })).toBeVisible();
}
const linhas = (page: Page) => page.getByRole('table', { name: 'Lançamentos para conferir' });
const salvou = (page: Page, texto: string) => expect(page.getByText(texto).first()).toBeVisible();

test.describe('Conferência dos lançamentos', () => {
  test('quando abre, então vê o pago e o que entrou no caixa, e a linha que só existe no caixa', async ({ page }) => {
    // Quando
    await abrirConferencia(page);
    // Então
    const confere = linhas(page).getByRole('row', { name: /CLIENTE QUE CONFERE/ });
    await expect(confere.getByLabel(/^Valor pago/)).toHaveValue('1.000,00');
    await expect(confere).toContainText('300,00');
    const soNoCaixa = linhas(page).getByRole('row', { name: /CLIENTE SÓ NO CAIXA/ });
    await expect(soNoCaixa).toContainText('150,00');
    await expect(soNoCaixa.getByLabel(/^Valor pago/)).toHaveValue('');
    await expect(linhas(page).getByRole('row', { name: /CLIENTE SEM ENTRADA/ })).toContainText('Sem entrada');
  });

  test('quando marca Não confere e escreve uma observação, então fica salvo, com quem marcou e no histórico', async ({ page }) => {
    // Dado
    await abrirConferencia(page);
    const linha = linhas(page).getByRole('row', { name: /CLIENTE QUE CONFERE/ });
    // Quando
    await linha.getByLabel(/^Situação/).selectOption({ label: 'Não confere' });
    await salvou(page, 'Conferência salva.');
    await linha.getByLabel(/^Observação/).fill('Falta o comprovante');
    await linha.getByLabel(/^Observação/).blur();
    await expect(linha).toContainText('Mateus Freitas Gonçalves');
    // Então
    await page.reload();
    const depois = linhas(page).getByRole('row', { name: /CLIENTE QUE CONFERE/ });
    await expect(depois.getByLabel(/^Situação/)).toHaveValue('nao_confere');
    await expect(depois.getByLabel(/^Observação/)).toHaveValue('Falta o comprovante');
    await depois.getByRole('button', { name: /^Ver o histórico/ }).click();
    await expect(page.getByRole('region', { name: 'Histórico da linha' })).toContainText('Falta o comprovante');
  });

  test('quando corrige o valor pago, então fica salvo e o caixa não muda; a data futura é recusada', async ({ page }) => {
    // Dado
    await abrirConferencia(page);
    const linha = linhas(page).getByRole('row', { name: /CLIENTE QUE CONFERE/ });
    // Quando
    await linha.getByLabel(/^Pago em/).fill(`${new Date().getFullYear() + 1}-01-01`);
    await linha.getByLabel(/^Pago em/).blur();
    // Então
    await expect(linha.getByText('A data do pagamento não pode estar no futuro.')).toBeVisible();
    // Quando
    await linha.getByLabel(/^Pago em/).fill('2026-03-15');
    await linha.getByLabel(/^Valor pago/).fill('1.234,56');
    await linha.getByLabel(/^Valor pago/).blur();
    await salvou(page, 'Pagamento corrigido.');
    // Então
    await page.reload();
    await expect(linhas(page).getByRole('row', { name: /CLIENTE QUE CONFERE/ }).getByLabel(/^Valor pago/)).toHaveValue('1.234,56');
    await page.goto('/financeiro/contas/');
    await expect(page.getByRole('heading', { name: /^Caixa/ })).toBeVisible();
    await expect(page.getByText('1.234,56')).toHaveCount(0);
  });

  test('quando preenche a linha que só existe no caixa, então salva só depois da data e do valor', async ({ page }) => {
    // Dado
    await abrirConferencia(page);
    const linha = linhas(page).getByRole('row', { name: /CLIENTE SÓ NO CAIXA/ });
    // Quando
    await linha.getByLabel(/^Pago em/).fill('2026-05-20');
    await linha.getByLabel(/^Pago em/).blur();
    // Então
    await expect(linha.getByRole('alert')).toHaveCount(0);
    // Quando
    await linha.getByLabel(/^Valor pago/).fill('500,00');
    await linha.getByLabel(/^Valor pago/).blur();
    // Então
    await expect(linha.getByLabel(/^Valor pago/)).toHaveValue('500,00');
    await page.reload();
    await expect(linhas(page).getByRole('row', { name: /CLIENTE SÓ NO CAIXA/ }).getByLabel(/^Valor pago/)).toHaveValue('500,00');
  });

  test('dado um administrador, quando abre o resumo, então vê por responsável e ano, e abre as linhas de cada um', async ({ page }) => {
    // Quando
    await abrirConferencia(page);
    const resumo = page.getByRole('table', { name: 'Resumo por responsável e ano' });
    // Então
    await expect(resumo.getByRole('row', { name: /Ana Teste Lima.*2026/ })).toBeVisible();
    await expect(resumo.getByRole('row', { name: /Mateus Freitas Gonçalves.*2025/ })).toBeVisible();
    // Quando
    await page.getByRole('button', { name: 'Ver as linhas de Ana Teste Lima em 2026' }).click();
    // Então
    await expect(linhas(page).getByRole('row', { name: /CLIENTE DA ANA/ })).toBeVisible();
    await expect(linhas(page).getByRole('row', { name: /CLIENTE QUE CONFERE/ })).toHaveCount(0);
  });

  test('quando filtra por ano, situação e busca, então mostra só essas linhas', async ({ page }) => {
    // Dado
    await abrirConferencia(page);
    // Quando
    await page.getByLabel('Ano', { exact: true }).selectOption('2025');
    // Então
    await expect(linhas(page).getByRole('row', { name: /CLIENTE DE 2025/ })).toBeVisible();
    await expect(linhas(page).getByRole('row', { name: /CLIENTE QUE CONFERE/ })).toHaveCount(0);
    // Quando
    await page.getByLabel('Ano', { exact: true }).selectOption('2026');
    await page.getByLabel('Situação', { exact: true }).selectOption({ label: 'Confere' });
    // Então
    await expect(page.getByText('Nenhuma linha com esse filtro.')).toBeVisible();
    // Quando
    await page.getByLabel('Situação', { exact: true }).selectOption({ label: 'A conferir' });
    await page.getByLabel('Buscar').fill('sem entrada');
    // Então
    await expect(linhas(page).getByRole('row', { name: /CLIENTE SEM ENTRADA/ })).toBeVisible();
    await expect(linhas(page).getByRole('row', { name: /CLIENTE QUE CONFERE/ })).toHaveCount(0);
  });
});
