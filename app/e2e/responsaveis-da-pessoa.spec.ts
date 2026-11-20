// Os responsáveis da pessoa no topo do cartão (#387): em bolinhas, como a equipe dos outros cartões, todos iguais, sem um
// principal; o "+" põe mais um e a bolinha tira, com o aviso e o Desfazer. A seção "Responsáveis" do corpo saiu.
// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md. Na semente do banco fictício, quem está logado é o Mateus
// (master), e o José da Silva Teste tem dois responsáveis: o Mateus e o Bruno.
import { expect, test, type Page } from '@playwright/test';
import { acaoNoMenuDoCartao } from './ajudantes';

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
    await expect(equipe.getByRole('button', { name: 'Deixar de ser responsável (Mateus Freitas Gonçalves)' })).toBeVisible();
    await expect(equipe.getByRole('button', { name: 'Tirar Bruno Exemplo Souza dos responsáveis' })).toHaveAttribute('data-dica', 'Tirar Bruno Exemplo Souza dos responsáveis');
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
    await expect(equipe.getByRole('button', { name: 'Tirar Ana Teste Lima dos responsáveis' })).toBeVisible();
    await expect(page.getByText('Ana Teste Lima agora é responsável.')).toBeVisible();
    // Quando
    await page.getByRole('button', { name: 'Desfazer' }).click();
    // Então
    await expect(equipe.getByRole('button', { name: 'Tirar Ana Teste Lima dos responsáveis' })).toHaveCount(0);
  });

  test('quando a pessoa clica na bolinha de um responsável, então ele sai, com o aviso e o Desfazer que o põe de volta', async ({ page }) => {
    // Dado
    const cartao = await abrirJose(page);
    const equipe = cartao.getByRole('group', { name: 'Equipe', exact: true });
    // Quando
    await equipe.getByRole('button', { name: 'Tirar Bruno Exemplo Souza dos responsáveis' }).click();
    // Então
    await expect(page.getByText('Bruno Exemplo Souza saiu dos responsáveis.')).toBeVisible();
    await expect(equipe.getByRole('button', { name: 'Tirar Bruno Exemplo Souza dos responsáveis' })).toHaveCount(0);
    // Quando
    await page.getByRole('button', { name: 'Desfazer' }).click();
    // Então
    await expect(equipe.getByRole('button', { name: 'Tirar Bruno Exemplo Souza dos responsáveis' })).toBeVisible();
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
