// Padrão dos testes (Dado / Quando / Então): veja app/TESTES.md.
// Menções de itens pelo código nos comentários, com ! (#297). No banco fictício, quem está logado é o Mauro (administrador); a Ana é
// advogada e o Bruno, estagiário. A tarefa C0FFEE12 ("Emitir a GRU") é do Mauro; a F00D1234 ("Renovar a procuração") é da Ana, e o
// Bruno não está nela.
import { expect, test, type Locator, type Page } from '@playwright/test';
import { abrirSecao, entrarComo } from './ajudantes';

/** Abre o cartão do JOSÉ, com a seção de comentários aberta, e devolve o cartão. */
async function abrirOJose(page: Page) {
  await page.goto('/pessoas/');
  await page.getByRole('button', { name: 'Tabela' }).click();
  await page.getByRole('row').filter({ hasText: 'JOSÉ DA SILVA TESTE' }).click();
  const cartao = page.getByRole('dialog');
  await abrirSecao(cartao, 'Comentários');
  return cartao;
}
const doCartao = (cartao: Locator) => cartao.getByRole('listitem', { name: /Comentário de/ });

test.describe('Menções de itens com !', () => {
  test('quando a pessoa digita ! e parte do título, escolhe a tarefa e comenta, então o código vira um atalho que abre o cartão dela', async ({ page }) => {
    // Dado
    const cartao = await abrirOJose(page);
    const caixa = cartao.getByRole('textbox', { name: 'Escrever um comentário' });
    // Quando
    await caixa.pressSequentially('Antes, fazer !emiti');
    await cartao.getByRole('option', { name: /Emitir a GRU/ }).click();
    // Então: o código entra no texto, já em destaque enquanto se digita
    await expect(caixa).toHaveValue('Antes, fazer !C0FFEE12 ');
    await expect(cartao.getByText('!C0FFEE12', { exact: true })).toBeVisible();
    // Quando
    await cartao.getByRole('button', { name: 'Comentar' }).click();
    const atalho = doCartao(cartao).first().getByRole('link', { name: 'Abrir Tarefa C0FFEE12: Emitir a GRU' });
    await expect(atalho).toContainText('!C0FFEE12 Emitir a GRU');
    await atalho.click();
    // Então
    await expect(page).toHaveURL(/\/tarefas\/\?id=/);
    await expect(page.getByRole('dialog')).toContainText('Emitir a GRU');
  });

  test('quando a pessoa escreve "Urgente!" ou um ! seguido de espaço, então nenhuma lista abre', async ({ page }) => {
    // Dado
    const cartao = await abrirOJose(page);
    const caixa = cartao.getByRole('textbox', { name: 'Escrever um comentário' });
    // Quando
    await caixa.pressSequentially('Urgente! Veja ! isto');
    // Então
    await expect(caixa).toHaveValue('Urgente! Veja ! isto');
    await expect(cartao.getByRole('listbox')).toHaveCount(0);
  });

  test('dado um comentário com uma tarefa que o Bruno não vê e um código que não existe, quando ele lê, então vê só os códigos, sem título e sem atalho', async ({ page }) => {
    // Dado
    let cartao = await abrirOJose(page);
    await cartao.getByRole('textbox', { name: 'Escrever um comentário' }).fill('Ver !F00D1234 e !ABCDEF12 hoje');
    await cartao.getByRole('button', { name: 'Comentar' }).click();
    await expect(doCartao(cartao).first().getByRole('link', { name: 'Abrir Tarefa F00D1234: Renovar a procuração' })).toBeVisible();
    // Quando
    await entrarComo(page, 'u-bruno');
    cartao = await abrirOJose(page);
    // Então
    const comentario = doCartao(cartao).filter({ hasText: 'Ver !F00D1234' });
    await expect(comentario).toContainText('!F00D1234 · sem acesso ou excluído');
    await expect(comentario).toContainText('!ABCDEF12 · sem acesso ou excluído');
    await expect(comentario).not.toContainText('Renovar a procuração');
    await expect(comentario.getByRole('link')).toHaveCount(0);
  });

  test('dado um comentário que menciona a Ana e uma tarefa, quando ela abre a caixa de Mensagens, então as duas menções vêm em destaque no trecho', async ({ page }) => {
    // Dado
    const cartao = await abrirOJose(page);
    await cartao.getByRole('textbox', { name: 'Escrever um comentário' }).fill('Fazer !C0FFEE12 com @ana.lima amanhã');
    await cartao.getByRole('button', { name: 'Comentar' }).click();
    await expect(doCartao(cartao).first()).toContainText('Fazer !C0FFEE12');
    // Quando
    await entrarComo(page, 'u-ana');
    await page.goto('/mensagens/');
    // Então
    const mensagem = page.getByRole('listitem', { name: /Mensagem não lida de/ }).filter({ hasText: 'Fazer !C0FFEE12' });
    await expect(mensagem.getByText('@ana.lima', { exact: true })).toHaveAttribute('title', 'Ana Teste Lima');
    await expect(mensagem.getByText('!C0FFEE12', { exact: true })).toHaveAttribute('title', 'Item mencionado');
  });
});
