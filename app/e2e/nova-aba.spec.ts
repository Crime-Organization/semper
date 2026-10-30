// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Como num site comum, Ctrl+clique (Cmd+clique no Mac) e o clique da rodinha abrem o cartão numa aba nova, nas linhas
// da tabela e nos cartões do quadro. A aba nova leva uma cópia do banco fictício da aba de antes.
import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test';

/** Clica no item como pedido e devolve a aba nova que ele abriu, já carregada. */
async function abaNova(context: BrowserContext, clicar: () => Promise<void>) {
  const [nova] = await Promise.all([context.waitForEvent('page'), clicar()]);
  await nova.waitForLoadState();
  return nova;
}
/** Confere que a aba de antes continua na lista, sem cartão aberto. */
async function continuaNaLista(page: Page, endereco: RegExp) {
  await expect(page).toHaveURL(endereco);
  await expect(page.getByRole('dialog')).toHaveCount(0);
}
/** A última célula da linha (a data): um lugar da linha fora do nome. */
const foraDoNome = (linha: Locator) => linha.getByRole('cell').last();

test.describe('Abrir o cartão numa aba nova', () => {
  test('quando a pessoa dá Ctrl+clique numa linha da tabela de pessoas, então o cartão abre numa aba nova e esta continua na lista', async ({ page, context }) => {
    // Dado
    await page.goto('/pessoas/');
    const linha = page.getByRole('row').filter({ hasText: 'JOSÉ DA SILVA TESTE' });
    // Quando
    const nova = await abaNova(context, () => foraDoNome(linha).click({ modifiers: ['ControlOrMeta'] }));
    // Então
    await expect(nova).toHaveURL(/\/pessoas\/\?id=/);
    await expect(nova.getByRole('dialog')).toContainText('JOSÉ DA SILVA TESTE');
    await continuaNaLista(page, /\/pessoas\/$/);
  });

  test('quando a pessoa dá Ctrl+clique num cartão do quadro, então o cartão abre numa aba nova e o quadro continua aqui', async ({ page, context }) => {
    // Dado
    await page.goto('/pessoas/');
    await page.getByRole('button', { name: 'Kanban' }).click();
    const cartao = page.getByRole('list', { name: 'Lead', exact: true }).getByRole('listitem').filter({ hasText: 'JOSÉ DA SILVA TESTE' });
    // Quando
    const nova = await abaNova(context, () => cartao.click({ modifiers: ['ControlOrMeta'] }));
    // Então
    await expect(nova.getByRole('dialog')).toContainText('JOSÉ DA SILVA TESTE');
    await continuaNaLista(page, /\/pessoas\/$/);
    await expect(cartao).toBeVisible();
  });

  test('quando a pessoa clica com a rodinha numa linha da tabela de contratos, então o contrato abre numa aba nova', async ({ page, context }) => {
    // Dado
    await page.goto('/contratos/');
    const linha = page.getByRole('row').filter({ hasText: 'MARIA APARECIDA EXEMPLO' });
    // Quando
    const nova = await abaNova(context, () => foraDoNome(linha).click({ button: 'middle' }));
    // Então
    await expect(nova).toHaveURL(/\/contratos\/\?id=/);
    await expect(nova.getByRole('dialog')).toContainText('MARIA APARECIDA EXEMPLO');
    await continuaNaLista(page, /\/contratos\/$/);
  });

  test('quando a pessoa olha o nome na linha, então ele é um link para o cartão (o botão direito oferece abrir em nova aba)', async ({ page }) => {
    // Quando
    await page.goto('/pessoas/');
    // Então
    const nome = page.getByRole('row').filter({ hasText: 'JOSÉ DA SILVA TESTE' }).getByRole('link', { name: 'JOSÉ DA SILVA TESTE' });
    await expect(nome).toHaveAttribute('href', /^\/pessoas\/\?id=/);
  });

  test('quando a pessoa clica no nome sem Ctrl, então o cartão abre aqui mesmo, sem aba nova', async ({ page, context }) => {
    // Dado
    await page.goto('/pessoas/');
    // Quando
    await page.getByRole('row').filter({ hasText: 'JOSÉ DA SILVA TESTE' }).getByRole('link', { name: 'JOSÉ DA SILVA TESTE' }).click();
    // Então
    await expect(page.getByRole('dialog')).toContainText('JOSÉ DA SILVA TESTE');
    expect(context.pages()).toHaveLength(1);
  });
});
