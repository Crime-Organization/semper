// Os responsáveis da pessoa no topo do cartão (#387): em bolinhas, como a equipe dos outros cartões, todos iguais, sem um
// principal; o "+" põe mais um e o menu da bolinha (#388) tira ou abre o perfil, com o aviso e o Desfazer. A seção "Responsáveis"
// do corpo saiu.
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Na semente do banco fictício, quem está logado é o Mateus
// (master), e o José da Silva Teste tem dois responsáveis: o Mateus e o Bruno.
import { expect, test, type Page } from '@playwright/test';
import { abrirMenuDaBolinha, acaoDaBolinha, acaoNoMenuDoCartao } from './ajudantes';

/** Abre o cartão do José pela tabela de Pessoas. */
async function abrirJose(page: Page) {
  await page.goto('/pessoas/');
  await page.getByRole('button', { name: 'Tabela', exact: true }).click();
  await page.getByRole('row').filter({ hasText: 'JOSÉ DA SILVA TESTE' }).first().getByText('JOSÉ DA SILVA TESTE').first().click();
  const cartao = page.getByRole('dialog').filter({ has: page.getByRole('heading', { level: 2, name: 'JOSÉ DA SILVA TESTE' }) });
  await expect(cartao.getByRole('heading', { level: 2 })).toBeVisible();
  return cartao;
}

test.describe('Responsáveis da pessoa no topo do cartão', () => {
  test('dada uma pessoa com dois responsáveis, quando o cartão abre, então os dois aparecem em bolinhas no topo, com o nome na dica, e não há a seção "Responsáveis"', async ({ page }) => {
    // Quando
    const cartao = await abrirJose(page);
    // Então
    const equipe = cartao.getByRole('group', { name: 'Equipe', exact: true });
    await expect(equipe.getByRole('button', { name: 'Mateus Freitas Gonçalves, Responsável', exact: true })).toBeVisible();
    await expect(equipe.getByRole('button', { name: 'Bruno Exemplo Souza, Responsável', exact: true })).toHaveAttribute('data-dica', 'Bruno Exemplo Souza · Responsável');
    const topo = (await equipe.boundingBox())!, titulo = (await cartao.getByRole('heading', { level: 2 }).boundingBox())!;
    expect(topo.y + topo.height).toBeLessThanOrEqual(titulo.y);
    await expect(cartao.getByRole('heading', { name: 'Responsáveis' })).toHaveCount(0);
  });

  test('dado o "+" no topo, quando a pessoa escolhe alguém da equipe, então ele passa a ser responsável e aparece o aviso com Desfazer', async ({ page }) => {
    // Dado
    const cartao = await abrirJose(page);
    const equipe = cartao.getByRole('group', { name: 'Equipe', exact: true });
    // Quando
    await equipe.getByRole('button', { name: 'Pôr responsável' }).click();
    await page.getByRole('dialog', { name: 'Pôr responsável' }).getByRole('button', { name: 'Ana Teste Lima' }).click();
    // Então
    await expect(equipe.getByRole('button', { name: 'Ana Teste Lima, Responsável', exact: true })).toBeVisible();
    await expect(page.getByText('Ana Teste Lima agora é responsável.')).toBeVisible();
    // Quando
    await page.getByRole('button', { name: 'Desfazer' }).click();
    // Então
    await expect(equipe.getByRole('button', { name: 'Ana Teste Lima, Responsável', exact: true })).toHaveCount(0);
  });

  test('quando a pessoa clica na bolinha de um responsável, então abre o menu dele, sem "Tornar" nem "Trocar"; na própria bolinha, "Deixar de ser responsável"', async ({ page }) => {
    // Dado
    const cartao = await abrirJose(page);
    // Quando
    let menu = await abrirMenuDaBolinha(page, cartao, 'Bruno Exemplo Souza, Responsável');
    // Então: a pessoa não tem responsável principal, e ninguém sai só por abrir o menu
    await expect(menu.getByRole('menuitem')).toHaveText(['Tirar dos responsáveis', 'Ver perfil']);
    await expect(page.getByText('Bruno Exemplo Souza saiu dos responsáveis.')).toHaveCount(0);
    // Quando
    await page.keyboard.press('Escape');
    menu = await abrirMenuDaBolinha(page, cartao, 'Mateus Freitas Gonçalves, Responsável');
    // Então
    await expect(menu.getByRole('menuitem')).toHaveText(['Deixar de ser responsável', 'Ver perfil']);
  });

  test('quando a pessoa escolhe "Tirar dos responsáveis" no menu da bolinha de um, então ele sai, com o aviso e o Desfazer que o põe de volta', async ({ page }) => {
    // Dado
    const cartao = await abrirJose(page);
    const equipe = cartao.getByRole('group', { name: 'Equipe', exact: true });
    // Quando
    await acaoDaBolinha(page, cartao, 'Bruno Exemplo Souza, Responsável', 'Tirar dos responsáveis');
    // Então
    await expect(page.getByText('Bruno Exemplo Souza saiu dos responsáveis.')).toBeVisible();
    await expect(equipe.getByRole('button', { name: 'Bruno Exemplo Souza, Responsável', exact: true })).toHaveCount(0);
    // Quando
    await page.getByRole('button', { name: 'Desfazer' }).click();
    // Então
    await expect(equipe.getByRole('button', { name: 'Bruno Exemplo Souza, Responsável', exact: true })).toBeVisible();
  });

  test('dada uma pessoa arquivada, quando o cartão abre, então as bolinhas aparecem só para ver, sem "+"', async ({ page }) => {
    // Dado
    const cartao = await abrirJose(page);
    // Quando
    await acaoNoMenuDoCartao(page, cartao, 'Arquivar');
    // Então
    const equipe = cartao.getByRole('group', { name: 'Equipe', exact: true });
    await expect(equipe.getByRole('img', { name: 'Bruno Exemplo Souza, Responsável' })).toBeVisible();
    await expect(equipe.getByRole('img', { name: 'Mateus Freitas Gonçalves, Responsável' })).toBeVisible();
    await expect(equipe.getByRole('button')).toHaveCount(0);
  });
});
