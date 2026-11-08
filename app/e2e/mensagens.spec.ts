// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Caixa de mensagens (#112). No banco fictício, quem está logado é o Mateus; a Ana é advogada e o Bruno, estagiário.
import { expect, test, type Page } from '@playwright/test';
import { abrir, abrirSecao, entrarComo } from './ajudantes';

const menu = (page: Page) => page.getByRole('navigation', { name: 'Seções' });

/** Comenta no cartão do JOSÉ, como o Mateus. */
async function comentar(page: Page, texto: string) {
  await page.goto('/pessoas/');
  await page.getByRole('button', { name: 'Tabela' }).click();
  await page.getByRole('row').filter({ hasText: 'JOSÉ DA SILVA TESTE' }).click();
  const cartao = page.getByRole('dialog');
  await abrirSecao(cartao, 'Comentários');
  await cartao.getByRole('textbox', { name: 'Escrever um comentário' }).fill(texto);
  await cartao.getByRole('button', { name: 'Comentar' }).click();
  await expect(cartao.getByRole('listitem', { name: /Comentário de/ }).first()).toContainText(texto);
}

test.describe('Caixa de mensagens', () => {
  test('quando alguém é marcado com @, então vê o número no menu, abre o cartão no comentário, e a mensagem fica lida', async ({ page }) => {
    // Dado
    await comentar(page, 'Pedir documentos, @ana.lima até sexta');
    await entrarComo(page, 'u-ana');
    await page.goto('/inicio/');
    await expect(menu(page).getByRole('link', { name: 'Mensagens, 1 não lida' })).toBeVisible();
    // Quando
    await menu(page).getByRole('link', { name: /^Mensagens/ }).click();
    const mensagem = page.getByRole('listitem', { name: /Mensagem não lida de/ });
    await expect(mensagem).toContainText('citou você em pessoa JOSÉ DA SILVA TESTE');
    await expect(mensagem).toContainText('Pedir documentos, @ana.lima até sexta');
    await mensagem.getByRole('link').click();
    // Então: o cartão abre no comentário, destacado, e o contador zera
    const cartao = page.getByRole('dialog');
    await expect(cartao.getByRole('listitem', { name: /Comentário de/ }).filter({ hasText: 'Pedir documentos' })).toHaveAttribute('aria-current', 'true');
    await expect(menu(page).getByRole('link', { name: 'Mensagens', exact: true })).toBeVisible();
  });

  test('quando a pessoa pede para marcar todas como lidas, então o contador zera e o botão some', async ({ page }) => {
    // Dado
    await comentar(page, 'Primeira, @ana.lima até sexta');
    await comentar(page, 'Segunda, @ana.lima até sexta');
    await entrarComo(page, 'u-ana');
    await page.goto('/mensagens/');
    await expect(menu(page).getByRole('link', { name: 'Mensagens, 2 não lidas' })).toBeVisible();
    // Quando
    await page.getByRole('button', { name: 'Marcar todas como lidas' }).click();
    // Então
    await expect(menu(page).getByRole('link', { name: 'Mensagens', exact: true })).toBeVisible();
    await expect(page.getByRole('listitem', { name: /Mensagem lida de/ })).toHaveCount(2);
    await expect(page.getByRole('button', { name: 'Marcar todas como lidas' })).toHaveCount(0);
  });

  test('quando a pessoa marca uma mensagem como lida, então só ela deixa de contar', async ({ page }) => {
    // Dado
    await comentar(page, 'Primeira, @ana.lima até sexta');
    await comentar(page, 'Segunda, @ana.lima até sexta');
    await entrarComo(page, 'u-ana');
    await page.goto('/mensagens/');
    // Quando
    await page.getByRole('button', { name: /Marcar como lida a mensagem/ }).first().click();
    // Então
    await expect(menu(page).getByRole('link', { name: 'Mensagens, 1 não lida' })).toBeVisible();
    await expect(page.getByRole('listitem', { name: /Mensagem não lida de/ })).toHaveCount(1);
  });

  test('quando outra pessoa abre a caixa, então não vê a mensagem de quem foi marcado', async ({ page }) => {
    // Dado
    await comentar(page, 'Só para a Ana, @ana.lima até sexta');
    // Quando
    await entrarComo(page, 'u-bruno');
    await abrir(page, 'Mensagens');
    // Então
    await expect(page.getByText('Nenhuma mensagem.', { exact: false })).toBeVisible();
  });
});
