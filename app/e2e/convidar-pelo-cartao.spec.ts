// Convidar para a equipe pelo cartão da pessoa (#327): o administrador abre uma pessoa física com e-mail e, no ⋯, "Convidar para a
// equipe" leva ao convite da tela Equipe, já com a pessoa e o e-mail. Quem já é da equipe tem o selo "Da equipe", que leva à
// Equipe. Quem não é administrador não vê a ação.
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Na semente do banco fictício, quem está logado é o Mauro
// (master); o José da Silva Teste é pessoa física com e-mail (pessoa0@exemplo.com) e não é da equipe; a Ana Teste Lima é.
import { expect, test, type Locator, type Page } from '@playwright/test';
import { acoesNoMenuDoCartao, entrarComo, menuDoCartao } from './ajudantes';

/** Abre o cartão de uma pessoa pela tabela de Pessoas. */
async function abrirPessoa(page: Page, nome: string) {
  await page.goto('/pessoas/');
  await page.getByRole('button', { name: 'Tabela', exact: true }).click();
  await page.getByRole('row').filter({ hasText: nome }).first().getByText(nome).first().click();
  const cartao = page.getByRole('dialog').filter({ has: page.getByRole('heading', { level: 2, name: nome }) });
  await expect(cartao.getByRole('heading', { level: 2 })).toBeVisible();
  return cartao;
}

/** Escolhe "Convidar para a equipe" no ⋯ do cartão. */
async function convidarPeloCartao(page: Page, cartao: Locator) {
  const mais = menuDoCartao(cartao);
  const nome = await mais.getAttribute('aria-label');
  await mais.click();
  await page.getByRole('menu', { name: nome ?? undefined }).getByRole('menuitem', { name: 'Convidar para a equipe' }).click();
}

test.describe('Convidar para a equipe pelo cartão da pessoa', () => {
  test('dado o cartão de uma pessoa física com e-mail, quando o administrador clica em "Convidar para a equipe", então o convite da Equipe abre já com a pessoa e o e-mail, e sai como lá', async ({ page }) => {
    // Dado
    const cartao = await abrirPessoa(page, 'JOSÉ DA SILVA TESTE');
    // Quando
    await convidarPeloCartao(page, cartao);
    // Então
    await expect(page).toHaveURL(/\/equipe\/$/);
    const convite = page.getByRole('region', { name: 'Dar acesso a uma pessoa' });
    await expect(convite.getByText('JOSÉ DA SILVA TESTE')).toBeVisible();
    await expect(convite.getByLabel('E-mail de acesso')).toHaveValue('pessoa0@exemplo.com');
    await expect(convite.getByLabel('E-mail de acesso')).toBeFocused();
    await convite.getByRole('button', { name: 'Liberar acesso' }).click();
    await expect(convite.getByText('Acesso liberado para', { exact: false })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Convites pendentes' })).toContainText('pessoa0@exemplo.com');
  });

  test('dada uma pessoa com convite pendente, quando o cartão abre, então mostra "Convite enviado" e o ⋯ não convida de novo', async ({ page }) => {
    // Dado
    await convidarPeloCartao(page, await abrirPessoa(page, 'JOSÉ DA SILVA TESTE'));
    const convite = page.getByRole('region', { name: 'Dar acesso a uma pessoa' });
    await expect(convite.getByLabel('E-mail de acesso')).toHaveValue('pessoa0@exemplo.com');
    await convite.getByRole('button', { name: 'Liberar acesso' }).click();
    await expect(convite.getByText('Acesso liberado para', { exact: false })).toBeVisible();
    // Quando
    const cartao = await abrirPessoa(page, 'JOSÉ DA SILVA TESTE');
    // Então
    await expect(cartao.getByRole('link', { name: 'Convite enviado' })).toBeVisible();
    expect(await acoesNoMenuDoCartao(page, cartao)).not.toContain('Convidar para a equipe');
  });

  test('dada uma pessoa que já é usuário, quando o cartão abre, então mostra que ela é da equipe, com o link para a Equipe', async ({ page }) => {
    // Dado
    const cartao = await abrirPessoa(page, 'ANA TESTE LIMA');
    // Quando
    await cartao.getByRole('link', { name: 'Da equipe' }).click();
    // Então
    await expect(page).toHaveURL(/\/equipe\/$/);
    await expect(page.getByRole('heading', { level: 1, name: /Equipe e acessos/ })).toBeVisible();
  });

  test('dada uma pessoa que já é usuário, quando o administrador abre o ⋯, então não há "Convidar para a equipe"', async ({ page }) => {
    // Dado
    const cartao = await abrirPessoa(page, 'ANA TESTE LIMA');
    // Quando
    const acoes = await acoesNoMenuDoCartao(page, cartao);
    // Então
    expect(acoes).not.toContain('Convidar para a equipe');
  });

  test('dado um usuário comum, quando abre o cartão de uma pessoa física com e-mail, então não vê a ação de convidar', async ({ page }) => {
    // Dado
    await entrarComo(page, 'u-bruno');
    const cartao = await abrirPessoa(page, 'JOSÉ DA SILVA TESTE');
    // Quando
    const acoes = await acoesNoMenuDoCartao(page, cartao);
    // Então
    expect(acoes).not.toContain('Convidar para a equipe');
  });

  test('dado um usuário comum, quando abre o cartão de quem é da equipe, então vê o selo "Da equipe", sem link (a Equipe é só da administração)', async ({ page }) => {
    // Dado
    await entrarComo(page, 'u-bruno');
    // Quando
    const cartao = await abrirPessoa(page, 'BRUNO EXEMPLO SOUZA');
    // Então
    await expect(cartao.getByText('Da equipe', { exact: true })).toBeVisible();
    await expect(cartao.getByRole('link', { name: 'Da equipe' })).toHaveCount(0);
  });
});
