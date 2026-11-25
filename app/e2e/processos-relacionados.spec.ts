// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Processos relacionados de qualquer tipo (#440): todo processo liga outro que já existe ("Ligar processo existente"), e cada cartão
// mostra o outro como "Relacionado". Na semente do banco fictício: o processo judicial 0001234-97.2026.8.13.0024, de JOSÉ DA SILVA
// TESTE, e o administrativo "Registro da marca Exemplo" (912345678). Quem está logado é o Mauro (administrador).
import { expect, test, type Locator, type Page } from '@playwright/test';
import { abrirSecao } from './ajudantes';

const MARCA = 'Registro da marca Exemplo';

/** Abre o cartão de um processo pela tabela do tipo dele. */
async function abrirProcesso(page: Page, tipo: 'judicial' | 'administrativo', linha: string) {
  await page.goto(`/processos/${tipo}/`);
  await page.getByRole('button', { name: 'Tabela', exact: true }).click();
  await page.getByRole('row').filter({ hasText: linha }).first().click();
  const cartao = page.getByRole('dialog');
  await expect(cartao.getByLabel('Situação do processo')).toBeVisible();
  return cartao;
}
/** A seção "Processos relacionados" do cartão, aberta. */
async function relacionados(cartao: Locator) {
  await abrirSecao(cartao, 'Processos relacionados');
  return cartao.locator('section', { has: cartao.page().getByRole('button', { name: /^Processos relacionados( \d+)?$/ }) });
}

test.describe('Processos relacionados de qualquer tipo (#440)', () => {
  test('dado um processo judicial, quando liga um administrativo que já existe, então os dois cartões mostram o outro como "Relacionado", e o contador sobe', async ({ page }) => {
    // Dado
    let cartao = await abrirProcesso(page, 'judicial', 'JOSÉ DA SILVA TESTE');
    let secao = await relacionados(cartao);
    // Quando
    await cartao.getByRole('button', { name: 'Ligar processo existente' }).click();
    await secao.getByRole('textbox', { name: 'Buscar processo para ligar' }).fill('marca');
    await secao.getByRole('list', { name: 'Processos para ligar' }).getByRole('button', { name: new RegExp(MARCA) }).click();
    // Então
    await expect(page.getByText('Processo relacionado:', { exact: false })).toBeVisible();
    const administrativo = secao.getByRole('link', { name: new RegExp(MARCA) });
    await expect(administrativo).toContainText('Relacionado · Administrativo · 912345678');
    await expect(cartao.getByRole('button', { name: /^Processos relacionados/ })).toHaveText(/1$/);
    // Quando: abre o administrativo
    await administrativo.click();
    cartao = page.getByRole('dialog');
    await expect(cartao.getByRole('heading', { name: MARCA, level: 2 })).toBeVisible();
    secao = await relacionados(cartao);
    // Então ele mostra o judicial, e a busca não oferece de novo o que já está ligado
    await expect(secao.getByRole('link', { name: /JOSÉ DA SILVA TESTE/ })).toContainText('Relacionado · Judicial · 0001234-97.2026.8.13.0024');
    await cartao.getByRole('button', { name: 'Ligar processo existente' }).click();
    await secao.getByRole('textbox', { name: 'Buscar processo para ligar' }).fill('0001234');
    await expect(secao.getByText('Nenhum processo ativo com esse texto que você possa ligar.')).toBeVisible();
  });
});
