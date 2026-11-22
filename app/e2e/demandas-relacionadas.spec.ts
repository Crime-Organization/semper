// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Demandas relacionadas (#310). Na semente do banco fictício: "Registro de marca" (D3A1F09C, com o Bruno de colaborador) e "Busca de
// anterioridade" (7B42C0DE, sem o Bruno) são do contrato de JOSÉ DA SILVA TESTE; "Notificar o devedor" (A90E5B13) é avulsa, do Bruno
// (estagiário). Quem está logado é o Mauro (administrador).
import { expect, test, type Locator, type Page } from '@playwright/test';
import { abrirSecao, entrarComo } from './ajudantes';

const SECAO = 'Demandas relacionadas';

/** Abre o cartão de uma demanda pela tabela, com a seção das relacionadas aberta. */
async function abrirDemanda(page: Page, titulo: string) {
  await page.goto('/demandas/');
  await page.getByRole('button', { name: 'Tabela' }).click();
  await page.getByRole('row').filter({ hasText: titulo }).click();
  const cartao = page.getByRole('dialog');
  await expect(cartao.getByRole('heading', { name: titulo, level: 2 })).toBeVisible();
  await abrirSecao(cartao, SECAO);
  return cartao;
}
/** A lista das relacionadas, no cartão. */
const lista = (cartao: Locator) => cartao.getByRole('list', { name: SECAO });
/** Liga, pelo "Ligar demanda existente", a demanda achada pelo texto. */
async function relacionar(cartao: Locator, texto: string, achado: RegExp) {
  await cartao.getByRole('button', { name: 'Ligar demanda existente' }).click();
  await cartao.getByRole('textbox', { name: 'Buscar demanda para ligar' }).fill(texto);
  await cartao.getByRole('list', { name: 'Demandas para ligar' }).getByRole('button', { name: achado }).click();
}

test.describe('Demandas relacionadas', () => {
  test('quando liga uma demanda a outra, então cada uma mostra a outra com o número, e desfazer num cartão tira dos dois', async ({ page }) => {
    // Dado
    let cartao = await abrirDemanda(page, 'Registro de marca');
    await expect(cartao.getByText('Nenhuma demanda relacionada a esta.')).toBeVisible();
    // Quando
    await relacionar(cartao, 'anterioridade', /Busca de anterioridade/);
    // Então: aparece aqui, com o número, e o título da seção conta 1
    await expect(page.getByText('Demanda relacionada: 7B42C0DE.')).toBeVisible();
    await expect(lista(cartao).getByRole('link', { name: /Busca de anterioridade/ })).toContainText('7B42C0DE');
    await expect(cartao.getByRole('button', { name: `${SECAO} 1` })).toBeVisible();

    // Quando: abre a outra
    cartao = await abrirDemanda(page, 'Busca de anterioridade');
    // Então: a ligação aparece no outro sentido
    await expect(lista(cartao).getByRole('link', { name: /Registro de marca/ })).toContainText('D3A1F09C');
    // Quando: desfaz por este cartão
    await cartao.getByRole('button', { name: 'Desfazer a ligação com a demanda D3A1F09C' }).click();
    // Então: some daqui e da primeira
    await expect(cartao.getByText('Nenhuma demanda relacionada a esta.')).toBeVisible();
    await expect(cartao.getByRole('button', { name: `${SECAO} 0` })).toBeVisible();
    cartao = await abrirDemanda(page, 'Registro de marca');
    await expect(cartao.getByText('Nenhuma demanda relacionada a esta.')).toBeVisible();
  });

  test('quando a seção está recolhida, então o título dela mostra quantas relacionadas há', async ({ page }) => {
    // Dado
    let cartao = await abrirDemanda(page, 'Notificar o devedor');
    await relacionar(cartao, 'anterioridade', /Busca de anterioridade/);
    await expect(lista(cartao).getByRole('link', { name: /Busca de anterioridade/ })).toBeVisible();
    // Quando: recolhe a seção e abre o cartão de novo
    await cartao.getByRole('button', { name: `${SECAO} 1` }).click();
    await page.goto('/demandas/');
    await page.getByRole('button', { name: 'Tabela' }).click();
    await page.getByRole('row').filter({ hasText: 'Notificar o devedor' }).click();
    cartao = page.getByRole('dialog');
    // Então
    const titulo = cartao.getByRole('button', { name: `${SECAO} 1` });
    await expect(titulo).toHaveAttribute('aria-expanded', 'false');
  });

  test('dado quem não tem acesso à relacionada, quando abre a sua demanda, então vê que existe uma relacionada, com o número, sem o conteúdo', async ({ page }) => {
    // Dado: o Mauro liga "Busca de anterioridade" (sem o Bruno) à "Notificar o devedor" (do Bruno)
    const cartao = await abrirDemanda(page, 'Notificar o devedor');
    await relacionar(cartao, 'anterioridade', /Busca de anterioridade/);
    await expect(lista(cartao).getByRole('link', { name: /Busca de anterioridade/ })).toBeVisible();
    // Quando: o Bruno, com a visualização fechada (cada um vê só o que é seu), abre a demanda dele
    await page.goto('/inicio/');
    await page.evaluate(() => (window as unknown as { SEMPER_FALSO: { fecharVisibilidade(l: boolean): void } }).SEMPER_FALSO.fecharVisibilidade(true));
    await entrarComo(page, 'u-bruno');
    const doBruno = await abrirDemanda(page, 'Notificar o devedor');
    // Então: o número e o aviso, sem o título e sem o link
    await expect(lista(doBruno)).toContainText('7B42C0DE');
    await expect(lista(doBruno)).toContainText('Você não tem acesso a esta demanda');
    await expect(lista(doBruno)).not.toContainText('Busca de anterioridade');
    await expect(lista(doBruno).getByRole('link')).toHaveCount(0);
    await expect(doBruno.getByRole('button', { name: `${SECAO} 1` })).toBeVisible();
  });
});
